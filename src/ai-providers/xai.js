/**
 * xai.js
 * AI provider implementation for xAI models using Vercel AI SDK.
 */

import { createXai } from '@ai-sdk/xai';
import { BaseAIProvider } from './base-provider.js';

export class XAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'xAI';
	}

	/**
	 * Creates and returns an xAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - xAI API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} xAI client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('xAI API key is required.');
			}

			return createXai({
				apiKey,
				baseURL: baseURL || 'https://api.x.ai/v1'
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
