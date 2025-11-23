/**
 * src/ai-providers/gemini-cli.js
 *
 * Implementation for interacting with Gemini models via Gemini CLI
 * using the ai-sdk-provider-gemini-cli package.
 *
 * As of v1.4.0, the SDK provides native structured output support via:
 * - supportsStructuredOutputs = true
 * - defaultObjectGenerationMode = 'json'
 * - responseJsonSchema passed directly to Gemini API
 *
 * This eliminates the need for JSON extraction workarounds.
 * System messages are automatically handled by the SDK's mapPromptToGeminiFormat
 * which extracts them to Gemini's systemInstruction field.
 */

import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import { BaseAIProvider } from './base-provider.js';

export class GeminiCliProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Gemini CLI';
		// Gemini CLI does not support temperature parameter
		this.supportsTemperature = false;
	}

	/**
	 * Override validateAuth to handle Gemini CLI authentication options.
	 * Gemini CLI is designed to use pre-configured OAuth authentication.
	 * Users choose gemini-cli specifically to leverage their existing
	 * gemini auth login credentials, not to use API keys.
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// No validation needed - the SDK will handle auth internally
		// via OAuth (primary) or API key (optional fallback)
	}

	/**
	 * Creates and returns a Gemini CLI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Optional Gemini API key (rarely used with gemini-cli)
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Promise<Function>} Gemini CLI client function
	 * @throws {Error} If initialization fails
	 */
	async getClient(params) {
		try {
			// Primary use case: Use existing gemini CLI authentication via OAuth
			// Secondary use case: Direct API key (for compatibility)
			let authOptions = {};

			if (params.apiKey && params.apiKey !== 'gemini-cli-no-key-required') {
				// API key provided - use it for compatibility
				authOptions = {
					authType: 'api-key',
					apiKey: params.apiKey
				};
			} else {
				// Expected case: Use gemini CLI authentication via OAuth
				authOptions = {
					authType: 'oauth-personal'
				};
			}

			// Add baseURL if provided (for custom endpoints)
			if (params.baseURL) {
				authOptions.baseURL = params.baseURL;
			}

			// Create and return the provider
			return createGeminiProvider(authOptions);
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Returns the name of the API key environment variable.
	 * @returns {string} API key environment variable name
	 */
	getRequiredApiKeyName() {
		return 'GEMINI_API_KEY';
	}

	/**
	 * Indicates whether an API key is required.
	 * Gemini CLI primarily uses OAuth, so API key is optional.
	 * @returns {boolean} False - API key is not required
	 */
	isRequiredApiKey() {
		return false;
	}
}
