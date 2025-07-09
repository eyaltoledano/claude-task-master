/**
 * Direct function wrapper for validateDependenciesCommand
 */

import { validateDependenciesCommand } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Validate dependencies in tasks.json
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Function arguments
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function validateDependenciesDirect(taskMaster, args, log) {
	try {
		log.info(`Validating dependencies in tasks: ${taskMaster.getTasksPath()}`);

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the original command function using the tasksPath from taskMaster
		await validateDependenciesCommand(taskMaster.getTasksPath());

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				message: 'Dependencies validated successfully',
				tasksPath: taskMaster.getTasksPath()
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error validating dependencies: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'VALIDATION_ERROR',
				message: error.message
			}
		};
	}
}
