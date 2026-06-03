/**
 * minimax.js
 * AI provider implementation for MiniMax models.
 * Uses the OpenAI-compatible API endpoint.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * MiniMax provider supporting MiniMax-M3 (default) and MiniMax-M2.7 family models through OpenAI-compatible API.
 */
export class MiniMaxProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'MiniMax',
			apiKeyEnvVar: 'MINIMAX_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.minimax.io/v1',
			supportsStructuredOutputs: true
		});
	}
}
