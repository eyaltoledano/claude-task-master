import fs from 'fs';
import path from 'path';

import {
	getTagAwareFilePath,
	isSilentMode,
	log,
	readJSON,
	writeJSON
} from '../utils.js';

import {
	displayAiUsageSummary,
	startLoadingIndicator,
	stopLoadingIndicator
} from '../ui.js';

import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js';
import { generateObjectService } from '../ai-services-unified.js';

import {
	getDefaultSubtasks,
	getDebugFlag,
	hasCodebaseAnalysis
} from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import { findProjectRoot, flattenTasksWithSubtasks } from '../utils.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';

/**
 * Expand a task into subtasks using the unified AI service (generateObjectService).
 * Appends new subtasks by default. Replaces existing subtasks if force=true.
 * Integrates complexity report to determine subtask count and prompt if available,
 * unless numSubtasks is explicitly provided.
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} taskId - Task ID to expand
 * @param {number | null | undefined} [numSubtasks] - Optional: Explicit target number of subtasks. If null/undefined, check complexity report or config default.
 * @param {boolean} [useResearch=false] - Whether to use the research AI role.
 * @param {string} [additionalContext=''] - Optional additional context.
 * @param {Object} context - Context object containing session and mcpLog.
 * @param {Object} [context.session] - Session object from MCP.
 * @param {Object} [context.mcpLog] - MCP logger object.
 * @param {string} [context.projectRoot] - Project root path
 * @param {string} [context.tag] - Tag for the task
 * @param {boolean} [force=false] - If true, replace existing subtasks; otherwise, append.
 * @returns {Promise<Object>} The updated parent task object with new subtasks.
 * @throws {Error} If task not found, AI service fails, or parsing fails.
 */
async function expandTask(
	tasksPath,
	taskId,
	numSubtasks,
	useResearch = false,
	additionalContext = '',
	context = {},
	force = false
) {
	const {
		session,
		mcpLog,
		projectRoot: contextProjectRoot,
		tag,
		complexityReportPath
	} = context;
	const outputFormat = mcpLog ? 'json' : 'text';

	// Determine projectRoot: Use from context if available, otherwise derive from tasksPath
	const projectRoot = contextProjectRoot || findProjectRoot(tasksPath);

	// Use mcpLog if available, otherwise use the default console log wrapper
	const logger = mcpLog || {
		info: (msg) => !isSilentMode() && log('info', msg),
		warn: (msg) => !isSilentMode() && log('warn', msg),
		error: (msg) => !isSilentMode() && log('error', msg),
		debug: (msg) =>
			!isSilentMode() && getDebugFlag(session) && log('debug', msg) // Use getDebugFlag
	};

	if (mcpLog) {
		logger.info(`expandTask called with context: session=${!!session}`);
	}

	try {
		// --- Task Loading/Filtering (Unchanged) ---
		logger.info(`Reading tasks from ${tasksPath}`);
		const data = readJSON(tasksPath, projectRoot, tag);
		if (!data || !data.tasks)
			throw new Error(`Invalid tasks data in ${tasksPath}`);
		const taskIndex = data.tasks.findIndex(
			(t) => t.id === parseInt(taskId, 10)
		);
		if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);
		const task = data.tasks[taskIndex];
		logger.info(
			`Expanding task ${taskId}: ${task.title}${useResearch ? ' with research' : ''}`
		);
		// --- End Task Loading/Filtering ---

		// --- Handle Force Flag: Clear existing subtasks if force=true ---
		if (force && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
			logger.info(
				`Force flag set. Clearing existing ${task.subtasks.length} subtasks for task ${taskId}.`
			);
			task.subtasks = []; // Clear existing subtasks
		}
		// --- End Force Flag Handling ---

		// --- Context Gathering ---
		let gatheredContext = '';
		try {
			const contextGatherer = new ContextGatherer(projectRoot, tag);
			const allTasksFlat = flattenTasksWithSubtasks(data.tasks);
			const fuzzySearch = new FuzzyTaskSearch(allTasksFlat, 'expand-task');
			const searchQuery = `${task.title} ${task.description}`;
			const searchResults = fuzzySearch.findRelevantTasks(searchQuery, {
				maxResults: 5,
				includeSelf: true
			});
			const relevantTaskIds = fuzzySearch.getTaskIds(searchResults);

			const finalTaskIds = [
				...new Set([taskId.toString(), ...relevantTaskIds])
			];

			if (finalTaskIds.length > 0) {
				const contextResult = await contextGatherer.gather({
					tasks: finalTaskIds,
					format: 'research'
				});
				gatheredContext = contextResult.context || '';
			}
		} catch (contextError) {
			logger.warn(`Could not gather context: ${contextError.message}`);
		}
		// --- End Context Gathering ---

		// --- Complexity Report Integration ---
		let finalSubtaskCount;
		let complexityReasoningContext = '';
		let taskAnalysis = null;

		logger.info(
			`Looking for complexity report at: ${complexityReportPath}${tag !== 'master' ? ` (tag-specific for '${tag}')` : ''}`
		);

		try {
			if (fs.existsSync(complexityReportPath)) {
				const complexityReport = readJSON(complexityReportPath);
				taskAnalysis = complexityReport?.complexityAnalysis?.find(
					(a) => a.taskId === task.id
				);
				if (taskAnalysis) {
					logger.info(
						`Found complexity analysis for task ${task.id}: Score ${taskAnalysis.complexityScore}`
					);
					if (taskAnalysis.reasoning) {
						complexityReasoningContext = `\nComplexity Analysis Reasoning: ${taskAnalysis.reasoning}`;
					}
				} else {
					logger.info(
						`No complexity analysis found for task ${task.id} in report.`
					);
				}
			} else {
				logger.info(
					`Complexity report not found at ${complexityReportPath}. Skipping complexity check.`
				);
			}
		} catch (reportError) {
			logger.warn(
				`Could not read or parse complexity report: ${reportError.message}. Proceeding without it.`
			);
		}

		// Determine final subtask count
		const explicitNumSubtasks = parseInt(numSubtasks, 10);
		if (!Number.isNaN(explicitNumSubtasks) && explicitNumSubtasks >= 0) {
			finalSubtaskCount = explicitNumSubtasks;
			logger.info(
				`Using explicitly provided subtask count: ${finalSubtaskCount}`
			);
		} else if (taskAnalysis?.recommendedSubtasks) {
			finalSubtaskCount = parseInt(taskAnalysis.recommendedSubtasks, 10);
			logger.info(
				`Using subtask count from complexity report: ${finalSubtaskCount}`
			);
		} else {
			finalSubtaskCount = getDefaultSubtasks(session);
			logger.info(`Using default number of subtasks: ${finalSubtaskCount}`);
		}
		if (Number.isNaN(finalSubtaskCount) || finalSubtaskCount < 0) {
			logger.warn(
				`Invalid subtask count determined (${finalSubtaskCount}), defaulting to 3.`
			);
			finalSubtaskCount = 3;
		}

		// Determine prompt content AND system prompt
		// Calculate the next subtask ID to match current behavior:
		// - Start from the number of existing subtasks + 1
		// - This creates sequential IDs: 1, 2, 3, 4...
		// - Display format shows as parentTaskId.subtaskId (e.g., "1.1", "1.2", "2.1")
		const nextSubtaskId = (task.subtasks?.length || 0) + 1;

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		// Check if a codebase analysis provider is being used
		const hasCodebaseAnalysisCapability = hasCodebaseAnalysis(
			useResearch,
			projectRoot,
			session
		);

		// Combine all context sources into a single additionalContext parameter
		let combinedAdditionalContext = '';
		if (additionalContext || complexityReasoningContext) {
			combinedAdditionalContext =
				`\n\n${additionalContext}${complexityReasoningContext}`.trim();
		}
		if (gatheredContext) {
			combinedAdditionalContext =
				`${combinedAdditionalContext}\n\n# Project Context\n\n${gatheredContext}`.trim();
		}

		// Ensure expansionPrompt is a string (handle both string and object formats)
		let expansionPromptText = undefined;
		if (taskAnalysis?.expansionPrompt) {
			if (typeof taskAnalysis.expansionPrompt === 'string') {
				expansionPromptText = taskAnalysis.expansionPrompt;
			} else if (
				typeof taskAnalysis.expansionPrompt === 'object' &&
				taskAnalysis.expansionPrompt.text
			) {
				expansionPromptText = taskAnalysis.expansionPrompt.text;
			}
		}

		// Ensure gatheredContext is a string (handle both string and object formats)
		let gatheredContextText = gatheredContext;
		if (typeof gatheredContext === 'object' && gatheredContext !== null) {
			if (gatheredContext.data) {
				gatheredContextText = gatheredContext.data;
			} else if (gatheredContext.text) {
				gatheredContextText = gatheredContext.text;
			} else {
				gatheredContextText = JSON.stringify(gatheredContext);
			}
		}

		const promptParams = {
			task: task,
			subtaskCount: finalSubtaskCount,
			nextSubtaskId: nextSubtaskId,
			additionalContext: additionalContext,
			complexityReasoningContext: complexityReasoningContext,
			gatheredContext: gatheredContextText || '',
			useResearch: useResearch,
			expansionPrompt: expansionPromptText || undefined,
			hasCodebaseAnalysis: hasCodebaseAnalysisCapability,
			projectRoot: projectRoot || ''
		};
		let variantKey = 'default';
		if (expansionPromptText) {
			variantKey = 'complexity-report';
			logger.info(
				`Using expansion prompt from complexity report for task ${task.id}.`
			);
		} else if (useResearch) {
			variantKey = 'research';
			logger.info(`Using research variant for task ${task.id}.`);
		} else {
			logger.info(`Using standard prompt generation for task ${task.id}.`);
		}

		const { systemPrompt, userPrompt: promptContent } =
			await promptManager.loadPrompt('expand-task', promptParams, variantKey);

		// Debug logging to identify the issue
		logger.debug(`Selected variant: ${variantKey}`);
		logger.debug(
			`Prompt params passed: ${JSON.stringify(promptParams, null, 2)}`
		);
		logger.debug(
			`System prompt (first 500 chars): ${systemPrompt.substring(0, 500)}...`
		);
		logger.debug(
			`User prompt (first 500 chars): ${promptContent.substring(0, 500)}...`
		);
		// --- End Complexity Report / Prompt Logic ---

		// --- AI Subtask Generation using generateObjectService ---
		let generatedSubtasks = [];
		let loadingIndicator = null;
		if (outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator(
				`Generating ${finalSubtaskCount || 'appropriate number of'} subtasks...\n`
			);
		}

		let aiServiceResponse = null;
		try {
			const role = useResearch ? 'research' : 'main';

			// Call generateObjectService with the determined prompts and telemetry params
			aiServiceResponse = await generateObjectService({
				prompt: promptContent,
				systemPrompt: systemPrompt,
				role,
				session,
				projectRoot,
				schema: COMMAND_SCHEMAS['expand-task'],
				objectName: 'subtasks',
				commandName: 'expand-task',
				outputType: outputFormat
			});

			// With generateObject, we expect structured data – verify it before use
			const mainResult = aiServiceResponse?.mainResult;
			if (!mainResult || !Array.isArray(mainResult.subtasks)) {
				throw new Error('AI response did not include a valid subtasks array.');
			}
			generatedSubtasks = mainResult.subtasks;
			logger.info(`Received ${generatedSubtasks.length} subtasks from AI.`);
		} catch (error) {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
			logger.error(
				`Error during AI call or parsing for task ${taskId}: ${error.message}`, // Added task ID context
				'error'
			);
			throw error;
		} finally {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
		}

		// --- Task Update & File Writing ---
		// Ensure task.subtasks is an array before appending
		if (!Array.isArray(task.subtasks)) {
			task.subtasks = [];
		}
		// Append the newly generated and validated subtasks
		task.subtasks.push(...generatedSubtasks);
		// --- End Change: Append instead of replace ---

		data.tasks[taskIndex] = task; // Assign the modified task back
		writeJSON(tasksPath, data, projectRoot, tag);
		// await generateTaskFiles(tasksPath, path.dirname(tasksPath));

		// Display AI Usage Summary for CLI
		if (
			outputFormat === 'text' &&
			aiServiceResponse &&
			aiServiceResponse.telemetryData
		) {
			displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
		}

		// Return the updated task object AND telemetry data
		return {
			task,
			telemetryData: aiServiceResponse?.telemetryData,
			tagInfo: aiServiceResponse?.tagInfo
		};
	} catch (error) {
		// Catches errors from file reading, parsing, AI call etc.
		logger.error(`Error expanding task ${taskId}: ${error.message}`, 'error');
		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.error(error); // Log full stack in debug CLI mode
		}
		throw error; // Re-throw for the caller
	}
}

export default expandTask;
