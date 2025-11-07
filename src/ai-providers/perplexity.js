/**
 * perplexity.js
 * AI provider implementation for Perplexity models using Vercel AI SDK.
 */

import { createPerplexity } from '@ai-sdk/perplexity';
import { BaseAIProvider } from './base-provider.js';

export class PerplexityAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Perplexity';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Perplexity API key
	 */
	getRequiredApiKeyName() {
		return 'PERPLEXITY_API_KEY';
	}

	/**
	 * Creates and returns a Perplexity client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Perplexity API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Perplexity client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Perplexity API key is required.');
			}

			return createPerplexity({
				apiKey,
				baseURL: baseURL || 'https://api.perplexity.ai',
				fetch: this.createProxyFetch()
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Override generateObject to use JSON mode for Perplexity
	 *
	 * NOTE: Perplexity models (especially sonar models) have known issues
	 * generating valid JSON, particularly with array fields. They often
	 * generate malformed JSON like "dependencies": , instead of "dependencies": []
	 *
	 * The base provider now handles JSON repair automatically for all providers.
	 */
	async generateObject(params) {
		// Force JSON mode for Perplexity as it may help with reliability
		return super.generateObject({
			...params,
			mode: 'json'
		});
	}
}
