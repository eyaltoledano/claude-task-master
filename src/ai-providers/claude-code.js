/**
 * Claude Code CLI provider implementation
 * Uses custom SDK wrapper for @anthropic-ai/claude-code
 */

import {
	createClaudeCode
} from './custom-sdk/claude-code-sdk.js';
import { log } from '../../scripts/modules/index.js';
import { BaseAIProvider } from './base-provider.js';

export class ClaudeCodeProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'ClaudeCode';
		this.supportedModels = ['opus', 'sonnet'];
		this._sdkLoaded = false;
		this._client = null;
	}

	/**
	 * Override to handle SDK-specific errors
	 */
	async handleError(operation, error) {
		const errorMessage = error.message?.toLowerCase() || '';

		// Check for authentication errors
		if (
			errorMessage.includes('not authenticated') ||
			errorMessage.includes('auth_required') ||
			error.code === 'AUTH_REQUIRED'
		) {
			throw new Error('Claude Code authentication required. Run: claude login');
		}

		// Check for CLI not found errors
		if (
			errorMessage.includes('command not found') ||
			errorMessage.includes('enoent') ||
			errorMessage.includes('spawn claude')
		) {
			throw new Error(
				'Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code'
			);
		}

		// Check for timeout errors
		if (errorMessage.includes('timeout') || error.code === 'TIMEOUT') {
			throw new Error(
				'Request timed out. Consider increasing timeout in config.json'
			);
		}

		// For other errors, use base class handling
		super.handleError(operation, error);
	}

	/**
	 * Override validateAuth to skip API key requirement
	 * Claude Code uses CLI authentication instead
	 */
	validateAuth() {
		// No API key needed for Claude Code CLI
		log('debug', 'Claude Code provider uses CLI authentication');
	}

	/**
	 * Override validateParams to add model validation
	 */
	validateParams(params) {
		super.validateParams(params);

		if (!this.supportedModels.includes(params.modelId)) {
			throw new Error(
				`Model '${params.modelId}' is not supported. ` +
					`Supported models: ${this.supportedModels.join(', ')}`
			);
		}
	}

	/**
	 * Creates and returns a Claude Code client instance
	 */
	getClient(params) {
		// Create client with settings (only those supported by SDK)
		const settings = {
			pathToClaudeCodeExecutable: params.pathToClaudeCodeExecutable,
			cwd: params.cwd || process.cwd(),
			executable: params.executable,
			executableArgs: params.executableArgs
		};

		// Remove undefined values
		Object.keys(settings).forEach((key) => {
			if (settings[key] === undefined) {
				delete settings[key];
			}
		});

		try {
			this._client = createClaudeCode(settings);
			return this._client;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Converts messages to Claude Code format
	 */
	_convertMessages(messages) {
		return messages.map((msg) => ({
			role:
				msg.role === 'system'
					? 'system'
					: msg.role === 'user'
						? 'human'
						: 'assistant',
			content: Array.isArray(msg.content) ? msg.content[0].text : msg.content
		}));
	}

	/**
	 * Generate text using Claude Code
	 */
	async generateText(params) {
		try {
			this.validateParams(params);

			const client = this.getClient(params);
			const messages = this._convertMessages(params.messages);

			// Query the Claude Code CLI
			// Note: The SDK doesn't support temperature or maxTokens, only maxTurns
			const response = await client.query(params.modelId, messages, {
				maxTurns: params.maxTurns,
				abortController: params.abortController
			});

			// Extract the response text
			const text = response.content || response.text || '';

			// Log response details for debugging
			log('debug', `Claude Code response: text length=${text.length}, has usage=${!!response.usage}`);
			if (response.usage) {
				log('debug', `Usage data: ${JSON.stringify(response.usage)}`);
			}

			// Use actual usage data from SDK if available, otherwise estimate
			const usage = response.usage || {
				input_tokens: Math.round(JSON.stringify(messages).length / 4),
				output_tokens: Math.round(text.length / 4),
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0
			};

			// Calculate total input tokens including cache tokens
			const totalInputTokens = (usage.input_tokens || 0) + 
				(usage.cache_creation_input_tokens || 0) + 
				(usage.cache_read_input_tokens || 0);

			const result = {
				text,
				finishReason: 'stop',
				usage: {
					inputTokens: totalInputTokens,
					outputTokens: usage.output_tokens || 0,
					totalTokens: totalInputTokens + (usage.output_tokens || 0)
				}
			};

			log('debug', `Claude Code generateText returning: usage=${JSON.stringify(result.usage)}`);
			return result;
		} catch (error) {
			await this.handleError('generateText', error);
			// BaseAIProvider's handleError will throw, so this won't be reached
			// but just in case, return undefined
			return undefined;
		}
	}

	/**
	 * Stream text using Claude Code
	 */
	async streamText(params) {
		try {
			this.validateParams(params);

			const client = this.getClient(params);
			const messages = this._convertMessages(params.messages);

			let fullText = '';
			let finalUsage = null;

			// Create the stream
			// Note: The SDK doesn't support temperature or maxTokens, only maxTurns
			const stream = await client.stream(params.modelId, messages, {
				maxTurns: params.maxTurns,
				abortController: params.abortController
			});

			// Return an async generator that yields text deltas
			return {
				textStream: (async function* () {
					for await (const chunk of stream) {
						// Check if this is the final chunk with usage data
						if (chunk.isFinal && chunk.usage) {
							finalUsage = chunk.usage;
							continue; // Don't yield the final empty chunk
						}
						
						const delta = chunk.delta || chunk.text || '';
						if (delta) {
							fullText += delta;
							yield delta;
						}
					}
				})(),

				// Provide methods to get final usage data
				get fullStream() {
					return this.textStream;
				},

				get usage() {
					// If we have real usage data, use it
					if (finalUsage) {
						const totalInputTokens = (finalUsage.input_tokens || 0) + 
							(finalUsage.cache_creation_input_tokens || 0) + 
							(finalUsage.cache_read_input_tokens || 0);
						
						return Promise.resolve({
							inputTokens: totalInputTokens,
							outputTokens: finalUsage.output_tokens || 0,
							totalTokens: totalInputTokens + (finalUsage.output_tokens || 0)
						});
					}
					
					// Otherwise estimate
					const inputTokens = JSON.stringify(messages).length / 4;
					const outputTokens = fullText.length / 4;
					return Promise.resolve({
						inputTokens: Math.round(inputTokens),
						outputTokens: Math.round(outputTokens),
						totalTokens: Math.round(inputTokens + outputTokens)
					});
				}
			};
		} catch (error) {
			await this.handleError('streamText', error);
		}
	}

	/**
	 * Generate structured object using Claude Code
	 */
	async generateObject(params) {
		try {
			this.validateParams(params);

			// Enhance the prompt to request JSON output
			const enhancedMessages = [...params.messages];
			const lastMessage = enhancedMessages[enhancedMessages.length - 1];

			const jsonPrompt = `
Please respond with a valid JSON object that matches this schema:
${JSON.stringify(params.schema, null, 2)}

The object should represent: ${params.objectName || 'the requested data'}

Respond ONLY with the JSON object, no additional text or formatting.`;

			lastMessage.content = `${lastMessage.content}\n\n${jsonPrompt}`;

			const result = await this.generateText({
				...params,
				messages: enhancedMessages
			});

			// Parse the JSON response
			try {
				const object = JSON.parse(result.text);
				return {
					object,
					finishReason: result.finishReason,
					usage: result.usage
				};
			} catch (parseError) {
				// Try to extract JSON from the response
				const jsonMatch = result.text.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					const object = JSON.parse(jsonMatch[0]);
					return {
						object,
						finishReason: result.finishReason,
						usage: result.usage
					};
				}
				throw new Error(`Failed to parse JSON response: ${parseError.message}`);
			}
		} catch (error) {
			await this.handleError('generateObject', error);
		}
	}
}
