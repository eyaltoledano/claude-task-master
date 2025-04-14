/**
 * remove-task.js
 * Direct function implementation for removing a task
 */

import { removeTask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for removeTask with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - The ID of the task or subtask to remove.
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
		const taskId = id;
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

		// Skip confirmation in the direct function since it's handled by the client
		log.info(`Removing task with ID: ${taskId} from ${tasksJsonPath}`);

		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			enableSilentMode();

			// Call the core removeTask function using the provided path
			const result = await removeTask(tasksJsonPath, taskId);

			// Restore normal logging
			disableSilentMode();

			log.info(`Successfully removed task: ${taskId}`);

			// Return the result
			return {
				success: true,
				data: {
					message: result.message,
					taskId: taskId,
					tasksPath: tasksJsonPath,
					removedTask: result.removedTask
				},
				fromCache: false
			};
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();

			log.error(`Error removing task: ${error.message}`);
			return {
				success: false,
				error: {
					code: error.code || 'REMOVE_TASK_ERROR',
					message: error.message || 'Failed to remove task'
				},
				fromCache: false
			};
		}
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
