/**
 * Direct function wrapper for validateDependenciesCommand
 */

import { validateDependenciesCommand } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import fs from 'fs';

/**
 * Validate dependencies in tasks.json
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function validateDependenciesDirect(args, log) {
	// Destructure the explicit tasksJsonPath
	const { tasksJsonPath } = args;

	if (!tasksJsonPath) {
		log.error('validateDependenciesDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			}
		};
	}

	try {
		log.info(`Validating dependencies in tasks: ${tasksJsonPath}`);

		// Use the provided tasksJsonPath
		const tasksPath = tasksJsonPath;

		// Verify the file exists
		if (!fs.existsSync(tasksPath)) {
			return {
				success: false,
				error: {
					code: 'FILE_NOT_FOUND',
					message: `Tasks file not found at ${tasksPath}`
				}
			};
		}

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the original command function using the provided tasksPath
		await validateDependenciesCommand(tasksPath);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				message: 'Dependencies validated successfully',
				tasksPath
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
