import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText, generateObject } from 'ai';
import { log } from '../../scripts/modules/utils.js'; // Assuming utils.js is in scripts/modules

/**
 * Generates text using an OpenRouter chat model.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - OpenRouter API key.
 * @param {string} params.modelId - The OpenRouter model ID (e.g., 'anthropic/claude-3.5-sonnet').
 * @param {Array<object>} params.messages - Array of message objects (system, user, assistant).
 * @param {number} [params.maxTokens] - Maximum tokens to generate.
 * @param {number} [params.temperature] - Sampling temperature.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If the API call fails.
 */
async function generateOpenRouterText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	...rest // Capture any other Vercel AI SDK compatible parameters
}) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	if (!modelId) throw new Error('OpenRouter model ID is required.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const openrouter = createOpenRouter({ apiKey });
		const model = openrouter.chat(modelId); // Assuming chat model

		const { text } = await generateText({
			model,
			messages,
			maxTokens,
			temperature,
			...rest // Pass any additional parameters
		});
		return text;
	} catch (error) {
		log(
			'error',
			`OpenRouter generateText failed for model ${modelId}: ${error.message}`
		);
		// Re-throw the error for the unified layer to handle retries/fallbacks
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
 * @returns {Promise<ReadableStream<string>>} A readable stream of text deltas.
 * @throws {Error} If the API call fails.
 */
async function streamOpenRouterText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	...rest
}) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	if (!modelId) throw new Error('OpenRouter model ID is required.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const openrouter = createOpenRouter({ apiKey });
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
		log(
			'error',
			`OpenRouter streamText failed for model ${modelId}: ${error.message}`
		);
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
	...rest
}) {
	if (!apiKey) throw new Error('OpenRouter API key is required.');
	if (!modelId) throw new Error('OpenRouter model ID is required.');
	if (!schema) throw new Error('Zod schema is required for object generation.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const openrouter = createOpenRouter({ apiKey });
		const model = openrouter.chat(modelId);

		const { object } = await generateObject({
			model,
			schema,
			mode: 'tool', // Standard mode for most object generation
			tool: {
				// Define the tool based on the schema
				name: objectName,
				description: `Generate an object conforming to the ${objectName} schema.`,
				parameters: schema
			},
			messages,
			maxTokens,
			temperature,
			maxRetries, // Pass maxRetries if supported by generateObject
			...rest
		});
		return object;
	} catch (error) {
		log(
			'error',
			`OpenRouter generateObject failed for model ${modelId}: ${error.message}`
		);
		throw error;
	}
}

export {
	generateOpenRouterText,
	streamOpenRouterText,
	generateOpenRouterObject
};
