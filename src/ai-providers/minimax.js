/**
 * minimax.js
 * AI provider implementation for MiniMax models using the Vercel AI SDK provider.
 */

import { minimax, minimaxOpenAI } from 'vercel-minimax-ai-provider';
import { BaseAIProvider } from './base-provider.js';

export class MinimaxProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'MiniMax';
		this.supportedModels = this.getSupportedModelsForProvider('minimax');
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the MiniMax API key
	 */
	getRequiredApiKeyName() {
		return 'MINIMAX_API_KEY';
	}

	/**
	 * Checks if the provider requires an API key for operation.
	 * @returns {boolean} True if API key is required, false otherwise
	 */
	isRequiredApiKey() {
		return true;
	}

	/**
	 * Creates and returns a MiniMax client instance using Anthropic-compatible API format.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - MiniMax API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} MiniMax client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey } = params;
			
			// Return a function that creates the appropriate model based on the API key
			// The actual model instantiation happens when generating text
			return (modelId) => {
				if (!apiKey) {
					throw new Error('MiniMax API key is required');
				}
				
				// Use Anthropic-compatible API format by default (recommended)
				// This provides better support for advanced features
				return minimax(modelId);
			};
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Gets a specific model instance from the MiniMax provider.
	 * @param {string} modelId - The ID of the model to retrieve
	 * @param {object} params - Additional parameters for model configuration
	 * @returns {object} The model instance for the specified MiniMax model
	 * @throws {Error} If the model is not supported
	 */
	getModel(modelId, params = {}) {
		if (!this.isModelSupported(modelId)) {
			throw new Error(`Model ${modelId} is not supported by ${this.name} provider`);
		}

		const client = this.getClient(params);
		return client(modelId);
	}
}