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
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Remove task result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: false }
 */
export async function removeTaskDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, id } = args;
	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
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
		if (!id) {
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
		const taskIdArray = id.split(',').map((taskId) => taskId.trim());

		log.info(
			`Removing ${taskIdArray.length} task(s) with ID(s): ${taskIdArray.join(', ')} from ${tasksJsonPath}`
		);

		// Validate all task IDs exist before proceeding
		const data = readJSON(tasksJsonPath);
		if (!data || !data.tasks) {
			return {
				success: false,
				error: {
					code: 'INVALID_TASKS_FILE',
					message: `No valid tasks found in ${tasksJsonPath}`
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
					const result = await removeTask(tasksJsonPath, taskId);
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
				tasksPath: tasksJsonPath
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
