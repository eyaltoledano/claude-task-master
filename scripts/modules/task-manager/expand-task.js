import fs from 'fs';
import path from 'path';
import { z } from 'zod';

import { log, readJSON, writeJSON, isSilentMode } from '../utils.js';

import { startLoadingIndicator, stopLoadingIndicator } from '../ui.js';

import { generateTextService } from '../ai-services-unified.js';

import { getDefaultSubtasks, getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';

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
			.optional()
			.describe('Approach for testing this subtask')
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


Respond ONLY with a valid JSON object containing a single key "subtasks" whose value is an array matching the structure described. Do not include any explanatory text, markdown formatting, or code block markers.`;
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
      "dependencies": [<number>], // e.g., [${nextSubtaskId + 1}]
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
	logger.info('Attempting to parse subtasks object from text response...');
	if (!text || text.trim() === '') {
		throw new Error('AI response text is empty.');
	}

	let cleanedResponse = text.trim();
	const originalResponseForDebug = cleanedResponse;

	// 1. Extract from Markdown code block first
	const codeBlockMatch = cleanedResponse.match(
		/```(?:json)?\s*([\s\S]*?)\s*```/
	);
	if (codeBlockMatch) {
		cleanedResponse = codeBlockMatch[1].trim();
		logger.info('Extracted JSON content from Markdown code block.');
	} else {
		// 2. If no code block, find first '{' and last '}' for the object
		const firstBrace = cleanedResponse.indexOf('{');
		const lastBrace = cleanedResponse.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
			logger.info('Extracted content between first { and last }.');
		} else {
			logger.warn(
				'Response does not appear to contain a JSON object structure. Parsing raw response.'
			);
		}
	}

	// 3. Attempt to parse the object
	let parsedObject;
	try {
		parsedObject = JSON.parse(cleanedResponse);
	} catch (parseError) {
		logger.error(`Failed to parse JSON object: ${parseError.message}`);
		logger.error(
			`Problematic JSON string (first 500 chars): ${cleanedResponse.substring(0, 500)}`
		);
		logger.error(
			`Original Raw Response (first 500 chars): ${originalResponseForDebug.substring(0, 500)}`
		);
		throw new Error(
			`Failed to parse JSON response object: ${parseError.message}`
		);
	}

	// 4. Validate the object structure and extract the subtasks array
	if (
		!parsedObject ||
		typeof parsedObject !== 'object' ||
		!Array.isArray(parsedObject.subtasks)
	) {
		logger.error(
			`Parsed content is not an object or missing 'subtasks' array. Content: ${JSON.stringify(parsedObject).substring(0, 200)}`
		);
		throw new Error(
			'Parsed AI response is not a valid object containing a "subtasks" array.'
		);
	}
	const parsedSubtasks = parsedObject.subtasks; // Extract the array

	logger.info(
		`Successfully parsed ${parsedSubtasks.length} potential subtasks from the object.`
	);
	if (expectedCount && parsedSubtasks.length !== expectedCount) {
		logger.warn(
			`Expected ${expectedCount} subtasks, but parsed ${parsedSubtasks.length}.`
		);
	}

	// 5. Validate and Normalize each subtask using Zod schema
	let currentId = startId;
	const validatedSubtasks = [];
	const validationErrors = [];

	for (const rawSubtask of parsedSubtasks) {
		const correctedSubtask = {
			...rawSubtask,
			id: currentId, // Enforce sequential ID
			dependencies: Array.isArray(rawSubtask.dependencies)
				? rawSubtask.dependencies
						.map((dep) => (typeof dep === 'string' ? parseInt(dep, 10) : dep))
						.filter(
							(depId) => !isNaN(depId) && depId >= startId && depId < currentId
						) // Ensure deps are numbers, valid range
				: [],
			status: 'pending' // Enforce pending status
			// parentTaskId can be added if needed: parentTaskId: parentTaskId
		};

		const result = subtaskSchema.safeParse(correctedSubtask);

		if (result.success) {
			validatedSubtasks.push(result.data); // Add the validated data
		} else {
			logger.warn(
				`Subtask validation failed for raw data: ${JSON.stringify(rawSubtask).substring(0, 100)}...`
			);
			result.error.errors.forEach((err) => {
				const errorMessage = `  - Field '${err.path.join('.')}': ${err.message}`;
				logger.warn(errorMessage);
				validationErrors.push(`Subtask ${currentId}: ${errorMessage}`);
			});
			// Optionally, decide whether to include partially valid tasks or skip them
			// For now, we'll skip invalid ones
		}
		currentId++; // Increment ID for the next *potential* subtask
	}

	if (validationErrors.length > 0) {
		logger.error(
			`Found ${validationErrors.length} validation errors in the generated subtasks.`
		);
		// Optionally throw an error here if strict validation is required
		// throw new Error(`Subtask validation failed:\n${validationErrors.join('\n')}`);
		logger.warn('Proceeding with only the successfully validated subtasks.');
	}

	if (validatedSubtasks.length === 0 && parsedSubtasks.length > 0) {
		throw new Error(
			'AI response contained potential subtasks, but none passed validation.'
		);
	}

	// Ensure we don't return more than expected, preferring validated ones
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
	const { session, mcpLog } = context;
	const outputFormat = mcpLog ? 'json' : 'text';

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
		const data = readJSON(tasksPath);
		if (!data || !data.tasks)
			throw new Error(`Invalid tasks data in ${tasksPath}`);
		const taskIndex = data.tasks.findIndex(
			(t) => t.id === parseInt(taskId, 10)
		);
		if (taskIndex === -1) throw new Error(`Task ${taskId} not found`);
		const task = data.tasks[taskIndex];
		logger.info(`Expanding task ${taskId}: ${task.title}`);
		// --- End Task Loading/Filtering ---

		// --- Handle Force Flag: Clear existing subtasks if force=true ---
		if (force && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
			logger.info(
				`Force flag set. Clearing existing ${task.subtasks.length} subtasks for task ${taskId}.`
			);
			task.subtasks = []; // Clear existing subtasks
		}
		// --- End Force Flag Handling ---

		// --- Complexity Report Integration ---
		let finalSubtaskCount;
		let promptContent = '';
		let complexityReasoningContext = '';
		let systemPrompt; // Declare systemPrompt here

		const projectRoot = path.dirname(path.dirname(tasksPath));
		const complexityReportPath = path.join(
			projectRoot,
			'scripts/task-complexity-report.json'
		);
		let taskAnalysis = null;

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
		if (!isNaN(explicitNumSubtasks) && explicitNumSubtasks > 0) {
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
		if (isNaN(finalSubtaskCount) || finalSubtaskCount <= 0) {
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

			// --- Use Simplified System Prompt for Report Prompts ---
			systemPrompt = `You are an AI assistant helping with task breakdown. Generate exactly ${finalSubtaskCount} subtasks based on the provided prompt and context. Respond ONLY with a valid JSON object containing a single key "subtasks" whose value is an array of the generated subtask objects. Each subtask object in the array must have keys: "id", "title", "description", "dependencies", "details", "status". Ensure the 'id' starts from ${nextSubtaskId} and is sequential. Ensure 'dependencies' only reference valid prior subtask IDs generated in this response (starting from ${nextSubtaskId}). Ensure 'status' is 'pending'. Do not include any other text or explanation.`;
			logger.info(
				`Using expansion prompt from complexity report and simplified system prompt for task ${task.id}.`
			);
			// --- End Simplified System Prompt ---
		} else {
			// Use standard prompt generation
			const combinedAdditionalContext =
				`${additionalContext}${complexityReasoningContext}`.trim();
			if (useResearch) {
				promptContent = generateResearchUserPrompt(
					task,
					finalSubtaskCount,
					combinedAdditionalContext,
					nextSubtaskId
				);
				// Use the specific research system prompt if needed, or a standard one
				systemPrompt = `You are an AI assistant that responds ONLY with valid JSON objects as requested. The object should contain a 'subtasks' array.`; // Or keep generateResearchSystemPrompt if it exists
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

		// --- AI Subtask Generation using generateTextService ---
		let generatedSubtasks = [];
		let loadingIndicator = null;
		if (outputFormat === 'text') {
			loadingIndicator = startLoadingIndicator(
				`Generating ${finalSubtaskCount} subtasks...`
			);
		}

		let responseText = '';

		try {
			const role = useResearch ? 'research' : 'main';
			logger.info(`Using AI service with role: ${role}`);

			// Call generateTextService with the determined prompts
			responseText = await generateTextService({
				prompt: promptContent,
				systemPrompt: systemPrompt, // Use the determined system prompt
				role,
				session,
				projectRoot
			});
			logger.info(
				'Successfully received text response from AI service',
				'success'
			);

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
			logger.error(
				`Error during AI call or parsing for task ${taskId}: ${error.message}`, // Added task ID context
				'error'
			);
			// Log raw response in debug mode if parsing failed
			if (
				error.message.includes('Failed to parse valid subtasks') &&
				getDebugFlag(session)
			) {
				logger.error(`Raw AI Response that failed parsing:\n${responseText}`);
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
		logger.info(`Writing updated tasks to ${tasksPath}`);
		writeJSON(tasksPath, data);
		logger.info(`Generating individual task files...`);
		await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		logger.info(`Task files generated.`);
		// --- End Task Update & File Writing ---

		return task; // Return the updated task object
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
