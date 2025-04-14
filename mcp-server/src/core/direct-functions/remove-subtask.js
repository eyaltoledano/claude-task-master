/**
 * Direct function wrapper for removeSubtask
 */

import { removeSubtask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Remove a subtask from its parent task
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - Subtask ID in format "parentId.subtaskId" (required)
 * @param {boolean} [args.convert] - Whether to convert the subtask to a standalone task
 * @param {boolean} [args.skipGenerate] - Skip regenerating task files
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function removeSubtaskDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, id, convert, skipGenerate } = args;
	try {
		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		log.info(`Removing subtask with args: ${JSON.stringify(args)}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('removeSubtaskDirect called without tasksJsonPath');
			disableSilentMode(); // Disable before returning
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		if (!id) {
			disableSilentMode(); // Disable before returning
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message:
						'Subtask ID is required and must be in format "parentId.subtaskId"'
				}
			};
		}

		// Validate subtask ID format
		if (!id.includes('.')) {
			disableSilentMode(); // Disable before returning
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: `Invalid subtask ID format: ${id}. Expected format: "parentId.subtaskId"`
				}
			};
		}

		// Use provided path
		const tasksPath = tasksJsonPath;

		// Convert convertToTask to a boolean
		const convertToTask = convert === true;

		// Determine if we should generate files
		const generateFiles = !skipGenerate;

		log.info(
			`Removing subtask ${id} (convertToTask: ${convertToTask}, generateFiles: ${generateFiles})`
		);

		// Use the provided tasksPath
		const result = await removeSubtask(
			tasksPath,
			id,
			convertToTask,
			generateFiles
		);

		// Restore normal logging
		disableSilentMode();

		if (convertToTask && result) {
			// Return info about the converted task
			return {
				success: true,
				data: {
					message: `Subtask ${id} successfully converted to task #${result.id}`,
					task: result
				}
			};
		} else {
			// Return simple success message for deletion
			return {
				success: true,
				data: {
					message: `Subtask ${id} successfully removed`
				}
			};
		}
	} catch (error) {
		// Ensure silent mode is disabled even if an outer error occurs
		disableSilentMode();

		log.error(`Error in removeSubtaskDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message
			}
		};
	}
}
