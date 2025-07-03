/**
 * src/ai-providers/custom-sdk/mcp/language-model.js
 *
 * MCP Language Model implementation following AI SDK LanguageModelV1 interface.
 * Uses MCP session.requestSampling() for AI operations.
 */

import {
	convertToMCPFormat,
	convertFromMCPFormat
} from './message-converter.js';
import { MCPError, mapMCPError } from './errors.js';
import { extractJson } from './json-extractor.js';
import {
	convertSchemaToInstructions,
	enhancePromptForJSON
} from './schema-converter.js';

/**
 * MCP Language Model implementing AI SDK LanguageModelV1 interface
 */
export class MCPLanguageModel {
	specificationVersion = 'v1';
	defaultObjectGenerationMode = 'json';
	supportsImageUrls = false;
	supportsStructuredOutputs = true;

	constructor(options) {
		this.session = options.session; // MCP session object
		this.modelId = options.modelId;
		this.settings = options.settings || {};
		this.provider = 'mcp-ai-sdk';
		this.maxTokens = this.settings.maxTokens;
		this.temperature = this.settings.temperature;

		this.validateSession();
	}

	/**
	 * Validate that the MCP session has required capabilities
	 */
	validateSession() {
		if (!this.session?.clientCapabilities?.sampling) {
			throw new MCPError('MCP session must have client sampling capabilities');
		}
	}

	/**
	 * Generate text using MCP session sampling
	 * @param {object} options - Generation options
	 * @param {Array} options.prompt - AI SDK prompt format
	 * @param {AbortSignal} options.abortSignal - Abort signal
	 * @returns {Promise<object>} Generation result in AI SDK format
	 */
	async doGenerate(options) {
		try {
			// Convert AI SDK prompt to MCP format
			const { messages, systemPrompt } = convertToMCPFormat(options.prompt);

			// Use MCP session.requestSampling (same as MCPRemoteProvider)
			const response = await this.session.requestSampling(
				{
					messages,
					systemPrompt,
					temperature: this.settings.temperature,
					maxTokens: this.settings.maxTokens,
					includeContext: 'thisServer'
				},
				{
					// signal: options.abortSignal,
					timeout: 240000 // 4 minutes timeout
				}
			);

			// Convert MCP response back to AI SDK format
			const result = convertFromMCPFormat(response);

			return {
				text: result.text,
				finishReason: result.finishReason || 'stop',
				usage: {
					promptTokens: result.usage?.inputTokens || 0,
					completionTokens: result.usage?.outputTokens || 0,
					totalTokens:
						(result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
				},
				rawResponse: response,
				warnings: result.warnings
			};
		} catch (error) {
			throw mapMCPError(error);
		}
	}

	/**
	 * Generate structured object using MCP session sampling
	 * @param {object} options - Generation options
	 * @param {Array} options.prompt - AI SDK prompt format
	 * @param {import('zod').ZodSchema} options.schema - Zod schema for validation
	 * @param {string} [options.mode='json'] - Generation mode ('json' or 'tool')
	 * @param {AbortSignal} options.abortSignal - Abort signal
	 * @returns {Promise<object>} Generation result with structured object
	 */
	async doGenerateObject(options) {
		try {
			const { schema, mode = 'json', ...restOptions } = options;

			if (!schema) {
				throw new MCPError('Schema is required for object generation');
			}

			// Convert schema to JSON instructions
			const objectName = restOptions.objectName || 'generated_object';
			const jsonInstructions = convertSchemaToInstructions(schema, objectName);

			// Enhance prompt with JSON generation instructions
			const enhancedPrompt = enhancePromptForJSON(
				options.prompt,
				jsonInstructions
			);

			// Convert enhanced prompt to MCP format
			const { messages, systemPrompt } = convertToMCPFormat(enhancedPrompt);

			// Use MCP session.requestSampling with enhanced prompt
			const response = await this.session.requestSampling(
				{
					messages,
					systemPrompt,
					temperature: this.settings.temperature,
					maxTokens: this.settings.maxTokens,
					includeContext: 'thisServer'
				},
				{
					timeout: 240000 // 4 minutes timeout
				}
			);

			// Convert MCP response back to AI SDK format
			const result = convertFromMCPFormat(response);

			// Extract JSON from the response text
			const jsonText = extractJson(result.text);

			// Parse and validate JSON
			let parsedObject;
			try {
				parsedObject = JSON.parse(jsonText);
			} catch (parseError) {
				throw new MCPError(
					`Failed to parse JSON response: ${parseError.message}. Response: ${result.text.substring(0, 200)}...`
				);
			}

			// Validate against schema
			try {
				const validatedObject = schema.parse(parsedObject);

				return {
					object: validatedObject,
					finishReason: result.finishReason || 'stop',
					usage: {
						promptTokens: result.usage?.inputTokens || 0,
						completionTokens: result.usage?.outputTokens || 0,
						totalTokens:
							(result.usage?.inputTokens || 0) +
							(result.usage?.outputTokens || 0)
					},
					rawResponse: response,
					warnings: result.warnings
				};
			} catch (validationError) {
				throw new MCPError(
					`Generated object does not match schema: ${validationError.message}. Generated: ${JSON.stringify(parsedObject, null, 2)}`
				);
			}
		} catch (error) {
			throw mapMCPError(error);
		}
	}

	/**
	 * Stream text generation using MCP session sampling
	 * Note: MCP may not support native streaming, so this may simulate streaming
	 * @param {object} options - Generation options
	 * @returns {AsyncIterable} Stream of generation chunks
	 */
	async doStream(options) {
		try {
			// For now, simulate streaming by chunking the complete response
			// TODO: Implement native streaming if MCP supports it
			const result = await this.doGenerate(options);

			// Create async generator that yields chunks
			return this.simulateStreaming(result);
		} catch (error) {
			throw mapMCPError(error);
		}
	}

	/**
	 * Simulate streaming by chunking a complete response
	 * @param {object} result - Complete generation result
	 * @returns {AsyncIterable} Simulated stream chunks
	 */
	async *simulateStreaming(result) {
		const text = result.text;
		const chunkSize = Math.max(1, Math.floor(text.length / 10)); // 10 chunks

		for (let i = 0; i < text.length; i += chunkSize) {
			const chunk = text.slice(i, i + chunkSize);
			const isLast = i + chunkSize >= text.length;

			yield {
				type: 'text-delta',
				textDelta: chunk
			};

			// Small delay to simulate streaming
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Final chunk with finish reason and usage
		yield {
			type: 'finish',
			finishReason: result.finishReason,
			usage: result.usage
		};
	}
}
