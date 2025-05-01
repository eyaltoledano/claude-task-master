/**
 * google.js
 * AI provider implementation for Google AI models (e.g., Gemini) using Vercel AI SDK.
 */

// import { GoogleGenerativeAI } from '@ai-sdk/google'; // Incorrect import
import { createGoogleGenerativeAI } from '@ai-sdk/google'; // Correct import for customization
import { generateText, streamText, generateObject } from 'ai'; // Import from main 'ai' package
import { log } from '../../scripts/modules/utils.js'; // Import logging utility

// Consider making model configurable via config-manager.js later
const DEFAULT_MODEL = 'gemini-2.0-pro'; // Or a suitable default
const DEFAULT_TEMPERATURE = 0.2; // Or a suitable default

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
	maxTokens // Note: Vercel SDK might handle this differently, needs verification
}) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	log('info', `Generating text with Google model: ${modelId}`);

	try {
		// const google = new GoogleGenerativeAI({ apiKey }); // Incorrect instantiation
		const googleProvider = createGoogleGenerativeAI({ apiKey }); // Correct instantiation
		// const model = google.getGenerativeModel({ model: modelId }); // Incorrect model retrieval
		const model = googleProvider(modelId); // Correct model retrieval

		// Construct payload suitable for Vercel SDK's generateText
		// Note: The exact structure might depend on how messages are passed
		const result = await generateText({
			model, // Pass the model instance
			messages, // Pass the messages array directly
			temperature,
			maxOutputTokens: maxTokens // Map to correct Vercel SDK param if available
		});

		// Assuming result structure provides text directly or within a property
		return result.text; // Adjust based on actual SDK response
	} catch (error) {
		log(
			'error',
			`Error generating text with Google (${modelId}): ${error.message}`
		);
		throw error; // Re-throw for unified service handler
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
	maxTokens
}) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	log('info', `Streaming text with Google model: ${modelId}`);

	try {
		// const google = new GoogleGenerativeAI({ apiKey }); // Incorrect instantiation
		const googleProvider = createGoogleGenerativeAI({ apiKey }); // Correct instantiation
		// const model = google.getGenerativeModel({ model: modelId }); // Incorrect model retrieval
		const model = googleProvider(modelId); // Correct model retrieval

		const stream = await streamText({
			model, // Pass the model instance
			messages,
			temperature,
			maxOutputTokens: maxTokens
		});

		return stream; // Return the stream directly
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
	maxTokens
}) {
	if (!apiKey) {
		throw new Error('Google API key is required.');
	}
	log('info', `Generating object with Google model: ${modelId}`);

	try {
		// const google = new GoogleGenerativeAI({ apiKey }); // Incorrect instantiation
		const googleProvider = createGoogleGenerativeAI({ apiKey }); // Correct instantiation
		// const model = google.getGenerativeModel({ model: modelId }); // Incorrect model retrieval
		const model = googleProvider(modelId); // Correct model retrieval

		const { object } = await generateObject({
			model, // Pass the model instance
			schema,
			messages,
			temperature,
			maxOutputTokens: maxTokens
			// Note: 'objectName' or 'mode' might not be directly applicable here
			// depending on how `@ai-sdk/google` handles `generateObject`.
			// Check SDK docs if specific tool calling/JSON mode needs explicit setup.
		});

		return object; // Return the parsed object
	} catch (error) {
		log(
			'error',
			`Error generating object with Google (${modelId}): ${error.message}`
		);
		throw error;
	}
}

export { generateGoogleText, streamGoogleText, generateGoogleObject };
