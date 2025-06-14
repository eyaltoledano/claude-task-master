/**
 * show-task.js
 * Direct function implementation for showing task details
 */

import {
	findTaskById,
	readComplexityReport,
	readJSON
} from '../../../../scripts/modules/utils.js';
import { findTasksPath } from '../utils/path-utils.js';

/**
 * Direct function wrapper for getting task details.
 *
 * @param {Object} args - Command arguments.
 * @param {string} args.id - Task ID to show.
 * @param {string} [args.file] - Optional path to the tasks file (passed to findTasksPath).
 * @param {string} args.reportPath - Explicit path to the complexity report file.
 * @param {string} [args.status] - Optional status to filter subtasks by.
 * @param {string} args.projectRoot - Absolute path to the project root directory (already normalized by tool).
 * @param {Object} log - Logger object.
 * @param {Object} context - Context object containing session data.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function showTaskDirect(args, log) {
	// This function doesn't need session context since it only reads data
	// Destructure projectRoot and other args. projectRoot is assumed normalized.
	const { id, file, reportPath, status, projectRoot } = args;

	log.info(
		`Showing task direct function. ID: ${id}, File: ${file}, Status Filter: ${status}, ProjectRoot: ${projectRoot}`
	);

	// --- Path Resolution using the passed (already normalized) projectRoot ---
	let tasksJsonPath;
	try {
		// Use the projectRoot passed directly from args
		tasksJsonPath = findTasksPath(
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
		const tasksData = readJSON(tasksJsonPath, projectRoot);
		if (!tasksData || !tasksData.tasks) {
			return {
				success: false,
				error: { code: 'INVALID_TASKS_DATA', message: 'Invalid tasks data' }
			};
		}

		const complexityReport = readComplexityReport(reportPath);

		// Parse comma-separated IDs
		const taskIds = id
			.split(',')
			.map((taskId) => taskId.trim())
			.filter((taskId) => taskId.length > 0);

		if (taskIds.length === 0) {
			return {
				success: false,
				error: {
					code: 'INVALID_TASK_ID',
					message: 'No valid task IDs provided'
				}
			};
		}

		// Handle single task ID (existing behavior)
		if (taskIds.length === 1) {
			const { task, originalSubtaskCount } = findTaskById(
				tasksData.tasks,
				taskIds[0],
				complexityReport,
				status
			);

			if (!task) {
				return {
					success: false,
					error: {
						code: 'TASK_NOT_FOUND',
						message: `Task or subtask with ID ${taskIds[0]} not found`
					}
				};
			}

			log.info(`Successfully retrieved task ${taskIds[0]}.`);

			const returnData = { ...task };
			if (originalSubtaskCount !== null) {
				returnData._originalSubtaskCount = originalSubtaskCount;
				returnData._subtaskFilter = status;
			}

			return { success: true, data: returnData };
		}

		// Handle multiple task IDs
		const foundTasks = [];
		const notFoundIds = [];

		taskIds.forEach((taskId) => {
			const { task, originalSubtaskCount } = findTaskById(
				tasksData.tasks,
				taskId,
				complexityReport,
				status
			);

			if (task) {
				const taskData = { ...task };
				if (originalSubtaskCount !== null) {
					taskData._originalSubtaskCount = originalSubtaskCount;
					taskData._subtaskFilter = status;
				}
				foundTasks.push(taskData);
			} else {
				notFoundIds.push(taskId);
			}
		});

		log.info(
			`Successfully retrieved ${foundTasks.length} of ${taskIds.length} requested tasks.`
		);

		// Return multiple tasks with metadata
		return {
			success: true,
			data: {
				tasks: foundTasks,
				requestedIds: taskIds,
				foundCount: foundTasks.length,
				notFoundIds: notFoundIds,
				isMultiple: true
			}
		};
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
