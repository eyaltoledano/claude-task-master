/**
 * Direct function wrapper for moveTask
 */

import { moveTask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Move a task or subtask to a new position
 * @param {Object} args - Function arguments
 * @param {string} args.sourceId - ID of the task/subtask to move (e.g., '5' or '5.2' or '5,6,7')
 * @param {string} args.destinationId - ID of the destination (e.g., '7' or '7.3' or '7,8,9')
 * @param {string} args.file - Alternative path to the tasks.json file
 * @param {boolean} args.generateFiles - Whether to regenerate task files after moving (default: true)
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: Object}>}
 */
export async function moveTaskDirect(taskMaster, args, log, context = {}) {
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
		// Enable silent mode to prevent console output during MCP operation
		enableSilentMode();

		// Call the core moveTask function with file generation control
		const generateFiles = args.generateFiles !== false; // Default to true
		const result = await moveTask(
			taskMaster.getTasksPath(),
			args.sourceId,
			args.destinationId,
			generateFiles,
			{ projectRoot: taskMaster.getProjectRoot(), tag: args.tag }
		);

		// Restore console output
		disableSilentMode();

		return {
			success: true,
			data: {
				...result,
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
