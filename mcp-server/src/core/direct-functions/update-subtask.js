/**
 * update-subtask.js
 * Direct function implementation for updating a subtask using appropriate provider.
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
 * Direct function wrapper for updateSubtask via configured provider.
 *
 * @param {Object} args - Command arguments (id, prompt, research, file, projectRoot).
 * @param {Object} log - Logger object.
 * @param {Object} context - Tool context { session }.
 * @returns {Promise<Object>} - Result object { success: boolean, data?: any, error?: { code: string, message: string } }.
 */
export async function updateSubtaskDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot, id: subtaskId, prompt, research, file } = args;

	try {
		log.info(`Updating subtask with args: ${JSON.stringify(args)}`);

		// --- Argument Validation ---
		if (!projectRoot) {
			log.warn('updateSubtaskDirect called without projectRoot.');
		}
		if (!subtaskId) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Subtask ID (id) is required' } };
		}
		if (!prompt) {
			return { success: false, error: { code: 'MISSING_ARGUMENT', message: 'Prompt (prompt) is required' } };
		}
		// --- End Argument Validation ---

		const providerType = CONFIG.TASK_PROVIDER?.toLowerCase() || 'local';
		log.info(`Requesting ${providerType} provider to update subtask ${subtaskId}.`);

		// --- Prepare Jira MCP Tools if needed ---
		let jiraMcpTools = {};
		if (providerType === 'jira') {
			const toolPrefix = CONFIG.JIRA_MCP_TOOL_PREFIX || 'mcp_atlassian_jira';
			// Define the tools required by JiraTaskManager's updateSubtask method
			// Likely requires: get_issue, update_issue, add_comment?
			const requiredTools = ['get_issue', 'update_issue', 'add_comment']; // Adjust as needed
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
				prompt, // Pass prompt directly
				research,
				file,
				mcpLog: logWrapper,
				session,
				anthropicClient,
				modelConfig
			};

			// Call the provider's updateSubtask method
			// Assuming signature: updateSubtask(subtaskId, options)
			const updateResult = await provider.updateSubtask(subtaskId, providerOptions);

			// Check provider result
			if (updateResult && updateResult.success) {
				log.info(`Provider successfully updated subtask ${subtaskId}.`);
				return {
					success: true,
					data: updateResult.data || { message: `Successfully updated subtask ${subtaskId}.` },
					fromCache: false // State modification
				};
			} else {
				const errorMsg = updateResult?.error?.message || 'Provider failed to update subtask.';
				const errorCode = updateResult?.error?.code || 'PROVIDER_ERROR';
				log.error(`Provider error updating subtask ${subtaskId}: ${errorMsg} (Code: ${errorCode})`);
				return {
					success: false,
					error: updateResult?.error || { code: errorCode, message: errorMsg },
					fromCache: false
				};
			}
		} catch (error) {
			// No silent mode usually needed, but check
			if (isSilentMode()) {
				disableSilentMode();
			}
			log.error(`Error during updateSubtaskDirect execution: ${error.message}`);
			console.error(error.stack);
			return {
				success: false,
				error: {
					code: error.code || 'PROVIDER_UPDATE_SUBTASK_ERROR',
					message: error.message || `Failed to update subtask ${subtaskId}`
				},
				fromCache: false
			};
		}
	} catch (error) {
		// Catch errors from argument validation or initial setup
		log.error(`Outer error in updateSubtaskDirect: ${error.message}`);
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