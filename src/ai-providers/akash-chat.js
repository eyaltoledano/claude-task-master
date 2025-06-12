/**
 * akash-chat.js
 * AI provider implementation for AkashChat API using OpenAI-compatible interface.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';

export class AkashChatProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'AkashChat';
	}

	/**
	 * Creates and returns an AkashChat client instance.
	 * AkashChat uses OpenAI-compatible API, so we use createOpenAI with custom baseURL
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - AkashChat API key
	 * @param {string} [params.baseURL] - AkashChat API base URL (defaults to https://chatapi.akash.network/api/v1)
	 * @returns {Function} AkashChat client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('AkashChat API key is required.');
			}

			return createOpenAI({
				apiKey,
				baseURL: baseURL || 'https://chatapi.akash.network/api/v1'
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
