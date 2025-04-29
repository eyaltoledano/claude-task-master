/**
 * update-tasks.js
 * Direct function implementation for updating tasks based on new context/prompt using FastMCP sampling.
 */

// Removed: import { updateTasks } from '../../../../scripts/modules/task-manager.js';
import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js'; // Keep for generating files
import {
	enableSilentMode,
	disableSilentMode,
	readJSON,
	writeJSON,
} from '../../../../scripts/modules/utils.js';
import {
	// Removed: getAnthropicClientForMCP,
	// Removed: getPerplexityClientForMCP
} from '../utils/ai-client-utils.js';
// Import necessary AI prompt/parsing helpers
import {
	_buildUpdateMultipleTasksPrompt, // Assuming exists
	parseTasksFromCompletion, // Assuming exists and returns { tasks: [...] }
} from '../../../../scripts/modules/ai-services.js';
import path from 'path'; // Needed for generateTaskFiles

/**
 * Direct function wrapper for updating tasks based on new context/prompt using FastMCP sampling.
 *
 * @param {Object} args - Command arguments containing fromId, prompt, useResearch and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data for sampling.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function updateTasksDirect(args, log, context = {}) {
	const { session } = context; // Session is needed for sampling
	const { tasksJsonPath, from, prompt, research } = args;

	// --- Input Validation ---
	if (!tasksJsonPath) {
		const errorMessage = 'tasksJsonPath is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_ARGUMENT', message: errorMessage }, fromCache: false };
	}
	if (args.id !== undefined && from === undefined) {
		const errorMessage = "Use 'from' parameter for updateTasksDirect, not 'id'.";
		log.error(errorMessage);
		return { success: false, error: { code: 'PARAMETER_MISMATCH', message: errorMessage }, fromCache: false };
	}
	if (!from) {
		const errorMessage = "'from' ID is required";
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_FROM_ID', message: errorMessage }, fromCache: false };
	}
	if (!prompt) {
		const errorMessage = 'Update prompt is required';
		log.error(errorMessage);
		return { success: false, error: { code: 'MISSING_PROMPT', message: errorMessage }, fromCache: false };
	}
	let fromId;
	try {
		fromId = parseInt(String(from), 10);
		if (isNaN(fromId)) throw new Error('Not an integer');
	} catch {
		const errorMessage = `Invalid from ID: ${from}. Must be an integer.`;
		log.error(errorMessage);
		return { success: false, error: { code: 'INVALID_FROM_ID', message: errorMessage }, fromCache: false };
	}
	if (!session || typeof session.llm?.complete !== 'function') {
		const errorMessage = 'FastMCP sampling function (session.llm.complete) is not available.';
		log.error(errorMessage);
		return { success: false, error: { code: 'SAMPLING_UNAVAILABLE', message: errorMessage }, fromCache: false };
	}

	const tasksPath = tasksJsonPath;
	const useResearch = research === true; // Note: Research needs to be handled by client LLM

	log.info(`Updating tasks from ID ${fromId} via MCP sampling. Research hint: ${useResearch}`);

	try {
		// --- Read Task Data ---
		const data = readJSON(tasksPath);
		if (!data || !Array.isArray(data.tasks)) {
			return { success: false, error: { code: 'INVALID_TASKS_FILE', message: `Invalid tasks data in ${tasksPath}` }, fromCache: false };
		}

		// --- Filter Tasks to Update ---
		const originalTasksToUpdate = data.tasks.filter(
			(task) => parseInt(String(task.id).split('.')[0], 10) >= fromId && task.status !== 'done' && task.status !== 'completed'
		);

		if (originalTasksToUpdate.length === 0) {
			log.info(`No pending tasks found with ID >= ${fromId} to update.`);
			return { success: true, data: { message: `No pending tasks found with ID >= ${fromId}.`, tasksUpdated: 0 }, fromCache: false };
		}
		log.info(`Found ${originalTasksToUpdate.length} tasks to update.`);

		// --- Start of Refactored Logic ---

		// 1. Construct Prompt
		// Assumes _buildUpdateMultipleTasksPrompt exists
		const { systemPrompt, userPrompt } = _buildUpdateMultipleTasksPrompt(originalTasksToUpdate, prompt);
		if (!userPrompt) {
			throw new Error('Failed to generate the prompt for multiple task update.');
		}
		log.info('Generated multiple task update prompt for sampling.');

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
		let updatedTasksDataFromAI;
		try {
			// Assuming parseTasksFromCompletion returns { tasks: [...] }
			updatedTasksDataFromAI = parseTasksFromCompletion(completionText);
			if (!updatedTasksDataFromAI || !Array.isArray(updatedTasksDataFromAI.tasks)) {
				throw new Error('Parsing did not return a valid tasks array.');
			}
			log.info(`Parsed ${updatedTasksDataFromAI.tasks.length} updated tasks from completion.`);
		} catch (error) {
			log.error(`Failed to parse LLM completion: ${error.message}`);
			throw new Error(`Failed to parse LLM completion: ${error.message}`);
		}

		// 4. Validation and Merging (Moved from core function)
		const validatedUpdatedTasks = [];
		for (const updatedTaskAI of updatedTasksDataFromAI.tasks) {
			const originalTask = originalTasksToUpdate.find(t => t.id === updatedTaskAI.id);
			if (!originalTask) {
				log.warn(`AI returned task with ID ${updatedTaskAI.id} which was not in the original update list. Skipping.`);
				continue;
			}

			// Basic validation
			if (!updatedTaskAI.title || !updatedTaskAI.description) {
				log.warn(`Updated task ${updatedTaskAI.id} from AI is missing title or description. Skipping.`);
				validatedUpdatedTasks.push(originalTask); // Keep original if AI version is invalid
				continue;
			}
			// Ensure ID is preserved
			if (updatedTaskAI.id !== originalTask.id) {
				log.warn(`Task ID ${originalTask.id} changed by AI. Restoring.`);
				updatedTaskAI.id = originalTask.id;
			}
			// Ensure status is preserved
			if (updatedTaskAI.status !== originalTask.status) {
				log.warn(`Task status for ${originalTask.id} changed by AI. Restoring status '${originalTask.status}'.`);
				updatedTaskAI.status = originalTask.status;
			}
			// Ensure completed subtasks are preserved
			if (originalTask.subtasks?.length > 0) {
				const completedOriginalSubtasks = originalTask.subtasks.filter(st => st.status === 'done' || st.status === 'completed');
				if (!updatedTaskAI.subtasks) updatedTaskAI.subtasks = [];
				for (const completedSubtask of completedOriginalSubtasks) {
					const updatedVersion = updatedTaskAI.subtasks.find(st => st.id === completedSubtask.id);
					if (!updatedVersion) {
						log.warn(`Completed subtask ${originalTask.id}.${completedSubtask.id} removed by AI. Restoring.`);
						updatedTaskAI.subtasks.push(completedSubtask);
					} else if (JSON.stringify(updatedVersion) !== JSON.stringify(completedSubtask)) {
						log.warn(`Completed subtask ${originalTask.id}.${completedSubtask.id} modified by AI. Restoring.`);
						const idx = updatedTaskAI.subtasks.findIndex(st => st.id === completedSubtask.id);
						if (idx !== -1) updatedTaskAI.subtasks[idx] = completedSubtask;
					}
				}
				// Ensure unique subtask IDs
				const subtaskIds = new Set();
				updatedTaskAI.subtasks = updatedTaskAI.subtasks.filter(st => {
					if (!subtaskIds.has(st.id)) { subtaskIds.add(st.id); return true; }
					log.warn(`Duplicate subtask ID ${originalTask.id}.${st.id} detected. Removing duplicate.`);
					return false;
				});
			}
			validatedUpdatedTasks.push(updatedTaskAI);
		}

		// 5. Update Tasks in Main Data
		let tasksUpdatedCount = 0;
		validatedUpdatedTasks.forEach(updatedTask => {
			const index = data.tasks.findIndex(t => t.id === updatedTask.id);
			if (index !== -1) {
				data.tasks[index] = updatedTask;
				tasksUpdatedCount++;
			}
		});
		log.info(`Merged ${tasksUpdatedCount} validated updated tasks back into main data.`);

		// 6. Save Updated Task Data
		writeJSON(tasksPath, data);
		log.info(`Updated tasks file ${tasksPath}.`);

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
				message: `Successfully updated ${tasksUpdatedCount} tasks from ID ${fromId} using client LLM sampling.`,
				tasksUpdated: tasksUpdatedCount
			},
			fromCache: false
		};

	} catch (error) {
		log.error(`Error during MCP updateTasksDirect: ${error.message}`);
		log.error(error.stack);
		return {
			success: false,
			error: {
				code: 'UPDATE_TASKS_SAMPLING_ERROR',
				message: error.message || 'Unknown error during multiple task update via sampling'
			},
			fromCache: false
		};
	}
}
