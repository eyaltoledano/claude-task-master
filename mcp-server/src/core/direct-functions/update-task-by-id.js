/**
 * update-task-by-id.js
 * Direct function implementation for updating a single task by ID using FastMCP sampling.
 */

// Removed: import { updateTaskById } from '../../../../scripts/modules/task-manager.js';
import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js'; // Keep for generating files
import {
	enableSilentMode,
	disableSilentMode,
	readJSON,
	writeJSON
} from '../../../../scripts/modules/utils.js';
import {
	// Removed: getAnthropicClientForMCP,
	// Removed: getPerplexityClientForMCP
} from '../utils/ai-client-utils.js';
// Import necessary AI prompt/parsing helpers
import {
	_buildUpdateTaskPrompt, // Assuming exists
	parseTaskJsonResponse // Assuming exists
} from '../../../../scripts/modules/ai-services.js';

/**
 * Direct function wrapper for updating a task by ID using FastMCP sampling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data for sampling.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTaskByIdDirect(args, log, context = {}) {
	const { session } = context; // Session is needed for sampling
	const { tasksJsonPath, id, prompt, research } = args;

	// --- Input Validation ---
	if (!tasksJsonPath) {
		const errorMessage = 'tasksJsonPath is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_ARGUMENT', message: errorMessage }, fromCache: false };
	}
	if (!id) {
		const errorMessage = 'Task ID is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_TASK_ID', message: errorMessage }, fromCache: false };
	}
	if (!prompt) {
		const errorMessage = 'Update prompt is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_PROMPT', message: errorMessage }, fromCache: false };
	}
	if (!session || typeof session.llm?.complete !== 'function') {
		const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
		log.error(errorMessage);
		return { success: false, error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage }, fromCache: false };
	}

	// Parse taskId (only handles top-level tasks for this function)
	const taskId = parseInt(id, 10);
	if (isNaN(taskId) || id.includes('.')) {
		const errorMessage = `Invalid task ID: ${id}. updateTaskByIdDirect only supports top-level integer IDs. Use updateSubtaskByIdDirect for subtasks.`;
		log.error(errorMessage);
		return { success: false, error: { code: 'INVALID_TASK_ID', message: errorMessage }, fromCache: false };
	}

	const tasksPath = tasksJsonPath;
	const useResearch = research === true; // Note: Research needs to be handled by client LLM

	log.info(`Updating task ${taskId} via MCP sampling. Research hint: ${useResearch}`);

	try {
		// --- Read Task Data ---
		const data = readJSON(tasksPath);
		if (!data || !Array.isArray(data.tasks)) {
			return { success: false, error: { code: 'INVALID_TASKS_FILE', message: `Invalid tasks data in ${tasksPath}` }, fromCache: false };
		}
		const taskIndex = data.tasks.findIndex((t) => t.id === taskId);
		if (taskIndex === -1) {
			return { success: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found` }, fromCache: false };
		}
		const taskToUpdate = data.tasks[taskIndex];

		// --- Pre-Update Checks ---
		if (taskToUpdate.status === 'done' || taskToUpdate.status === 'completed') {
			return { success: false, error: { code: 'TASK_COMPLETED', message: `Task ${taskId} is already completed` }, fromCache: false };
		}

		// --- Start of Refactored Logic ---

		// 1. Construct Prompt
		// Assumes _buildUpdateTaskPrompt exists and takes task object + update instructions
		const { systemPrompt, userPrompt } = _buildUpdateTaskPrompt(taskToUpdate, prompt);
		if (!userPrompt) { // Check userPrompt as it's the main content
			throw new Error('Failed to generate the prompt for task update.');
		}
		log.info('Generated task update prompt for sampling.');

		// 2. Call FastMCP Sampling
		let completionText;
		try {
			log.info('Initiating FastMCP LLM sampling via client...');
			const completion = await session.llm.complete(userPrompt, { system: systemPrompt });
			log.info('Received completion from client LLM.');
			completionText = completion?.content;
			if (!completionText) {
				throw new Error('Received empty completion from client LLM via sampling.');
			}
		} catch (error) {
			log.error(`LLM sampling failed: ${error.message}`);
			throw new Error(`Failed to get completion via sampling: ${error.message}`);
		}

		// 3. Parse Completion
		let updatedTaskDataFromAI;
		try {
			updatedTaskDataFromAI = parseTaskJsonResponse(completionText);
			log.info('Parsed updated task data from LLM completion.');
		} catch (error) {
			log.error(`Failed to parse LLM completion: ${error.message}`);
			throw new Error(`Failed to parse LLM completion: ${error.message}`);
		}

		// 4. Validation (Moved from core function)
		if (!updatedTaskDataFromAI || typeof updatedTaskDataFromAI !== 'object') {
			throw new Error('LLM completion did not contain a valid task object.');
		}
		if (!updatedTaskDataFromAI.title || !updatedTaskDataFromAI.description) {
			throw new Error('Updated task from LLM is missing required fields (title or description).');
		}
		// --> Ensure ID is preserved <--
		if (updatedTaskDataFromAI.id !== taskId) {
			log.warn(`Task ID changed by AI. Restoring original ID ${taskId}.`);
			updatedTaskDataFromAI.id = taskId;
		}
		// --> Ensure status is preserved unless explicitly changed <--
		if (updatedTaskDataFromAI.status !== taskToUpdate.status && !prompt.toLowerCase().includes('status')) {
			log.warn(`Task status changed by AI without explicit instruction. Restoring original status '${taskToUpdate.status}'.`);
			updatedTaskDataFromAI.status = taskToUpdate.status;
		}
		// --> Ensure completed subtasks are preserved <--
		if (taskToUpdate.subtasks?.length > 0) {
			const completedOriginalSubtasks = taskToUpdate.subtasks.filter(st => st.status === 'done' || st.status === 'completed');
			if (!updatedTaskDataFromAI.subtasks) updatedTaskDataFromAI.subtasks = [];

			for (const completedSubtask of completedOriginalSubtasks) {
				const updatedVersion = updatedTaskDataFromAI.subtasks.find(st => st.id === completedSubtask.id);
				if (!updatedVersion) {
					log.warn(`Completed subtask ${taskId}.${completedSubtask.id} removed by AI. Restoring.`);
					updatedTaskDataFromAI.subtasks.push(completedSubtask);
				} else if (JSON.stringify(updatedVersion) !== JSON.stringify(completedSubtask)) {
					log.warn(`Completed subtask ${taskId}.${completedSubtask.id} modified by AI. Restoring.`);
					const idx = updatedTaskDataFromAI.subtasks.findIndex(st => st.id === completedSubtask.id);
					if (idx !== -1) updatedTaskDataFromAI.subtasks[idx] = completedSubtask;
				}
			}
			// Ensure unique subtask IDs after potential restoration
			const subtaskIds = new Set();
			updatedTaskDataFromAI.subtasks = updatedTaskDataFromAI.subtasks.filter(st => {
				if (!subtaskIds.has(st.id)) {
					subtaskIds.add(st.id);
					return true;
				}
				log.warn(`Duplicate subtask ID ${taskId}.${st.id} detected after AI update/validation. Removing duplicate.`);
				return false;
			});
		}
		// --- End Validation logic --- //

		// 5. Update Task in Data
		data.tasks[taskIndex] = updatedTaskDataFromAI; // Replace with validated data

		// 6. Save Updated Task Data
		writeJSON(tasksPath, data);
		log.info(`Updated task ${taskId} in ${tasksPath}.`);

		// 7. Generate Individual Task Files (in silent mode)
		enableSilentMode();
		try {
			await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog: log });
			log.info('Generated individual task files.');
		} finally {
			disableSilentMode();
		}

		// --- End of Refactored Logic ---

		// 8. Return Success
		return {
			success: true,
			data: {
				message: `Successfully updated task ${taskId} using client LLM sampling.`,
				task: updatedTaskDataFromAI // Return the updated task data
			},
			fromCache: false
		};

	} catch (error) {
		log.error(`Error during MCP updateTaskByIdDirect: ${error.message}`);
		log.error(error.stack);
		return {
			success: false,
			error: {
				code: 'UPDATE_TASK_SAMPLING_ERROR',
				message: error.message || 'Unknown error during task update via sampling'
			},
			fromCache: false
		};
	}
}
