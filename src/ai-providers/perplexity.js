/**
 * src/ai-providers/perplexity.js
 *
 * Implementation for interacting with Perplexity models
 * using the Vercel AI SDK.
 */
import { createPerplexity } from '@ai-sdk/perplexity';
import { generateText, streamText, generateObject, streamObject } from 'ai';
import { log } from '../../scripts/modules/utils.js';

// --- Client Instantiation ---
// Similar to Anthropic, this expects the resolved API key to be passed in.
function getClient(apiKey) {
	if (!apiKey) {
		throw new Error('Perplexity API key is required.');
	}
	// Create and return a new instance directly
	return createPerplexity({
		apiKey: apiKey
	});
}

// --- Standardized Service Function Implementations ---

/**
 * Generates text using a Perplexity model.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - The Perplexity API key.
 * @param {string} params.modelId - The specific Perplexity model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If the API call fails.
 */
export async function generatePerplexityText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature
}) {
	log('debug', `Generating Perplexity text with model: ${modelId}`);
	try {
		const client = getClient(apiKey);
		const result = await generateText({
			model: client(modelId),
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
		});
		log(
			'debug',
			`Perplexity generateText result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		return result.text;
	} catch (error) {
		log('error', `Perplexity generateText failed: ${error.message}`);
		throw error;
	}
}

/**
 * Streams text using a Perplexity model.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} params.apiKey - The Perplexity API key.
 * @param {string} params.modelId - The specific Perplexity model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @returns {Promise<object>} The full stream result object from the Vercel AI SDK.
 * @throws {Error} If the API call fails to initiate the stream.
 */
export async function streamPerplexityText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature
}) {
	log('debug', `Streaming Perplexity text with model: ${modelId}`);
	try {
		const client = getClient(apiKey);
		const stream = await streamText({
			model: client(modelId),
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
		});
		return stream;
	} catch (error) {
		log('error', `Perplexity streamText failed: ${error.message}`);
		throw error;
	}
}

/**
 * Generates a structured object using a Perplexity model.
 * Note: Perplexity API might not directly support structured object generation
 * in the same way as OpenAI or Anthropic. This function might need
 * adjustments or might not be feasible depending on the model's capabilities
 * and the Vercel AI SDK's support for Perplexity in this context.
 *
 * @param {object} params - Parameters for object generation.
 * @param {string} params.apiKey - The Perplexity API key.
 * @param {string} params.modelId - The specific Perplexity model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the object.
 * @param {string} params.objectName - A name for the object/tool.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If generation or validation fails or is unsupported.
 */
export async function generatePerplexityObject({
	apiKey,
	modelId,
	messages,
	schema,
	objectName = 'generated_object',
	maxTokens,
	temperature,
	maxRetries = 1 // Lower retries as support might be limited
}) {
	log(
		'debug',
		`Attempting to generate Perplexity object ('${objectName}') with model: ${modelId}`
	);
	log(
		'warn',
		'generateObject support for Perplexity might be limited or experimental.'
	);
	try {
		const client = getClient(apiKey);
		// Attempt using generateObject, but be prepared for potential issues
		const result = await generateObject({
			model: client(modelId),
			schema: schema,
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature,
			maxRetries: maxRetries
		});
		log(
			'debug',
			`Perplexity generateObject result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		return result.object;
	} catch (error) {
		log(
			'error',
			`Perplexity generateObject ('${objectName}') failed: ${error.message}`
		);
		throw new Error(
			`Failed to generate object with Perplexity: ${error.message}. Structured output might not be fully supported.`
		);
	}
}

// TODO: Implement streamPerplexityObject if needed and feasible.
