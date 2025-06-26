/**
 * @fileoverview MCP Sampling provider factory and exports
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { McpSamplingLanguageModel } from './language-model.js';

/**
 * @typedef {import('./types.js').McpSamplingSettings} McpSamplingSettings
 * @typedef {import('./types.js').McpSamplingModelId} McpSamplingModelId
 * @typedef {import('./types.js').McpSamplingProvider} McpSamplingProvider
 * @typedef {import('./types.js').McpSamplingProviderSettings} McpSamplingProviderSettings
 */

/**
 * Create a MCP Sampling provider
 * @param {McpSamplingProviderSettings} [options={}] - Provider configuration options
 * @returns {McpSamplingProvider} MCP Sampling provider instance
 */
export function createMcpSampling(options = {}) {
	/**
	 * Create a language model instance
	 * @param {McpSamplingModelId} modelId - Model ID
	 * @param {McpSamplingSettings} [settings={}] - Model settings
	 * @returns {McpSamplingLanguageModel}
	 */
	const createModel = (modelId, settings = {}) => {
		return new McpSamplingLanguageModel({
			id: modelId,
			settings: {
				...options.defaultSettings,
				...settings
			}
		});
	};

	/**
	 * Provider function
	 * @param {McpSamplingModelId} modelId - Model ID
	 * @param {McpSamplingSettings} [settings] - Model settings
	 * @returns {McpSamplingLanguageModel}
	 */
	const provider = function (modelId, settings) {
		if (new.target) {
			throw new Error(
				'The MCP Sampling model function cannot be called with the new keyword.'
			);
		}

		return createModel(modelId, settings);
	};

	provider.languageModel = createModel;
	provider.chat = createModel; // Alias for languageModel

	// Add textEmbeddingModel method that throws NoSuchModelError
	provider.textEmbeddingModel = (modelId) => {
		throw new NoSuchModelError({
			modelId,
			modelType: 'textEmbeddingModel',
			message: 'MCP Sampling does not support text embeddings'
		});
	};

	return /** @type {McpSamplingProvider} */ (provider);
}

/**
 * Default MCP Sampling provider instance
 */
export const mcpSampling = createMcpSampling();

// Provider exports
export { McpSamplingLanguageModel } from './language-model.js';

// Error handling exports
export {
	isAuthenticationError,
	isTimeoutError,
	getErrorMetadata,
	createAPICallError,
	createAuthenticationError,
	createTimeoutError
} from './errors.js';
