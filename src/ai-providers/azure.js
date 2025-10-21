/**
 * azure.js
 * AI provider implementation for Azure OpenAI models using Vercel AI SDK.
 */

import { createAzure } from '@ai-sdk/azure';
import { BaseAIProvider } from './base-provider.js';
import MODEL_MAP from '../../scripts/modules/supported-models.json' with { type: 'json' };

export class AzureProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Azure OpenAI';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Azure OpenAI API key
	 */
	getRequiredApiKeyName() {
		return 'AZURE_OPENAI_API_KEY';
	}

	/**
	 * Validates Azure-specific authentication parameters
	 * @param {object} params - Parameters to validate
	 * @throws {Error} If required parameters are missing
	 */
	validateAuth(params) {
		if (!params.apiKey) {
			throw new Error('Azure API key is required');
		}

		if (!params.baseURL) {
			throw new Error(
				'Azure endpoint URL is required. Set it in .taskmasterconfig global.azureBaseURL or models.[role].baseURL'
			);
		}
	}

	/**
	 * Determines if a model requires the responses API endpoint instead of chat/completions
	 * @param {string} modelId - The model ID to check
	 * @returns {boolean} True if the model needs the responses API
	 */
	isReasoningModel(modelId) {
		const azureModels = MODEL_MAP.azure || [];
		const modelDef = azureModels.find(m => m.id === modelId);
		return modelDef?.api_type === 'responses';
	}

	/**
	 * Adjusts the base URL for reasoning models that need the responses endpoint
	 * @param {string} baseURL - Original base URL
	 * @param {string} modelId - Model ID
	 * @returns {string} Adjusted base URL
	 */
	adjustBaseURL(baseURL, modelId) {
		if (!this.isReasoningModel(modelId)) {
			return baseURL;
		}

		// Convert chat/completions URL to responses URL for reasoning models
		if (baseURL.includes('/chat/completions')) {
			return baseURL.replace('/chat/completions', '/responses');
		}

		// If baseURL ends with deployments/<model-name>, add responses endpoint
		if (baseURL.includes('/deployments/')) {
			return baseURL.replace(/\/deployments\/[^\/]+$/, '/responses');
		}

		// If baseURL is just the base, ensure it ends with /responses
		if (!baseURL.endsWith('/responses')) {
			return baseURL.replace(/\/$/, '') + '/responses';
		}

		return baseURL;
	}

	/**
	 * Creates and returns an Azure OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure OpenAI API key
	 * @param {string} params.baseURL - Azure OpenAI endpoint URL (from .taskmasterconfig global.azureBaseURL or models.[role].baseURL)
	 * @param {string} params.modelId - Model ID (used to determine API endpoint)
	 * @returns {Function} Azure OpenAI client function
	 * @throws {Error} If required parameters are missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL, modelId } = params;

			// Adjust base URL for reasoning models
			const adjustedBaseURL = this.adjustBaseURL(baseURL, modelId);

			return createAzure({
				apiKey,
				baseURL: adjustedBaseURL
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
