/**
 * src/ai-providers/custom-sdk/mcp/index.js
 *
 * AI SDK factory function for MCP provider.
 * Creates MCP language model instances with session-based AI operations.
 */

import { MCPLanguageModel } from './language-model.js';

/**
 * Create MCP provider factory function following AI SDK patterns
 * @param {object} options - Provider options
 * @param {object} options.session - MCP session object
 * @param {object} options.defaultSettings - Default settings for the provider
 * @returns {Function} Provider factory function
 */
export function createMCP(options = {}) {
	if (!options.session) {
		throw new Error('MCP provider requires session object');
	}

	// Return the provider factory function that AI SDK expects
	const provider = function (modelId, settings = {}) {
		if (new.target) {
			throw new Error(
				'The MCP model function cannot be called with the new keyword.'
			);
		}

		return new MCPLanguageModel({
			session: options.session,
			modelId: modelId || 'claude-3-5-sonnet-20241022',
			settings: {
				temperature: settings.temperature,
				maxTokens: settings.maxTokens,
				...options.defaultSettings,
				...settings
			}
		});
	};

	// Add required methods for AI SDK compatibility
	provider.languageModel = (modelId, settings) => provider(modelId, settings);
	provider.chat = (modelId, settings) => provider(modelId, settings);

	return provider;
}
