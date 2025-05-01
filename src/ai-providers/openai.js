import { createOpenAI, openai } from '@ai-sdk/openai'; // Using openai provider from Vercel AI SDK
import { generateText, streamText, generateObject } from 'ai'; // Import necessary functions from 'ai'
import { log } from '../../scripts/modules/utils.js';

/**
 * Generates text using OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, maxTokens, temperature.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If API call fails.
 */
export async function generateOpenAIText(params) {
	const { apiKey, modelId, messages, maxTokens, temperature } = params;
	log('debug', `generateOpenAIText called with model: ${modelId}`);

	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	if (!modelId) {
		throw new Error('OpenAI Model ID is required.');
	}
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new Error('Invalid or empty messages array provided for OpenAI.');
	}

	const openaiClient = createOpenAI({ apiKey });

	try {
		const result = await openaiClient.chat(messages, {
			// Updated: Use openaiClient.chat directly
			model: modelId,
			max_tokens: maxTokens,
			temperature
		});

		// Adjust based on actual Vercel SDK response structure for openaiClient.chat
		// This might need refinement based on testing the SDK's output.
		const textContent = result?.choices?.[0]?.message?.content?.trim();

		if (!textContent) {
			log(
				'warn',
				'OpenAI generateText response did not contain expected content.',
				{ result }
			);
			throw new Error('Failed to extract content from OpenAI response.');
		}
		log(
			'debug',
			`OpenAI generateText completed successfully for model: ${modelId}`
		);
		return textContent;
	} catch (error) {
		log(
			'error',
			`Error in generateOpenAIText (Model: ${modelId}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`OpenAI API error during text generation: ${error.message}`
		);
	}
}

/**
 * Streams text using OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, maxTokens, temperature.
 * @returns {Promise<ReadableStream>} A readable stream of text deltas.
 * @throws {Error} If API call fails.
 */
export async function streamOpenAIText(params) {
	const { apiKey, modelId, messages, maxTokens, temperature } = params;
	log('debug', `streamOpenAIText called with model: ${modelId}`);

	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	if (!modelId) {
		throw new Error('OpenAI Model ID is required.');
	}
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new Error(
			'Invalid or empty messages array provided for OpenAI streaming.'
		);
	}

	const openaiClient = createOpenAI({ apiKey });

	try {
		// Use the streamText function from Vercel AI SDK core
		const stream = await openaiClient.chat.stream(messages, {
			// Updated: Use openaiClient.chat.stream
			model: modelId,
			max_tokens: maxTokens,
			temperature
		});

		log(
			'debug',
			`OpenAI streamText initiated successfully for model: ${modelId}`
		);
		// The Vercel SDK's streamText should directly return the stream object
		return stream;
	} catch (error) {
		log(
			'error',
			`Error initiating OpenAI stream (Model: ${modelId}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`OpenAI API error during streaming initiation: ${error.message}`
		);
	}
}

/**
 * Generates structured objects using OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, schema, objectName, maxTokens, temperature.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If API call fails or object generation fails.
 */
export async function generateOpenAIObject(params) {
	const {
		apiKey,
		modelId,
		messages,
		schema,
		objectName,
		maxTokens,
		temperature
	} = params;
	log(
		'debug',
		`generateOpenAIObject called with model: ${modelId}, object: ${objectName}`
	);

	if (!apiKey) throw new Error('OpenAI API key is required.');
	if (!modelId) throw new Error('OpenAI Model ID is required.');
	if (!messages || !Array.isArray(messages) || messages.length === 0)
		throw new Error('Invalid messages array for OpenAI object generation.');
	if (!schema)
		throw new Error('Schema is required for OpenAI object generation.');
	if (!objectName)
		throw new Error('Object name is required for OpenAI object generation.');

	const openaiClient = createOpenAI({ apiKey });

	try {
		// Use the imported generateObject function from 'ai' package
		const result = await generateObject({
			model: openaiClient(modelId),
			schema: schema,
			messages: messages,
			mode: 'tool',
			maxTokens: maxTokens,
			temperature: temperature
		});

		log(
			'debug',
			`OpenAI generateObject completed successfully for model: ${modelId}`
		);
		return result.object;
	} catch (error) {
		log(
			'error',
			`Error in generateOpenAIObject (Model: ${modelId}, Object: ${objectName}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`OpenAI API error during object generation: ${error.message}`
		);
	}
}
