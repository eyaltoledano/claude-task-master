/**
 * cheaperinference.js
 * AI provider implementation for Cheaper Inference.
 * Uses the OpenAI-compatible API endpoint.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Cheaper Inference provider supporting models from several labs through OpenAI-compatible API.
 */
export class CheaperInferenceProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'Cheaper Inference',
			apiKeyEnvVar: 'CHEAPER_INFERENCE_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.cheaperinference.com/v1',
			supportsStructuredOutputs: true
		});
	}
}
