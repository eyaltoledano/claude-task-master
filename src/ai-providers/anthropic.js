/**
 * src/ai-providers/anthropic.js
 *
 * Implementation for interacting with Anthropic models (e.g., Claude)
 * using the Vercel AI SDK.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText, generateObject, streamObject } from 'ai';
import { log } from '../../scripts/modules/utils.js'; // Assuming utils is accessible

// TODO: Implement standardized functions for generateText, streamText, generateObject

// --- Client Instantiation ---
// Note: API key resolution should ideally happen closer to the call site
// using the config manager/resolver which checks process.env and session.env.
// This is a placeholder for basic functionality.
// Remove the global variable and caching logic
// let anthropicClient;

function getClient(apiKey) {
	if (!apiKey) {
		// In a real scenario, this would use the config resolver.
		// Throwing error here if key isn't passed for simplicity.
		// Keep the error check for the passed key
		throw new Error('Anthropic API key is required.');
	}
	// Remove the check for anthropicClient
	// if (!anthropicClient) {
	// TODO: Explore passing options like default headers if needed
	// Create and return a new instance directly with standard version header
	return createAnthropic({
		apiKey: apiKey,
		baseURL: 'https://api.anthropic.com/v1',
		// Use standard version header instead of beta
		headers: {
			'anthropic-beta': 'output-128k-2025-02-19'
		}
	});
	// }
	// return anthropicClient;
}

// --- Standardized Service Function Implementations ---

/**
 * Generates text using an Anthropic model.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - The Anthropic API key.
 * @param {string} params.modelId - The specific Anthropic model ID.
 * @param {Array<object>} params.messages - The messages array (e.g., [{ role: 'user', content: '...' }]).
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If the API call fails.
 */
export async function generateAnthropicText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature
}) {
	log('debug', `Generating Anthropic text with model: ${modelId}`);
	try {
		const client = getClient(apiKey);
		const result = await generateText({
			model: client(modelId),
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
			// Beta header moved to client initialization
			// TODO: Add other relevant parameters like topP, topK if needed
		});
		log(
			'debug',
			`Anthropic generateText result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		return result.text;
	} catch (error) {
		log('error', `Anthropic generateText failed: ${error.message}`);
		// Consider more specific error handling or re-throwing a standardized error
		throw error;
	}
}

/**
 * Streams text using an Anthropic model.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} params.apiKey - The Anthropic API key.
 * @param {string} params.modelId - The specific Anthropic model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @returns {Promise<object>} The full stream result object from the Vercel AI SDK.
 * @throws {Error} If the API call fails to initiate the stream.
 */
export async function streamAnthropicText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature
}) {
	log('debug', `Streaming Anthropic text with model: ${modelId}`);
	try {
		const client = getClient(apiKey);

		// --- DEBUG LOGGING --- >>
		log(
			'debug',
			'[streamAnthropicText] Parameters received by streamText:',
			JSON.stringify(
				{
					modelId: modelId, // Log modelId being used
					messages: messages, // Log the messages array
					maxTokens: maxTokens,
					temperature: temperature
				},
				null,
				2
			)
		);
		// --- << DEBUG LOGGING ---

		const stream = await streamText({
			model: client(modelId),
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
			// Beta header moved to client initialization
			// TODO: Add other relevant parameters
		});

		// *** RETURN THE FULL STREAM OBJECT, NOT JUST stream.textStream ***
		return stream;
	} catch (error) {
		log(
			'error',
			`Anthropic streamText failed: ${error.message}`,
			error.stack // Log stack trace for more details
		);
		throw error;
	}
}

/**
 * Generates a structured object using an Anthropic model.
 * NOTE: Anthropic's tool/function calling support might have limitations
 * compared to OpenAI, especially regarding complex schemas or enforcement.
 * The Vercel AI SDK attempts to abstract this.
 *
 * @param {object} params - Parameters for object generation.
 * @param {string} params.apiKey - The Anthropic API key.
 * @param {string} params.modelId - The specific Anthropic model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the object.
 * @param {string} params.objectName - A name for the object/tool.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If generation or validation fails.
 */
export async function generateAnthropicObject({
	apiKey,
	modelId,
	messages,
	schema,
	objectName = 'generated_object',
	maxTokens,
	temperature,
	maxRetries = 3
}) {
	log(
		'debug',
		`Generating Anthropic object ('${objectName}') with model: ${modelId}`
	);
	try {
		const client = getClient(apiKey);

		// Log basic debug info
		log(
			'debug',
			`Using maxTokens: ${maxTokens}, temperature: ${temperature}, model: ${modelId}`
		);

		const result = await generateObject({
			model: client(modelId),
			mode: 'tool', // Anthropic generally uses 'tool' mode for structured output
			schema: schema,
			messages: messages,
			tool: {
				name: objectName,
				description: `Generate a ${objectName} based on the prompt.`
			},
			maxTokens: maxTokens,
			temperature: temperature,
			maxRetries: maxRetries
		});

		log(
			'debug',
			`Anthropic generateObject result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		return result.object;
	} catch (error) {
		// Simple error logging
		log(
			'error',
			`Anthropic generateObject ('${objectName}') failed: ${error.message}`
		);
		throw error;
	}
}

// TODO: Implement streamAnthropicObject if needed and supported well by the SDK for Anthropic.
// The basic structure would be similar to generateAnthropicObject but using streamObject.
