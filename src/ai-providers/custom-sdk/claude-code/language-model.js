/**
 * @fileoverview Claude Code Language Model implementation
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { generateId } from '@ai-sdk/provider-utils';
import { convertToClaudeCodeMessages } from './message-converter.js';
import { extractJson } from './json-extractor.js';
import { createAPICallError, createAuthenticationError } from './errors.js';
import { query, AbortError } from '@anthropic-ai/claude-code';

/**
 * @typedef {import('./types.js').ClaudeCodeSettings} ClaudeCodeSettings
 * @typedef {import('./types.js').ClaudeCodeModelId} ClaudeCodeModelId
 * @typedef {import('./types.js').ClaudeCodeLanguageModelOptions} ClaudeCodeLanguageModelOptions
 */

const modelMap = {
	opus: 'opus',
	sonnet: 'sonnet'
};

export class ClaudeCodeLanguageModel {
	specificationVersion = 'v1';
	defaultObjectGenerationMode = 'json';
	supportsImageUrls = false;
	supportsStructuredOutputs = false;

	/** @type {ClaudeCodeModelId} */
	modelId;

	/** @type {ClaudeCodeSettings} */
	settings;

	/** @type {string|undefined} */
	sessionId;

	/**
	 * @param {ClaudeCodeLanguageModelOptions} options
	 */
	constructor(options) {
		this.modelId = options.id;
		this.settings = options.settings ?? {};

		// Validate model ID format
		if (
			!this.modelId ||
			typeof this.modelId !== 'string' ||
			this.modelId.trim() === ''
		) {
			throw new NoSuchModelError({
				modelId: this.modelId,
				modelType: 'languageModel'
			});
		}
	}

	get provider() {
		return 'claude-code';
	}

	/**
	 * Get the model name for Claude Code CLI
	 * @returns {string}
	 */
	getModel() {
		const mapped = modelMap[this.modelId];
		return mapped ?? this.modelId;
	}

	/**
	 * Generate unsupported parameter warnings
	 * @param {Object} options - Generation options
	 * @returns {Array} Warnings array
	 */
	generateUnsupportedWarnings(options) {
		const warnings = [];
		const unsupportedParams = [];

		// Check for unsupported parameters
		if (options.temperature !== undefined) unsupportedParams.push('temperature');
		if (options.maxTokens !== undefined) unsupportedParams.push('maxTokens');
		if (options.topP !== undefined) unsupportedParams.push('topP');
		if (options.topK !== undefined) unsupportedParams.push('topK');
		if (options.presencePenalty !== undefined)
			unsupportedParams.push('presencePenalty');
		if (options.frequencyPenalty !== undefined)
			unsupportedParams.push('frequencyPenalty');
		if (options.stopSequences !== undefined && options.stopSequences.length > 0)
			unsupportedParams.push('stopSequences');
		if (options.seed !== undefined) unsupportedParams.push('seed');

		if (unsupportedParams.length > 0) {
			// Add a warning for each unsupported parameter
			for (const param of unsupportedParams) {
				warnings.push({
					type: 'unsupported-setting',
					setting: param,
					details: `Claude Code CLI does not support the ${param} parameter. It will be ignored.`
				});
			}
		}

		return warnings;
	}

	/**
	 * Generate text using Claude Code
	 * @param {Object} options - Generation options
	 * @returns {Promise<Object>}
	 */
	async doGenerate(options) {
		const { messagesPrompt } = convertToClaudeCodeMessages(
			options.prompt,
			options.mode
		);

		const abortController = new AbortController();
		if (options.abortSignal) {
			options.abortSignal.addEventListener('abort', () =>
				abortController.abort()
			);
		}

		const queryOptions = {
			model: this.getModel(),
			abortController,
			resume: this.sessionId,
			pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
			customSystemPrompt: this.settings.customSystemPrompt,
			appendSystemPrompt: this.settings.appendSystemPrompt,
			maxTurns: this.settings.maxTurns,
			maxThinkingTokens: this.settings.maxThinkingTokens,
			cwd: this.settings.cwd,
			executable: this.settings.executable,
			executableArgs: this.settings.executableArgs,
			permissionMode: this.settings.permissionMode,
			permissionPromptToolName: this.settings.permissionPromptToolName,
			continue: this.settings.continue,
			allowedTools: this.settings.allowedTools,
			disallowedTools: this.settings.disallowedTools,
			mcpServers: this.settings.mcpServers
		};

		let text = '';
		let usage = { promptTokens: 0, completionTokens: 0 };
		let finishReason = 'stop';
		let costUsd;
		let durationMs;
		let rawUsage;
		const warnings = this.generateUnsupportedWarnings(options);

		try {
			const response = query({
				prompt: messagesPrompt,
				options: queryOptions
			});

			for await (const message of response) {
				if (message.type === 'assistant') {
					text += message.message.content
						.map((c) => (c.type === 'text' ? c.text : ''))
						.join('');
				} else if (message.type === 'result') {
					this.sessionId = message.session_id;
					costUsd = message.total_cost_usd;
					durationMs = message.duration_ms;

					if ('usage' in message) {
						rawUsage = message.usage;
						usage = {
							promptTokens:
								(message.usage.cache_creation_input_tokens ?? 0) +
								(message.usage.cache_read_input_tokens ?? 0) +
								(message.usage.input_tokens ?? 0),
							completionTokens: message.usage.output_tokens ?? 0
						};
					}

					if (message.subtype === 'error_max_turns') {
						finishReason = 'length';
					} else if (message.subtype === 'error_during_execution') {
						finishReason = 'error';
					}
				} else if (message.type === 'system' && message.subtype === 'init') {
					this.sessionId = message.session_id;
				}
			}
		} catch (error) {
			if (error instanceof AbortError) {
				throw options.abortSignal?.aborted
					? options.abortSignal.reason
					: error;
			}

			// Check for authentication errors
			if (
				error.message?.includes('not logged in') ||
				error.message?.includes('authentication') ||
				error.exitCode === 401
			) {
				throw createAuthenticationError({
					message:
						error.message ||
						'Authentication failed. Please ensure Claude Code CLI is properly authenticated.'
				});
			}

			// Wrap other errors with API call error
			throw createAPICallError({
				message: error.message || 'Claude Code CLI error',
				code: error.code,
				exitCode: error.exitCode,
				stderr: error.stderr,
				promptExcerpt: messagesPrompt.substring(0, 200),
				isRetryable: error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
			});
		}

		// Extract JSON if in object-json mode
		if (options.mode?.type === 'object-json' && text) {
			text = extractJson(text);
		}

		return {
			text: text || undefined,
			usage,
			finishReason,
			rawCall: {
				rawPrompt: messagesPrompt,
				rawSettings: queryOptions
			},
			warnings: warnings.length > 0 ? warnings : undefined,
			response: {
				id: generateId(),
				timestamp: new Date(),
				modelId: this.modelId
			},
			request: {
				body: messagesPrompt
			},
			providerMetadata: {
				'claude-code': {
					...(this.sessionId !== undefined && { sessionId: this.sessionId }),
					...(costUsd !== undefined && { costUsd }),
					...(durationMs !== undefined && { durationMs }),
					...(rawUsage !== undefined && { rawUsage })
				}
			}
		};
	}

	/**
	 * Stream text using Claude Code
	 * @param {Object} options - Stream options
	 * @returns {Promise<Object>}
	 */
	async doStream(options) {
		const { messagesPrompt } = convertToClaudeCodeMessages(
			options.prompt,
			options.mode
		);

		const abortController = new AbortController();
		if (options.abortSignal) {
			options.abortSignal.addEventListener('abort', () =>
				abortController.abort()
			);
		}

		const queryOptions = {
			model: this.getModel(),
			abortController,
			resume: this.sessionId,
			pathToClaudeCodeExecutable: this.settings.pathToClaudeCodeExecutable,
			customSystemPrompt: this.settings.customSystemPrompt,
			appendSystemPrompt: this.settings.appendSystemPrompt,
			maxTurns: this.settings.maxTurns,
			maxThinkingTokens: this.settings.maxThinkingTokens,
			cwd: this.settings.cwd,
			executable: this.settings.executable,
			executableArgs: this.settings.executableArgs,
			permissionMode: this.settings.permissionMode,
			permissionPromptToolName: this.settings.permissionPromptToolName,
			continue: this.settings.continue,
			allowedTools: this.settings.allowedTools,
			disallowedTools: this.settings.disallowedTools,
			mcpServers: this.settings.mcpServers
		};

		const warnings = this.generateUnsupportedWarnings(options);

		const stream = new ReadableStream({
			start: async (controller) => {
				try {
					const response = query({
						prompt: messagesPrompt,
						options: queryOptions
					});

					let usage = { promptTokens: 0, completionTokens: 0 };
					let accumulatedText = '';

					for await (const message of response) {
						if (message.type === 'assistant') {
							const text = message.message.content
								.map((c) => (c.type === 'text' ? c.text : ''))
								.join('');

							if (text) {
								accumulatedText += text;

								// In object-json mode, we need to accumulate the full text
								// and extract JSON at the end, so don't stream individual deltas
								if (options.mode?.type !== 'object-json') {
									controller.enqueue({
										type: 'text-delta',
										textDelta: text
									});
								}
							}
						} else if (message.type === 'result') {
							let rawUsage;
							if ('usage' in message) {
								rawUsage = message.usage;
								usage = {
									promptTokens:
										(message.usage.cache_creation_input_tokens ?? 0) +
										(message.usage.cache_read_input_tokens ?? 0) +
										(message.usage.input_tokens ?? 0),
									completionTokens: message.usage.output_tokens ?? 0
								};
							}

							let finishReason = 'stop';
							if (message.subtype === 'error_max_turns') {
								finishReason = 'length';
							} else if (message.subtype === 'error_during_execution') {
								finishReason = 'error';
							}

							// Store session ID in the model instance
							this.sessionId = message.session_id;

							// In object-json mode, extract JSON and send the full text at once
							if (options.mode?.type === 'object-json' && accumulatedText) {
								const extractedJson = extractJson(accumulatedText);
								controller.enqueue({
									type: 'text-delta',
									textDelta: extractedJson
								});
							}

							controller.enqueue({
								type: 'finish',
								finishReason,
								usage,
								providerMetadata: {
									'claude-code': {
										sessionId: message.session_id,
										...(message.total_cost_usd !== undefined && {
											costUsd: message.total_cost_usd
										}),
										...(message.duration_ms !== undefined && {
											durationMs: message.duration_ms
										}),
										...(rawUsage !== undefined && { rawUsage })
									}
								}
							});
						} else if (message.type === 'system' && message.subtype === 'init') {
							// Store session ID for future use
							this.sessionId = message.session_id;

							// Emit response metadata when session is initialized
							controller.enqueue({
								type: 'response-metadata',
								id: message.session_id,
								timestamp: new Date(),
								modelId: this.modelId
							});
						}
					}

					controller.close();
				} catch (error) {
					let errorToEmit;

					if (error instanceof AbortError) {
						errorToEmit = options.abortSignal?.aborted
							? options.abortSignal.reason
							: error;
					} else if (
						error.message?.includes('not logged in') ||
						error.message?.includes('authentication') ||
						error.exitCode === 401
					) {
						errorToEmit = createAuthenticationError({
							message:
								error.message ||
								'Authentication failed. Please ensure Claude Code CLI is properly authenticated.'
						});
					} else {
						errorToEmit = createAPICallError({
							message: error.message || 'Claude Code CLI error',
							code: error.code,
							exitCode: error.exitCode,
							stderr: error.stderr,
							promptExcerpt: messagesPrompt.substring(0, 200),
							isRetryable:
								error.code === 'ENOENT' || error.code === 'ECONNREFUSED'
						});
					}

					// Emit error as a stream part
					controller.enqueue({
						type: 'error',
						error: errorToEmit
					});

					controller.close();
				}
			}
		});

		return {
			stream,
			rawCall: {
				rawPrompt: messagesPrompt,
				rawSettings: queryOptions
			},
			warnings: warnings.length > 0 ? warnings : undefined,
			request: {
				body: messagesPrompt
			}
		};
	}
}