/**
 * add-dependency.js
 * Direct function implementation for adding a task dependency using appropriate provider.
 */

// Corrected import path for task-provider-factory
import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG to read TASK_PROVIDER and JIRA_MCP_TOOL_PREFIX
} from '../../../../scripts/modules/utils.js';
// Removed config loader import

/**
 * Direct function wrapper for addDependency via configured provider.
 *
 * @param {Object} args - Command arguments (id, dependsOn, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function addDependencyDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id, dependsOn, file } = args; // Added file

	try {
		log.info(`Adding dependency with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('addDependencyDirect called without projectRoot.');
		}
		if (!id || !dependsOn) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Both Task ID (id) and Depends On ID (dependsOn) are required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to add dependency: task ${id} depends on ${dependsOn}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira'; // Default prefix
			// Define the tools required by JiraTaskManager's addDependency method
			const requiredTools = ['search', 'get_issue', 'update_issue', 'link_issue']; // Adjust based on JiraTaskManager needs
			for (const toolName of requiredTools) {
				const fullToolName = `${toolPrefix}_${toolName}`;
				if (typeof global[fullToolName] === 'function') {
					jiraMcpTools[toolName] = global[fullToolName];
				} else {
					log.warn(`Jira MCP tool function not found in global scope: ${fullToolName}`);
					// Decide if this is critical - maybe throw error or allow provider to handle missing tools
					// For now, we'll let the provider handle it if a tool is missing.
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

			// Call the provider's addDependency method
			// Assuming signature: addDependency(taskId, dependencyId, options)
			const addResult = await provider.addDependency(id, dependsOn, providerOptions);

			disableSilentMode();

			// Check provider result
			if (addResult && addResult.success) {
				log.info(`Provider successfully added dependency: task ${id} depends on ${dependsOn}.`);
				return {
					success: true,
					data: addResult.data || { message: `Successfully added dependency ${dependsOn} to task ${id}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = addResult?.error?.message || 'Provider failed to add dependency.';
				const errorCode = addResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error adding dependency: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: addResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during addDependencyDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_ADD_DEPENDENCY_ERROR',
					message: error.message || `Failed to add dependency ${dependsOn} to task ${id}`
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
		log.error(`Outer error in addDependencyDirect: ${error.message}`);
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
