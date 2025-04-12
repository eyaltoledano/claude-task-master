/**
 * Direct function wrapper for fixDependencies using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js'; // Use the factory
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';

/**
 * Fix invalid dependencies automatically via configured provider.
 * @param {Object} args - Function arguments (projectRoot, file).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<{success: boolean, data?: Object, error?: {code: string, message: string}}>}
 */
export async function fixDependenciesDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, file } = args; // Added file

	try {
		log.info(`Fixing dependencies with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			// Warn but don't fail
			log.warn('fixDependenciesDirect called without projectRoot.');
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to fix dependencies.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's fixDependencies method
			// Likely requires: search, update_issue, get_issue, link_issue?, delete_link?
			const requiredTools = ['search', 'update_issue', 'get_issue', 'link_issue', 'delete_link']; // Adjust as needed
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

		enableSilentMode(); // Consider if needed
		try {
			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });
			const providerOptions = {
				file,
				mcpLog: logWrapper,
				session
			};

			// Call the provider's fixDependencies method
			// Assuming signature: fixDependencies(options)
			const fixResult = await provider.fixDependencies(providerOptions);

			disableSilentMode();

			// Interpret fixResult (assuming it returns { success: boolean, data: { fixedCount: number, issues: [...] } } or similar)
			if (fixResult && fixResult.success) {
				const fixes = fixResult.data?.fixes || [];
				const message = fixes.length > 0
					? `Provider fixed ${fixes.length} dependency issues.`
					: 'Provider validation complete. No dependency issues needed fixing.';
				log.info(message);
				return {
					success: true,
					data: {
						message: message,
						fixes: fixes
					},
					fromCache: false // State modification
				};
			} else {
				const errorMsg = fixResult?.error?.message || 'Provider failed to fix dependencies.';
				const errorCode = fixResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error fixing dependencies: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: fixResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			disableSilentMode();
			log.error(`Error during fixDependenciesDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_FIX_DEPENDENCIES_ERROR',
					message: error.message || 'Failed to fix dependencies'
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
		log.error(`Outer error in fixDependenciesDirect: ${error.message}`);
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
