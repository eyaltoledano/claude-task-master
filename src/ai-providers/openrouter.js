import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText, generateObject } from 'ai';
import { log } from '../../scripts/modules/utils.js'; // Assuming utils.js is in scripts/modules

function getClient(apiKey, baseUrl) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	return createOpenRouter({
		apiKey,
		...(baseUrl && { baseURL: baseUrl })
	});
}

/**
 * Generates text using an OpenRouter chat model.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - OpenRouter API key.
 * @param {string} params.modelId - The OpenRouter model ID (e.g., 'anthropic/claude-3.5-sonnet').
 * @param {Array<object>} params.messages - Array of message objects (system, user, assistant).
 * @param {number} [params.maxTokens] - Maximum tokens to generate.
 * @param {number} [params.temperature] - Sampling temperature.
 * @param {string} [params.baseUrl] - Base URL for the OpenRouter API.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If the API call fails.
 */
async function generateOpenRouterText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	...rest // Capture any other Vercel AI SDK compatible parameters
}) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	if (!modelId) throw new Error('OpenRouter model ID is required.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const openrouter = getClient(apiKey, baseUrl);
		const model = openrouter.chat(modelId); // Assuming chat model

		// Capture the full result from generateText
		const result = await generateText({
			model,
			messages,
			maxTokens,
			temperature,
			...rest // Pass any additional parameters
		});

		// Check if text and usage are present
		if (!result || typeof result.text !== 'string') {
			log(
				'warn',
				`OpenRouter generateText for model ${modelId} did not return expected text.`,
				{ result }
			);
			throw new Error('Failed to extract text from OpenRouter response.');
		}
		if (!result.usage) {
			log(
				'warn',
				`OpenRouter generateText for model ${modelId} did not return usage data.`,
				{ result }
			);
			// Decide if this is critical. For now, let it pass but telemetry will be incomplete.
		}

		log('debug', `OpenRouter generateText completed for model ${modelId}`);
		// Return text and usage
		return {
			text: result.text,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		let detailedMessage = `OpenRouter generateText failed for model ${modelId}: ${error.message}`;
		if (error.cause) {
			detailedMessage += `\n\nCause:\n\n ${typeof error.cause === 'string' ? error.cause : JSON.stringify(error.cause)}`;
		}
		// Vercel AI SDK sometimes wraps the actual API error response in error.data
		if (error.data) {
			detailedMessage += `\n\nData:\n\n ${JSON.stringify(error.data)}`;
		}
		// Log the original error object for full context if needed for deeper debugging
		log('error', detailedMessage, { originalErrorObject: error });
		throw error;
	}
}

/**
 * Streams text using an OpenRouter chat model.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} params.apiKey - OpenRouter API key.
 * @param {string} params.modelId - The OpenRouter model ID (e.g., 'anthropic/claude-3.5-sonnet').
 * @param {Array<object>} params.messages - Array of message objects (system, user, assistant).
 * @param {number} [params.maxTokens] - Maximum tokens to generate.
 * @param {number} [params.temperature] - Sampling temperature.
 * @param {string} [params.baseUrl] - Base URL for the OpenRouter API.
 * @returns {Promise<ReadableStream<string>>} A readable stream of text deltas.
 * @throws {Error} If the API call fails.
 */
async function streamOpenRouterText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	...rest
}) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	if (!modelId) throw new Error('OpenRouter model ID is required.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const openrouter = getClient(apiKey, baseUrl);
		const model = openrouter.chat(modelId);

		// Directly return the stream from the Vercel AI SDK function
		const stream = await streamText({
			model,
			messages,
			maxTokens,
			temperature,
			...rest
		});
		return stream;
	} catch (error) {
		let detailedMessage = `OpenRouter streamText failed for model ${modelId}: ${error.message}`;
		if (error.cause) {
			detailedMessage += `\n\nCause:\n\n ${typeof error.cause === 'string' ? error.cause : JSON.stringify(error.cause)}`;
		}
		if (error.data) {
			detailedMessage += `\n\nData:\n\n ${JSON.stringify(error.data)}`;
		}
		log('error', detailedMessage, { originalErrorObject: error });
		throw error;
	}
}

/**
 * Generates a structured object using an OpenRouter chat model.
 *
 * @param {object} params - Parameters for object generation.
 * @param {string} params.apiKey - OpenRouter API key.
 * @param {string} params.modelId - The OpenRouter model ID.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the expected object.
 * @param {Array<object>} params.messages - Array of message objects.
 * @param {string} [params.objectName='generated_object'] - Name for object/tool.
 * @param {number} [params.maxRetries=3] - Max retries for object generation.
 * @param {number} [params.maxTokens] - Maximum tokens.
 * @param {number} [params.temperature] - Temperature.
 * @param {string} [params.baseUrl] - Base URL for the OpenRouter API.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If the API call fails or validation fails.
 */
async function generateOpenRouterObject({
	apiKey,
	modelId,
	schema,
	messages,
	objectName = 'generated_object',
	maxRetries = 3,
	maxTokens,
	temperature,
	baseUrl,
	...rest
}) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	if (!modelId) throw new Error('OpenRouter model ID is required.');
	if (!schema) throw new Error('Zod schema is required for object generation.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const openrouter = getClient(apiKey, baseUrl);
		const model = openrouter.chat(modelId);

		// Capture the full result from generateObject
		const result = await generateObject({
			model,
			schema,
			mode: 'tool',
			tool: {
				name: objectName,
				description: `Generate an object conforming to the ${objectName} schema.`,
				parameters: schema
			},
			messages,
			maxTokens,
			temperature,
			maxRetries,
			...rest
		});

		// Check if object and usage are present
		if (!result || typeof result.object === 'undefined') {
			log(
				'warn',
				`OpenRouter generateObject for model ${modelId} did not return expected object.`,
				{ result }
			);
			throw new Error('Failed to extract object from OpenRouter response.');
		}
		if (!result.usage) {
			log(
				'warn',
				`OpenRouter generateObject for model ${modelId} did not return usage data.`,
				{ result }
			);
		}

		log('debug', `OpenRouter generateObject completed for model ${modelId}`);
		// Return object and usage
		return {
			object: result.object,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		let detailedMessage = `OpenRouter generateObject failed for model ${modelId}: ${error.message}`;
		if (error.cause) {
			detailedMessage += `\n\nCause:\n\n ${typeof error.cause === 'string' ? error.cause : JSON.stringify(error.cause)}`;
		}
		if (error.data) {
			detailedMessage += `\n\nData:\n\n ${JSON.stringify(error.data)}`;
		}
		log('error', detailedMessage, { originalErrorObject: error });
		throw error;
	}
}

export {
	generateOpenRouterText,
	streamOpenRouterText,
	generateOpenRouterObject
};
