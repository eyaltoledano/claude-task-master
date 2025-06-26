/**
 * @fileoverview MCP Sampling Language Model implementation
 */

import { NoSuchModelError } from '@ai-sdk/provider';
import { generateId } from '@ai-sdk/provider-utils';
import {
	convertToMcpSamplingMessages,
	extractTextFromResponse
} from './message-converter.js';
import {
	createAPICallError,
	createAuthenticationError,
	createTimeoutError
} from './errors.js';

/**
 * @typedef {import('./types.js').McpSamplingSettings} McpSamplingSettings
 * @typedef {import('./types.js').McpSamplingModelId} McpSamplingModelId
 * @typedef {import('./types.js').McpSamplingLanguageModelOptions} McpSamplingLanguageModelOptions
 */

export class McpSamplingLanguageModel {
	specificationVersion = 'v1';
	defaultObjectGenerationMode = 'json';
	supportsImageUrls = false;
	supportsStructuredOutputs = false;

	/** @type {McpSamplingModelId} */
	modelId;

	/** @type {McpSamplingSettings} */
	settings;

	/**
	 * @param {McpSamplingLanguageModelOptions} options
	 */
	constructor(options) {
		this.modelId = options.id;
		this.settings = options.settings ?? {};

		// Validate model ID
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
		return 'mcp-sampling';
	}

	/**
	 * Validate that we have a valid MCP session
	 * @returns {Object} The validated session
	 * @throws {Error} If session is invalid
	 */
	validateSession() {
		const session = this.settings.session;

		if (!session) {
			throw createAuthenticationError({
				message: 'MCP session is required but not provided',
				data: { modelId: this.modelId }
			});
		}

		if (
			!session.requestSampling ||
			typeof session.requestSampling !== 'function'
		) {
			throw createAuthenticationError({
				message: 'MCP session does not have requestSampling capability',
				data: { modelId: this.modelId }
			});
		}

		if (!session.clientCapabilities?.sampling) {
			throw createAuthenticationError({
				message: 'MCP session does not have client sampling capabilities',
				data: { modelId: this.modelId }
			});
		}

		return session;
	}

	/**
	 * Generate unsupported parameter warnings
	 * @param {Object} options - Generation options
	 * @returns {Array} Warnings array
	 */
	generateWarnings(options) {
		const warnings = [];

		// MCP Sampling supports most parameters through the session
		// but we should warn about unsupported features
		if (options.tools && options.tools.length > 0) {
			warnings.push({
				type: 'unsupported-setting',
				setting: 'tools',
				details: 'MCP Sampling does not support tool calling'
			});
		}

		if (options.toolChoice) {
			warnings.push({
				type: 'unsupported-setting',
				setting: 'toolChoice',
				details: 'MCP Sampling does not support tool choice'
			});
		}

		if (
			options.responseFormat &&
			options.responseFormat.type === 'json_schema'
		) {
			warnings.push({
				type: 'unsupported-setting',
				setting: 'responseFormat.json_schema',
				details: 'MCP Sampling does not support JSON schema response format'
			});
		}

		return warnings;
	}

	/**
	 * Generate text using MCP Sampling
	 * @param {Object} options - Generation options
	 * @returns {Promise<Object>}
	 */
	async doGenerate(options) {
		const session = this.validateSession();
		const warnings = this.generateWarnings(options);

		// Convert messages to MCP format
		const { messages, systemPrompt } = convertToMcpSamplingMessages(
			options.prompt,
			options.mode
		);

		// Prepare request parameters
		const requestParams = {
			messages: messages,
			systemPrompt: systemPrompt || this.settings.systemPrompt || '',
			temperature: options.temperature ?? this.settings.temperature ?? 0.7,
			maxTokens: options.maxTokens ?? this.settings.maxTokens ?? 1000,
			includeContext: this.settings.includeContext || 'thisServer'
		};

		// Add model preferences if model ID is specified
		// MCP uses a preference system, not direct model selection
		if (this.modelId) {
			requestParams.modelPreferences = {
				hints: [{ name: this.modelId }],
				// Default priorities - can be overridden via settings
				costPriority: this.settings.costPriority ?? 0.5,
				speedPriority: this.settings.speedPriority ?? 0.5,
				intelligencePriority: this.settings.intelligencePriority ?? 0.5
			};
		}

		const requestOptions = {
			timeout: this.settings.timeout || 120000 // 2 minutes default
		};

		try {
			// Call MCP sampling
			const response = await session.requestSampling(
				requestParams,
				requestOptions
			);

			// Extract text from response
			const text = extractTextFromResponse(response);

			// Parse JSON if in object mode
			let parsedObject = undefined;
			if (options.mode?.type === 'object-json') {
				try {
					parsedObject = JSON.parse(text);
				} catch (e) {
					throw createAPICallError({
						message: 'Failed to parse JSON response from MCP Sampling',
						cause: e,
						data: {
							modelId: this.modelId,
							operation: 'json-parse',
							response: text
						}
					});
				}
			}

			// Return AI SDK compatible response
			return {
				text: text,
				toolCalls: [], // MCP doesn't support tools
				finishReason: response.stopReason || 'stop',
				usage: {
					promptTokens: 0, // MCP doesn't provide token counts
					completionTokens: 0,
					totalTokens: 0
				},
				warnings: warnings,
				rawResponse: {
					headers: {},
					body: response
				},
				object: parsedObject,
				request: {
					body: JSON.stringify(requestParams)
				},
				response: {
					id: generateId(),
					timestamp: new Date(),
					modelId: this.modelId
				}
			};
		} catch (error) {
			// Handle timeout errors
			if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
				throw createTimeoutError({
					timeout: requestOptions.timeout,
					operation: 'requestSampling',
					cause: error,
					data: { modelId: this.modelId }
				});
			}

			// Handle authentication/session errors
			if (
				error.message?.includes('session') ||
				error.message?.includes('capability')
			) {
				throw createAuthenticationError({
					message: error.message,
					cause: error,
					data: { modelId: this.modelId }
				});
			}

			// Generic API error
			throw createAPICallError({
				message: error.message || 'MCP Sampling request failed',
				cause: error,
				data: {
					modelId: this.modelId,
					operation: 'requestSampling'
				}
			});
		}
	}

	/**
	 * Stream text using MCP Sampling (not supported)
	 * @param {Object} options - Generation options
	 * @returns {Promise<never>}
	 */
	async doStream(options) {
		throw new NoSuchModelError({
			modelId: this.modelId,
			modelType: 'languageModel',
			message: 'MCP Sampling does not support streaming'
		});
	}
}
