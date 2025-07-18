/**
 * Direct function wrapper for clearSubtasks
 */

import { clearSubtasks } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	readJSON
} from '../../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Clear subtasks from specified tasks
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Function arguments
 * @param {string} [args.id] - Task IDs (comma-separated) to clear subtasks from
 * @param {boolean} [args.all] - Clear subtasks from all tasks
 * @param {string} [args.tag] - Tag context to operate on (defaults to current active tag)
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function clearSubtasksDirect(taskMaster, args, log) {
	// Destructure expected args
	const { id, all, tag } = args;
	try {
		log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);

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

		// Check if tasks.json exists
		if (!fs.existsSync(taskMaster.getTasksPath())) {
			return {
				success: false,
				error: {
					code: 'FILE_NOT_FOUND_ERROR',
					message: `Tasks file not found at ${taskMaster.getTasksPath()}`
				}
			};
		}

		let taskIds;

		// Use readJSON which handles silent migration and tag resolution
		const data = readJSON(
			taskMaster.getTasksPath(),
			taskMaster.getProjectRoot(),
			tag
		);

		if (!data || !data.tasks) {
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: `No tasks found in tasks file: ${taskMaster.getTasksPath()}`
				}
			};
		}

		const currentTag = data.tag || 'master';
		const tasks = data.tasks;

		// If all is specified, get all task IDs
		if (all) {
			log.info(`Clearing subtasks from all tasks in tag '${currentTag}'`);
			if (tasks.length === 0) {
				return {
					success: false,
					error: {
						code: 'INPUT_VALIDATION_ERROR',
						message: `No tasks found in tag context '${currentTag}'`
					}
				};
			}
			taskIds = tasks.map((t) => t.id).join(',');
		} else {
			// Use the provided task IDs
			taskIds = id;
		}

		log.info(`Clearing subtasks from tasks: ${taskIds} in tag '${currentTag}'`);

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the core function
		clearSubtasks(taskMaster.getTasksPath(), taskIds, {
			projectRoot: taskMaster.getProjectRoot(),
			tag: currentTag
		});

		// Restore normal logging
		disableSilentMode();

		// Read the updated data to provide a summary
		const updatedData = readJSON(
			taskMaster.getTasksPath(),
			taskMaster.getProjectRoot(),
			currentTag
		);
		const taskIdArray = taskIds.split(',').map((id) => parseInt(id.trim(), 10));

		// Build a summary of what was done
		const clearedTasksCount = taskIdArray.length;
		const updatedTasks = updatedData.tasks || [];

		const taskSummary = taskIdArray.map((id) => {
			const task = updatedTasks.find((t) => t.id === id);
			return task ? { id, title: task.title } : { id, title: 'Task not found' };
		});

		return {
			success: true,
			data: {
				message: `Successfully cleared subtasks from ${clearedTasksCount} task(s) in tag '${currentTag}'`,
				tasksCleared: taskSummary,
				tag: currentTag
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
