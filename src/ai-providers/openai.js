/**
 * openai.js
 * AI provider implementation for OpenAI models using Vercel AI SDK.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';

export class OpenAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'OpenAI';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the OpenAI API key
	 */
	getRequiredApiKeyName() {
		return 'OPENAI_API_KEY';
	}

	/**
	 * Creates and returns an OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - OpenAI API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} OpenAI client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;
			const fetchImpl = this.createProxyFetch();

			return createOpenAI({
				apiKey,
				...(baseURL && { baseURL }),
				...(fetchImpl && { fetch: fetchImpl })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
