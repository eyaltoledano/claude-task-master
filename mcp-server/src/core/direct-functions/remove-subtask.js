/**
 * Direct function wrapper for removeSubtask
 */

import { removeSubtask } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { readJSON } from '../../../../scripts/modules/file-utils.js';
import { findTaskById } from '../../../../scripts/modules/task-utils.js';

/**
 * Remove a subtask from its parent task
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - Subtask ID in format "parentId.subtaskId" (required)
 * @param {boolean} [args.convert] - Whether to convert the subtask to a standalone task
 * @param {boolean} [args.skipGenerate] - Skip regenerating task files
 * @param {string} [args.mode] - Mode for agent-in-the-loop support
 * @param {Object} [args.removal] - Removal object for agent-in-the-loop support
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function removeSubtaskDirect(args, log) {
	// Revert to original signature and logic
	const { tasksJsonPath, id, convert, skipGenerate } = args;
	try {
		enableSilentMode();
		log.info(`Removing subtask with args: ${JSON.stringify(args)}`);
		if (!tasksJsonPath) {
			log.error('removeSubtaskDirect called without tasksJsonPath');
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}
		if (!id) {
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: 'Subtask ID is required and must be in format "parentId.subtaskId"'
				}
			};
		}
		if (!id.includes('.')) {
			disableSilentMode();
			return {
				success: false,
				error: {
					code: 'INPUT_VALIDATION_ERROR',
					message: `Invalid subtask ID format: ${id}. Expected format: "parentId.subtaskId"`
				}
			};
		}
		const tasksPath = tasksJsonPath;
		const convertToTask = convert === true;
		const generateFiles = !skipGenerate;
		log.info(`Removing subtask ${id} (convertToTask: ${convertToTask}, generateFiles: ${generateFiles})`);
		const result = await removeSubtask(tasksPath, id, convertToTask, generateFiles);
		disableSilentMode();
		if (convertToTask && result) {
			return {
				success: true,
				data: {
					message: `Subtask ${id} successfully converted to task #${result.id}`,
					task: result
				}
			};
		} else {
			return {
				success: true,
				data: {
					message: `Subtask ${id} successfully removed`
				}
			};
		}
	} catch (error) {
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
