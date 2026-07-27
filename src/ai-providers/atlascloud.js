/**
 * atlascloud.js
 * AI provider implementation for Atlas Cloud models.
 * Uses the OpenAI-compatible LLM API endpoint.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Atlas Cloud provider supporting LLM models through an OpenAI-compatible API.
 */
export class AtlasCloudProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'Atlas Cloud',
			apiKeyEnvVar: 'ATLASCLOUD_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.atlascloud.ai/v1',
			supportsStructuredOutputs: true
		});
	}
}
