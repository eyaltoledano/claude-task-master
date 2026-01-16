/**
 * azure-ai-foundry.js
 * AI provider implementation for Microsoft Azure AI Foundry (Microsoft Foundry).
 *
 * Azure AI Foundry provides access to various models (including Claude, GPT, Llama, etc.)
 * through a unified OpenAI-compatible API endpoint.
 *
 * Configuration:
 * - AZURE_AI_FOUNDRY_API_KEY: API key from your Azure AI Foundry resource
 * - AZURE_AI_FOUNDRY_ENDPOINT: Your Azure AI Foundry endpoint URL
 *   (e.g., https://your-resource.services.ai.azure.com/models)
 *
 * @see https://learn.microsoft.com/en-us/azure/ai-foundry/
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { BaseAIProvider } from './base-provider.js';

/**
 * Azure AI Foundry provider for accessing models deployed in Microsoft Foundry.
 * Uses the OpenAI-compatible API format recommended by Microsoft.
 */
export class AzureAIFoundryProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Azure AI Foundry';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Azure AI Foundry API key
	 */
	getRequiredApiKeyName() {
		return 'AZURE_AI_FOUNDRY_API_KEY';
	}

	/**
	 * Returns whether this provider requires an API key.
	 * @returns {boolean} True - Azure AI Foundry always requires an API key
	 */
	isRequiredApiKey() {
		return true;
	}

	/**
	 * Validates Azure AI Foundry-specific authentication parameters.
	 * @param {object} params - Parameters to validate
	 * @throws {Error} If required parameters are missing
	 */
	validateAuth(params) {
		if (!params.apiKey) {
			throw new Error(
				'Azure AI Foundry API key is required. Set AZURE_AI_FOUNDRY_API_KEY in your environment.'
			);
		}

		if (!params.baseURL) {
			throw new Error(
				'Azure AI Foundry endpoint URL is required. Set it in .taskmaster/config.json global.azureAIFoundryEndpoint or models.[role].baseURL, or set AZURE_AI_FOUNDRY_ENDPOINT in your environment.'
			);
		}
	}

	/**
	 * Normalizes the base URL to ensure proper Azure AI Foundry API routing.
	 * Azure AI Foundry endpoints should point to the models API.
	 *
	 * Supported endpoint formats:
	 * - https://<resource>.services.ai.azure.com (will append /models)
	 * - https://<resource>.services.ai.azure.com/models (used as-is)
	 * - https://<resource>.openai.azure.com (Azure OpenAI format, used as-is)
	 *
	 * @param {string} baseURL - Original base URL
	 * @returns {string} Normalized base URL
	 */
	normalizeBaseURL(baseURL) {
		if (!baseURL) return baseURL;

		try {
			const url = new URL(baseURL);
			let pathname = url.pathname.replace(/\/+$/, ''); // Remove trailing slashes

			// Check if this is an Azure AI Foundry services endpoint
			if (url.hostname.includes('.services.ai.azure.com')) {
				// If path doesn't already have /models, append it
				if (!pathname.includes('/models')) {
					pathname = pathname ? `${pathname}/models` : '/models';
				}
			}
			// For Azure OpenAI endpoints (.openai.azure.com), keep as-is
			// The @ai-sdk/openai-compatible will handle the routing

			url.pathname = pathname;
			return url.toString().replace(/\/$/, ''); // Remove trailing slash
		} catch {
			// Fallback for invalid URLs - return as-is
			return baseURL.replace(/\/+$/, '');
		}
	}

	/**
	 * Creates and returns an Azure AI Foundry client instance.
	 * Uses OpenAI-compatible SDK as recommended by Microsoft for production use.
	 *
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure AI Foundry API key
	 * @param {string} params.baseURL - Azure AI Foundry endpoint URL
	 * @returns {Function} Azure AI Foundry client function
	 * @throws {Error} If client initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			// Normalize the base URL for proper API routing
			const normalizedBaseURL = this.normalizeBaseURL(baseURL);
			const fetchImpl = this.createProxyFetch();

			return createOpenAICompatible({
				name: 'azure-ai-foundry',
				apiKey,
				baseURL: normalizedBaseURL,
				// Azure AI Foundry supports structured outputs for compatible models
				supportsStructuredOutputs: true,
				...(fetchImpl && { fetch: fetchImpl })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
