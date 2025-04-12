/**
 * get-task.js
 * Direct function implementation for getting a specific task using appropriate provider.
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
 * Direct function wrapper for getTask via configured provider.
 *
 * @param {Object} args - Command arguments (id, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function getTaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: taskId, file } = args;

	try {
		log.info(`Getting task with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('getTaskDirect called without projectRoot.');
		}
		if (!taskId) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Task ID (id) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting task ${taskId} from ${providerType} provider.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's getTask method
			// Likely requires: get_issue
			const requiredTools = ['get_issue']; // Adjust as needed
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

		const cacheKey = `getTask:${projectRoot}:${file || 'default'}:${taskId}`;

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

				// Call the provider's getTask method
				// Assuming signature: getTask(taskId, options)
				const taskResult = await provider.getTask(taskId, providerOptions);

				// Check provider result
				if (taskResult && taskResult.success) {
					const task = taskResult.data?.task;
					if (task) {
						log.info(`Provider found task ${taskId}.`);
						return { success: true, data: { task: task } }; // Return standard success format
					} else {
						log.warn(`Provider could not find task ${taskId}.`);
						// Return success:false with specific error code for not found
						return { success: false, error: { code: 'TASK_NOT_FOUND', message: `Task with ID ${taskId} not found.` } };
					}
				} else {
					const errorMsg = taskResult?.error?.message || `Provider failed to get task ${taskId}.`;
					const errorCode = taskResult?.error?.code || 'PROVIDER_ERROR';
					log.error(`Provider error getting task ${taskId}: ${errorMsg} (Code: ${errorCode})`);
					return { success: false, error: taskResult?.error || { code: errorCode, message: errorMsg } };
				}
			} catch (error) {
				log.error(`Error calling provider getTask: ${error.message}`);
				console.error(error.stack);
				return {
					success: false,
					error: {
						code: error.code || 'PROVIDER_GET_TASK_ERROR',
						message: error.message || `Failed to get task ${taskId}`
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
			log.info(`getTaskDirect completed. From cache: ${result.fromCache}`);
			return result;
		} catch (cacheError) {
			log.error(`Unexpected error during getCachedOrExecute for getTask: ${cacheError.message}`);
			return {
				success: false,
				error: { code: 'CACHE_UTIL_ERROR', message: cacheError.message },
				fromCache: false
			};
		}

	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in getTaskDirect: ${error.message}`);
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