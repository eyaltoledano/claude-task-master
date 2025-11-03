/**
 * zai-coding.js
 * AI provider implementation for Z.ai (GLM) Coding Plan models.
 * Uses the exclusive coding API endpoint with OpenAI-compatible API.
 */

import { ZAIProvider } from './zai.js';

/**
 * Z.ai Coding Plan provider supporting GLM models through the dedicated coding endpoint.
 * Extends ZAIProvider with only a different base URL.
 */
export class ZAICodingProvider extends ZAIProvider {
	constructor() {
		super();
		// Override only the name and base URL
		this.name = 'Z.ai (Coding Plan)';
		this.defaultBaseURL = 'https://api.z.ai/api/coding/paas/v4/';
	}
}
