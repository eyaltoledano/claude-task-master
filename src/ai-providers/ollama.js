/**
 * ollama.js
 * AI provider implementation for Ollama models using the ollama-ai-provider package.
 */

import { createOllama } from 'ollama-ai-provider';
import { BaseAIProvider } from './base-provider.js';

export class OllamaAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Ollama';
	}

	/**
	 * Override auth validation - Ollama doesn't require API keys
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(_params) {
		// Ollama runs locally and doesn't require API keys
		// No authentication validation needed
	}

	/**
	 * Creates and returns an Ollama client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.baseURL] - Optional Ollama base URL (defaults to http://localhost:11434)
	 * @returns {Function} Ollama client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			const { baseURL } = params;

			return createOllama({
				...(baseURL && { baseURL })
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
