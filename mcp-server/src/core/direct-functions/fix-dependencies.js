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
 * @param {Object} taskMaster - TaskMaster instance
 * @param {Object} args - Function arguments
 * @param {string} args.tag - Tag for the project
 * @param {Object} log - Logger object
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function fixDependenciesDirect(taskMaster, args, log) {
	// Destructure expected args
	const { tag } = args;
	try {
		log.info(
			`Fixing invalid dependencies in tasks: ${taskMaster.getTasksPath()}`
		);

		// Verify the file exists
		if (!fs.existsSync(taskMaster.getTasksPath())) {
			return {
				success: false,
				error: {
					code: 'FILE_NOT_FOUND',
					message: `Tasks file not found at ${taskMaster.getTasksPath()}`
				}
			};
		}

		// Enable silent mode to prevent console logs from interfering with JSON response
		enableSilentMode();

		// Call the original command function using the provided path and proper context
		await fixDependenciesCommand(taskMaster.getTasksPath(), {
			context: { projectRoot: taskMaster.getProjectRoot(), tag }
		});

		// Restore normal logging
		disableSilentMode();

		return {
			success: true,
			data: {
				message: 'Dependencies fixed successfully',
				tasksPath: taskMaster.getTasksPath(),
				tag: tag || 'master'
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
