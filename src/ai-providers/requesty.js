/**
 * requesty.js
 * AI provider implementation for Requesty models using Vercel AI SDK.
 */

import { createRequesty } from '@requesty/ai-sdk';
import { BaseAIProvider } from './base-provider.js';

export class RequestyAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Requesty';
	}

	/**
	 * Creates and returns a Requesty client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Requesty API key
	 * @param {string} [params.baseUrl] - Optional custom API endpoint
	 * @returns {Function} Requesty client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Requesty API key is required.');
			}

			return createRequesty({
				apiKey,
				...(baseURL && { baseURL })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}