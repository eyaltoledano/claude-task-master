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

	// Validate flags: cannot use both openrouter and ollama simultaneously
	if (args.openrouter && args.ollama) {
		log.error(
			'Error: Cannot use both openrouter and ollama flags simultaneously.'
		);
		return {
			success: false,
			error: {
				code: 'INVALID_ARGS',
				message: 'Cannot use both openrouter and ollama flags simultaneously.'
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
					projectRoot // Pass projectRoot to function
				});
			}

			// Handle setting a specific model
			if (args.setMain) {
				return await setModel('main', args.setMain, {
					session,
					mcpLog,
					projectRoot, // Pass projectRoot to function
					providerHint: args.openrouter
						? 'openrouter'
						: args.ollama
							? 'ollama'
							: undefined // Pass hint
				});
			}

			if (args.setResearch) {
				return await setModel('research', args.setResearch, {
					session,
					mcpLog,
					projectRoot, // Pass projectRoot to function
					providerHint: args.openrouter
						? 'openrouter'
						: args.ollama
							? 'ollama'
							: undefined // Pass hint
				});
			}

			if (args.setFallback) {
				return await setModel('fallback', args.setFallback, {
					session,
					mcpLog,
					projectRoot, // Pass projectRoot to function
					providerHint: args.openrouter
						? 'openrouter'
						: args.ollama
							? 'ollama'
							: undefined // Pass hint
				});
			}

			// Default action: get current configuration
			return await getModelConfiguration({
				session,
				mcpLog,
				projectRoot // Pass projectRoot to function
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
