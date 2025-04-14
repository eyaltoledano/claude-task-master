/**
 * Direct function wrapper for clearSubtasks
 */

import { clearSubtasks } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import fs from 'fs';

/**
 * Clear subtasks from specified tasks
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} [args.id] - Task IDs (comma-separated) to clear subtasks from
 * @param {boolean} [args.all] - Clear subtasks from all tasks
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function clearSubtasksDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, id, all } = args;
	try {
		log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('clearSubtasksDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		// Either id or all must be provided
		if (!id && !all) {
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message:
						'Either task IDs with id parameter or all parameter must be provided'
				}
			};
		}

		// Use provided path
		const tasksPath = tasksJsonPath;

		// Check if tasks.json exists
		if (!fs.existsSync(tasksPath)) {
			return {
				success: false,
				error: {
					code: 'FILE_NOT_FOUND_ERROR',
					message: `Tasks file not found at ${tasksPath}`
				}
			};
		}

		let taskIds;

		// If all is specified, get all task IDs
		if (all) {
			log.info('Clearing subtasks from all tasks');
			const data = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			if (!data || !data.tasks || data.tasks.length === 0) {
				return {
					success: false,
					error: {
						code: 'INPUT_VALIDATION_ERROR',
						message: 'No valid tasks found in the tasks file'
					}
				};
			}
			taskIds = data.tasks.map((t) => t.id).join(',');
		} else {
			// Use the provided task IDs
			taskIds = id;
		}

		log.info(`Clearing subtasks from tasks: ${taskIds}`);

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the core function
		clearSubtasks(tasksPath, taskIds);

		// Restore normal logging
		disableSilentMode();

		// Read the updated data to provide a summary
		const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
		const taskIdArray = taskIds.split(',').map((id) => parseInt(id.trim(), 10));

		// Build a summary of what was done
		const clearedTasksCount = taskIdArray.length;
		const taskSummary = taskIdArray.map((id) => {
			const task = updatedData.tasks.find((t) => t.id === id);
			return task ? { id, title: task.title } : { id, title: 'Task not found' };
		});

		return {
			success: true,
			data: {
				message: `Successfully cleared subtasks from ${clearedTasksCount} task(s)`,
				tasksCleared: taskSummary
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error in clearSubtasksDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message
			}
		};
	}
}
