/**
 * src/ai-providers/bedrock.js
 *
 * Implementation for interacting with AWS Bedrock models
 * using the Vercel AI SDK.
 */
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, streamText, generateObject } from 'ai';
import { log } from '../../scripts/modules/utils.js'; // Assuming utils is accessible

// --- Client Instantiation ---
function getClient(accessKeyId, secretAccessKey, region, sessionToken, baseUrl, credentialProvider) {
	// Use credential provider if provided
	if (credentialProvider) {
		return createAmazonBedrock({
			region: region || 'us-east-1',
			credentialProvider,
			...(baseUrl && { baseURL: baseUrl })
		});
	}

	// If we have explicit credentials, use them
	if (accessKeyId && secretAccessKey) {
		return createAmazonBedrock({
			region: region || 'us-east-1',
			accessKeyId,
			secretAccessKey,
			...(sessionToken && { sessionToken }),
			...(baseUrl && { baseURL: baseUrl })
		});
	}

	// If no explicit credentials provided, try to use AWS SDK default credential chain
	// This will automatically pick up credentials from ~/.aws/credentials, EC2 instance metadata, etc.
	try {
		return createAmazonBedrock({
			region: region || 'us-east-1',
			...(baseUrl && { baseURL: baseUrl })
		});
	} catch (error) {
		throw new Error(`AWS Bedrock requires accessKeyId, secretAccessKey, and region when not using credentialProvider, or valid AWS credentials in the environment. Error: ${error.message}`);
	}
}

// --- Standardized Service Function Implementations ---

/**
 * Generates text using an AWS Bedrock model.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} [params.accessKeyId] - The AWS access key ID.
 * @param {string} [params.secretAccessKey] - The AWS secret access key.
 * @param {string} [params.region] - The AWS region (default: us-east-1).
 * @param {string} [params.sessionToken] - Optional AWS session token.
 * @param {Function} [params.credentialProvider] - Optional AWS credential provider function.
 * @param {string} params.modelId - The specific Bedrock model ID (e.g., 'anthropic.claude-3-sonnet-20240229-v1:0').
 * @param {Array<object>} params.messages - The messages array (e.g., [{ role: 'user', content: '...' }]).
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {string} [params.baseUrl] - The base URL for the AWS Bedrock API.
 * @param {object} [params.additionalModelRequestFields] - Additional model-specific request fields.
 * @returns {Promise<object>} The generated text content and usage.
 * @throws {Error} If the API call fails.
 */
export async function generateBedrockText({
	accessKeyId,
	secretAccessKey,
	region = 'us-east-1',
	sessionToken,
	credentialProvider,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	additionalModelRequestFields
}) {
	log('debug', `Generating Bedrock text with model: ${modelId}`);
	try {
		const client = getClient(accessKeyId, secretAccessKey, region, sessionToken, baseUrl, credentialProvider);
		
		// Create model with additional request fields if provided
		const model = additionalModelRequestFields 
			? client(modelId, { additionalModelRequestFields })
			: client(modelId);

		const result = await generateText({
			model,
			messages,
			maxTokens,
			temperature
		});

		log(
			'debug',
			`Bedrock generateText result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);

		// Return both text and usage
		return {
			text: result.text,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log('error', `Bedrock generateText failed: ${error.message}`);
		throw error;
	}
}

/**
 * Streams text using an AWS Bedrock model.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} [params.accessKeyId] - The AWS access key ID.
 * @param {string} [params.secretAccessKey] - The AWS secret access key.
 * @param {string} [params.region] - The AWS region (default: us-east-1).
 * @param {string} [params.sessionToken] - Optional AWS session token.
 * @param {Function} [params.credentialProvider] - Optional AWS credential provider function.
 * @param {string} params.modelId - The specific Bedrock model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {string} [params.baseUrl] - The base URL for the AWS Bedrock API.
 * @param {object} [params.additionalModelRequestFields] - Additional model-specific request fields.
 * @returns {Promise<object>} The full stream result object from the Vercel AI SDK.
 * @throws {Error} If the API call fails to initiate the stream.
 */
export async function streamBedrockText({
	accessKeyId,
	secretAccessKey,
	region = 'us-east-1',
	sessionToken,
	credentialProvider,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	additionalModelRequestFields
}) {
	log('debug', `Streaming Bedrock text with model: ${modelId}`);
	try {
		const client = getClient(accessKeyId, secretAccessKey, region, sessionToken, baseUrl, credentialProvider);
		
		// Create model with additional request fields if provided
		const model = additionalModelRequestFields 
			? client(modelId, { additionalModelRequestFields })
			: client(modelId);

		log(
			'debug',
			'[streamBedrockText] Parameters received by streamText:',
			JSON.stringify(
				{
					modelId,
					messages,
					maxTokens,
					temperature
				},
				null,
				2
			)
		);

		const stream = await streamText({
			model,
			messages,
			maxTokens,
			temperature
		});

		// Return the full stream object
		return stream;
	} catch (error) {
		log('error', `Bedrock streamText failed: ${error.message}`, error.stack);
		throw error;
	}
}

/**
 * Generates a structured object using an AWS Bedrock model.
 * Note: Tool/function calling support varies by model. Claude models generally 
 * have better support for structured outputs.
 *
 * @param {object} params - Parameters for object generation.
 * @param {string} [params.accessKeyId] - The AWS access key ID.
 * @param {string} [params.secretAccessKey] - The AWS secret access key.
 * @param {string} [params.region] - The AWS region (default: us-east-1).
 * @param {string} [params.sessionToken] - Optional AWS session token.
 * @param {Function} [params.credentialProvider] - Optional AWS credential provider function.
 * @param {string} params.modelId - The specific Bedrock model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the object.
 * @param {string} params.objectName - A name for the object/tool.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @param {string} [params.baseUrl] - The base URL for the AWS Bedrock API.
 * @param {object} [params.additionalModelRequestFields] - Additional model-specific request fields.
 * @returns {Promise<object>} The generated object matching the schema and usage.
 * @throws {Error} If generation or validation fails.
 */
export async function generateBedrockObject({
	accessKeyId,
	secretAccessKey,
	region = 'us-east-1',
	sessionToken,
	credentialProvider,
	modelId,
	messages,
	schema,
	objectName = 'generated_object',
	maxTokens,
	temperature,
	maxRetries = 3,
	baseUrl,
	additionalModelRequestFields
}) {
	log(
		'debug',
		`Generating Bedrock object ('${objectName}') with model: ${modelId}`
	);
	try {
		const client = getClient(accessKeyId, secretAccessKey, region, sessionToken, baseUrl, credentialProvider);
		
		// Create model with additional request fields if provided
		const model = additionalModelRequestFields 
			? client(modelId, { additionalModelRequestFields })
			: client(modelId);

		log(
			'debug',
			`Using maxTokens: ${maxTokens}, temperature: ${temperature}, model: ${modelId}`
		);

		const result = await generateObject({
			model,
			mode: 'tool',
			schema,
			messages,
			tool: {
				name: objectName,
				description: `Generate a ${objectName} based on the prompt.`
			},
			maxTokens,
			temperature,
			maxRetries
		});

		log(
			'debug',
			`Bedrock generateObject result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);

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
			`Bedrock generateObject ('${objectName}') failed: ${error.message}`
		);
		throw error;
	}
}

// Export utility function for creating Bedrock client directly if needed
export { createAmazonBedrock as createBedrockClient }; 