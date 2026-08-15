/**
 * trustedrouter.js
 * AI provider implementation for TrustedRouter models.
 * Uses the OpenAI-compatible API endpoint.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * TrustedRouter provider.
 *
 * Model ids are namespaced (`anthropic/claude-opus-4-7`); a bare id is
 * rejected. Ids under `trustedrouter/` are routing policies rather than
 * single models — each picks an upstream per request and fails over.
 */
export class TrustedRouterProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'TrustedRouter',
			apiKeyEnvVar: 'TRUSTEDROUTER_API_KEY',
			requiresApiKey: true,
			defaultBaseURL: 'https://api.trustedrouter.com/v1',
			supportsStructuredOutputs: true
		});
	}
}
