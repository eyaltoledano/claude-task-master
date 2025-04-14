/**
 * set-task-status.js
 * Direct function implementation for setting task status using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for setTaskStatus via configured provider.
 *
 * @param {Object} args - Command arguments (id, status, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string }, fromCache: boolean }.
 */
export async function setTaskStatusDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: taskIdString, status, file } = args;

	try {
		log.info(`Setting task status with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('setTaskStatusDirect called without projectRoot.');
		}
		if (!taskIdString) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Task ID(s) (id) is required' }, fromCache: false };
		}
		if (!status) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Status (status) is required' }, fromCache: false };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to set status '${status}' for task(s) ${taskIdString}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's setTaskStatus method
			// Likely requires: get_issue, update_issue, get_transitions, transition_issue
			const requiredTools = ['get_issue', 'update_issue', 'get_transitions', 'transition_issue']; // Adjust as needed
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

		const taskIds = taskIdString.split(',').map(id => id.trim());

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

			// Call the provider's setTaskStatus method
			const setResult = await provider.setTaskStatus(taskIds, status, providerOptions);

			disableSilentMode();

			// Check provider result
			if (setResult && setResult.success) {
				log.info(`Provider successfully set status '${status}' for task(s) ${taskIds.join(', ')}.`);
				return {
					success: true,
					data: setResult.data || { message: `Successfully set status to '${status}'.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = setResult?.error?.message || 'Provider failed to set task status.';
				const errorCode = setResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error setting status for ${taskIds.join(', ')}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: setResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during setTaskStatusDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_SET_STATUS_ERROR',
					message: error.message || `Failed to set status for task(s) ${taskIds.join(', ')}`
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
		log.error(`Outer error in setTaskStatusDirect: ${error.message}`);
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
