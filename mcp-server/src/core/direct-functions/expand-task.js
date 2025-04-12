/**
 * expand-task.js
 * Direct function implementation for expanding a task into subtasks using appropriate provider.
 */

import { getTaskProvider } from '../../../../scripts/modules/task-provider-factory.js';
import {
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	CONFIG // Import CONFIG
} from '../../../../scripts/modules/utils.js';
import {
	getAnthropicClientForMCP,
	getModelConfig
} from '../utils/ai-client-utils.js';

/**
 * Direct function wrapper for expandTask via configured provider.
 *
 * @param {Object} args - Command arguments (id, num, prompt, research, force, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function expandTaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: taskId, num, prompt, research, force, file } = args;

	try {
		log.info(`Expanding task with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('expandTaskDirect called without projectRoot.');
		}
		if (!taskId) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Task ID (id) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to expand task ${taskId}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's expandTask method
			// Likely requires: create_issue, get_issue, update_issue, search
			const requiredTools = ['create_issue', 'get_issue', 'update_issue', 'search']; // Adjust as needed
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

		try {
			// Pass jiraMcpTools in options to the factory
			const provider = await getTaskProvider({ jiraMcpTools });

			// AI client setup needed for the provider
			let anthropicClient = null;
			try {
				anthropicClient = getAnthropicClientForMCP(session, log);
			} catch (error) {
				throw { code: 'AI_CLIENT_ERROR', message: `Cannot initialize Anthropic client: ${error.message}` };
			}
			const modelConfig = getModelConfig(session);

			const providerOptions = {
				num,
				prompt,
				research,
				force,
				file,
				mcpLog: logWrapper,
				session,
				anthropicClient,
				modelConfig
			};

			// Call the provider's expandTask method
			// Assuming signature: expandTask(taskId, options)
			const expandResult = await provider.expandTask(taskId, providerOptions);

			// Check provider result
			if (expandResult && expandResult.success) {
				log.info(`Provider successfully expanded task ${taskId}.`);
				return {
					success: true,
					data: expandResult.data || { message: `Successfully expanded task ${taskId}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = expandResult?.error?.message || 'Provider failed to expand task.';
				const errorCode = expandResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error expanding task ${taskId}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: expandResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			log.error(`Error during expandTaskDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_EXPAND_TASK_ERROR',
					message: error.message || `Failed to expand task ${taskId}`
				},
				fromCache: false
			};
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in expandTaskDirect: ${error.message}`);
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
