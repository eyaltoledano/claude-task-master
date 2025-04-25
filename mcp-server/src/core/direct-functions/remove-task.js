/**
 * remove-task.js
 * Direct function implementation for removing a task
 */

import {
	removeTask,
	taskExists
} from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	readJSON
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for removeTask with error handling.
 * Supports removing multiple tasks at once with comma-separated IDs.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - The ID(s) of the task(s) or subtask(s) to remove (comma-separated for multiple).
 * @param {string} args.mode - The mode for agent-in-the-loop support
 * @param {Object} args.removal - The removal object for agent-in-the-loop support
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Remove task result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: false }
 */
export async function removeTaskDirect(args, log) {
	const { tasksJsonPath, id, mode, removal } = args;
	// Agent-in-the-loop support
	if (mode === 'get_prompt' || (!removal && mode === 'submit_removal')) {
		// Load current tasks for context
		let tasks;
		try {
			tasks = await readJSON(tasksJsonPath);
		} catch (e) {
			return { ok: false, error: `Could not read tasks file: ${e.message}` };
		}
		// Find the tasks to remove
		const ids = id.split(',').map((s) => s.trim());
		const found = ids.map((taskId) => {
			const t = findTaskById(tasks, taskId);
			return t ? { id: taskId, title: t.title, status: t.status, description: t.description } : { id: taskId, error: 'Not found' };
		});
		return {
			ok: true,
			agentPrompt: {
				message: `You are about to remove the following task(s). Please confirm removal and provide a reason if possible.`,
				tasks: found,
				required: {
					confirm: true,
					reason: 'string (optional)'
				}
			}
		};
	}
	if (mode === 'submit_removal' && removal && removal.confirm === true) {
		// Validate removal object
		if (!removal.id || removal.id !== id) {
			return { ok: false, error: 'Removal object id does not match request id.' };
		}
		// Optionally log the reason
		if (removal.reason) {
			log.info(`Agent provided reason for removal: ${removal.reason}`);
		}
		// Proceed with removal
		args.confirm = true; // skip prompt
	}
	// Destructure expected args
	const { tasksJsonPath: path, id: taskId } = args;
	try {
		// Check if tasksJsonPath was provided
		if (!path) {
			log.error('removeTaskDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				},
				fromCache: false
			};
		}

		// Validate task ID parameter
		if (!taskId) {
			log.error('Task ID is required');
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: 'Task ID is required'
				},
				fromCache: false
			};
		}

		// Split task IDs if comma-separated
		const taskIdArray = taskId.split(',').map((taskId) => taskId.trim());

		log.info(
			`Removing ${taskIdArray.length} task(s) with ID(s): ${taskIdArray.join(', ')} from ${path}`
		);

		// Validate all task IDs exist before proceeding
		const data = readJSON(path);
		if (!data || !data.tasks) {
			return {
				success: false,
				error: {
					code: 'INVALID_TASKS_FILE',
					message: `No valid tasks found in ${path}`
				},
				fromCache: false
			};
		}

		const invalidTasks = taskIdArray.filter(
			(taskId) => !taskExists(data.tasks, taskId)
		);

		if (invalidTasks.length > 0) {
			return {
				success: false,
				error: {
					code: 'INVALID_TASK_ID',
					message: `The following tasks were not found: ${invalidTasks.join(', ')}`
				},
				fromCache: false
			};
		}

		// Remove tasks one by one
		const results = [];

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		try {
			for (const taskId of taskIdArray) {
				try {
					const result = await removeTask(path, taskId);
					results.push({
						taskId,
						success: true,
						message: result.message,
						removedTask: result.removedTask
					});
					log.info(`Successfully removed task: ${taskId}`);
				} catch (error) {
					results.push({
						taskId,
						success: false,
						error: error.message
					});
					log.error(`Error removing task ${taskId}: ${error.message}`);
				}
			}
		} finally {
			// Restore normal logging
			disableSilentMode();
		}

		// Check if all tasks were successfully removed
		const successfulRemovals = results.filter((r) => r.success);
		const failedRemovals = results.filter((r) => !r.success);

		if (successfulRemovals.length === 0) {
			// All removals failed
			return {
				success: false,
				error: {
					code: 'REMOVE_TASK_ERROR',
					message: 'Failed to remove any tasks',
					details: failedRemovals
						.map((r) => `${r.taskId}: ${r.error}`)
						.join('; ')
				},
				fromCache: false
			};
		}

		// At least some tasks were removed successfully
		return {
			success: true,
			data: {
				totalTasks: taskIdArray.length,
				successful: successfulRemovals.length,
				failed: failedRemovals.length,
				results: results,
				tasksPath: path
			},
			fromCache: false
		};
	} catch (error) {
		// Ensure silent mode is disabled even if an outer error occurs
		disableSilentMode();

		// Catch any unexpected errors
		log.error(`Unexpected error in removeTaskDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'UNEXPECTED_ERROR',
				message: error.message
			},
			fromCache: false
		};
	}
}
