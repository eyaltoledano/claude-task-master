import fs from 'fs';
import path from 'path';
import { z } from 'zod';

import {
	log,
	readJSON,
	writeJSON,
	isSilentMode,
	getTagAwareFilePath
} from '../utils.js';

import {
	startLoadingIndicator,
	stopLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';

import { generateTextService } from '../ai-services-unified.js';

import {
	getDefaultSubtasks,
	getDebugFlag,
	getMainProvider,
	getResearchProvider
} from '../config-manager.js';
import { getPromptManager } from '../prompt-manager.js';
import generateTaskFiles from './generate-task-files.js';
import { COMPLEXITY_REPORT_FILE } from '../../../src/constants/paths.js';
import { CUSTOM_PROVIDERS } from '../../../src/constants/providers.js';
import { ContextGatherer } from '../utils/contextGatherer.js';
import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
import { flattenTasksWithSubtasks, findProjectRoot } from '../utils.js';

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
			.array(z.string())
			.describe(
				'Array of subtask dependencies within the same parent task. Use format ["parentTaskId.1", "parentTaskId.2"]. Subtasks can only depend on siblings, not external tasks.'
			),
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
		logger.error('AI response text is empty after trimming.');
		throw new Error('AI response text is empty after trimming.');
	}

	const originalTrimmedResponse = text.trim(); // Store the original trimmed response
	let jsonToParse = originalTrimmedResponse; // Initialize jsonToParse with it

	logger.debug(
		`Starting parseSubtasksFromText with startId=${startId}, expectedCount=${expectedCount}, parentTaskId=${parentTaskId}`
	);

	// --- NEW: Handle Claude Code CLI text responses ---
	// Claude Code CLI often returns plain text instead of JSON
	// Check if the response looks like plain text (no JSON structure)
	const hasJsonStructure =
		jsonToParse.includes('"subtasks"') ||
		jsonToParse.includes('```json') ||
		(jsonToParse.trim().startsWith('{') && jsonToParse.trim().endsWith('}'));

	logger.debug(
		`JSON structure check: hasJsonStructure=${hasJsonStructure}, contains subtasks: ${jsonToParse.includes('"subtasks"')}`
	);

	if (!hasJsonStructure) {
		logger.debug(
			'Response appears to be plain text from Claude Code CLI. Attempting to extract subtasks from text format.'
		);

		// Try to extract subtasks from plain text format
		const extractedSubtasks = extractSubtasksFromPlainText(
			jsonToParse,
			startId,
			expectedCount,
			parentTaskId,
			logger
		);
		if (extractedSubtasks && extractedSubtasks.length > 0) {
			logger.warn(
				`SUCCESS: Successfully extracted ${extractedSubtasks.length} subtasks from plain text response.`
			);
			return extractedSubtasks;
		} else {
			logger.debug(
				'Failed to extract subtasks from plain text. Falling back to JSON parsing.'
			);
		}
	} else {
		logger.debug('JSON structure detected, proceeding with JSON parsing.');
	}

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
		logger.debug(
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

		// Advanced JSON extraction logic
		const targetPattern = '{"subtasks":';
		const patternStartIndex = jsonToParse.indexOf(targetPattern);

		if (patternStartIndex !== -1) {
			let openBraces = 0;
			let firstBraceFound = false;
			let extractedJsonBlock = '';

			for (let i = patternStartIndex; i < jsonToParse.length; i++) {
				const char = jsonToParse[i];
				if (char === '{') {
					if (!firstBraceFound) {
						firstBraceFound = true;
					}
					openBraces++;
				} else if (char === '}') {
					openBraces--;
				}

				extractedJsonBlock += char;

				if (firstBraceFound && openBraces === 0) {
					break;
				}
			}

			if (openBraces === 0 && extractedJsonBlock.length > 0) {
				jsonToParse = extractedJsonBlock;
				logger.debug(
					'Advanced extraction: Successfully extracted JSON block using target pattern.'
				);
			} else {
				logger.debug(
					'Advanced extraction: Target pattern found but brace counting failed. Trying fallback extraction.'
				);
				// Fallback: try to find the last complete JSON object
				const lastOpenBrace = jsonToParse.lastIndexOf('{');
				const lastCloseBrace = jsonToParse.lastIndexOf('}');

				if (
					lastOpenBrace !== -1 &&
					lastCloseBrace !== -1 &&
					lastCloseBrace > lastOpenBrace
				) {
					jsonToParse = jsonToParse.substring(
						lastOpenBrace,
						lastCloseBrace + 1
					);
					logger.debug(
						'Advanced extraction: Using fallback extraction (last complete JSON object).'
					);
				}
			}
		} else {
			logger.debug(
				'Advanced extraction: Target pattern not found. Trying fallback extraction.'
			);
			// Fallback: try to find the last complete JSON object
			const lastOpenBrace = jsonToParse.lastIndexOf('{');
			const lastCloseBrace = jsonToParse.lastIndexOf('}');

			if (
				lastOpenBrace !== -1 &&
				lastCloseBrace !== -1 &&
				lastCloseBrace > lastOpenBrace
			) {
				jsonToParse = jsonToParse.substring(lastOpenBrace, lastCloseBrace + 1);
				logger.debug(
					'Advanced extraction: Using fallback extraction (last complete JSON object).'
				);
			}
		}

		logger.debug(
			`Advanced extraction: JSON string that will be parsed: ${jsonToParse.substring(0, 500)}...`
		);
		try {
			parsedObject = JSON.parse(jsonToParse);
			logger.debug('Advanced extraction parse successful!');
		} catch (parseError) {
			logger.debug(
				`Advanced extraction: Failed to parse JSON object: ${parseError.message}`
			);

			// --- FORCED PLAIN TEXT EXTRACTION FOR TESTING ---
			logger.debug('Attempting to extract subtasks from plain text response.');
			logger.debug(
				`Original response for text extraction: ${originalTrimmedResponse.substring(0, 500)}...`
			);

			try {
				const extractedSubtasks = extractSubtasksFromPlainText(
					originalTrimmedResponse,
					startId,
					expectedCount,
					parentTaskId,
					logger
				);
				if (extractedSubtasks && extractedSubtasks.length > 0) {
					logger.info(
						`SUCCESS: Extracted ${extractedSubtasks.length} subtasks from plain text response.`
					);
					return extractedSubtasks;
				} else {
					logger.debug('Plain text extraction returned empty array.');
				}
			} catch (extractError) {
				logger.error(
					`Error in extractSubtasksFromPlainText: ${extractError.message}`
				);
			}

			// --- NEW: Enhanced fallback for mixed text+JSON responses ---
			logger.debug(
				'JSON parsing failed. Attempting to extract JSON from mixed text+JSON response.'
			);

			// Try to extract JSON from the original response (might contain text + JSON)
			const jsonMatch = originalTrimmedResponse.match(
				/\{[\s\S]*"subtasks"[\s\S]*\}/
			);
			if (jsonMatch) {
				try {
					const extractedJson = jsonMatch[0];
					logger.debug(
						`Found JSON block in mixed response: ${extractedJson.substring(0, 200)}...`
					);
					parsedObject = JSON.parse(extractedJson);
					logger.info(
						'Successfully parsed JSON from mixed text+JSON response.'
					);
				} catch (jsonParseError) {
					logger.warn(
						`Failed to parse extracted JSON: ${jsonParseError.message}`
					);
				}
			}

			if (!parsedObject) {
				throw new Error(
					// Re-throw a more specific error if all attempts fail
					`Failed to parse JSON response object after all attempts (JSON parsing + forced plain text extraction + JSON extraction): ${parseError.message}`
				);
			}
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
				? rawSubtask.dependencies.filter(
						(dep) =>
							typeof dep === 'string' && dep.startsWith(`${parentTaskId}.`)
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
 * Extract subtasks from plain text response (for Claude Code CLI compatibility)
 * @param {string} text - Plain text response from AI
 * @param {number} startId - Starting subtask ID
 * @param {number} expectedCount - Expected number of subtasks
 * @param {number} parentTaskId - Parent task ID
 * @param {Object} logger - Logging object
 * @returns {Array} Array of extracted subtasks
 */
function extractSubtasksFromPlainText(
	text,
	startId,
	expectedCount,
	parentTaskId,
	logger
) {
	logger.debug('Extracting subtasks from plain text response');
	logger.debug(`Input text length: ${text.length}`);

	const subtasks = [];
	let currentId = startId;

	// Split text into lines and look for numbered items or bullet points
	const lines = text.split('\n');
	logger.debug(`Split into ${lines.length} lines`);
	let currentSubtask = null;

	for (const line of lines) {
		const trimmedLine = line.trim();

		// Skip empty lines
		if (!trimmedLine) continue;

		// Look for numbered items (e.g., "1.", "2.", "1)", "2)", etc.)
		const numberedMatch = trimmedLine.match(/^(\d+)[\.\)]\s*(.+)$/);
		// Look for bullet points (e.g., "- ", "* ", "• ")
		const bulletMatch = trimmedLine.match(/^[\-\*•]\s*(.+)$/);
		// Look for "Subtask X:" format
		const subtaskMatch = trimmedLine.match(/^Subtask\s+(\d+):\s*(.+)$/i);

		let title = null;

		if (numberedMatch) {
			title = numberedMatch[2].trim();
			logger.debug(`Found numbered item: ${title}`);
		} else if (bulletMatch) {
			title = bulletMatch[1].trim();
			logger.debug(`Found bullet item: ${title}`);
		} else if (subtaskMatch) {
			title = subtaskMatch[2].trim();
			logger.debug(`Found subtask item: ${title}`);
		}

		if (title) {
			// If we have a previous subtask, save it
			if (currentSubtask) {
				subtasks.push(currentSubtask);
			}

			// Start a new subtask
			currentSubtask = {
				id: currentId,
				title: title,
				description: title, // Use title as description initially
				details: `Implementation details for: ${title}. This subtask was extracted from plain text response and requires manual review for specific implementation approach.`,
				dependencies: [],
				status: 'pending',
				testStrategy: `Test strategy for: ${title}. Verify implementation works as expected.`
			};
			currentId++;
		} else if (currentSubtask) {
			// This line is part of the current subtask's details
			if (currentSubtask.details) {
				currentSubtask.details += '\n' + trimmedLine;
			} else {
				currentSubtask.details = trimmedLine;
			}
		}
	}

	// Don't forget the last subtask
	if (currentSubtask) {
		subtasks.push(currentSubtask);
	}

	// Validate extracted subtasks
	const validatedSubtasks = [];
	for (const rawSubtask of subtasks) {
		const result = subtaskSchema.safeParse(rawSubtask);
		if (result.success) {
			validatedSubtasks.push(result.data);
		} else {
			logger.warn(
				`Plain text subtask validation failed: ${JSON.stringify(rawSubtask).substring(0, 100)}...`
			);
			logger.warn(
				`Plain text subtask validation failed: ${JSON.stringify(rawSubtask).substring(0, 100)}...`
			);
		}
	}

	logger.debug(
		`Extracted ${subtasks.length} raw subtasks, validated ${validatedSubtasks.length} subtasks`
	);

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

	// Declare task variable outside try block so it's accessible in catch block
	let task = null;
	let finalSubtaskCount = 0; // Declare finalSubtaskCount variable

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
		task = data.tasks[taskIndex];
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
		const nextSubtaskId = (task.subtasks?.length || 0) + 1;

		// Load prompts using PromptManager
		const promptManager = getPromptManager();

		// Check if Claude Code is being used as the provider
		const currentProvider = useResearch
			? getResearchProvider(projectRoot)
			: getMainProvider(projectRoot);
		const isClaudeCode = currentProvider === CUSTOM_PROVIDERS.CLAUDE_CODE;

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
			isClaudeCode: isClaudeCode,
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

		// --- AI Subtask Generation using generateTextService ---
		let generatedSubtasks = [];
		let loadingIndicator = null;
		if (outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator(
				`Generating ${finalSubtaskCount || 'appropriate number of'} subtasks...\n`
			);
		}

		let responseText = '';
		let aiServiceResponse = null;

		try {
			const role = useResearch ? 'research' : 'main';

			// Call generateTextService with the determined prompts and telemetry params
			aiServiceResponse = await generateTextService({
				prompt: promptContent,
				systemPrompt: systemPrompt,
				role,
				session,
				projectRoot,
				commandName: 'expand-task',
				outputType: outputFormat
			});
			responseText = aiServiceResponse.mainResult;

			// Parse Subtasks
			generatedSubtasks = parseSubtasksFromText(
				responseText,
				nextSubtaskId,
				finalSubtaskCount,
				task.id,
				logger
			);
			logger.info(
				`Successfully parsed ${generatedSubtasks.length} subtasks from AI response.`
			);
		} catch (error) {
			if (loadingIndicator) stopLoadingIndicator(loadingIndicator);

			// Enhanced error logging with more context
			logger.error(
				`Error during AI call or parsing for task ${taskId}: ${error.message}`,
				'error'
			);

			// Log additional error context
			logger.error(`Error details for task ${taskId}:`, {
				errorType: error.constructor.name,
				errorCode: error.code,
				exitCode: error.exitCode,
				hasResponseText: !!responseText,
				responseTextLength: responseText ? responseText.length : 0,
				useResearch,
				finalSubtaskCount,
				role: useResearch ? 'research' : 'main'
			});

			// Log raw response in debug mode if parsing failed
			if (
				error.message.includes('Failed to parse valid subtasks') &&
				getDebugFlag(session)
			) {
				logger.error(`Raw AI Response that failed parsing:\n${responseText}`);
			}

			// Special handling for Claude Code API errors
			if (
				error.message &&
				error.message.includes('Claude Code process exited with code')
			) {
				logger.error(
					`Claude Code CLI error detected for task ${taskId}. This may be due to Ink interface issues on Windows.`
				);
				logger.error(
					`Suggested solutions: Use PowerShell instead of Git Bash, or set environment variables FORCE_COLOR=0 CI=true`
				);
			}

			// Special handling for instanceof errors
			if (error.message && error.message.includes('instanceof')) {
				logger.error(
					`Type checking error detected for task ${taskId}. This may be due to undefined classes or modules not being properly loaded.`
				);
			}

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

		// Enhanced error context logging
		logger.error(`Expand task error context for task ${taskId}:`, {
			errorType: error.constructor.name,
			errorCode: error.code,
			exitCode: error.exitCode,
			taskTitle: task?.title || 'task not found',
			taskStatus: task?.status || 'unknown',
			hasSubtasks: task?.subtasks ? task.subtasks.length : 0,
			useResearch,
			finalSubtaskCount: finalSubtaskCount || 0,
			projectRoot: projectRoot || 'not set',
			tag: tag || 'master'
		});

		// Special error handling for common issues
		if (
			error.message &&
			error.message.includes('Claude Code process exited with code')
		) {
			logger.error(
				`Claude Code CLI error in expand-task for task ${taskId}. This is a known issue on Windows with Git Bash.`
			);
			logger.error(
				`Solutions: Use PowerShell, set FORCE_COLOR=0 CI=true, or try a different AI provider.`
			);
		}

		if (error.message && error.message.includes('instanceof')) {
			logger.error(
				`Type checking error in expand-task for task ${taskId}. This may indicate a module loading issue.`
			);
		}

		if (error.message && error.message.includes('not found')) {
			logger.error(
				`Task or file not found error in expand-task for task ${taskId}. Check if the task exists and file paths are correct.`
			);
		}

		if (outputFormat === 'text' && getDebugFlag(session)) {
			console.error(error); // Log full stack in debug CLI mode
		}

		throw error; // Re-throw for the caller
	}
}

export default expandTask;
