/**
 * update-subtask-by-id.js
 * Direct function implementation for appending information to a specific subtask using FastMCP sampling.
 */

// Removed: import { updateSubtaskById } from '../../../../scripts/modules/task-manager.js';
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
	_buildUpdateSubtaskPrompt, // Assuming exists
	parseTaskJsonResponse // Assuming works for single task object
} from '../../../../scripts/modules/ai-services.js';
import path from 'path'; // Needed for generateTaskFiles

/**
 * Direct function wrapper for updateSubtaskById using FastMCP sampling.
 *
 * @param {Object} args - Command arguments containing id, prompt, useResearch and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data for sampling.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateSubtaskByIdDirect(args, log, context = {}) {
	const { session } = context; // Session is needed for sampling
	const { tasksJsonPath, id, prompt, research } = args;

	// --- Input Validation ---
	if (!tasksJsonPath) {
		const errorMessage = 'tasksJsonPath is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_ARGUMENT', message: errorMessage }, fromCache: false };
	}
	if (!id) {
		const errorMessage = 'Subtask ID is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_SUBTASK_ID', message: errorMessage }, fromCache: false };
	}
	if (!prompt) {
		const errorMessage = 'Update prompt is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_PROMPT', message: errorMessage }, fromCache: false };
	}
	const subtaskIdStr = String(id);
	if (!subtaskIdStr.includes('.')) {
		const errorMessage = `Invalid subtask ID format: ${subtaskIdStr}. Must be parentId.subtaskId.`;
		log.error(errorMessage);
		return { success: false, error: { code: 'INVALID_SUBTASK_ID_FORMAT', message: errorMessage }, fromCache: false };
	}
	if (!session || typeof session.llm?.complete !== 'function') {
		const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
		log.error(errorMessage);
		return { success: false, error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage }, fromCache: false };
	}

	const tasksPath = tasksJsonPath;
	const useResearch = research === true; // Note: Research needs to be handled by client LLM

	log.info(`Updating subtask ${subtaskIdStr} via MCP sampling. Research hint: ${useResearch}`);

	try {
		// --- Read Task Data ---
		const data = readJSON(tasksPath);
		if (!data || !Array.isArray(data.tasks)) {
			return { success: false, error: { code: 'INVALID_TASKS_FILE', message: `Invalid tasks data in ${tasksPath}` }, fromCache: false };
		}

		// Find parent task and subtask
		const [parentIdStr, subIdStr] = subtaskIdStr.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subId = parseInt(subIdStr, 10);

		const parentTaskIndex = data.tasks.findIndex((t) => t.id === parentId);
		if (parentTaskIndex === -1) {
			return { success: false, error: { code: 'PARENT_TASK_NOT_FOUND', message: `Parent task ${parentId} not found for subtask ${subtaskIdStr}` }, fromCache: false };
		}
		const parentTask = data.tasks[parentTaskIndex];

		if (!Array.isArray(parentTask.subtasks)) {
			return { success: false, error: { code: 'SUBTASK_NOT_FOUND', message: `Subtask ${subtaskIdStr} not found (parent has no subtasks)` }, fromCache: false };
		}

		const subtaskIndex = parentTask.subtasks.findIndex((st) => st.id === subId);
		if (subtaskIndex === -1) {
			return { success: false, error: { code: 'SUBTASK_NOT_FOUND', message: `Subtask ${subtaskIdStr} not found` }, fromCache: false };
		}
		const subtaskToUpdate = parentTask.subtasks[subtaskIndex];

		// --- Pre-Update Checks ---
		if (subtaskToUpdate.status === 'done' || subtaskToUpdate.status === 'completed') {
			return { success: false, error: { code: 'SUBTASK_COMPLETED', message: `Subtask ${subtaskIdStr} is already completed` }, fromCache: false };
		}

		// --- Start of Refactored Logic ---

		// 1. Construct Prompt
		// Assumes _buildUpdateSubtaskPrompt exists
		const { systemPrompt, userPrompt } = _buildUpdateSubtaskPrompt(parentTask, subtaskToUpdate, prompt);
		if (!userPrompt) {
			throw new Error('Failed to generate the prompt for subtask update.');
		}
		log.info('Generated subtask update prompt for sampling.');

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

		// 3. Parse Completion (assuming it returns a single subtask object)
		let updatedSubtaskDataFromAI;
		try {
			updatedSubtaskDataFromAI = parseTaskJsonResponse(completionText); // Reusing task parser
			log.info('Parsed updated subtask data from LLM completion.');
		} catch (error) {
			log.error(`Failed to parse LLM completion: ${error.message}`);
			throw new Error(`Failed to parse LLM completion: ${error.message}`);
		}

		// 4. Validation (specific to subtasks)
		if (!updatedSubtaskDataFromAI || typeof updatedSubtaskDataFromAI !== 'object') {
			throw new Error('LLM completion did not contain a valid subtask object.');
		}
		if (!updatedSubtaskDataFromAI.title || !updatedSubtaskDataFromAI.description) {
			throw new Error('Updated subtask from LLM is missing required fields (title or description).');
		}
		// --> Ensure ID is preserved <--
		if (updatedSubtaskDataFromAI.id !== subId) {
			log.warn(`Subtask ID changed by AI. Restoring original ID ${subId}.`);
			updatedSubtaskDataFromAI.id = subId;
		}
		// --> Ensure status is preserved unless explicitly changed <--
		if (updatedSubtaskDataFromAI.status !== subtaskToUpdate.status && !prompt.toLowerCase().includes('status')) {
			log.warn(`Subtask status changed by AI without explicit instruction. Restoring original status '${subtaskToUpdate.status}'.`);
			updatedSubtaskDataFromAI.status = subtaskToUpdate.status;
		}
		// Note: Completed subtask validation doesn't apply here as we check status before starting

		// 5. Update Subtask in Data
		parentTask.subtasks[subtaskIndex] = updatedSubtaskDataFromAI; // Replace with validated data
		data.tasks[parentTaskIndex] = parentTask; // Update parent task in main array

		// 6. Save Updated Task Data
		writeJSON(tasksPath, data);
		log.info(`Updated subtask ${subtaskIdStr} in ${tasksPath}.`);

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
				message: `Successfully updated subtask ${subtaskIdStr} using client LLM sampling.`,
				subtask: updatedSubtaskDataFromAI // Return the updated subtask data
			},
			fromCache: false
		};

	} catch (error) {
		log.error(`Error during MCP updateSubtaskByIdDirect: ${error.message}`);
		log.error(error.stack);
		return {
			success: false,
			error: {
				code: 'UPDATE_SUBTASK_SAMPLING_ERROR',
				message: error.message || 'Unknown error during subtask update via sampling'
			},
			fromCache: false
		};
	}
}
