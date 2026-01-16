/**
 * azure-ai-foundry.js
 * AI provider implementation for Microsoft Azure AI Foundry (Microsoft Foundry).
 *
 * Azure AI Foundry provides access to various models through two endpoints:
 * - OpenAI-compatible models (Phi-4, Llama, Mistral, etc.) via /models endpoint
 * - Anthropic Claude models via /anthropic endpoint (uses Anthropic Messages API)
 *
 * This provider automatically routes requests to the correct endpoint based on model name.
 *
 * Configuration:
 * - AZURE_AI_FOUNDRY_API_KEY: API key from your Azure AI Foundry resource
 * - AZURE_AI_FOUNDRY_ENDPOINT: Your Azure AI Foundry endpoint URL
 *   (e.g., https://your-resource.services.ai.azure.com)
 *
 * @see https://learn.microsoft.com/en-us/azure/ai-foundry/
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { BaseAIProvider } from './base-provider.js';

/**
 * Azure AI Foundry provider for accessing models deployed in Microsoft Foundry.
 * Automatically routes to the correct endpoint based on model type:
 * - Claude models → /anthropic endpoint (Anthropic Messages API)
 * - Other models → /models endpoint (OpenAI-compatible API)
 */
export class AzureAIFoundryProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Azure AI Foundry';
	}

	/**
	 * Determines if a model is an Anthropic/Claude model based on its ID.
	 * @param {string} modelId - The model identifier
	 * @returns {boolean} True if the model is a Claude/Anthropic model
	 */
	isAnthropicModel(modelId) {
		if (!modelId) return false;
		const lowerModelId = modelId.toLowerCase();
		return (
			lowerModelId.includes('claude') || lowerModelId.includes('anthropic')
		);
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
	 * Extracts the base resource URL from various Azure AI Foundry URL formats.
	 * @param {string} baseURL - Original base URL
	 * @returns {string} Base resource URL (e.g., https://resource.services.ai.azure.com)
	 */
	getBaseResourceURL(baseURL) {
		if (!baseURL) return baseURL;

		try {
			const url = new URL(baseURL);
			// Remove any path - just keep protocol + host
			url.pathname = '';
			return url.toString().replace(/\/$/, '');
		} catch {
			// Fallback: try to extract base from string
			const match = baseURL.match(/^(https?:\/\/[^/]+)/);
			return match ? match[1] : baseURL;
		}
	}

	/**
	 * Normalizes the base URL for OpenAI-compatible models (Phi-4, Llama, etc.).
	 * Routes to the /models endpoint.
	 *
	 * Supported endpoint formats:
	 * - https://<resource>.services.ai.azure.com (will append /models)
	 * - https://<resource>.services.ai.azure.com/models (used as-is)
	 * - https://<resource>.services.ai.azure.com/api/projects/<project> (extracts base, appends /models)
	 *
	 * @param {string} baseURL - Original base URL
	 * @returns {string} Normalized base URL ending with /models
	 */
	normalizeBaseURL(baseURL) {
		if (!baseURL) return baseURL;

		try {
			const url = new URL(baseURL);
			let pathname = url.pathname.replace(/\/+$/, ''); // Remove trailing slashes

			// Check if this is an Azure AI Foundry services endpoint
			if (url.hostname.includes('.services.ai.azure.com')) {
				// If the path contains /api/projects/, extract just the base resource URL
				// The /api/projects/ path is for the Azure AI Foundry portal, not for inference
				if (pathname.includes('/api/projects/') || pathname.includes('/api/')) {
					pathname = '/models';
				}
				// If path doesn't already have /models, append it
				else if (!pathname.includes('/models')) {
					pathname = '/models';
				}
			}

			url.pathname = pathname;
			return url.toString().replace(/\/$/, ''); // Remove trailing slash
		} catch {
			// Fallback for invalid URLs - return as-is
			return baseURL.replace(/\/+$/, '');
		}
	}

	/**
	 * Normalizes the base URL for Anthropic/Claude models.
	 * Routes to the /anthropic endpoint which uses the Anthropic Messages API.
	 *
	 * @param {string} baseURL - Original base URL
	 * @returns {string} Normalized base URL ending with /anthropic
	 */
	normalizeAnthropicBaseURL(baseURL) {
		const base = this.getBaseResourceURL(baseURL);
		return `${base}/anthropic`;
	}

	/**
	 * Creates and returns an Azure AI Foundry client instance.
	 * Automatically routes to the correct SDK based on model type:
	 * - Claude models use @ai-sdk/anthropic with /anthropic endpoint
	 * - Other models use @ai-sdk/openai-compatible with /models endpoint
	 *
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure AI Foundry API key
	 * @param {string} params.baseURL - Azure AI Foundry endpoint URL
	 * @param {string} [params.modelId] - Model identifier for routing
	 * @returns {Function} Azure AI Foundry client function
	 * @throws {Error} If client initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL, modelId } = params;
			const fetchImpl = this.createProxyFetch();

			// Route Claude/Anthropic models to the Anthropic endpoint
			if (this.isAnthropicModel(modelId)) {
				const anthropicBaseURL = this.normalizeAnthropicBaseURL(baseURL);

				return createAnthropic({
					apiKey,
					baseURL: anthropicBaseURL,
					headers: {
						'anthropic-version': '2023-06-01'
					},
					...(fetchImpl && { fetch: fetchImpl })
				});
			}

			// Route all other models to the OpenAI-compatible endpoint
			const normalizedBaseURL = this.normalizeBaseURL(baseURL);

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
