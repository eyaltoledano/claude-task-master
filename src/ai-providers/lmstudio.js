/**
 * lmstudio.js
 * AI provider implementation for LM Studio models using OpenAI-compatible API.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { BaseAIProvider } from './base-provider.js';
import { log } from '../../scripts/modules/utils.js';
import OpenAI from 'openai';

export class LMStudioAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'LM Studio';
	}

	/**
	 * Override auth validation - LM Studio doesn't require API keys for local usage
	 */
	validateAuth() {
		// LM Studio runs locally and doesn't require API keys
		// API key is optional for authentication if needed
		// No authentication validation required
	}

	/**
	 * Creates and returns an LM Studio client instance.
	 * @param {object} params - Parameters for client initialization
	 * @param {string} [params.apiKey] - Optional API key for authentication
	 * @param {string} [params.baseURL] - LM Studio base URL (defaults to http://127.0.0.1:1234/v1)
	 * @returns {Function} LM Studio client function
	 * @throws {Error} If initialization fails
	 */
	getClient(params) {
		try {
			const { apiKey, baseURL = 'http://127.0.0.1:1234/v1' } = params;

			return createOpenAI({
				...(apiKey && { apiKey }),
				baseURL
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}

	/**
	 * Override generateObject to handle LM Studio's tool_choice limitations
	 * LM Studio only supports string values for tool_choice, not objects
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
			
			// For LM Studio, we need to use the raw OpenAI client directly
			// since the Vercel AI SDK's generateObject doesn't work with LM Studio's tool_choice limitations
			const { apiKey, baseURL = 'http://127.0.0.1:1234/v1' } = params;
			const openaiClient = new OpenAI({
				apiKey: apiKey || 'lm-studio-dummy-key', // LM Studio doesn't require a real API key
				baseURL
			});
			
			// Create a function schema for LM Studio
			const functionSchema = {
				name: params.objectName,
				description: `Generate a ${params.objectName} object`,
				parameters: {
					type: 'object',
					properties: {
						tasks: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									id: { type: 'number' },
									title: { type: 'string' },
									description: { type: 'string' },
									status: { type: 'string' },
									dependencies: { type: 'array', items: { type: 'number' } },
									priority: { type: 'string', enum: ['high', 'medium', 'low'] },
									details: { type: 'string' },
									testStrategy: { type: 'string' }
								},
								required: ['id', 'title', 'description', 'status', 'dependencies', 'priority', 'details', 'testStrategy']
							}
						},
						metadata: {
							type: 'object',
							properties: {
								projectName: { type: 'string' },
								totalTasks: { type: 'number' },
								sourceFile: { type: 'string' },
								generatedAt: { type: 'string' }
							},
							required: ['projectName', 'totalTasks', 'sourceFile', 'generatedAt']
						}
					},
					required: ['tasks', 'metadata']
				}
			};

			// Use the raw OpenAI client with function calling
			const response = await openaiClient.chat.completions.create({
				model: params.modelId,
				messages: params.messages,
				tools: [{
					type: 'function',
					function: functionSchema
				}],
				tool_choice: 'required', // Use string instead of object
				...this.prepareTokenParam(params.modelId, params.maxTokens),
				temperature: params.temperature
			});

			// Extract the function call result
			const choice = response.choices[0];
			if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
				throw new Error('No function call found in response');
			}

			const toolCall = choice.message.tool_calls[0];
			const resultObject = JSON.parse(toolCall.function.arguments);

			log(
				'debug',
				`${this.name} generateObject completed successfully for model: ${params.modelId}`
			);

			return {
				object: resultObject,
				usage: {
					inputTokens: response.usage?.prompt_tokens || 0,
					outputTokens: response.usage?.completion_tokens || 0,
					totalTokens: response.usage?.total_tokens || 0
				}
			};
		} catch (error) {
			this.handleError('object generation', error);
		}
	}

	/**
	 * Returns if the API key is required
	 * @returns {boolean} false - LM Studio doesn't require API keys for local usage
	 */
	isRequiredApiKey() {
		return false;
	}

	/**
	 * Returns the required API key environment variable name
	 * @returns {string} The environment variable name for LM Studio API key (optional)
	 */
	getRequiredApiKeyName() {
		return 'LMSTUDIO_API_KEY';
	}
}
