/**
 * src/ai-providers/xai.js
 *
 * Implementation for interacting with xAI models (e.g., Grok)
 * using the Vercel AI SDK.
 */
import { createXai } from '@ai-sdk/xai';
import { generateText, streamText, generateObject } from 'ai'; // Only import what's used
import { log } from '../../scripts/modules/utils.js'; // Assuming utils is accessible

// --- Client Instantiation ---
function getClient(apiKey) {
	if (!apiKey) {
		throw new Error('xAI API key is required.');
	}
	// Create and return a new instance directly
	return createXai({
		apiKey: apiKey
		// Add baseURL or other options if needed later
	});
}

// --- Standardized Service Function Implementations ---

/**
 * Generates text using an xAI model.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - The xAI API key.
 * @param {string} params.modelId - The specific xAI model ID (e.g., 'grok-3').
 * @param {Array<object>} params.messages - The messages array (e.g., [{ role: 'user', content: '...' }]).
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If the API call fails.
 */
export async function generateXaiText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature
}) {
	log('debug', `Generating xAI text with model: ${modelId}`);
	try {
		const client = getClient(apiKey);
		const result = await generateText({
			model: client(modelId), // Correct model invocation
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
		});
		log(
			'debug',
			`xAI generateText result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		return result.text;
	} catch (error) {
		log('error', `xAI generateText failed: ${error.message}`);
		throw error;
	}
}

/**
 * Streams text using an xAI model.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} params.apiKey - The xAI API key.
 * @param {string} params.modelId - The specific xAI model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @returns {Promise<object>} The full stream result object from the Vercel AI SDK.
 * @throws {Error} If the API call fails to initiate the stream.
 */
export async function streamXaiText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature
}) {
	log('debug', `Streaming xAI text with model: ${modelId}`);
	try {
		const client = getClient(apiKey);
		const stream = await streamText({
			model: client(modelId), // Correct model invocation
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
		});
		return stream; // Return the full stream object
	} catch (error) {
		log('error', `xAI streamText failed: ${error.message}`, error.stack);
		throw error;
	}
}

/**
 * Generates a structured object using an xAI model.
 * Note: Based on search results, xAI models do not currently support Object Generation.
 * This function is included for structural consistency but will likely fail if called.
 *
 * @param {object} params - Parameters for object generation.
 * @param {string} params.apiKey - The xAI API key.
 * @param {string} params.modelId - The specific xAI model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the object.
 * @param {string} params.objectName - A name for the object/tool.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If generation or validation fails.
 */
export async function generateXaiObject({
	apiKey,
	modelId,
	messages,
	schema,
	objectName = 'generated_xai_object',
	maxTokens,
	temperature,
	maxRetries = 3
}) {
	log(
		'warn', // Log warning as this is likely unsupported
		`Attempting to generate xAI object ('${objectName}') with model: ${modelId}. This may not be supported by the provider.`
	);
	try {
		const client = getClient(apiKey);
		const result = await generateObject({
			model: client(modelId), // Correct model invocation
			// Note: mode might need adjustment if xAI ever supports object generation differently
			mode: 'tool',
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
			`xAI generateObject result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		return result.object;
	} catch (error) {
		log(
			'error',
			`xAI generateObject ('${objectName}') failed: ${error.message}. (Likely unsupported by provider)`
		);
		throw error; // Re-throw the error
	}
}
