/**
 * Direct function wrapper for moveTask
 */

import { moveTask } from '../../../../scripts/modules/task-manager.js';
import { findTasksPath } from '../utils/path-utils.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Move a task or subtask to a new position
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file
 * @param {string} args.sourceId - ID of the task/subtask to move (e.g., '5' or '5.2')
 * @param {string} args.destinationId - ID of the destination (e.g., '7' or '7.3')
 * @param {string} args.file - Alternative path to the tasks.json file
 * @param {string} args.projectRoot - Project root directory
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: Object}>}
 */
export async function moveTaskDirect(args, log, context = {}) {
	const { session } = context;

	// Validate required parameters
	if (!args.sourceId) {
		return {
			success: false,
			error: {
				message: 'Source ID is required',
				code: 'MISSING_SOURCE_ID'
			}
		};
	}

	if (!args.destinationId) {
		return {
			success: false,
			error: {
				message: 'Destination ID is required',
				code: 'MISSING_DESTINATION_ID'
			}
		};
	}

	try {
		// Find tasks.json path if not provided
		let tasksPath = args.tasksJsonPath || args.file;
		if (!tasksPath) {
			if (!args.projectRoot) {
				return {
					success: false,
					error: {
						message:
							'Project root is required if tasksJsonPath is not provided',
						code: 'MISSING_PROJECT_ROOT'
					}
				};
			}
			tasksPath = findTasksPath(args, log);
		}

		// Enable silent mode to prevent console output during MCP operation
		enableSilentMode();

		// Call the core moveTask function, always generate files
		const result = await moveTask(
			tasksPath,
			args.sourceId,
			args.destinationId,
			true
		);

		// Restore console output
		disableSilentMode();

		return {
			success: true,
			data: {
				movedTask: result.movedTask,
				message: `Successfully moved task/subtask ${args.sourceId} to ${args.destinationId}`
			}
		};
	} catch (error) {
		// Restore console output in case of error
		disableSilentMode();

		log.error(`Failed to move task: ${error.message}`);

		return {
			success: false,
			error: {
				message: error.message,
				code: 'MOVE_TASK_ERROR'
			}
		};
	}
}
