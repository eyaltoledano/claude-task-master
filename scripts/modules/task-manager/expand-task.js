import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { z } from 'zod';

import { log, readJSON, writeJSON, isSilentMode } from '../utils.js';

import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import {
	generateTextService,
	streamTextService
} from '../ai-services-unified.js';
import { parseStream } from '../../../src/utils/stream-parser.js';
import { createExpandTracker } from '../../../src/progress/expand-tracker.js';
import {
	displayExpandStart,
	displayExpandSummary
} from '../../../src/ui/expand.js';

import { getDefaultSubtasks, getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { flattenTasksWithSubtasks, findProjectRoot } from '../utils.js';

/**
 * Helper function to detect if expandTask is being called from expandAllTasks
 * @returns {boolean} True if called from expand-all-tasks
 */
function isCalledFromExpandAll() {
	const stack = new Error().stack;
	return stack.includes('expandAllTasks') || stack.includes('expand-all-tasks');
}

// --- Zod Schemas (Keep from previous step) ---
const subtaskSchema = z
	.object({
		id: z
			.number()
			.int()
			.positive()
			.describe('Sequential subtask ID starting from 1'),
		title: z.string().min(5).describe('Clear, specific title for the subtask'),
		description: z
			.string()
			.min(10)
			.describe('Detailed description of the subtask'),
		dependencies: z
			.array(z.number().int())
			.describe('IDs of prerequisite subtasks within this expansion'),
		details: z.string().min(20).describe('Implementation details and guidance'),
		status: z
			.string()
			.describe(
				'The current status of the subtask (should be pending initially)'
			),
		testStrategy: z
			.string()
			.nullable()
			.describe('Approach for testing this subtask')
			.default('')
	})
	.strict();
const subtaskArraySchema = z.array(subtaskSchema);
const subtaskWrapperSchema = z.object({
	subtasks: subtaskArraySchema.describe('The array of generated subtasks.')
});
// --- End Zod Schemas ---

/**
 * Generates the system prompt for the main AI role (e.g., Claude).
 * @param {number} subtaskCount - The target number of subtasks.
 * @returns {string} The system prompt.
 */
function generateMainSystemPrompt(subtaskCount) {
	return `You are an AI assistant helping with task breakdown for software development.
You need to break down a high-level task into ${subtaskCount} specific subtasks that can be implemented one by one.

Subtasks should:
1. Be specific and actionable implementation steps
2. Follow a logical sequence
3. Each handle a distinct part of the parent task
4. Include clear guidance on implementation approach
5. Have appropriate dependency chains between subtasks (using the new sequential IDs)
6. Collectively cover all aspects of the parent task

For each subtask, provide:
- id: Sequential integer starting from the provided nextSubtaskId
- title: Clear, specific title
- description: Detailed description
- dependencies: Array of prerequisite subtask IDs (use the new sequential IDs)
- details: Implementation details
- testStrategy: Optional testing approach


Respond ONLY with a valid JSON object containing a single key "subtasks" whose value is an array matching the structure described. Do not include any explanatory text, markdown formatting, or code block markers.

CRITICAL: Your response must start with { and end with }. Do not wrap the JSON in \`\`\`json\`\`\` or any other formatting.`;
}

/**
 * Generates the user prompt for the main AI role (e.g., Claude).
 * @param {Object} task - The parent task object.
 * @param {number} subtaskCount - The target number of subtasks.
 * @param {string} additionalContext - Optional additional context.
 * @param {number} nextSubtaskId - The starting ID for the new subtasks.
 * @returns {string} The user prompt.
 */
function generateMainUserPrompt(
	task,
	subtaskCount,
	additionalContext,
	nextSubtaskId
) {
	const contextPrompt = additionalContext
		? `\n\nAdditional context: ${additionalContext}`
		: '';
	const schemaDescription = `
{
  "subtasks": [
    {
      "id": ${nextSubtaskId}, // First subtask ID
      "title": "Specific subtask title",
      "description": "Detailed description",
      "dependencies": [], // e.g., [${nextSubtaskId + 1}] if it depends on the next
      "details": "Implementation guidance",
      "testStrategy": "Optional testing approach"
    },
    // ... (repeat for a total of ${subtaskCount} subtasks with sequential IDs)
  ]
}`;

	return `Break down this task into exactly ${subtaskCount} specific subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || 'None'}
${contextPrompt}

Return ONLY the JSON object containing the "subtasks" array, matching this structure:
${schemaDescription}`;
}

/**
 * Generates the user prompt for the research AI role (e.g., Perplexity).
 * @param {Object} task - The parent task object.
 * @param {number} subtaskCount - The target number of subtasks.
 * @param {string} additionalContext - Optional additional context.
 * @param {number} nextSubtaskId - The starting ID for the new subtasks.
 * @returns {string} The user prompt.
 */
function generateResearchUserPrompt(
	task,
	subtaskCount,
	additionalContext,
	nextSubtaskId
) {
	const contextPrompt = additionalContext
		? `\n\nConsider this context: ${additionalContext}`
		: '';
	const schemaDescription = `
{
  "subtasks": [
    {
      "id": <number>, // Sequential ID starting from ${nextSubtaskId}
      "title": "<string>",
      "description": "<string>",
      "dependencies": [<number>], // e.g., [${nextSubtaskId + 1}]. If no dependencies, use an empty array [].
      "details": "<string>",
      "testStrategy": "<string>" // Optional
    },
    // ... (repeat for ${subtaskCount} subtasks)
  ]
}`;

	return `Analyze the following task and break it down into exactly ${subtaskCount} specific subtasks using your research capabilities. Assign sequential IDs starting from ${nextSubtaskId}.

Parent Task:
ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Current details: ${task.details || 'None'}
${contextPrompt}

CRITICAL: Respond ONLY with a valid JSON object containing a single key "subtasks". The value must be an array of the generated subtasks, strictly matching this structure:
${schemaDescription}

Important: For the 'dependencies' field, if a subtask has no dependencies, you MUST use an empty array, for example: "dependencies": []. Do not use null or omit the field.

Do not include ANY explanatory text, markdown, or code block markers. Just the JSON object.`;
}

/**
 * Parse subtasks from AI's text response. Includes basic cleanup.
 * @param {string} text - Response text from AI.
 * @param {number} startId - Starting subtask ID expected.
 * @param {number} expectedCount - Expected number of subtasks.
 * @param {number} parentTaskId - Parent task ID for context.
 * @param {Object} logger - Logging object (mcpLog or console log).
 * @returns {Array} Parsed and potentially corrected subtasks array.
 * @throws {Error} If parsing fails or JSON is invalid/malformed.
 */
function parseSubtasksFromText(
	text,
	startId,
	expectedCount,
	parentTaskId,
	logger
) {
	if (typeof text !== 'string') {
		logger.error(
			`AI response text is not a string. Received type: ${typeof text}, Value: ${text}`
		);
		throw new Error('AI response text is not a string.');
	}

	if (!text || text.trim() === '') {
		throw new Error('AI response text is empty after trimming.');
	}

	const originalTrimmedResponse = text.trim(); // Store the original trimmed response
	let jsonToParse = originalTrimmedResponse; // Initialize jsonToParse with it

	logger.debug(
		`Original AI Response for parsing (full length: ${jsonToParse.length}): ${jsonToParse.substring(0, 1000)}...`
	);

	// --- Pre-emptive cleanup for known AI JSON issues ---
	// Fix for "dependencies": , or "dependencies":,
	if (jsonToParse.includes('"dependencies":')) {
		const malformedPattern = /"dependencies":\s*,/g;
		if (malformedPattern.test(jsonToParse)) {
			logger.warn('Attempting to fix malformed "dependencies": , issue.');
			jsonToParse = jsonToParse.replace(
				malformedPattern,
				'"dependencies": [],'
			);
			logger.debug(
				`JSON after fixing "dependencies": ${jsonToParse.substring(0, 500)}...`
			);
		}
	}
	// --- End pre-emptive cleanup ---

	let parsedObject;
	let primaryParseAttemptFailed = false;

	// --- Attempt 1: Simple Parse (with optional Markdown cleanup) ---
	logger.debug('Attempting simple parse...');
	try {
		// Check for markdown code block
		const codeBlockMatch = jsonToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		let contentToParseDirectly = jsonToParse;
		if (codeBlockMatch && codeBlockMatch[1]) {
			contentToParseDirectly = codeBlockMatch[1].trim();
			logger.debug('Simple parse: Extracted content from markdown code block.');
		} else {
			logger.debug(
				'Simple parse: No markdown code block found, using trimmed original.'
			);
		}

		parsedObject = JSON.parse(contentToParseDirectly);
		logger.debug('Simple parse successful!');

		// Quick check if it looks like our target object
		if (
			!parsedObject ||
			typeof parsedObject !== 'object' ||
			!Array.isArray(parsedObject.subtasks)
		) {
			logger.warn(
				'Simple parse succeeded, but result is not the expected {"subtasks": []} structure. Will proceed to advanced extraction.'
			);
			primaryParseAttemptFailed = true;
			parsedObject = null; // Reset parsedObject so we enter the advanced logic
		}
		// If it IS the correct structure, we'll skip advanced extraction.
	} catch (e) {
		logger.warn(
			`Simple parse failed: ${e.message}. Proceeding to advanced extraction logic.`
		);
		primaryParseAttemptFailed = true;
		// jsonToParse is already originalTrimmedResponse if simple parse failed before modifying it for markdown
	}

	// --- Attempt 2: Advanced Extraction (if simple parse failed or produced wrong structure) ---
	if (primaryParseAttemptFailed || !parsedObject) {
		// Ensure we try advanced if simple parse gave wrong structure
		logger.debug('Attempting advanced extraction logic...');
		// Reset jsonToParse to the original full trimmed response for advanced logic
		jsonToParse = originalTrimmedResponse;

		// (Insert the more complex extraction logic here - the one we worked on with:
		//  - targetPattern = '{"subtasks":';
		//  - careful brace counting for that targetPattern
		//  - fallbacks to last '{' and '}' if targetPattern logic fails)
		//  This was the logic from my previous message. Let's assume it's here.
		//  This block should ultimately set `jsonToParse` to the best candidate string.

		// Example snippet of that advanced logic's start:
		const targetPattern = '{"subtasks":';
		const patternStartIndex = jsonToParse.indexOf(targetPattern);

		if (patternStartIndex !== -1) {
			const openBraces = 0;
			const firstBraceFound = false;
			const extractedJsonBlock = '';
			// ... (loop for brace counting as before) ...
			// ... (if successful, jsonToParse = extractedJsonBlock) ...
			// ... (if that fails, fallbacks as before) ...
		} else {
			// ... (fallback to last '{' and '}' if targetPattern not found) ...
		}
		// End of advanced logic excerpt

		logger.debug(
			`Advanced extraction: JSON string that will be parsed: ${jsonToParse.substring(0, 500)}...`
		);
		try {
			parsedObject = JSON.parse(jsonToParse);
			logger.debug('Advanced extraction parse successful!');
		} catch (parseError) {
			logger.error(
				`Advanced extraction: Failed to parse JSON object: ${parseError.message}`
			);
			logger.error(
				`Advanced extraction: Problematic JSON string for parse (first 500 chars): ${jsonToParse.substring(0, 500)}`
			);
			throw new Error(
				// Re-throw a more specific error if advanced also fails
				`Failed to parse JSON response object after both simple and advanced attempts: ${parseError.message}`
			);
		}
	}

	// --- Validation (applies to successfully parsedObject from either attempt) ---
	if (
		!parsedObject ||
		typeof parsedObject !== 'object' ||
		!Array.isArray(parsedObject.subtasks)
	) {
		logger.error(
			`Final parsed content is not an object or missing 'subtasks' array. Content: ${JSON.stringify(parsedObject).substring(0, 200)}`
		);
		throw new Error(
			'Parsed AI response is not a valid object containing a "subtasks" array after all attempts.'
		);
	}
	const parsedSubtasks = parsedObject.subtasks;

	if (expectedCount && parsedSubtasks.length !== expectedCount) {
		logger.warn(
			`Expected ${expectedCount} subtasks, but parsed ${parsedSubtasks.length}.`
		);
	}

	let currentId = startId;
	const validatedSubtasks = [];
	const validationErrors = [];

	for (const rawSubtask of parsedSubtasks) {
		const correctedSubtask = {
			...rawSubtask,
			id: currentId,
			dependencies: Array.isArray(rawSubtask.dependencies)
				? rawSubtask.dependencies
						.map((dep) => (typeof dep === 'string' ? parseInt(dep, 10) : dep))
						.filter(
							(depId) =>
								!Number.isNaN(depId) && depId >= startId && depId < currentId
						)
				: [],
			status: 'pending'
		};

		const result = subtaskSchema.safeParse(correctedSubtask);

		if (result.success) {
			validatedSubtasks.push(result.data);
		} else {
			logger.warn(
				`Subtask validation failed for raw data: ${JSON.stringify(rawSubtask).substring(0, 100)}...`
			);
			result.error.errors.forEach((err) => {
				const errorMessage = `  - Field '${err.path.join('.')}': ${err.message}`;
				logger.warn(errorMessage);
				validationErrors.push(`Subtask ${currentId}: ${errorMessage}`);
			});
		}
		currentId++;
	}

	if (validationErrors.length > 0) {
		logger.error(
			`Found ${validationErrors.length} validation errors in the generated subtasks.`
		);
		logger.warn('Proceeding with only the successfully validated subtasks.');
	}

	if (validatedSubtasks.length === 0 && parsedSubtasks.length > 0) {
		throw new Error(
			'AI response contained potential subtasks, but none passed validation.'
		);
	}
	return validatedSubtasks.slice(0, expectedCount || validatedSubtasks.length);
}

/**
 * Expand a task into subtasks using the unified AI service (generateTextService).
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
		parentTracker
	} = context;
	const outputFormat = mcpLog ? 'json' : 'text';
	const isChildExpansion = isCalledFromExpandAll();

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
		logger.debug(`Reading tasks from ${tasksPath}`);
		const data = readJSON(tasksPath, projectRoot, tag);
		if (!data || !data.tasks)
			throw new Error(`Invalid tasks data in ${tasksPath}`);
		const taskIndex = data.tasks.findIndex(
			(t) => t.id === parseInt(taskId, 10)
		);
		if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);
		const task = data.tasks[taskIndex];
		logger.debug(
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
			const contextGatherer = new ContextGatherer(projectRoot);
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
				gatheredContext = contextResult;
			}
		} catch (contextError) {
			logger.warn(`Could not gather context: ${contextError.message}`);
		}
		// --- End Context Gathering ---

		// --- Complexity Report Integration ---
		let finalSubtaskCount;
		let promptContent = '';
		let complexityReasoningContext = '';
		let systemPrompt = ''; // Initialize systemPrompt here

		const complexityReportPath = path.join(projectRoot, COMPLEXITY_REPORT_FILE);
		let taskAnalysis = null;

		try {
			if (fs.existsSync(complexityReportPath)) {
				const complexityReport = readJSON(complexityReportPath);
				taskAnalysis = complexityReport?.complexityAnalysis?.find(
					(a) => a.taskId === task.id
				);
				if (taskAnalysis) {
					logger.debug(
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
		if (!Number.isNaN(explicitNumSubtasks) && explicitNumSubtasks > 0) {
			finalSubtaskCount = explicitNumSubtasks;
			logger.debug(
				`Using explicitly provided subtask count: ${finalSubtaskCount}`
			);
		} else if (taskAnalysis?.recommendedSubtasks) {
			finalSubtaskCount = parseInt(taskAnalysis.recommendedSubtasks, 10);
			logger.debug(
				`Using subtask count from complexity report: ${finalSubtaskCount}`
			);
		} else {
			finalSubtaskCount = getDefaultSubtasks(session);
			logger.debug(`Using default number of subtasks: ${finalSubtaskCount}`);
		}
		if (Number.isNaN(finalSubtaskCount) || finalSubtaskCount <= 0) {
			logger.warn(
				`Invalid subtask count determined (${finalSubtaskCount}), defaulting to 3.`
			);
			finalSubtaskCount = 3;
		}

		// Determine prompt content AND system prompt
		const nextSubtaskId = (task.subtasks?.length || 0) + 1;

		if (taskAnalysis?.expansionPrompt) {
			// Use prompt from complexity report
			promptContent = taskAnalysis.expansionPrompt;
			// Append additional context and reasoning
			promptContent += `\n\n${additionalContext}`.trim();
			promptContent += `${complexityReasoningContext}`.trim();
			if (gatheredContext) {
				promptContent += `\n\n# Project Context\n\n${gatheredContext}`;
			}

			// --- Use Simplified System Prompt for Report Prompts ---
			systemPrompt = `You are an AI assistant helping with task breakdown. Generate exactly ${finalSubtaskCount} subtasks based on the provided prompt and context. Respond ONLY with a valid JSON object containing a single key "subtasks" whose value is an array of the generated subtask objects. Each subtask object in the array must have keys: "id", "title", "description", "dependencies", "details", "status". Ensure the 'id' starts from ${nextSubtaskId} and is sequential. Ensure 'dependencies' only reference valid prior subtask IDs generated in this response (starting from ${nextSubtaskId}). Ensure 'status' is 'pending'. Do not include any other text or explanation.

CRITICAL: Your response must start with { and end with }. Do not wrap the JSON in \`\`\`json\`\`\` or any other formatting.`;

			// --- End Simplified System Prompt ---
		} else {
			// Use standard prompt generation
			let combinedAdditionalContext =
				`${additionalContext}${complexityReasoningContext}`.trim();
			if (gatheredContext) {
				combinedAdditionalContext =
					`${combinedAdditionalContext}\n\n# Project Context\n\n${gatheredContext}`.trim();
			}

			if (useResearch) {
				promptContent = generateResearchUserPrompt(
					task,
					finalSubtaskCount,
					combinedAdditionalContext,
					nextSubtaskId
				);
				// Use the specific research system prompt if needed, or a standard one
				systemPrompt = `You are an AI assistant that responds ONLY with valid JSON objects as requested. The object should contain a 'subtasks' array.

CRITICAL: Your response must start with { and end with }. Do not wrap the JSON in \`\`\`json\`\`\` or any other formatting.`; // Or keep generateResearchSystemPrompt if it exists
			} else {
				promptContent = generateMainUserPrompt(
					task,
					finalSubtaskCount,
					combinedAdditionalContext,
					nextSubtaskId
				);
				// Use the original detailed system prompt for standard generation
				systemPrompt = generateMainSystemPrompt(finalSubtaskCount);
			}
			logger.info(`Using standard prompt generation for task ${task.id}.`);
		}
		// --- End Complexity Report / Prompt Logic ---

		// --- AI Subtask Generation ---
		let generatedSubtasks = [];
		let aiServiceResponse = null;

		// Determine if we should use streaming (same pattern as parse-prd)
		const isMCP = !!mcpLog;
		const reportProgress = context.reportProgress;
		const shouldUseStreaming =
			typeof reportProgress === 'function' || outputFormat === 'text';

		// Initialize progress tracker for CLI mode only (not MCP, and not child expansion)
		let progressTracker = null;
		if (outputFormat === 'text' && !isMCP && !isChildExpansion) {
			progressTracker = createExpandTracker({
				expandType: 'single',
				numTasks: finalSubtaskCount, // Track number of subtasks being generated
				taskId: task.id,
				taskTitle: task.title,
				taskPriority: task.priority
			});

			// Display header
			displayExpandStart({
				taskId: task.id,
				tasksFilePath: tasksPath,
				numSubtasks: finalSubtaskCount,
				explicitSubtasks: Boolean(numSubtasks),
				complexityScore: taskAnalysis?.complexityScore,
				hasComplexityAnalysis: Boolean(taskAnalysis),
				force: force,
				research: useResearch,
				expandType: 'single'
			});

			progressTracker.start();
		}

		// Estimate input tokens
		// Our prompts contain a mix of prose and JSON schemas/examples
		// Empirically, we see ~3-4 chars per token for this type of content
		const totalPromptLength = systemPrompt.length + promptContent.length;
		const estimatedInputTokens = Math.ceil(totalPromptLength / 3.5);

		// Debug logging to check our estimates
		logger.debug(
			`Prompt lengths - System: ${systemPrompt.length}, User: ${promptContent.length}, Total: ${totalPromptLength}`
		);
		logger.debug(`Estimated input tokens: ${estimatedInputTokens}`);

		// Report initial progress for MCP
		if (reportProgress) {
			await reportProgress({
				type: 'subtask_generation_start',
				progress: 0,
				current: 0,
				total: finalSubtaskCount,
				taskId: task.id,
				taskTitle: task.title,
				inputTokens: estimatedInputTokens,
				message: `Starting subtask generation for Task ${task.id}${useResearch ? ' with research' : ''}... (Input: ${estimatedInputTokens} tokens)`
			});
		}

		let loadingIndicator = null;
		try {
			const role = useResearch ? 'research' : 'main';

			if (shouldUseStreaming) {
				// Use streaming approach
				logger.debug(`Using streaming AI service for subtask generation...`);

				aiServiceResponse = await streamTextService({
					prompt: promptContent,
					systemPrompt: systemPrompt,
					role,
					session,
					projectRoot,
					commandName: 'expand-task',
					outputType: isMCP ? 'mcp' : 'cli'
				});

				const textStream = aiServiceResponse.mainResult;
				if (!textStream) {
					throw new Error('No text stream received from AI service');
				}

				// Create progress callback for parseStream
				const onProgress = async (subtask, metadata) => {
					const { currentCount, estimatedTokens } = metadata;

					// CLI progress tracker
					if (progressTracker) {
						// For single task expansion, update the progress bar directly
						progressTracker.progressBar.update(currentCount, {
							tasks: `${currentCount}/${finalSubtaskCount}`
						});

						// Track subtask generation for time estimation
						progressTracker.updateSubtaskGeneration(currentCount);

						// Update tokens with estimates during streaming (will be replaced with actuals later)
						if (estimatedTokens) {
							// estimatedTokens from parseStream is ONLY the output tokens (from accumulated response)
							// Use our pre-calculated input estimate
							const inputEstimate = estimatedInputTokens; // From our calculation above
							const outputEstimate = estimatedTokens; // This is already just output tokens

							// Show estimates with a ~ prefix to indicate they're not final
							progressTracker.updateTokens(inputEstimate, outputEstimate);
						}

						// Add the subtask to the table display
						const subtaskId = nextSubtaskId + currentCount - 1;
						progressTracker.addSubtaskLine(
							subtaskId,
							subtask.title || `Subtask ${currentCount}`
						);
					}

					// Update parent tracker if this is a child expansion
					if (parentTracker && isChildExpansion) {
						// Don't update token counts during streaming - wait for final telemetry
						// The estimated tokens during streaming are not accurate

						// Update subtask progress in parent
						parentTracker.updateCurrentTaskSubtaskProgress(currentCount);
					}

					// Call the onSubtaskProgress callback if provided (for MCP in expand-all)
					if (
						context.onSubtaskProgress &&
						typeof context.onSubtaskProgress === 'function'
					) {
						await context.onSubtaskProgress(currentCount);
					}

					// MCP progress reporting (following the pattern from parse-prd and analyze-complexity)
					if (reportProgress) {
						try {
							// Estimate output tokens for this subtask
							const outputTokens = estimatedTokens
								? Math.floor(estimatedTokens / finalSubtaskCount)
								: 0;

							await reportProgress({
								type: 'subtask_generation',
								current: currentCount,
								total: finalSubtaskCount,
								taskId: task.id,
								taskTitle: task.title,
								subtaskId: nextSubtaskId + currentCount - 1,
								subtaskTitle: subtask.title || `Subtask ${currentCount}`,
								inputTokens:
									metadata.estimatedInputTokens || estimatedInputTokens,
								outputTokens: outputTokens,
								message: `Generated subtask ${currentCount}/${finalSubtaskCount}: ${subtask.title || 'Processing...'}`
							});
						} catch (error) {
							logger.warn(`Progress reporting failed: ${error.message}`);
						}
					}
				};

				// Fallback extractor for subtasks
				const fallbackItemExtractor = (fullResponse) => {
					return fullResponse.subtasks || [];
				};

				const parseResult = await parseStream(textStream, {
					jsonPaths: ['$.subtasks.*'],
					onProgress: onProgress,
					onError: (error) => {
						logger.debug(`JSON parsing error: ${error.message}`);
					},
					estimateTokens: (text) => Math.ceil(text.length / 3.5), // Match our input estimation ratio
					expectedTotal: finalSubtaskCount,
					fallbackItemExtractor
				});

				const { items: parsedSubtasks, usedFallback } = parseResult;

				if (usedFallback) {
					logger.info(`Fallback parsing recovered additional subtasks`);
				}

				// Validate and correct subtasks
				generatedSubtasks = parsedSubtasks.map((subtask, index) => {
					const correctedId = nextSubtaskId + index;
					return {
						...subtask,
						id: correctedId,
						status: 'pending',
						dependencies: Array.isArray(subtask.dependencies)
							? subtask.dependencies.filter(
									(depId) => depId >= nextSubtaskId && depId < correctedId
								)
							: []
					};
				});

				logger.debug(
					`Successfully generated ${generatedSubtasks.length} subtasks via streaming`
				);
			} else {
				// Use non-streaming approach (fallback)
				if (outputFormat === 'text') {
					loadingIndicator = startLoadingIndicator(
						`Generating ${finalSubtaskCount} subtasks...\n`
					);
				}

				aiServiceResponse = await generateTextService({
					prompt: promptContent,
					systemPrompt: systemPrompt,
					role,
					session,
					projectRoot,
					commandName: 'expand-task',
					outputType: outputFormat
				});
				const responseText = aiServiceResponse.mainResult;

				// Parse Subtasks
				generatedSubtasks = parseSubtasksFromText(
					responseText,
					nextSubtaskId,
					finalSubtaskCount,
					task.id,
					logger
				);
				logger.debug(
					`Successfully parsed ${generatedSubtasks.length} subtasks from AI response.`
				);
			}
		} catch (streamingError) {
			// Check if this is a streaming-specific error and fallback
			const errorMessage = streamingError.message || '';
			logger.debug(`Streaming error caught: ${errorMessage}`);
			logger.debug(`Error stack: ${streamingError.stack}`);

			const streamingErrorPatterns = [
				'not async iterable',
				'Failed to process AI text stream',
				'Stream object is not iterable',
				'Failed to parse AI response as JSON',
				'No text stream received'
			];
			const isStreamingError =
				shouldUseStreaming &&
				streamingErrorPatterns.some((pattern) =>
					errorMessage.includes(pattern)
				);

			if (isStreamingError) {
				logger.warn(`Streaming failed, falling back to non-streaming mode...`);

				// Stop progress tracker if it was started
				if (progressTracker) {
					await progressTracker.stop();
					progressTracker = null;
				}

				// Show fallback message for CLI
				if (outputFormat === 'text' && !isMCP) {
					console.log(
						chalk.yellow(
							`Streaming failed, falling back to non-streaming mode...`
						)
					);
				}

				// Fallback to non-streaming
				if (outputFormat === 'text') {
					loadingIndicator = startLoadingIndicator(
						`Generating ${finalSubtaskCount} subtasks...\n`
					);
				}

				try {
					const role = useResearch ? 'research' : 'main';
					aiServiceResponse = await generateTextService({
						prompt: promptContent,
						systemPrompt: systemPrompt,
						role,
						session,
						projectRoot,
						commandName: 'expand-task',
						outputType: outputFormat
					});
					const responseText = aiServiceResponse.mainResult;

					generatedSubtasks = parseSubtasksFromText(
						responseText,
						nextSubtaskId,
						finalSubtaskCount,
						task.id,
						logger
					);
					logger.debug(
						`Successfully parsed ${generatedSubtasks.length} subtasks via fallback`
					);
				} catch (fallbackError) {
					if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
					throw fallbackError;
				}
			} else {
				// Not a streaming error, re-throw
				if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
				throw streamingError;
			}
		} finally {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
		}

		// Update tracker with telemetry data if available
		if (progressTracker && aiServiceResponse?.telemetryData) {
			progressTracker.addTelemetryData(aiServiceResponse.telemetryData);
		}

		// Update parent tracker with telemetry data if this is a child expansion
		if (parentTracker && isChildExpansion && aiServiceResponse?.telemetryData) {
			parentTracker.addTelemetryData(aiServiceResponse.telemetryData);
		}

		// Stop progress tracker for CLI mode
		if (progressTracker) {
			// For single task expansion, manually update the final count
			progressTracker.subtasksCreated = generatedSubtasks.length;
			progressTracker.completedExpansions = 1;

			await progressTracker.stop();

			// Display summary
			const summary = progressTracker.getSummary();
			displayExpandSummary({
				taskId: task.id,
				totalSubtasksCreated: generatedSubtasks.length,
				tasksFilePath: tasksPath,
				elapsedTime: summary.elapsedTime,
				force: force,
				research: useResearch,
				explicitSubtasks: Boolean(numSubtasks),
				complexityScore: taskAnalysis?.complexityScore,
				hasComplexityAnalysis: Boolean(taskAnalysis),
				expandType: 'single'
			});
		}

		// Final progress report for MCP
		if (reportProgress) {
			// Use actual telemetry if available, otherwise fall back to estimates
			const hasValidTelemetry =
				aiServiceResponse?.telemetryData &&
				(aiServiceResponse.telemetryData.inputTokens > 0 ||
					aiServiceResponse.telemetryData.outputTokens > 0);

			let completionMessage;
			if (hasValidTelemetry) {
				// Use actual telemetry data with cost
				const cost = aiServiceResponse.telemetryData.totalCost || 0;
				const currency = aiServiceResponse.telemetryData.currency || 'USD';
				completionMessage = `✅ Subtask generation completed for Task ${task.id} | Tokens (I/O): ${aiServiceResponse.telemetryData.inputTokens}/${aiServiceResponse.telemetryData.outputTokens} | Cost: ${currency === 'USD' ? '$' : currency}${cost.toFixed(4)}`;
			} else {
				// Use estimates and indicate they're estimates
				const estimatedOutputTokens = generatedSubtasks.length * 150; // Rough estimate per subtask
				completionMessage = `✅ Subtask generation completed for Task ${task.id} | ~Tokens (I/O): ${estimatedInputTokens}/${estimatedOutputTokens} | Cost: ~$0.00`;
			}

			await reportProgress({
				type: 'subtask_generation_complete',
				progress: finalSubtaskCount,
				current: finalSubtaskCount,
				total: finalSubtaskCount,
				taskId: task.id,
				taskTitle: task.title,
				subtasksGenerated: generatedSubtasks.length,
				inputTokens: hasValidTelemetry
					? aiServiceResponse.telemetryData.inputTokens
					: estimatedInputTokens,
				outputTokens: hasValidTelemetry
					? aiServiceResponse.telemetryData.outputTokens
					: generatedSubtasks.length * 150,
				totalCost: hasValidTelemetry
					? aiServiceResponse.telemetryData.totalCost
					: 0,
				currency: hasValidTelemetry
					? aiServiceResponse.telemetryData.currency
					: 'USD',
				message: completionMessage
			});
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

		// Display AI Usage Summary for CLI (skip if child expansion - parent will handle it)
		if (
			outputFormat === 'text' &&
			aiServiceResponse &&
			aiServiceResponse.telemetryData &&
			!isChildExpansion
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
