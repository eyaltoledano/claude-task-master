/**
 * azure.js
 * AI provider implementation for Azure OpenAI models using Vercel AI SDK.
 */

import { createAzure } from '@ai-sdk/azure';
import { BaseAIProvider } from './base-provider.js';
import { BaseAIProvider } from './base-provider.js';

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
		if (!modelId) return false;

		const azureModels = MODEL_MAP.azure || [];
		const modelDef = azureModels.find((m) => m.id === modelId);

		// First check if we have a direct match in our model definitions
		if (modelDef?.api_type === 'responses') {
			return true;
		}

		// Fallback heuristic for custom Azure deployment names
		// Check if the modelId contains canonical reasoning model base names
		const canonical = modelId.toLowerCase();
		return /^(gpt-5|o1|o3|o4)/.test(canonical);
	}

	/**
	 * Adjusts the base URL for reasoning models that need the responses endpoint
	 * @param {string} baseURL - Original base URL
	 * @param {string} modelId - Model ID
	 * @returns {string} Adjusted base URL
	 */
	adjustBaseURL(baseURL, modelId) {
		if (!this.isReasoningModel(modelId) || !baseURL) return baseURL;

		try {
			const url = new URL(baseURL);
			// Normalize trailing slashes (don't touch query/search)
			let pathname = url.pathname.replace(/\/+$/, '');

			// 1) Replace .../chat/completions with .../responses
			pathname = pathname.replace(/\/chat\/completions$/, '/responses');

			// 2) If path ends with /openai/deployments/<dep>, append /responses
			if (/\/openai\/deployments\/[^/]+$/.test(pathname)) {
				pathname = `${pathname}/responses`;
			}
			// 3) If path ends with /openai, append /responses
			else if (/\/openai$/.test(pathname)) {
				pathname = `${pathname}/responses`;
			}

			url.pathname = pathname;
			return url.toString();
		} catch {
			// Fallback that preserves query string positioning
			const qIdx = baseURL.indexOf('?');
			const path = qIdx >= 0 ? baseURL.slice(0, qIdx) : baseURL;
			const qs = qIdx >= 0 ? baseURL.slice(qIdx) : '';
			let newPath = path.replace('/chat/completions', '/responses');
			if (!/\/responses$/.test(newPath)) {
				if (
					/\/openai\/deployments\/[^/]+$/.test(newPath) ||
					/\/openai$/.test(newPath)
				) {
					newPath = newPath.replace(/\/+$/, '') + '/responses';
				}
			}
			return newPath + qs;
		}
	}

	/**
	 * Creates and returns an Azure OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure OpenAI API key
	 * @param {string} params.baseURL - Azure OpenAI endpoint URL (from .taskmasterconfig global.azureBaseURL or models.[role].baseURL)
	 * @param {string} params.modelId - Model ID (used to determine API endpoint)
	 * @returns {Function} Azure OpenAI client function
	 * @throws {Error} If client initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL, modelId } = params;

			// Adjust base URL for reasoning models
			const adjustedBaseURL = this.adjustBaseURL(baseURL, modelId);
			const fetchImpl = this.createProxyFetch();

			return createAzure({
				apiKey,
				baseURL: adjustedBaseURL,
				...(fetchImpl && { fetch: fetchImpl })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
