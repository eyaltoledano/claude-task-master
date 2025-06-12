/**
 * burncloud.js
 * AI provider implementation for Burncloud models using Vercel AI SDK.
 */

import { createBurnCloud } from '@burncloud/ai-sdk-provider';
import { BaseAIProvider } from './base-provider.js';

export class BurncloudAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Burncloud';
	}

	/**
	 * Creates and returns a Burncloud client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Burncloud API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Burncloud client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Burncloud API key is required.');
			}

			// Use Burncloud's official SDK provider
			const clientOptions = {
				apiKey
			};

			// Add baseURL if provided
			if (baseURL) {
				clientOptions.baseURL = baseURL;
			}

			return createBurnCloud(clientOptions);
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
} 