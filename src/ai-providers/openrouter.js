/**
 * openrouter.js
 * AI provider implementation for OpenRouter models using Vercel AI SDK.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { BaseAIProvider } from './base-provider.js';

export class OpenRouterAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'OpenRouter';
	}

	/**
	 * Creates and returns an OpenRouter client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - OpenRouter API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} OpenRouter client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('OpenRouter API key is required.');
			}

			return createOpenRouter({
				apiKey,
				...(baseURL && { baseURL })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
