/**
 * generate-task-files.js
 * Direct function implementation for generating task files, specific to local provider.
 */

// Removed direct import of generateTaskFiles
// Removed silent mode utils
// Removed path import
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import { log as mcpLogUtil } from '../../../../scripts/modules/utils.js'; // Use a distinct name if log is passed

/**
 * Direct function wrapper for generating task files, checking provider compatibility.
 *
 * @param {Object} args - Command arguments.
 * @param {string} [args.file] - Optional path to the tasks.json file (for local provider).
 * @param {string} [args.outputDir] - Optional output directory path.
 * @param {Object} log - Logger object provided by MCP framework.
 * @returns {Promise<Object>} - Result object with success status and data/error information.
 */
export async function generateTaskFilesDirect(args, log) {
	const { file, outputDir } = args;
	try {
		log.info(`Attempting to generate task files with args: ${JSON.stringify(args)}`);

		const provider = await getTaskProvider();

		// Check if the provider supports generating task files
		if (typeof provider.generateTaskFiles !== 'function') {
			const errorMsg = 'Generating task files is not supported by the current task provider (e.g., Jira).';
			log.warn(errorMsg);
			return {
				success: false,
				error: {
					code: 'UNSUPPORTED_PROVIDER',
					message: errorMsg
				}
			};
		}

		// Provider supports it, proceed (likely LocalTaskManager)
		const providerOptions = { file, outputDir, mcpLog: log };

		// Call the provider's method
		// Assuming it returns { success: boolean, data?: { message, generatedCount }, error?: { code, message } }
		const result = await provider.generateTaskFiles(providerOptions);

		if (result.success) {
			log.info(`Provider successfully generated task files: ${result.data?.message || 'Operation completed.'}`);
			return {
				success: true,
				data: result.data || { message: 'Task files generated successfully.' },
				fromCache: false // Operation modifies state
			};
		} else {
			log.error(`Provider failed to generate task files: ${result.error?.message || 'Unknown provider error'}`);
			return {
				success: false,
				error: result.error || { code: 'PROVIDER_ERROR', message: 'Provider failed to generate task files.' },
				fromCache: false
			};
		}

	} catch (error) {
		// Catch errors during provider retrieval or execution
		log.error(`Error in generateTaskFilesDirect: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'MCP_DIRECT_FUNCTION_ERROR',
				message: error.message || 'An unexpected error occurred while generating task files.'
			},
			fromCache: false
		};
	}
}
