/**
 * glm.js
 * AI provider implementation for GLM models using Z.ai API endpoints.
 * Supports both Coding Plan and Common API routes.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';

export class GLMProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'GLM';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the GLM API key
	 */
	getRequiredApiKeyName() {
		return 'GLM_API_KEY';
	}

	/**
	 * Creates and returns a GLM client instance using OpenAI-compatible API.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - GLM API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint (defaults to Z.ai endpoint)
	 * @param {string} [params.route] - API route type: 'coding' for Coding Plan or 'common' for Common API
	 * @returns {Function} GLM client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL, route = 'coding' } = params;

			if (!apiKey) {
				throw new Error('GLM API key is required.');
			}

			// Default to Z.ai endpoints based on route type
			let defaultBaseURL;
			if (route === 'coding') {
				// Z.ai Coding Plan endpoint
				defaultBaseURL = 'https://api.z.ai/v1';
			} else if (route === 'common') {
				// Z.ai Common API endpoint  
				defaultBaseURL = 'https://openai.z.ai/v1';
			} else {
				// Default to coding plan endpoint
				defaultBaseURL = 'https://api.z.ai/v1';
			}

			return createOpenAI({
				apiKey,
				baseURL: baseURL || defaultBaseURL
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Validates GLM-specific parameters
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {
		// Validate API key
		if (!params.apiKey) {
			throw new Error(`${this.name} API key is required`);
		}

		// Validate route if provided
		if (params.route && !['coding', 'common'].includes(params.route)) {
			throw new Error(`${this.name} route must be either 'coding' or 'common'`);
		}
	}
}