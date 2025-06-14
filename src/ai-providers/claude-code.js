/**
 * Claude Code SDK Provider for Task Master
 *
 * This provider integrates Claude Code's natural language processing capabilities
 * directly into Task Master without requiring API keys, using the free subscription model.
 *
 * Key Features:
 * - No API key required (uses Claude Code's OAuth2 authentication)
 * - Environment-aware execution
 * - Streaming responses
 * - Multi-turn conversation support
 * - Codebase understanding
 */

import { BaseAIProvider } from './base-provider.js';

export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.providerName = 'claude-code';
		this.requiresApiKey = false; // Uses SDK's internal OAuth2 auth
		this.supportsStreaming = true;
		this.supportsTools = true;
		this._sdkModule = null;
	}

	/**
	 * Lazily load the Claude Code SDK to avoid import errors if not installed
	 */
	async loadSDK() {
		if (!this._sdkModule) {
			try {
				this._sdkModule = await import('@anthropic-ai/claude-code');
			} catch (error) {
				throw new Error(
					'Claude Code SDK not installed. Please install it with: npm install @anthropic-ai/claude-code'
				);
			}
		}
		return this._sdkModule;
	}

	/**
	 * Get the Claude Code SDK client
	 * @param {Object} params - Parameters (unused for Claude Code)
	 * @returns {Promise<Object>} The SDK module
	 */
	async getClient(params = {}) {
		return this.loadSDK();
	}

	/**
	 * Check if Claude Code is properly authenticated
	 */
	async checkAuthentication() {
		// Claude Code SDK uses system authentication
		// The SDK will handle auth errors when we try to use it
		return true;
	}

	/**
	 * Convert Task Master message format to Claude Code prompt
	 */
	convertMessagesToPrompt(messages) {
		const parts = [];
		let systemPrompt = null;

		for (const msg of messages) {
			if (msg.role === 'system') {
				systemPrompt = msg.content;
			} else if (msg.role === 'user') {
				parts.push(msg.content);
			} else if (msg.role === 'assistant') {
				parts.push(`Previous response: ${msg.content}`);
			}
		}

		return {
			prompt: parts.join('\n\n'),
			systemPrompt
		};
	}

	/**
	 * Extract text content from Claude Code SDK message
	 */
	extractTextFromMessage(message) {
		const textParts = [];

		// Handle SDKMessage format
		if (message.type === 'assistant' && message.message) {
			// message.message is the Anthropic Message object
			const content = message.message.content;
			if (Array.isArray(content)) {
				for (const block of content) {
					if (block.type === 'text') {
						textParts.push(block.text);
					}
				}
			} else if (typeof content === 'string') {
				textParts.push(content);
			}
		} else if (message.type === 'result') {
			// Handle result message type
		}

		return textParts.join('\n');
	}

	/**
	 * Generate text using Claude Code SDK
	 */
	async generateText(params) {
		await this.checkAuthentication();

		const {
			messages,
			temperature,
			model,
			maxTokens,
			systemPrompt: additionalSystemPrompt
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);
		const finalSystemPrompt = additionalSystemPrompt
			? `${systemPrompt || ''}\n\n${additionalSystemPrompt}`.trim()
			: systemPrompt;

		const results = [];
		let tokenCount = 0;

		try {
			for await (const message of query({
				prompt,
				options: {
					maxTurns: 1, // Single turn for text generation
					systemPrompt:
						finalSystemPrompt ||
						'You are a helpful AI assistant for Task Master, a task management system for software projects.',
					cwd: process.cwd(),
					allowedTools: [], // No tools for pure text generation
					permissionMode: 'default'
					// Note: temperature and maxTokens not directly supported by SDK
					// but may influence the underlying model
				}
			})) {
				const text = this.extractTextFromMessage(message);
				if (text) {
					results.push(text);
					tokenCount += text.split(/\s+/).length;
				}
			}

			const fullText = results.join('\n');

			return {
				text: fullText,
				usage: {
					promptTokens: Math.floor(prompt.split(/\s+/).length * 1.3),
					completionTokens: Math.floor(tokenCount * 1.3),
					totalTokens: Math.floor(
						(prompt.split(/\s+/).length + tokenCount) * 1.3
					)
				}
			};
		} catch (error) {
			throw this.handleError(error);
		}
	}

	/**
	 * Generate structured object using Claude Code SDK
	 */
	async generateObject(params) {
		await this.checkAuthentication();

		const {
			messages,
			schema,
			temperature,
			model,
			systemPrompt: additionalSystemPrompt
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);

		// Enhance prompt to request JSON output
		const enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object that matches this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any explanatory text, markdown formatting, or code blocks. Just the raw JSON.`;

		const jsonSystemPrompt = `${systemPrompt || 'You are a helpful AI assistant.'}\n\nYou must always respond with valid JSON that matches the provided schema. No additional text or formatting.`;
		const finalSystemPrompt = additionalSystemPrompt
			? `${jsonSystemPrompt}\n\n${additionalSystemPrompt}`.trim()
			: jsonSystemPrompt;

		const results = [];

		try {
			// Add AbortController for better control
			const abortController = new AbortController();

			for await (const message of query({
				prompt: enhancedPrompt,
				abortController,
				options: {
					maxTurns: 1,
					systemPrompt: finalSystemPrompt,
					cwd: process.cwd(),
					allowedTools: [], // No tools for JSON generation
					permissionMode: 'default'
				}
			})) {
				const text = this.extractTextFromMessage(message);
				if (text) {
					results.push(text);
				}
			}

			const jsonText = results.join('\n').trim();

			// Clean up common JSON formatting issues
			let cleanedJson = jsonText;
			// Remove markdown code blocks if present
			cleanedJson = cleanedJson
				.replace(/^```json\s*/i, '')
				.replace(/\s*```$/, '');
			cleanedJson = cleanedJson.replace(/^```\s*/i, '').replace(/\s*```$/, '');

			const parsed = JSON.parse(cleanedJson);

			return {
				object: parsed,
				usage: {
					promptTokens: Math.floor(enhancedPrompt.split(/\s+/).length * 1.3),
					completionTokens: Math.floor(jsonText.split(/\s+/).length * 1.3),
					totalTokens: Math.floor(
						(enhancedPrompt.split(/\s+/).length +
							jsonText.split(/\s+/).length) *
							1.3
					)
				}
			};
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new Error(
					`Failed to parse JSON response: ${error.message}\nResponse: ${results.join('\n')}`
				);
			}
			throw this.handleError(error);
		}
	}

	/**
	 * Stream text using Claude Code SDK
	 */
	async streamText(params) {
		await this.checkAuthentication();

		const {
			messages,
			onChunk,
			temperature,
			model,
			systemPrompt: additionalSystemPrompt
		} = params;
		const { query } = await this.loadSDK();

		const { prompt, systemPrompt } = this.convertMessagesToPrompt(messages);
		const finalSystemPrompt = additionalSystemPrompt
			? `${systemPrompt || ''}\n\n${additionalSystemPrompt}`.trim()
			: systemPrompt;

		const chunks = [];

		try {
			for await (const message of query({
				prompt,
				options: {
					maxTurns: 1,
					systemPrompt:
						finalSystemPrompt ||
						'You are a helpful AI assistant for Task Master.',
					cwd: process.cwd(),
					allowedTools: [],
					permissionMode: 'default'
				}
			})) {
				const text = this.extractTextFromMessage(message);
				if (text) {
					chunks.push(text);
					if (onChunk) {
						onChunk(text);
					}
				}
			}

			const fullText = chunks.join('');

			return {
				text: fullText,
				usage: {
					promptTokens: Math.floor(prompt.split(/\s+/).length * 1.3),
					completionTokens: Math.floor(fullText.split(/\s+/).length * 1.3),
					totalTokens: Math.floor(
						(prompt.split(/\s+/).length + fullText.split(/\s+/).length) * 1.3
					)
				}
			};
		} catch (error) {
			throw this.handleError(error);
		}
	}

	/**
	 * Enhanced error handling for Claude Code specific errors
	 */
	handleError(error) {
		const errorMessage = error.message || error.toString();

		// Authentication errors
		if (
			errorMessage.includes('credentials') ||
			errorMessage.includes('unauthorized')
		) {
			return new Error(
				'Claude Code authentication failed. Please ensure you are logged in by running: claude auth login'
			);
		}

		// SDK not installed
		if (errorMessage.includes('Cannot find module')) {
			return new Error(
				'Claude Code SDK not found. Please install it with: npm install @anthropic-ai/claude-code'
			);
		}

		// Claude CLI not installed
		if (errorMessage.includes('claude: command not found')) {
			return new Error(
				'Claude Code CLI not installed. Please install it from: https://claude.ai/code'
			);
		}

		// Generic SDK errors
		if (errorMessage.includes('Claude Code')) {
			return error;
		}

		// Wrap other errors
		return new Error(`Claude Code Provider Error: ${errorMessage}`);
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities() {
		return {
			streaming: true,
			tools: true,
			functionCalling: false, // Not directly, but could be implemented
			vision: true, // Claude Code supports images
			maxContextTokens: 200000, // Claude's context window
			costPerMillionTokens: {
				input: 0, // Free with subscription
				output: 0
			}
		};
	}
}

// Export for use in the provider registry
export default ClaudeCodeProvider;
