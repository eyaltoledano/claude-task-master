/**
 * Direct function wrapper for clearSubtasks
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';

/**
 * Clear subtasks from specified tasks using the configured task provider.
 * @param {Object} args - Function arguments
 * @param {string} [args.id] - Task IDs (comma-separated) to clear subtasks from
 * @param {boolean} [args.all] - Clear subtasks from all tasks
 * @param {string} [args.file] - Optional path to the tasks file (for local provider)
 * @param {Object} log - Logger object provided by MCP framework
 * @param {Object} context - Tool context { session }
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function clearSubtasksDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: taskIdString, all, file } = args;

	try {
		log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('clearSubtasksDirect called without projectRoot.');
		}
		if (!taskIdString && !all) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Either Task ID(s) (id) or the "all" flag is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		const targetDescription = all ? 'all tasks' : `task(s) ${taskIdString}`;
		log.info(`Requesting ${providerType} provider to clear subtasks from ${targetDescription}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's clearSubtasks method
			// Likely requires: search, delete_issue (use with caution!)
			const requiredTools = ['search', 'delete_issue']; // Adjust as needed
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

		const taskIds = all ? null : taskIdString.split(',').map(id => id.trim());

		const logWrapper = {
			info: (message, ...rest) => log.info(message, ...rest),
			warn: (message, ...rest) => log.warn(message, ...rest),
			error: (message, ...rest) => log.error(message, ...rest),
			debug: (message, ...rest) => log.debug && log.debug(message, ...rest),
			success: (message, ...rest) => log.info(message, ...rest)
		};

		enableSilentMode();
		try {
			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });
			const providerOptions = {
				file,
				mcpLog: logWrapper,
				session
			};

			// Call the provider's clearSubtasks method
			// Assuming signature: clearSubtasks(taskIds, options) where taskIds can be null for 'all'
			const clearResult = await provider.clearSubtasks(taskIds, providerOptions);

			disableSilentMode();

			// Check provider result
			if (clearResult && clearResult.success) {
				log.info(`Provider successfully cleared subtasks from ${targetDescription}.`);
				return {
					success: true,
					data: clearResult.data || { message: `Successfully cleared subtasks from ${targetDescription}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = clearResult?.error?.message || 'Provider failed to clear subtasks.';
				const errorCode = clearResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error clearing subtasks: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: clearResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during clearSubtasksDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_CLEAR_SUBTASKS_ERROR',
					message: error.message || `Failed to clear subtasks from ${targetDescription}`
				},
				fromCache: false
			};
		} finally {
			if (isSilentMode()) {
				disableSilentMode();
			}
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in clearSubtasksDirect: ${error.message}`);
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
