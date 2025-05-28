/**
 * src/ai-providers/anthropic.js
 *
 * Implementation for interacting with Anthropic models (e.g., Claude)
 * using the Vercel AI SDK.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { BaseAIProvider } from './base-provider.js';

// TODO: Implement standardized functions for generateText, streamText, generateObject

// --- Client Instantiation ---
// Note: API key resolution should ideally happen closer to the call site
// using the config manager/resolver which checks process.env and session.env.
// This is a placeholder for basic functionality.
// Remove the global variable and caching logic
// let anthropicClient;

export class AnthropicAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Anthropic';
	}

	/**
	 * Creates and returns an Anthropic client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} params.apiKey - Anthropic API key
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Function} Anthropic client function
	 * @throws {Error} If API key is missing or initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL } = params;

			if (!apiKey) {
				throw new Error('Anthropic API key is required.');
			}

			return createAnthropic({
				apiKey,
				...(baseURL && { baseURL }),
				headers: {
					'anthropic-beta': 'output-128k-2025-02-19'
				}
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}

// TODO: Implement streamAnthropicObject if needed and supported well by the SDK for Anthropic.
// The basic structure would be similar to generateAnthropicObject but using streamObject.
