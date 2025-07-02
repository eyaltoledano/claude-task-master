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
 * @param {string} [args.tag] - Tag context to operate on (defaults to current active tag).
 * @param {Object} log - Logger object
 * @returns {Promise<Object>} - Remove task result { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function removeTaskDirect(args, log, context = {}) {
	// Destructure expected args
	const { tasksJsonPath, id, projectRoot, tag } = args;
	const { session } = context;
	try {
		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('removeTaskDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
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
				}
			};
		}

		// Split task IDs if comma-separated
		const taskIdArray = id.split(',').map((taskId) => taskId.trim());

		log.info(
			`Removing ${taskIdArray.length} task(s) with ID(s): ${taskIdArray.join(', ')} from ${tasksJsonPath}${tag ? ` in tag '${tag}'` : ''}`
		);

		// Validate all task IDs exist before proceeding
		const data = readJSON(tasksJsonPath, projectRoot, tag);
		if (!data || !data.tasks) {
			return {
				success: false,
				error: {
					code: 'INVALID_TASKS_FILE',
					message: `No valid tasks found in ${tasksJsonPath}${tag ? ` for tag '${tag}'` : ''}`
				}
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
					message: `The following tasks were not found${tag ? ` in tag '${tag}'` : ''}: ${invalidTasks.join(', ')}`
				}
			};
		}

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		try {
			// Call removeTask with proper context including tag
			const result = await removeTask(tasksJsonPath, id, {
				projectRoot,
				tag
			});

			if (!result.success) {
				return {
					success: false,
					error: {
						code: 'REMOVE_TASK_ERROR',
						message: result.errors.join('; ') || 'Failed to remove tasks',
						details: result.errors
					}
				};
			}

			log.info(`Successfully removed ${result.removedTasks.length} task(s)`);

			return {
				success: true,
				data: {
					totalTasks: taskIdArray.length,
					successful: result.removedTasks.length,
					failed: result.errors.length,
					removedTasks: result.removedTasks,
					messages: result.messages,
					errors: result.errors,
					tasksPath: tasksJsonPath,
					tag: data.tag || tag || 'master'
				}
			};
		} finally {
			// Restore normal logging
			disableSilentMode();
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
			}
		};
	}
}
