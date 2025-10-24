/**
 * cursor.js
 * AI provider implementation for Cursor models using Vercel AI SDK.
 * Cursor API is OpenAI-compatible, allowing access to multiple AI models through a single API key.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';

export class CursorProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Cursor';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Cursor API key
	 */
	getRequiredApiKeyName() {
		return 'CURSOR_API_KEY';
	}

	/**
	 * Creates and returns a Cursor client instance using OpenAI-compatible SDK.
	 * Cursor API is compatible with OpenAI SDK, so we use createOpenAI with Cursor's endpoint.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Cursor API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint (defaults to Cursor's API endpoint)
	 * @returns {Function} Cursor client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Cursor API key is required.');
			}

			// Cursor API is OpenAI-compatible and uses the endpoint at api.cursor.sh
			// Default to Cursor's API endpoint unless a custom baseURL is provided
			const cursorBaseURL = baseURL || 'https://api.cursor.sh/v1';

			return createOpenAI({
				apiKey,
				baseURL: cursorBaseURL,
				compatibility: 'compatible' // Ensures compatibility with OpenAI-like APIs
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}

