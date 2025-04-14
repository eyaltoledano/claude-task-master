/**
 * set-task-status.js
 * Direct function implementation for setting task status
 */

import { setTaskStatus } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for setTaskStatus with error handling.
 *
 * @param {Object} args - Command arguments containing id, status and tasksJsonPath.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function setTaskStatusDirect(args, log) {
	// Destructure expected args, including the resolved tasksJsonPath
	const { tasksJsonPath, id, status } = args;
	try {
		log.info(`Setting task status with args: ${JSON.stringify(args)}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			const errorMessage = 'tasksJsonPath is required but was not provided.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: errorMessage },
				fromCache: false
			};
		}

		// Check required parameters (id and status)
		if (!id) {
			const errorMessage =
				'No task ID specified. Please provide a task ID to update.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_TASK_ID', message: errorMessage },
				fromCache: false
			};
		}

		if (!status) {
			const errorMessage =
				'No status specified. Please provide a new status value.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_STATUS', message: errorMessage },
				fromCache: false
			};
		}

		// Use the provided path
		const tasksPath = tasksJsonPath;

		// Execute core setTaskStatus function
		const taskId = id;
		const newStatus = status;

		log.info(`Setting task ${taskId} status to "${newStatus}"`);

		// Call the core function with proper silent mode handling
		enableSilentMode(); // Enable silent mode before calling core function
		try {
			// Call the core function
			await setTaskStatus(tasksPath, taskId, newStatus, { mcpLog: log });

			log.info(`Successfully set task ${taskId} status to ${newStatus}`);

			// Return success data
			const result = {
				success: true,
				data: {
					message: `Successfully updated task ${taskId} status to "${newStatus}"`,
					taskId,
					status: newStatus,
					tasksPath: tasksPath // Return the path used
				},
				fromCache: false // This operation always modifies state and should never be cached
			};
			return result;
		} catch (error) {
			log.error(`Error setting task status: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'SET_STATUS_ERROR',
					message: error.message || 'Unknown error setting task status'
				},
				fromCache: false
			};
		} finally {
			// ALWAYS restore normal logging in finally block
			disableSilentMode();
		}
	} catch (error) {
		// Ensure silent mode is disabled if there was an uncaught error in the outer try block
		if (isSilentMode()) {
			disableSilentMode();
		}

		log.error(`Error setting task status: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'SET_STATUS_ERROR',
				message: error.message || 'Unknown error setting task status'
			},
			fromCache: false
		};
	}
}
