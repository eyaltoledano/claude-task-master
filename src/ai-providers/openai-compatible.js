/**
 * openai-compatible.js
 * Generic base class for OpenAI-compatible API providers.
 * This allows any provider with an OpenAI-compatible API to be easily integrated.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { BaseAIProvider } from './base-provider.js';

/**
 * Base class for OpenAI-compatible providers (LM Studio, Z.ai, etc.)
 * Provides a flexible foundation for any service with OpenAI-compatible endpoints.
 */
export class OpenAICompatibleProvider extends BaseAIProvider {
	/**
	 * @param {object} config - Provider configuration
	 * @param {string} config.name - Provider display name
	 * @param {string} config.apiKeyEnvVar - Environment variable name for API key
	 * @param {boolean} [config.requiresApiKey=true] - Whether API key is required
	 * @param {string} [config.defaultBaseURL] - Default base URL for the API
	 * @param {Function} [config.getBaseURL] - Function to determine base URL from params
	 * @param {boolean} [config.supportsStructuredOutputs] - Whether provider supports structured outputs
	 */
	constructor(config) {
		super();

		if (!config.name) {
			throw new Error('Provider name is required');
		}
		if (!config.apiKeyEnvVar) {
			throw new Error('API key environment variable name is required');
		}

		this.name = config.name;
		this.apiKeyEnvVar = config.apiKeyEnvVar;
		this.requiresApiKey = config.requiresApiKey !== false; // Default to true
		this.defaultBaseURL = config.defaultBaseURL;
		this.getBaseURLFromParams = config.getBaseURL;
		this.supportsStructuredOutputs = config.supportsStructuredOutputs;
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the API key
	 */
	getRequiredApiKeyName() {
		return this.apiKeyEnvVar;
	}

	/**
	 * Returns whether this provider requires an API key.
	 * @returns {boolean} True if API key is required
	 */
	isRequiredApiKey() {
		return this.requiresApiKey;
	}

	/**
	 * Override auth validation based on requiresApiKey setting
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		if (this.requiresApiKey && !params.apiKey) {
			throw new Error(`${this.name} API key is required`);
		}
	}

	/**
	 * Determines the base URL to use for the API.
	 * @param {object} params - Client parameters
	 * @returns {string|undefined} The base URL to use
	 */
	getBaseURL(params) {
		// If custom baseURL provided in params, use it
		if (params.baseURL) {
			return params.baseURL;
		}

		// If provider has a custom getBaseURL function, use it
		if (this.getBaseURLFromParams) {
			return this.getBaseURLFromParams(params);
		}

		// Otherwise use default baseURL if available
		return this.defaultBaseURL;
	}

	/**
	 * Creates and returns an OpenAI-compatible client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - API key (required if requiresApiKey is true)
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} OpenAI-compatible client function
	 * @throws {Error} If required parameters are missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey } = params;

			// Validate API key if required
			if (this.requiresApiKey && !apiKey) {
				throw new Error(`${this.name} API key is required.`);
			}

			const baseURL = this.getBaseURL(params);

			const clientConfig = {
				// Provider name for SDK (required, used for logging/debugging)
				name: this.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
				// Add proxy support
				fetch: this.createProxyFetch()
			};

			// Only include apiKey if provider requires it
			if (this.requiresApiKey && apiKey) {
				clientConfig.apiKey = apiKey;
			}

			// Include baseURL if available
			if (baseURL) {
				clientConfig.baseURL = baseURL;
			}

			// Configure structured outputs support if specified
			if (this.supportsStructuredOutputs !== undefined) {
				clientConfig.supportsStructuredOutputs = this.supportsStructuredOutputs;
			}

			return createOpenAICompatible(clientConfig);
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
