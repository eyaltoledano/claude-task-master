/**
 * src/ai-providers/chatgpt-oauth.js
 *
 * Implementation for interacting with OpenAI GPT-5 via ChatGPT OAuth
 * using the ai-sdk-provider-chatgpt-oauth package (AI SDK v4 build/tag).
 */

import { BaseAIProvider } from './base-provider.js';
import { log } from '../../scripts/modules/utils.js';
import { generateText } from 'ai';
import { extractJsonTolerant } from '../utils/json-extract.js';

let createChatGPTOAuth;

async function loadChatGptOAuthModule() {
	if (!createChatGPTOAuth) {
		try {
			const mod = await import('ai-sdk-provider-chatgpt-oauth');
			createChatGPTOAuth = mod.createChatGPTOAuth || mod.chatgptOAuth;
			if (!createChatGPTOAuth) {
				throw new Error('createChatGPTOAuth export not found');
			}
		} catch (err) {
			throw new Error(
				"ChatGPT OAuth SDK is not installed. Please install 'ai-sdk-provider-chatgpt-oauth@ai-sdk-v4' to use the chatgpt-oauth provider."
			);
		}
	}
}

export class ChatGPTOAuthProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'ChatGPT OAuth';
	}

	/**
	 * ChatGPT OAuth does not require a traditional API key; it uses OAuth tokens.
	 * We return a descriptive env var name for visibility but do not require it.
	 */
	getRequiredApiKeyName() {
		return 'CHATGPT_OAUTH_ACCESS_TOKEN';
	}

	isRequiredApiKey() {
		return false;
	}

	/**
	 * Override validateAuth to skip API key validation.
	 */
	validateAuth(_params) {
		// Auth handled internally by the SDK (reads ~/.codex/auth.json or env vars)
	}

	/**
	 * Creates and returns a ChatGPT OAuth client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.baseURL] - Optional custom API endpoint
	 * @returns {Promise<Function>} ChatGPT OAuth client function
	 */
	async getClient(params) {
		try {
			await loadChatGptOAuthModule();

			const options = {};
			if (params?.baseURL) {
				options.baseURL = params.baseURL;
			}

			// Optional reasoning controls (matches provider API):
			// - reasoningEffort: 'low' | 'medium' | 'high' | null (disable)
			// - reasoningSummary: 'auto' | 'none' | 'concise' | 'detailed' | null (omit)
			if (typeof params?.reasoningEffort !== 'undefined') {
				options.reasoningEffort = params.reasoningEffort;
			}
			if (typeof params?.reasoningSummary !== 'undefined') {
				options.reasoningSummary = params.reasoningSummary;
			}

			// The provider will source credentials automatically from ~/.codex/auth.json
			// or environment variables (CHATGPT_OAUTH_ACCESS_TOKEN, CHATGPT_OAUTH_ACCOUNT_ID, etc.).
			const provider = createChatGPTOAuth(options);
			return provider;
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * GPT-5 via ChatGPT backend does not honor maxTokens; keep default behavior.
	 * If needed in the future, we can override prepareTokenParam to suppress it.
	 */
}

// --- Provider-specific message handling ---
// The ChatGPT backend expects a very specific `instructions` string (from codex-instructions.txt).
// Appending arbitrary system prompts to instructions can cause 400 "Instructions are not valid".
// To stay compatible, we demote system messages to a regular user message and keep
// the special instructions intact.

ChatGPTOAuthProvider.prototype._demoteSystemToUser = function (messages) {
	if (!Array.isArray(messages) || messages.length === 0) return messages || [];
	const systemParts = messages.filter(
		(m) =>
			m.role === 'system' &&
			typeof m.content === 'string' &&
			m.content.trim() !== ''
	);
	const nonSystem = messages.filter((m) => m.role !== 'system');
	if (systemParts.length === 0) return nonSystem;
	const combined = systemParts.map((m) => m.content).join('\n\n');
	// Prepend a user message carrying the previous system content
	return [{ role: 'user', content: combined }, ...nonSystem];
};

// Override base calls to pre-process messages
ChatGPTOAuthProvider.prototype.generateText = async function (params) {
	const processed = {
		...params,
		messages: this._demoteSystemToUser(params.messages)
	};
	return BaseAIProvider.prototype.generateText.call(this, processed);
};

ChatGPTOAuthProvider.prototype.streamText = async function (params) {
	const processed = {
		...params,
		messages: this._demoteSystemToUser(params.messages)
	};
	return BaseAIProvider.prototype.streamText.call(this, processed);
};

ChatGPTOAuthProvider.prototype.generateObject = async function (params) {
	try {
		this.validateParams(params);
		this.validateMessages(params.messages);
		if (!params.schema)
			throw new Error('Schema is required for object generation');
		if (!params.objectName)
			throw new Error('Object name is required for object generation');

		// Demote system prompts to user to avoid contaminating ChatGPT OAuth instructions
		const demoted = this._demoteSystemToUser(params.messages);

		// Prepend strict JSON enforcement as a user message
		const jsonEnforcement =
			'CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, markdown, code fences, or commentary. The first character must be { or [ and the last must be } or ]. Return exactly the object requested.';
		const messages = [{ role: 'user', content: jsonEnforcement }, ...demoted];

		const client = await this.getClient(params);
		const result = await generateText({
			model: client(params.modelId),
			messages,
			maxTokens: params.maxTokens,
			temperature: params.temperature
		});

		const jsonText = extractJsonTolerant(result.text || '');
		let parsed;
		try {
			parsed = JSON.parse(jsonText);
		} catch (e) {
			throw new Error(
				`Failed to parse JSON from ChatGPT OAuth response: ${e.message}`
			);
		}

		// Validate against provided Zod schema
		const validated = params.schema.parse(parsed);

		return {
			object: validated,
			usage: {
				inputTokens: result.usage?.promptTokens,
				outputTokens: result.usage?.completionTokens,
				totalTokens: result.usage?.totalTokens
			}
		};
	} catch (error) {
		this.handleError('object generation', error);
	}
};
