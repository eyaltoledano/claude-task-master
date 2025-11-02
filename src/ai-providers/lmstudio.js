/**
 * lmstudio.js
 * AI provider implementation for LM Studio local models.
 *
 * LM Studio is a desktop application for running local LLMs.
 * It provides an OpenAI-compatible API server that runs locally.
 * Default server: http://localhost:1234/v1
 *
 * Usage:
 * 1. Start LM Studio application
 * 2. Load a model (e.g., llama-3.2-1b, mistral-7b)
 * 3. Go to "Local Server" tab and click "Start Server"
 * 4. Use the model ID from LM Studio in your config
 *
 * Note: LM Studio only supports `json_schema` mode for structured outputs,
 * not `json_object` mode. We disable native structured outputs to force
 * the AI SDK to use alternative strategies (like tool calling) which work
 * reliably across all LM Studio models.
 */

import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * LM Studio provider for local model inference.
 * Does not require an API key as it runs locally.
 */
export class LMStudioProvider extends OpenAICompatibleProvider {
	constructor() {
		super({
			name: 'LM Studio',
			apiKeyEnvVar: 'LMSTUDIO_API_KEY',
			requiresApiKey: false, // Local server, no API key needed
			defaultBaseURL: 'http://localhost:1234/v1',
			supportsStructuredOutputs: true
			// LM Studio only supports json_schema mode, not json_object mode
			// Disable native structured outputs to use alternative strategies
		});
	}
}
