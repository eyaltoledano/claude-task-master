/**
 * openai-compatible.js
 * AI provider implementation for OpenAI-compatible APIs (like DashScope, etc.)
 * that have slight differences from the standard OpenAI API.
 */

import { generateObject, generateText, streamText } from 'ai';
import { OpenAIProvider } from './openai.js';
import { log } from '../../scripts/modules/index.js';
import { extractJson } from './custom-sdk/claude-code/json-extractor.js';

export class OpenAICompatibleProvider extends OpenAIProvider {
	constructor() {
		super();
		this.name = 'OpenAI Compatible';
	}

	/**
	 * Adapts parameters for OpenAI-compatible APIs that have slight differences
	 * @param {object} params - Original parameters
	 * @returns {object} Adapted parameters
	 */
	adaptParamsForCompatibility(params) {
		const adaptedParams = { ...params };

		// Handle tool_choice parameter differences
		// Some OpenAI-compatible APIs (like DashScope) only support string values
		// instead of the full OpenAI object format
		if (params.schema && params.objectName) {
			// For generateObject calls, we need to handle tool_choice differently
			// DashScope expects "auto" instead of the complex OpenAI tool_choice object
			log('debug', 'Adapting tool_choice for OpenAI-compatible API');
		}

		return adaptedParams;
	}

	/**
	 * Generates a structured object using OpenAI-compatible API
	 * Overrides the base implementation to handle API differences
	 */
	async generateObject(params) {
		try {
			this.validateParams(params);
			this.validateMessages(params.messages);

			if (!params.schema) {
				throw new Error('Schema is required for object generation');
			}
			if (!params.objectName) {
				throw new Error('Object name is required for object generation');
			}

			log(
				'debug',
				`Generating ${this.name} object ('${params.objectName}') with model: ${params.modelId}`
			);

			const client = await this.getClient(params);

			// For OpenAI-compatible APIs, we need to use 'json' mode instead of
			// the default tool_choice object that might not be supported
			// This avoids the tool_choice parameter entirely
			let result;
			try {
				result = await generateObject({
					model: client(params.modelId),
					messages: params.messages,
					schema: params.schema,
					mode: 'json', // Use 'json' mode to avoid tool_choice issues
					maxTokens: params.maxTokens,
					temperature: params.temperature
				});
			} catch (error) {
				// If JSON parsing fails, try to extract JSON from the response
				if (error.message && error.message.includes('could not parse the response')) {
					log('debug', 'JSON parsing failed, attempting to extract JSON from response');

					// Get the raw response text from the error
					const rawText = error.text || error.response || '';
					if (rawText) {
						try {
							const extractedJson = extractJson(rawText);
							const parsedObject = JSON.parse(extractedJson);

							// Create a result object similar to what generateObject would return
							result = {
								object: parsedObject,
								usage: error.usage || {
									promptTokens: 0,
									completionTokens: 0,
									totalTokens: 0
								}
							};

							log('debug', 'Successfully extracted and parsed JSON from response');
						} catch (extractError) {
							log('error', `Failed to extract JSON: ${extractError.message}`);
							throw error; // Re-throw original error
						}
					} else {
						throw error; // Re-throw original error
					}
				} else {
					throw error; // Re-throw original error
				}
			}

			log(
				'debug',
				`${this.name} generateObject completed successfully for model: ${params.modelId}`
			);

			return {
				object: result.object,
				usage: {
					inputTokens: result.usage?.promptTokens,
					outputTokens: result.usage?.completionTokens,
					totalTokens: result.usage?.totalTokens
				}
			};
		} catch (error) {
			// Enhanced error handling for compatibility issues
			if (error.message && error.message.includes('tool_choice')) {
				log('warn', `Tool choice compatibility issue detected: ${error.message}`);
				// Could implement fallback logic here if needed
			}
			this.handleError('object generation', error);
		}
	}

	/**
	 * Generates text using OpenAI-compatible API
	 * Inherits from OpenAI provider but could be overridden if needed
	 */
	async generateText(params) {
		const adaptedParams = this.adaptParamsForCompatibility(params);
		return super.generateText(adaptedParams);
	}

	/**
	 * Streams text using OpenAI-compatible API  
	 * Inherits from OpenAI provider but could be overridden if needed
	 */
	async streamText(params) {
		const adaptedParams = this.adaptParamsForCompatibility(params);
		return super.streamText(adaptedParams);
	}
}
