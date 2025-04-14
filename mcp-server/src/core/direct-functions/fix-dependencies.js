/**
 * Direct function wrapper for fixDependenciesCommand
 */

import { fixDependenciesCommand } from '../../../../scripts/modules/dependency-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import fs from 'fs';

/**
 * Fix invalid dependencies in tasks.json automatically
 * @param {Object} args - Function arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function fixDependenciesDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath } = args;
	try {
		log.info(`Fixing invalid dependencies in tasks: ${tasksJsonPath}`);

		// Check if tasksJsonPath was provided
		if (!tasksJsonPath) {
			log.error('fixDependenciesDirect called without tasksJsonPath');
			return {
				success: false,
				error: {
					code: 'MISSING_ARGUMENT',
					message: 'tasksJsonPath is required'
				}
			};
		}

		// Use provided path
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

		// Call the original command function using the provided path
		await fixDependenciesCommand(tasksPath);

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				message: 'Dependencies fixed successfully',
				tasksPath
			}
		};
	} catch (error) {
		// Make sure to restore normal logging even if there's an error
		disableSilentMode();

		log.error(`Error fixing dependencies: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'FIX_DEPENDENCIES_ERROR',
				message: error.message
			}
		};
	}
}
