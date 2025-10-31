/**
 * models.js
 * Direct function for managing AI model configurations via MCP
 */

import {
	getModelConfiguration,
	getAvailableModelsList,
	setModel
} from '../../../../scripts/modules/task-manager/models.js';
import {
	enableSilentMode,
	disableSilentMode
} from '../../../../scripts/modules/utils.js';
import { createLogWrapper } from '../../tools/utils.js';
import { CUSTOM_PROVIDERS_ARRAY } from '@tm/core';

// Define supported roles for model setting
const MODEL_ROLES = ['main', 'research', 'fallback'];

/**
 * Determine provider hint from custom provider flags
 * @param {Object} args - Arguments containing provider flags
 * @returns {string|undefined} Provider hint or undefined if no custom provider flag is set
 */
function getProviderHint(args) {
	return CUSTOM_PROVIDERS_ARRAY.find((provider) => args[provider]);
}

/**
 * Handle setting models for different roles
 * @param {Object} args - Arguments containing role-specific model IDs
 * @param {Object} context - Context object with session, mcpLog, projectRoot
 * @returns {Object|null} Result if a model was set, null if no model setting was requested
 */
async function handleModelSetting(args, context) {
	for (const role of MODEL_ROLES) {
		const roleKey = `set${role.charAt(0).toUpperCase() + role.slice(1)}`; // setMain, setResearch, setFallback

		if (args[roleKey]) {
			const providerHint = getProviderHint(args);

			return await setModel(role, args[roleKey], {
				...context,
				providerHint,
				...(args.baseURL && { baseURL: args.baseURL })
			});
		}
	}
	return null; // No model setting was requested
}

/**
 * Get or update model configuration
 * @param {Object} args - Arguments passed by the MCP tool
 * @param {Object} log - MCP logger
 * @param {Object} context - MCP context (contains session)
 * @returns {Object} Result object with success, data/error fields
 */
export async function modelsDirect(args, log, context = {}) {
	const { session } = context;
	const { projectRoot } = args; // Extract projectRoot from args

	// Create a logger wrapper that the core functions can use
	const mcpLog = createLogWrapper(log);

	log.info(`Executing models_direct with args: ${JSON.stringify(args)}`);
	log.info(`Using project root: ${projectRoot}`);

	// Validate flags: only one custom provider flag can be used simultaneously
	const customProviderFlags = CUSTOM_PROVIDERS_ARRAY.filter(
		(provider) => args[provider]
	);

	if (customProviderFlags.length > 1) {
		log.error(
			'Error: Cannot use multiple custom provider flags simultaneously.'
		);
		return {
			success: false,
			error: {
				code: 'INVALID_ARGS',
				message:
					'Cannot use multiple custom provider flags simultaneously. Choose only one: openrouter, ollama, bedrock, azure, vertex, or openai-compatible.'
			}
		};
	}

	try {
		enableSilentMode();

		try {
			// Check for the listAvailableModels flag
			if (args.listAvailableModels === true) {
				return await getAvailableModelsList({
					session,
					mcpLog,
					projectRoot
				});
			}

			// Handle setting any model role using unified function
			const modelContext = { session, mcpLog, projectRoot };
			const modelSetResult = await handleModelSetting(args, modelContext);
			if (modelSetResult) {
				return modelSetResult;
			}

			// Default action: get current configuration
			return await getModelConfiguration({
				session,
				mcpLog,
				projectRoot
			});
		} finally {
			disableSilentMode();
		}
	} catch (error) {
		log.error(`Error in models_direct: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'DIRECT_FUNCTION_ERROR',
				message: error.message,
				details: error.stack
			}
		};
	}
}
