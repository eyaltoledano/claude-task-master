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
			throw new Error('Azure API key is required');
		}

		if (!params.baseURL) {
			throw new Error(
				'Azure endpoint URL is required. Set it in .taskmasterconfig global.azureBaseURL or models.[role].baseURL'
			);
		}
	}

	/**
	 * Creates and returns an Azure OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure OpenAI API key
	 * @param {string} params.baseURL - Azure OpenAI endpoint URL (from .taskmasterconfig global.azureBaseURL or models.[role].baseURL)
	 * @returns {Function} Azure OpenAI client function
	 * @throws {Error} If required parameters are missing or initialization fails
	 */
	getClient(params) {
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
