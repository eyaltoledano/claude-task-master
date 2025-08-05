/**
 * src/ai-providers/groq.js
 *
 * Implementation for interacting with Groq models
 * using the Vercel AI SDK.
 */

import { createGroq } from '@ai-sdk/groq';
import { BaseAIProvider } from './base-provider.js';

export class GroqProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Groq';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Groq API key
	 */
	getRequiredApiKeyName() {
		return 'GROQ_API_KEY';
	}

	/**
	 * Creates and returns a Groq client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Groq API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Groq client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Groq API key is required.');
			}

			return createGroq({
				apiKey,
				...(baseURL && { baseURL })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
