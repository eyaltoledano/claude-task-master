/**
 * requesty.js
 * AI provider implementation for Requesty models.
 * Requesty is an OpenAI-compatible LLM router that exposes many upstream
 * models (openai/..., anthropic/..., google/..., deepseek/...) behind a
 * single OpenAI-compatible endpoint, using `provider/model` naming
 * (the same convention as OpenRouter).
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Requesty provider using its OpenAI-compatible router endpoint.
 */
export class RequestyProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'Requesty',
			apiKeyEnvVar: 'REQUESTY_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://router.requesty.ai/v1'
		});
	}
}
