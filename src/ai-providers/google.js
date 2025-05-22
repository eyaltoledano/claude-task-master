/**
 * google.js
 * AI provider implementation for Google AI models (e.g., Gemini) using Vercel AI SDK.
 */

// import { GoogleGenerativeAI } from '@ai-sdk/google'; // Incorrect import
import { createGoogleGenerativeAI } from '@ai-sdk/google'; // Correct import for customization
import { generateText, streamText, generateObject } from 'ai'; // Import from main 'ai' package
import { log } from '../../scripts/modules/utils.js'; // Import logging utility

// Consider making model configurable via config-manager.js later
const DEFAULT_MODEL = 'gemini-2.5-pro-exp-03-25'; // Or a suitable default
const DEFAULT_TEMPERATURE = 0.2; // Or a suitable default

function getClient(apiKey, baseUrl) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	return createGoogleGenerativeAI({
		apiKey: apiKey,
		...(baseUrl && { baseURL: baseUrl })
	});
}

/**
 * Generates text using a Google AI model.
 *
 * @param {object} params - Parameters for the generation.
 * @param {string} params.apiKey - Google API Key.
 * @param {string} params.modelId - Specific model ID to use (overrides default).
 * @param {number} params.temperature - Generation temperature.
 * @param {Array<object>} params.messages - The conversation history (system/user prompts).
 * @param {number} [params.maxTokens] - Optional max tokens.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If API key is missing or API call fails.
 */
async function generateGoogleText({
	apiKey,
	modelId = DEFAULT_MODEL,
	temperature = DEFAULT_TEMPERATURE,
	messages,
	maxTokens,
	baseUrl
}) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	log('info', `Generating text with Google model: ${modelId}`);

	try {
		const googleProvider = getClient(apiKey, baseUrl);
		const model = googleProvider(modelId);
		const result = await generateText({
			model,
			messages,
			temperature,
			maxOutputTokens: maxTokens
		});

		// Assuming result structure provides text directly or within a property
		// return result.text; // Adjust based on actual SDK response
		// Return both text and usage
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
			`Error generating text with Google (${modelId}): ${error.message}`
		);
		throw error;
	}
}

/**
 * Streams text using a Google AI model.
 *
 * @param {object} params - Parameters for the streaming.
 * @param {string} params.apiKey - Google API Key.
 * @param {string} params.modelId - Specific model ID to use (overrides default).
 * @param {number} params.temperature - Generation temperature.
 * @param {Array<object>} params.messages - The conversation history.
 * @param {number} [params.maxTokens] - Optional max tokens.
 * @returns {Promise<ReadableStream>} A readable stream of text deltas.
 * @throws {Error} If API key is missing or API call fails.
 */
async function streamGoogleText({
	apiKey,
	modelId = DEFAULT_MODEL,
	temperature = DEFAULT_TEMPERATURE,
	messages,
	maxTokens,
	baseUrl
}) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	log('info', `Streaming text with Google model: ${modelId}`);

	try {
		const googleProvider = getClient(apiKey, baseUrl);
		const model = googleProvider(modelId);
		const stream = await streamText({
			model,
			messages,
			temperature,
			maxOutputTokens: maxTokens
		});
		return stream;
	} catch (error) {
		log(
			'error',
			`Error streaming text with Google (${modelId}): ${error.message}`
		);
		throw error;
	}
}

/**
 * Generates a structured object using a Google AI model.
 *
 * @param {object} params - Parameters for the object generation.
 * @param {string} params.apiKey - Google API Key.
 * @param {string} params.modelId - Specific model ID to use (overrides default).
 * @param {number} params.temperature - Generation temperature.
 * @param {Array<object>} params.messages - The conversation history.
 * @param {import('zod').ZodSchema} params.schema - Zod schema for the expected object.
 * @param {string} params.objectName - Name for the object generation context.
 * @param {number} [params.maxTokens] - Optional max tokens.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If API key is missing or API call fails.
 */
async function generateGoogleObject({
	apiKey,
	modelId = DEFAULT_MODEL,
	temperature = DEFAULT_TEMPERATURE,
	messages,
	schema,
	objectName, // Note: Vercel SDK might use this differently or not at all
	maxTokens,
	baseUrl
}) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	log('info', `Generating object with Google model: ${modelId}`);

	try {
		const googleProvider = getClient(apiKey, baseUrl);
		const model = googleProvider(modelId);
		const result = await generateObject({
			model,
			schema,
			messages,
			temperature,
			maxOutputTokens: maxTokens
		});

		// return object; // Return the parsed object
		// Return both object and usage
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
			`Error generating object with Google (${modelId}): ${error.message}`
		);
		throw error;
	}
}

export { generateGoogleText, streamGoogleText, generateGoogleObject };
