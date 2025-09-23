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
	 * Determines if a model requires max_completion_tokens instead of maxTokens
	 * GPT-5 models require max_completion_tokens parameter
	 * @param {string} modelId - The model ID to check
	 * @returns {boolean} True if the model requires max_completion_tokens
	 */
	requiresMaxCompletionTokens(modelId) {
		return modelId && modelId.startsWith('gpt-5');
	}

	/**
	 * Creates and returns an OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - OpenAI API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} OpenAI client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('OpenAI API key is required.');
			}

			return createOpenAI({
				apiKey,
				...(baseURL && { baseURL })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
