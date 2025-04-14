/**
 * remove-task.js
 * Direct function implementation for removing a task using appropriate provider.
 */

// Corrected import path for task-provider-factory
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for removeTask via configured provider.
 *
 * @param {Object} args - Command arguments (id, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function removeTaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: taskIdString, file } = args; // Added file

	try {
		log.info(`Removing task with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('removeTaskDirect called without projectRoot.');
		}
		if (!taskIdString) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Task ID(s) (id) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to remove task(s) ${taskIdString}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's removeTask method
			// Likely requires: delete_issue, search, get_issue, update_issue (for dependencies)
			const requiredTools = ['delete_issue', 'search', 'get_issue', 'update_issue']; // Adjust as needed
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

			// Call the provider's removeTask method
			const removeResult = await provider.removeTask(taskIds, providerOptions);

			disableSilentMode();

			// Check provider result
			if (removeResult && removeResult.success) {
				log.info(`Provider successfully removed task(s) ${taskIds.join(', ')}.`);
				return {
					success: true,
					data: removeResult.data || { message: `Successfully removed task(s) ${taskIds.join(', ')}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = removeResult?.error?.message || 'Provider failed to remove task.';
				const errorCode = removeResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error removing task ${taskIds.join(', ')}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: removeResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during removeTaskDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_REMOVE_TASK_ERROR',
					message: error.message || `Failed to remove task(s) ${taskIds.join(', ')}`
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
		log.error(`Outer error in removeTaskDirect: ${error.message}`);
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
