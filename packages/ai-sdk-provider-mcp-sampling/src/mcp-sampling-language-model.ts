/**
 * MCP Sampling Language Model implementation for AI SDK v5
 */

import type {
	LanguageModelV2,
	LanguageModelV2CallOptions,
	LanguageModelV2CallWarning
} from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { generateId } from '@ai-sdk/provider-utils';

import {
	createMCPAPICallError,
	createMCPSessionError,
	mapMCPError
} from './errors.js';
import { extractJson } from './json-extractor.js';
import {
	convertFromMCPFormat,
	convertToMCPFormat,
	createPromptFromMessages
} from './message-converter.js';
import type {
	MCPSamplingLanguageModelOptions,
	MCPSamplingModelId,
	MCPSamplingSettings,
	MCPSession
} from './types.js';

/**
 * MCP Sampling Language Model implementation for AI SDK v5
 */
export class MCPSamplingLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = 'v2' as const;
	readonly defaultObjectGenerationMode = 'json' as const;
	readonly supportsImageUrls = false;
	readonly supportsStructuredOutputs = true;
	readonly supportedUrls: Record<string, RegExp[]> = {};

	readonly modelId: MCPSamplingModelId;
	readonly settings: MCPSamplingSettings;
	readonly session: MCPSession;

	constructor(options: MCPSamplingLanguageModelOptions & { session: MCPSession }) {
		this.modelId = options.id;
		this.settings = options.settings ?? {};
		this.session = options.session;

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

		// Validate MCP session
		this.validateSession();
	}

	get provider(): string {
		return 'mcp-sampling';
	}

	/**
	 * Validate that the MCP session has required capabilities
	 */
	private validateSession(): void {
		if (!this.session) {
			throw createMCPSessionError({
				message: 'MCP session is required'
			});
		}

		if (!this.session.clientCapabilities?.sampling) {
			throw createMCPSessionError({
				message: 'MCP session must have client sampling capabilities'
			});
		}
	}

	/**
	 * Generate comprehensive warnings for unsupported parameters
	 */
	private generateWarnings(
		options: LanguageModelV2CallOptions
	): LanguageModelV2CallWarning[] {
		const warnings: LanguageModelV2CallWarning[] = [];
		const unsupportedParams: string[] = [];

		// Check for unsupported parameters
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
					setting: param as
						| 'topP'
						| 'topK'
						| 'presencePenalty'
						| 'frequencyPenalty'
						| 'stopSequences'
						| 'seed',
					details: `MCP Sampling does not support the ${param} parameter. It will be ignored.`
				});
			}
		}

		return warnings;
	}

	/**
	 * Generate text using MCP session sampling
	 */
	async doGenerate(options: LanguageModelV2CallOptions) {
		// Handle abort signal early
		if (options.abortSignal?.aborted) {
			throw options.abortSignal.reason || new Error('Request aborted');
		}

		const prompt = createPromptFromMessages(options.prompt);
		const warnings = this.generateWarnings(options);

		try {
			// Convert AI SDK prompt to MCP format
			const { messages, systemPrompt } = convertToMCPFormat(options.prompt);

			// Use MCP session.requestSampling
			const response = await this.session.requestSampling(
				{
					messages,
					systemPrompt,
					temperature: options.temperature ?? this.settings.temperature,
					maxTokens: options.maxTokens ?? this.settings.maxTokens,
					includeContext: 'thisServer'
				},
				{
					timeout: this.settings.timeout ?? 240000 // 4 minutes default
				}
			);

			// Convert MCP response back to AI SDK format
			const result = convertFromMCPFormat(response);

			// Extract JSON if in object-json mode
			let text = result.text || '';
			const isObjectJson = (
				o: unknown
			): o is { mode: { type: 'object-json' } } =>
				!!o &&
				typeof o === 'object' &&
				'mode' in o &&
				(o as any).mode?.type === 'object-json';
			if (isObjectJson(options) && text) {
				text = extractJson(text);
			}

			return {
				content: [
					{
						type: 'text' as const,
						text: text || ''
					}
				],
				usage: result.usage
					? {
							inputTokens: result.usage.inputTokens,
							outputTokens: result.usage.outputTokens,
							totalTokens: result.usage.inputTokens + result.usage.outputTokens
						}
					: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				finishReason: (result.finishReason as any) || 'stop',
				rawCall: {
					rawPrompt: prompt,
					rawSettings: {
						temperature: options.temperature ?? this.settings.temperature,
						maxTokens: options.maxTokens ?? this.settings.maxTokens
					}
				},
				warnings: warnings,
				response: {
					id: generateId(),
					timestamp: new Date(),
					modelId: this.modelId
				},
				request: {
					body: JSON.stringify({ messages, systemPrompt })
				},
				providerMetadata: {
					'mcp-sampling': {
						modelId: this.modelId,
						sessionCapabilities: this.session.clientCapabilities
					}
				}
			};
		} catch (error) {
			throw mapMCPError(error);
		}
	}

	/**
	 * Stream text using MCP sampling
	 * Note: MCP may not support native streaming, so this simulates streaming
	 * by generating the full response and then streaming it in chunks
	 */
	async doStream(options: LanguageModelV2CallOptions) {
		const prompt = createPromptFromMessages(options.prompt);
		const warnings = this.generateWarnings(options);

		const stream = new ReadableStream({
			start: async (controller) => {
				let abortListener: (() => void) | undefined;

				try {
					// Handle abort signal
					if (options.abortSignal?.aborted) {
						throw options.abortSignal.reason || new Error('Request aborted');
					}

					// Set up abort listener
					if (options.abortSignal) {
						abortListener = () => {
							controller.enqueue({
								type: 'error',
								error:
									options.abortSignal?.reason || new Error('Request aborted')
							});
							controller.close();
						};
						options.abortSignal.addEventListener('abort', abortListener, {
							once: true
						});
					}

					// Emit stream-start with warnings
					controller.enqueue({ type: 'stream-start', warnings });

					// Generate the full response first
					const result = await this.doGenerate(options);

					// Emit response metadata
					controller.enqueue({
						type: 'response-metadata',
						id: result.response.id,
						timestamp: result.response.timestamp,
						modelId: result.response.modelId
					});

					// Simulate streaming by chunking the text
					const content = result.content || [];
					const text =
						content.length > 0 && content[0].type === 'text'
							? content[0].text
							: '';
					const chunkSize = 50; // Characters per chunk
					let textPartId: string | undefined;

					// Emit text-start if we have content
					if (text.length > 0) {
						textPartId = generateId();
						controller.enqueue({
							type: 'text-start',
							id: textPartId
						});
					}

					for (let i = 0; i < text.length; i += chunkSize) {
						// Check for abort during streaming
						if (options.abortSignal?.aborted) {
							throw options.abortSignal.reason || new Error('Request aborted');
						}

						const chunk = text.slice(i, i + chunkSize);
						controller.enqueue({
							type: 'text-delta',
							id: textPartId!,
							delta: chunk
						});

						// Add small delay to simulate streaming
						await new Promise((resolve) => setTimeout(resolve, 20));
					}

					// Close text part if opened
					if (textPartId) {
						controller.enqueue({
							type: 'text-end',
							id: textPartId
						});
					}

					// Emit finish event
					controller.enqueue({
						type: 'finish',
						finishReason: result.finishReason,
						usage: result.usage,
						providerMetadata: result.providerMetadata
					});

					controller.close();
				} catch (error) {
					controller.enqueue({
						type: 'error',
						error: mapMCPError(error)
					});
					controller.close();
				} finally {
					// Clean up abort listener
					if (options.abortSignal && abortListener) {
						options.abortSignal.removeEventListener('abort', abortListener);
					}
				}
			},
			cancel: () => {
				// Clean up if stream is cancelled
			}
		});

		return {
			stream,
			request: {
				body: prompt
			}
		};
	}
}