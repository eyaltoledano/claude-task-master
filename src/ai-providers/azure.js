import { createAzure } from '@ai-sdk/azure';
import { generateObject, generateText } from 'ai';
import { log } from '../../scripts/modules/utils.js';

function getClient(apiKey, resourceName, apiVersion) {
	if (!apiKey) {
		throw new Error('Azure OpenAI API key is required.');
	}
	if (!resourceName) {
		throw new Error('Azure OpenAI resource name is required.');
	}
	return createAzure({
		apiKey: apiKey,
		resourceName: resourceName,
		apiVersion: apiVersion || '2025-01-01-preview'
	});
}

/**
 * Generates text using Azure OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, maxTokens, temperature, resourceName, apiVersion.
 * @returns {Promise<object>} The generated text content and usage.
 * @throws {Error} If API call fails.
 */
export async function generateAzureText(params) {
	const { apiKey, modelId, messages, maxTokens, temperature, resourceName, apiVersion } = params;
	log('debug', `generateAzureText called with model: ${modelId}`);

	if (!apiKey) {
		throw new Error('Azure OpenAI API key is required.');
	}
	if (!modelId) {
		throw new Error('Azure OpenAI Model ID is required.');
	}
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new Error('Invalid or empty messages array provided for Azure OpenAI.');
	}

	const azureClient = getClient(apiKey, resourceName, apiVersion);

	try {
		// For o3-mini model, ensure system message is present
		let processedMessages = messages;
		if (modelId === 'o3-mini') {
			const hasSystemRole = messages.some(msg => msg.role === 'system');
			if (!hasSystemRole) {
				processedMessages = [
					{ role: 'system', content: 'You are an AI assistant that helps people find information.' },
					...messages
				];
			}
		}

		const result = await generateText({
			model: azureClient(modelId),
			messages: processedMessages,
			maxTokens,
			temperature
		});

		if (!result || !result.text) {
			log(
				'warn',
				'Azure OpenAI generateText response did not contain expected content.',
				{ result }
			);
			throw new Error('Failed to extract content from Azure OpenAI response.');
		}
		log(
			'debug',
			`Azure OpenAI generateText completed successfully for model: ${modelId}`
		);
		return {
			text: result.text.trim(),
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log(
			'error',
			`Error in generateAzureText (Model: ${modelId}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`Azure OpenAI API error during text generation: ${error.message}`
		);
	}
}

/**
 * Streams text using Azure OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, maxTokens, temperature, resourceName, apiVersion.
 * @returns {Promise<ReadableStream>} A readable stream of text deltas.
 * @throws {Error} If API call fails.
 */
export async function streamAzureText(params) {
	const { apiKey, modelId, messages, maxTokens, temperature, resourceName, apiVersion } = params;
	log('debug', `streamAzureText called with model: ${modelId}`);

	if (!apiKey) {
		throw new Error('Azure OpenAI API key is required.');
	}
	if (!modelId) {
		throw new Error('Azure OpenAI Model ID is required.');
	}
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new Error(
			'Invalid or empty messages array provided for Azure OpenAI streaming.'
		);
	}

	const azureClient = getClient(apiKey, resourceName, apiVersion);

	try {
		const stream = await azureClient.chat.stream(messages, {
			model: modelId,
			max_tokens: maxTokens,
			temperature
		});

		log(
			'debug',
			`Azure OpenAI streamText initiated successfully for model: ${modelId}`
		);
		return stream;
	} catch (error) {
		log(
			'error',
			`Error initiating Azure OpenAI stream (Model: ${modelId}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`Azure OpenAI API error during streaming initiation: ${error.message}`
		);
	}
}

/**
 * Generates structured objects using Azure OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, schema, objectName, maxTokens, temperature, resourceName, apiVersion.
 * @returns {Promise<object>} The generated object matching the schema and usage.
 * @throws {Error} If API call fails or object generation fails.
 */
export async function generateAzureObject(params) {
	const {
		apiKey,
		modelId,
		messages,
		schema,
		objectName,
		maxTokens,
		temperature,
		resourceName,
		apiVersion
	} = params;
	log(
		'debug',
		`generateAzureObject called with model: ${modelId}, object: ${objectName}`
	);

	if (!apiKey) throw new Error('Azure OpenAI API key is required.');
	if (!modelId) throw new Error('Azure OpenAI Model ID is required.');
	if (!messages || !Array.isArray(messages) || messages.length === 0)
		throw new Error('Invalid messages array for Azure OpenAI object generation.');
	if (!schema)
		throw new Error('Schema is required for Azure OpenAI object generation.');
	if (!objectName)
		throw new Error('Object name is required for Azure OpenAI object generation.');

	const azureClient = getClient(apiKey, resourceName, apiVersion);

	try {
		// For o3-mini model, ensure system message is present
		let processedMessages = messages;
		if (modelId === 'o3-mini') {
			const hasSystemRole = messages.some(msg => msg.role === 'system');
			if (!hasSystemRole) {
				processedMessages = [
					{ role: 'system', content: 'You are an AI assistant that helps people find information.' },
					...messages
				];
			}
		}

		const result = await generateObject({
			model: azureClient(modelId),
			schema: schema,
			messages: processedMessages,
			mode: 'tool',
			maxTokens: maxTokens,
			temperature: temperature
		});

		log(
			'debug',
			`Azure OpenAI generateObject completed successfully for model: ${modelId}`
		);
		if (!result || typeof result.object === 'undefined') {
			log(
				'warn',
				'Azure OpenAI generateObject response did not contain expected object.',
				{ result }
			);
			throw new Error('Failed to extract object from Azure OpenAI response.');
		}
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
			`Error in generateAzureObject (Model: ${modelId}, Object: ${objectName}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`Azure OpenAI API error during object generation: ${error.message}`
		);
	}
} 