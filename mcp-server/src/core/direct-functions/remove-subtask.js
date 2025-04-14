/**
 * remove-subtask.js
 * Direct function implementation for removing a subtask using appropriate provider.
 */

// Corrected import path for task-provider-factory
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';

/**
 * Direct function wrapper for removing a subtask via configured provider.
 *
 * @param {Object} args - Command arguments (id, convert, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function removeSubtaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: subtaskIdString, convert, file } = args; // Added file

	try {
		log.info(`Removing subtask with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('removeSubtaskDirect called without projectRoot.');
		}
		if (!subtaskIdString) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Subtask ID(s) (id) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		const targetDescription = `subtask(s) ${subtaskIdString}${convert ? ' (converting to task)' : ''}`;
		log.info(`Requesting ${providerType} provider to remove ${targetDescription}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's removeSubtask method
			// Likely requires: delete_issue, update_issue, search, get_issue
			const requiredTools = ['delete_issue', 'update_issue', 'search', 'get_issue']; // Adjust as needed
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

		const subtaskIds = subtaskIdString.split(',').map(id => id.trim());

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
				convert,
				file,
				mcpLog: logWrapper,
				session
			};

			// Call the provider's removeSubtask method
			const removeResult = await provider.removeSubtask(subtaskIds, providerOptions);

			disableSilentMode();

			// Check provider result
			if (removeResult && removeResult.success) {
				log.info(`Provider successfully removed ${targetDescription}.`);
				return {
					success: true,
					data: removeResult.data || { message: `Successfully removed ${targetDescription}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = removeResult?.error?.message || 'Provider failed to remove subtask.';
				const errorCode = removeResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error removing subtask ${subtaskIds.join(', ')}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: removeResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during removeSubtaskDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_REMOVE_SUBTASK_ERROR',
					message: error.message || `Failed to remove ${targetDescription}`
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
		log.error(`Outer error in removeSubtaskDirect: ${error.message}`);
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
