/**
 * azure.js
 * AI provider implementation for Azure OpenAI models using Vercel AI SDK.
 */

import { createAzure } from '@ai-sdk/azure';
import { BaseAIProvider } from './base-provider.js';

export class AzureProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Azure OpenAI';
	}

	/**
	 * Validates Azure-specific authentication parameters
	 * @param {object} params - Parameters to validate
	 * @throws {Error} If required parameters are missing
	 */
	validateAuth(params) {
		if (!params.apiKey) {
			throw new Error('Azure OpenAI API key is required');
		}

		if (!params.baseURL) {
			throw new Error('Azure OpenAI endpoint URL is required');
		}
	}

	/**
	 * Creates and returns an Azure OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure OpenAI API key
	 * @param {string} params.endpoint - Azure OpenAI endpoint URL
	 * @returns {Function} Azure OpenAI client function
	 * @throws {Error} If required parameters are missing or initialization fails
	 */
	async getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			return createAzure({
				apiKey,
				baseURL
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
