/**
 * generate-task-files.js
 * Direct function implementation for generating task files from tasks.json
 */

import { generateTaskFiles } from '../../../../scripts/modules/task-manager.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import path from 'path';

/**
 * Direct function wrapper for generateTaskFiles with error handling.
 *
 * @param {Object} taskMaster - TaskMaster instance with path resolution
 * @param {Object} args - Command arguments containing outputDir.
 * @param {string} [args.outputDir] - Output directory for generated files (defaults to directory containing tasks.json)
 * @param {Object} log - Logger object.
 * @param {Object} context - Additional context (session)
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function generateTaskFilesDirect(
	taskMaster,
	args,
	log,
	context = {}
) {
	// Destructure expected args
	const { outputDir } = args;
	try {
		log.info(`Generating task files with args: ${JSON.stringify(args)}`);

		const resolvedOutputDir =
			outputDir || path.dirname(taskMaster.getTasksPath());

		log.info(
			`Generating task files from ${taskMaster.getTasksPath()} to ${resolvedOutputDir}`
		);

		// Execute core generateTaskFiles function in a separate try/catch
		try {
			// Enable silent mode to prevent logs from being written to stdout
			enableSilentMode();

			// The function is synchronous despite being awaited elsewhere
			generateTaskFiles(taskMaster.getTasksPath(), resolvedOutputDir);

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
				tasksPath: taskMaster.getTasksPath(),
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
