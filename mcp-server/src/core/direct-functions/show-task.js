/**
 * show-task.js
 * Direct function implementation for showing task details
 */

import { findTaskById } from '../../../../scripts/modules/utils.js';
import { readJSON } from '../../../../scripts/modules/utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for showing task details with error handling and caching.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - The ID of the task or subtask to show.
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Task details result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function showTaskDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, id } = args;

	if (!tasksJsonPath) {
		log.error('showTaskDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			},
			fromCache: false
		};
	}

	// Validate task ID
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

	// Generate cache key using the provided task path and ID
	const cacheKey = `showTask:${tasksJsonPath}:${taskId}`;

	// Define the action function to be executed on cache miss
	const coreShowTaskAction = async () => {
		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			enableSilentMode();

			log.info(
				`Retrieving task details for ID: ${taskId} from ${tasksJsonPath}`
			);

			// Read tasks data using the provided path
			const data = readJSON(tasksJsonPath);
			if (!data || !data.tasks) {
				disableSilentMode(); // Disable before returning
				return {
					success: false,
					error: {
						code: 'INVALID_TASKS_FILE',
						message: `No valid tasks found in ${tasksJsonPath}`
					}
				};
			}

			// Find the specific task
			const task = findTaskById(data.tasks, taskId);

			if (!task) {
				disableSilentMode(); // Disable before returning
				return {
					success: false,
					error: {
						code: 'TASK_NOT_FOUND',
						message: `Task with ID ${taskId} not found`
					}
				};
			}

			// Restore normal logging
			disableSilentMode();

			// Return the task data with the full tasks array for reference
			// (needed for formatDependenciesWithStatus function in UI)
			log.info(`Successfully found task ${taskId}`);
			return {
				success: true,
				data: {
					task,
					allTasks: data.tasks
				}
			};
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();

			log.error(`Error showing task: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'CORE_FUNCTION_ERROR',
					message: error.message || 'Failed to show task details'
				}
			};
		}
	};

	// Use the caching utility
	try {
		const result = await getCachedOrExecute({
			cacheKey,
			actionFn: coreShowTaskAction,
			log
		});
		log.info(`showTaskDirect completed. From cache: ${result.fromCache}`);
		return result; // Returns { success, data/error, fromCache }
	} catch (error) {
		// Catch unexpected errors from getCachedOrExecute itself
		disableSilentMode();
		log.error(
			`Unexpected error during getCachedOrExecute for showTask: ${error.message}`
		);
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
