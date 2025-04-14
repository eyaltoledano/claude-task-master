/**
 * get-next-task.js
 * Direct function implementation for getting the next task using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';
import { getCachedOrExecute } from '../../tools/utils.js';

/**
 * Direct function wrapper for getNextTask via configured provider.
 *
 * @param {Object} args - Command arguments (file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function getNextTaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, file } = args;

	try {
		log.info(`Getting next task with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('getNextTaskDirect called without projectRoot.');
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting next task from ${providerType} provider.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's getNextTask method
			// Likely requires: search, get_issue
			const requiredTools = ['search', 'get_issue']; // Adjust as needed
			for (const toolName of requiredTools) {
				const fullToolName = `${toolPrefix}_${toolName}`;
				if (typeof global[fullToolName] === 'function') {
					jiraMcpTools[toolName] = global[fullToolName];
				} else {
					log.warn(`Jira MCP tool function not found in global scope: ${fullToolName}`);
				}
			}
			log.debug('Prepared Jira MCP Tools for factory:', Object.keys(jiraMcpTools));
		}
		// --- End Jira MCP Tools Preparation ---

		const logWrapper = {
			info: (message, ...rest) => log.info(message, ...rest),
			warn: (message, ...rest) => log.warn(message, ...rest),
			error: (message, ...rest) => log.error(message, ...rest),
			debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
			success: (message, ...rest) => log.info(message, ...rest)
		};

		// Cache key should probably include projectRoot and file path if provided
		const cacheKey = `nextTask:${projectRoot}:${file || 'default'}`;

		const coreActionFn = async () => {
			enableSilentMode();
			try {
				// Pass jiraMcpTools in options to the factory
				const provider = await getTaskProvider({ jiraMcpTools });
				const providerOptions = {
					file,
					mcpLog: logWrapper,
					session
				};

				// Call the provider's getNextTask method
				// Assuming signature: getNextTask(options)
				const nextTaskResult = await provider.getNextTask(providerOptions);

				// Check provider result
				if (nextTaskResult && nextTaskResult.success) {
					const nextTask = nextTaskResult.data?.task;
					if (nextTask) {
						log.info(`Provider found next task: ${nextTask.id} - ${nextTask.title}`);
						return { success: true, data: { task: nextTask } }; // Return standard success format
					} else {
						log.info('Provider indicated no next task is available.');
						return { success: true, data: { task: null, message: 'No next task available.' } };
					}
				} else {
					const errorMsg = nextTaskResult?.error?.message || 'Provider failed to get next task.';
					const errorCode = nextTaskResult?.error?.code || 'PROVIDER_ERROR';
					log.error(`Provider error getting next task: ${errorMsg} (Code: ${errorCode})`);
					return { success: false, error: nextTaskResult?.error || { code: errorCode, message: errorMsg } };
				}
			} catch (error) {
				log.error(`Error calling provider getNextTask: ${error.message}`);
				console.error(error.stack);
				return {
					success: false,
					error: {
						code: error.code || 'PROVIDER_GET_NEXT_TASK_ERROR',
						message: error.message || 'Failed to get next task'
					}
				};
			} finally {
				if (isSilentMode()) {
					disableSilentMode();
				}
			}
		};

		try {
			const result = await getCachedOrExecute({
				cacheKey,
				actionFn: coreActionFn,
				log
			});
			log.info(`getNextTaskDirect completed. From cache: ${result.fromCache}`);
			return result;
		} catch (cacheError) {
			log.error(`Unexpected error during getCachedOrExecute for getNextTask: ${cacheError.message}`);
			return {
				success: false,
				error: { code: 'CACHE_UTIL_ERROR', message: cacheError.message },
				fromCache: false
			};
		}

	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in getNextTaskDirect: ${error.message}`);
		if (isSilentMode()) {
			disableSilentMode();
		}
		return {
			success: false,
			error: { code: 'DIRECT_FUNCTION_SETUP_ERROR', message: error.message },
			fromCache: false
		};
	}
} 