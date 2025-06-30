/**
 * src/ai-providers/gemini-cli.js
 *
 * Implementation for interacting with Gemini models via Gemini CLI
 * using the ai-sdk-provider-gemini-cli package.
 */

import { BaseAIProvider } from './base-provider.js';

let createGeminiProvider;

async function loadGeminiCliModule() {
	if (!createGeminiProvider) {
		try {
			const mod = await import('ai-sdk-provider-gemini-cli');
			createGeminiProvider = mod.createGeminiProvider;
		} catch (err) {
			throw new Error(
				"Gemini CLI SDK is not installed. Please install 'ai-sdk-provider-gemini-cli' to use the gemini-cli provider."
			);
		}
	}
}

export class GeminiCliProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Gemini CLI';
	}

	/**
	 * Override validateAuth to handle Gemini CLI authentication options
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Gemini CLI is designed to use pre-configured OAuth authentication
		// Users choose gemini-cli specifically to leverage their existing
		// gemini auth login credentials, not to use API keys.
		// We support API keys for compatibility, but the expected usage
		// is through CLI authentication (no API key required).
		// No validation needed - the SDK will handle auth internally
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
			// Load the Gemini CLI module dynamically
			await loadGeminiCliModule();
			// Primary use case: Use existing gemini CLI authentication
			// Secondary use case: Direct API key (for compatibility)
			let authOptions = {};

			if (params.apiKey && params.apiKey !== 'gemini-cli-no-key-required') {
				// API key provided - use it for compatibility
				authOptions = {
					authType: 'api-key',
					apiKey: params.apiKey
				};
			} else {
				// Expected case: Use gemini CLI authentication
				// Requires: gemini auth login (pre-configured)
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
}
