/**
 * perplexity.js
 * AI provider implementation for Perplexity models using Vercel AI SDK.
 */

import { createPerplexityAI } from '@ai-sdk/perplexity';
import { BaseAIProvider } from './base-provider.js';

export class PerplexityAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Perplexity';
	}

	/**
	 * Creates and returns a Perplexity client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Perplexity API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Perplexity client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	async getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Perplexity API key is required.');
			}

			return createPerplexityAI({
				apiKey,
				baseURL: baseURL || 'https://api.perplexity.ai'
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
