/**
 * zai-coding.js
 * AI provider implementation for Z.ai (GLM) Coding Plan models.
 * Uses the exclusive coding API endpoint with OpenAI-compatible API.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Z.ai Coding Plan provider supporting GLM models through the dedicated coding endpoint.
 */
export class ZAICodingProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'Z.ai (Coding Plan)',
			apiKeyEnvVar: 'ZAI_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.z.ai/api/coding/paas/v4/'
		});
	}
}
