/**
 * generate-task-files.js
 * Direct function implementation for generating task files from tasks.json
 */

import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for generateTaskFiles with error handling.
 *
 * @param {Object} args - Command arguments containing tasksJsonPath and outputDir.
 * @param {Object} log - Logger object.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function generateTaskFilesDirect(args, log) {
	// Destructure expected args
	const { tasksJsonPath, outputDir } = args;
	try {
		log.info(`Generating task files with args: ${JSON.stringify(args)}`);

		// Check if paths were provided
		if (!tasksJsonPath) {
			const errorMessage = 'tasksJsonPath is required but was not provided.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: errorMessage }
			};
		}
		if (!outputDir) {
			const errorMessage = 'outputDir is required but was not provided.';
			log.error(errorMessage);
			return {
				success: false,
				error: { code: 'MISSING_ARGUMENT', message: errorMessage }
			};
		}

		// Use the provided paths
		const tasksPath = tasksJsonPath;
		const resolvedOutputDir = outputDir;

		log.info(`Generating task files from ${tasksPath} to ${resolvedOutputDir}`);

		// Execute core generateTaskFiles function in a separate try/catch
		try {
			// Enable silent mode to prevent logs from being written to stdout
			enableSilentMode();

			// The function is synchronous despite being awaited elsewhere
			generateTaskFiles(tasksPath, resolvedOutputDir);

			// Restore normal logging after task generation
			disableSilentMode();
		} catch (genError) {
			// Make sure to restore normal logging even if there's an error
			disableSilentMode();

			log.error(`Error in generateTaskFiles: ${genError.message}`);
			return {
				success: false,
				error: { code: 'GENERATE_FILES_ERROR', message: genError.message }
			};
		}

		// Return success with file paths
		return {
			success: true,
			data: {
				message: `Successfully generated task files`,
				tasksPath: tasksPath,
				outputDir: resolvedOutputDir,
				taskFiles:
					'Individual task files have been generated in the output directory'
			}
		};
	} catch (error) {
		// Make sure to restore normal logging if an outer error occurs
		disableSilentMode();

		log.error(`Error generating task files: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'GENERATE_TASKS_ERROR',
				message: error.message || 'Unknown error generating task files'
			}
		};
	}
}
