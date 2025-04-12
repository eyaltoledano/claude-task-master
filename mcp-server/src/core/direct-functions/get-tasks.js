/**
 * get-tasks.js
 * Direct function implementation for getting tasks using appropriate provider.
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
 * Direct function wrapper for getTasks via configured provider.
 *
 * @param {Object} args - Command arguments (status, withSubtasks, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function getTasksDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, status, withSubtasks, file, epicKey } = args; // Added file and epicKey

	try {
		log.info(`Getting tasks with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot && !file) { // Need either projectRoot or explicit file path
			log.warn('getTasksDirect called without projectRoot or file path.');
			// Provider will likely fail, let it handle specific error.
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting tasks from ${providerType} provider.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's getTasks method
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

		// Cache key should include filters
		const cacheKey = `getTasks:${projectRoot}:${file || 'default'}:${status || 'all'}:${withSubtasks || false}:${epicKey || 'none'}`;

		const coreActionFn = async () => {
			enableSilentMode();
			try {
				// Pass jiraMcpTools in options to the factory
				const provider = await getTaskProvider({ jiraMcpTools });
				const providerOptions = {
					status,
					withSubtasks,
					file,
					epicKey, // Pass epicKey to provider
					mcpLog: logWrapper,
					session
				};

				// Call the provider's getTasks method
				// Assuming signature: getTasks(options)
				const tasksResult = await provider.getTasks(providerOptions);

				// Check provider result
				if (tasksResult && tasksResult.success) {
					const tasks = tasksResult.data?.tasks || [];
					log.info(`Provider returned ${tasks.length} tasks.`);
					return { success: true, data: { tasks: tasks } }; // Return standard success format
				} else {
					const errorMsg = tasksResult?.error?.message || 'Provider failed to get tasks.';
					const errorCode = tasksResult?.error?.code || 'PROVIDER_ERROR';
					log.error(`Provider error getting tasks: ${errorMsg} (Code: ${errorCode})`);
					return { success: false, error: tasksResult?.error || { code: errorCode, message: errorMsg } };
				}
			} catch (error) {
				log.error(`Error calling provider getTasks: ${error.message}`);
				console.error(error.stack);
				return {
					success: false,
					error: {
						code: error.code || 'PROVIDER_GET_TASKS_ERROR',
						message: error.message || 'Failed to get tasks'
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
			log.info(`getTasksDirect completed. From cache: ${result.fromCache}`);
			return result;
		} catch (cacheError) {
			log.error(`Unexpected error during getCachedOrExecute for getTasks: ${cacheError.message}`);
			return {
				success: false,
				error: { code: 'CACHE_UTIL_ERROR', message: cacheError.message },
				fromCache: false
			};
		}

	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in getTasksDirect: ${error.message}`);
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