/**
 * show-task.js
 * Direct function implementation for showing task details
 */

import { findTaskById, readJSON } from '../../../../scripts/modules/utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { findTasksJsonPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for getting task details.
 *
 * @param {Object} args - Command arguments.
 * @param {string} args.id - Task ID to show.
 * @param {string} [args.file] - Optional path to the tasks file (passed to findTasksJsonPath).
 * @param {string} [args.status] - Optional status to filter subtasks by.
 * @param {string} args.projectRoot - Absolute path to the project root directory (already normalized by tool).
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function showTaskDirect(args, log) {
	// Destructure session from context if needed later, otherwise ignore
	// const { session } = context;
	// Destructure projectRoot and other args. projectRoot is assumed normalized.
	const { id, file, status, projectRoot } = args;

	log.info(
		`Showing task direct function. ID: ${id}, File: ${file}, Status Filter: ${status}, ProjectRoot: ${projectRoot}`
	);

	// --- Path Resolution using the passed (already normalized) projectRoot ---
	let tasksJsonPath;
	try {
		// Use the projectRoot passed directly from args
		tasksJsonPath = findTasksJsonPath(
			{ projectRoot: projectRoot, file: file },
			log
		);
		log.info(`Resolved tasks path: ${tasksJsonPath}`);
	} catch (error) {
		log.error(`Error finding tasks.json: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'TASKS_FILE_NOT_FOUND',
				message: `Failed to find tasks.json: ${error.message}`
			}
		};
	}
	// --- End Path Resolution ---

	// --- Rest of the function remains the same, using tasksJsonPath ---
	try {
		const tasksData = readJSON(tasksJsonPath);
		if (!tasksData || !tasksData.tasks) {
			return {
				success: false,
				error: { code: 'INVALID_TASKS_DATA', message: 'Invalid tasks data' }
			};
		}

		const { task, originalSubtaskCount } = findTaskById(
			tasksData.tasks,
			id,
			status
		);

		if (!task) {
			return {
				success: false,
				error: {
					code: 'TASK_NOT_FOUND',
					message: `Task or subtask with ID ${id} not found`
				}
			};
		}

		log.info(`Successfully retrieved task ${id}.`);

		const returnData = { ...task };
		if (originalSubtaskCount !== null) {
			returnData._originalSubtaskCount = originalSubtaskCount;
			returnData._subtaskFilter = status;
		}

		return { success: true, data: returnData };
	} catch (error) {
		log.error(`Error showing task ${id}: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'TASK_OPERATION_ERROR',
				message: error.message
			}
		};
	}
}
