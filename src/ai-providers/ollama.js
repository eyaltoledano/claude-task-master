/**
 * ollama.js
 * AI provider implementation for Ollama models using the ollama-ai-provider package.
 */

import { createOllama } from 'ollama-ai-provider';
import { log } from '../../scripts/modules/utils.js'; // Import logging utility
import { generateObject, generateText, streamText } from 'ai';

// Consider making model configurable via config-manager.js later
const DEFAULT_MODEL = 'llama3'; // Or a suitable default for Ollama
const DEFAULT_TEMPERATURE = 0.2;

function getClient(baseUrl) {
	// baseUrl is optional, defaults to http://localhost:11434
	return createOllama({
		baseUrl: baseUrl || undefined
	});
}

/**
 * Generates text using an Ollama model.
 *
 * @param {object} params - Parameters for the generation.
 * @param {string} params.modelId - Specific model ID to use (overrides default).
 * @param {number} params.temperature - Generation temperature.
 * @param {Array<object>} params.messages - The conversation history (system/user prompts).
 * @param {number} [params.maxTokens] - Optional max tokens.
 * @param {string} [params.baseUrl] - Optional Ollama base URL.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If API call fails.
 */
async function generateOllamaText({
	modelId = DEFAULT_MODEL,
	messages,
	maxTokens,
	temperature = DEFAULT_TEMPERATURE,
	baseUrl
}) {
	log('info', `Generating text with Ollama model: ${modelId}`);

	try {
		const client = getClient(baseUrl);
		const result = await generateText({
			model: client(modelId),
			messages,
			maxTokens,
			temperature
		});
		log('debug', `Ollama generated text: ${result.text}`);
		return {
			text: result.text,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log(
			'error',
			`Error generating text with Ollama (${modelId}): ${error.message}`
		);
		throw error;
	}
}

/**
 * Streams text using an Ollama model.
 *
 * @param {object} params - Parameters for the streaming.
 * @param {string} params.modelId - Specific model ID to use (overrides default).
 * @param {number} params.temperature - Generation temperature.
 * @param {Array<object>} params.messages - The conversation history.
 * @param {number} [params.maxTokens] - Optional max tokens.
 * @param {string} [params.baseUrl] - Optional Ollama base URL.
 * @returns {Promise<ReadableStream>} A readable stream of text deltas.
 * @throws {Error} If API call fails.
 */
async function streamOllamaText({
	modelId = DEFAULT_MODEL,
	temperature = DEFAULT_TEMPERATURE,
	messages,
	maxTokens,
	baseUrl
}) {
	log('info', `Streaming text with Ollama model: ${modelId}`);

	try {
		const ollama = getClient(baseUrl);
		const stream = await streamText({
			model: modelId,
			messages,
			temperature,
			maxTokens
		});
		return stream;
	} catch (error) {
		log(
			'error',
			`Error streaming text with Ollama (${modelId}): ${error.message}`
		);
		throw error;
	}
}

/**
 * Generates a structured object using an Ollama model using the Vercel AI SDK's generateObject.
 *
 * @param {object} params - Parameters for the object generation.
 * @param {string} params.modelId - Specific model ID to use (overrides default).
 * @param {number} params.temperature - Generation temperature.
 * @param {Array<object>} params.messages - The conversation history.
 * @param {import('zod').ZodSchema} params.schema - Zod schema for the expected object.
 * @param {string} params.objectName - Name for the object generation context.
 * @param {number} [params.maxTokens] - Optional max tokens.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @param {string} [params.baseUrl] - Optional Ollama base URL.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If generation or validation fails.
 */
async function generateOllamaObject({
	modelId = DEFAULT_MODEL,
	temperature = DEFAULT_TEMPERATURE,
	messages,
	schema,
	objectName = 'generated_object',
	maxTokens,
	maxRetries = 3,
	baseUrl
}) {
	log('info', `Generating object with Ollama model: ${modelId}`);
	try {
		const ollama = getClient(baseUrl);
		const result = await generateObject({
			model: ollama(modelId),
			mode: 'tool',
			schema: schema,
			messages: messages,
			tool: {
				name: objectName,
				description: `Generate a ${objectName} based on the prompt.`
			},
			maxOutputTokens: maxTokens,
			temperature: temperature,
			maxRetries: maxRetries
		});
		return {
			object: result.object,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log(
			'error',
			`Ollama generateObject ('${objectName}') failed: ${error.message}`
		);
		throw error;
	}
}

export { generateOllamaText, streamOllamaText, generateOllamaObject };
