/**
 * zai.js
 * AI provider implementation for Z.ai (GLM) models.
 * Uses the OpenAI-compatible API endpoint.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Z.ai provider supporting GLM models through OpenAI-compatible API.
 */
export class ZAIProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'Z.ai',
			apiKeyEnvVar: 'ZAI_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.z.ai/api/paas/v4/'
		});
	}
}
