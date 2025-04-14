/**
 * next-task.js
 * Direct function implementation for finding the next task to work on
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import { getCachedOrExecute } from '../../tools/utils.js';
import { log as mcpLogUtil } from '../../../../scripts/modules/utils.js'; // Use a distinct name if log is passed

/**
 * Direct function wrapper for finding the next task using the configured provider.
 *
 * @param {Object} args - Command arguments
 * @param {string} [args.file] - Optional path to the tasks file (for local provider)
 * @param {Object} log - Logger object provided by MCP framework
 * @returns {Promise<Object>} - Next task result { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }
 */
export async function nextTaskDirect(args, log) {
	const { file } = args; // Expect file path, not tasksJsonPath

	// Generate a cache key based on provider type and potentially the file path
	// This needs refinement - how to make cache key robust across providers?
	// For now, simplest key based on file path (might be null for Jira)
	const cacheKey = `nextTask:${file || 'default'}`;

	const coreNextTaskAction = async () => {
		try {
			log.info(`Finding next task using provider. Options: ${JSON.stringify({ file })}`);

			const provider = await getTaskProvider();
			const providerOptions = { file, mcpLog: log }; // Pass file and logger

			// Call provider's findNextTask method
			const result = await provider.findNextTask(providerOptions);

			if (!result || !result.success) {
			    const errorMsg = result?.error?.message || 'Provider failed to find next task.';
				log.error(`Provider error finding next task: ${errorMsg}`);
                return {
                    success: false,
                    error: result?.error || { code: 'PROVIDER_ERROR', message: errorMsg }
                };
			}

			if (!result.data || !result.data.nextTask) {
				log.info('No eligible next task found by provider.');
				return {
					success: true,
					data: {
						message:
							'No eligible next task found. All tasks are either completed or have unsatisfied dependencies',
						nextTask: null
					}
				};
			}

			log.info(`Successfully found next task ${result.data.nextTask.id || result.data.nextTask.key}`);
			return {
				success: true,
				data: result.data // Pass the entire data object from the provider
			};

		} catch (error) {
			log.error(`Error during coreNextTaskAction: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'CORE_ACTION_ERROR',
					message: error.message || 'Failed to execute core next task logic'
				}
			};
		}
	};

	// Use the caching utility
	try {
		const result = await getCachedOrExecute({
			cacheKey,
			actionFn: coreNextTaskAction,
			log,
			// Consider cache duration/invalidation strategy
		});
		log.info(`nextTaskDirect completed. From cache: ${result.fromCache}`);
		return result;
	} catch (error) {
		log.error(`Unexpected error during getCachedOrExecute for nextTask: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CACHE_UTIL_ERROR',
				message: error.message
			},
			fromCache: false
		};
	}
}
