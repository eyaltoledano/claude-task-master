/**
 * remove-dependency.js
 * Direct function implementation for removing a task dependency using appropriate provider.
 */

// Corrected import path for task-provider-factory
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG
} from '../../../../scripts/modules/utils.js';
// Removed config loader import

/**
 * Direct function wrapper for removeDependency via configured provider.
 *
 * @param {Object} args - Command arguments (id, dependsOn, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function removeDependencyDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id, dependsOn, file } = args; // Added file

	try {
		log.info(`Removing dependency with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('removeDependencyDirect called without projectRoot.');
		}
		if (!id || !dependsOn) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Both Task ID (id) and Depends On ID (dependsOn) are required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to remove dependency: task ${id} no longer depends on ${dependsOn}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's removeDependency method
			// Likely requires: search, update_issue, get_issue, delete_link?
			const requiredTools = ['search', 'update_issue', 'get_issue', 'delete_link']; // Adjust as needed
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

		enableSilentMode();
		try {
			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });
			const providerOptions = {
				file,
				mcpLog: logWrapper,
				session
			};

			// Call the provider's removeDependency method
			const removeResult = await provider.removeDependency(id, dependsOn, providerOptions);

			disableSilentMode();

			// Check provider result
			if (removeResult && removeResult.success) {
				log.info(`Provider successfully removed dependency: task ${id} from ${dependsOn}.`);
				return {
					success: true,
					data: removeResult.data || { message: `Successfully removed dependency ${dependsOn} from task ${id}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = removeResult?.error?.message || 'Provider failed to remove dependency.';
				const errorCode = removeResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error removing dependency: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: removeResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during removeDependencyDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_REMOVE_DEPENDENCY_ERROR',
					message: error.message || `Failed to remove dependency ${dependsOn} from task ${id}`
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
		log.error(`Outer error in removeDependencyDirect: ${error.message}`);
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
