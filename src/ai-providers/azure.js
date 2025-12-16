/**
 * azure.js
 * AI provider implementation for Azure OpenAI Service using Vercel AI SDK.
 */

import { createAzure } from '@ai-sdk/azure';
import { BaseAIProvider } from './base-provider.js';

export class AzureProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Azure OpenAI';
	}

	/**
	 * Returns the environment variable name required for this provider's API key.
	 * @returns {string} The environment variable name for the Azure OpenAI API key
	 */
	getRequiredApiKeyName() {
		return 'AZURE_OPENAI_API_KEY';
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
	 * Normalizes the base URL to ensure it ends with /openai for proper Azure API routing.
	 * The Azure API expects paths like /openai/deployments/{model}/chat/completions
	 * @param {string} baseURL - Original base URL
	 * @returns {string} Normalized base URL ending with /openai
	 */
	normalizeBaseURL(baseURL) {
		if (!baseURL) return baseURL;

		try {
			const url = new URL(baseURL);
			let pathname = url.pathname.replace(/\/+$/, ''); // Remove trailing slashes

			// If the path doesn't end with /openai, append it
			if (!pathname.endsWith('/openai')) {
				pathname = `${pathname}/openai`;
			}

			url.pathname = pathname;
			return url.toString();
		} catch {
			// Fallback for invalid URLs
			const normalized = baseURL.replace(/\/+$/, '');
			return normalized.endsWith('/openai')
				? normalized
				: `${normalized}/openai`;
		}
	}

	/**
	 * Creates and returns an Azure OpenAI client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Azure OpenAI API key
	 * @param {string} params.baseURL - Azure OpenAI endpoint URL (from .taskmasterconfig global.azureBaseURL or models.[role].baseURL)
	 * @returns {Function} Azure OpenAI client function
	 * @throws {Error} If client initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			// Normalize base URL to ensure it ends with /openai
			const normalizedBaseURL = this.normalizeBaseURL(baseURL);
			const fetchImpl = this.createProxyFetch();

			return createAzure({
				apiKey,
				baseURL: normalizedBaseURL,
				...(fetchImpl && { fetch: fetchImpl })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
