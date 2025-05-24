/**
 * src/ai-providers/aws-bedrock.js
 *
 * Implementation for interacting with AWS Bedrock models
 * using the Vercel AI SDK.
 */
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { generateText, streamText, generateObject } from 'ai';
import { log, resolveEnvVariable } from '../../scripts/modules/utils.js';

/**
 * Creates and returns a Bedrock client instance.
 * See https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
 * for additional details about what variables and configuration are
 * available for AWS SDK.
 * 
 * @param {string} profile - AWS the AWS_PROFILE environemnt variable.
 * @param {string} [baseUrl] - Optional custom endpoint URL
 * @returns {Function} Bedrock client function
 * @throws {Error} If required credentials are missing
 */
function getClient(profile, baseUrl) {
	log('info', `AWS connection info profile:${profile}, baseUrl:${baseUrl}`);

	// AWS credential provider pulls the correct environment variables or config given a profile string.
	const provider = fromNodeProviderChain({profile: profile || 'default'});

	// There needs to be a better way to pass region down, but I can't see it right now. `createAmazonBedrock`
	// requires a region, and ideally we can pull that from the `.taskmaster` config, but I've not 
	// seen a way to make that happen yet. The other option wouold be to pull it from the provider, but that's
	// not one of the class members (see AwsCredentialIdentityProvider).
	const region = resolveEnvVariable('AWS_DEFAULT_REGION') || 'us-east-1';

	return createAmazonBedrock({
		region: region,
		credentialProvider: provider,
		...(baseUrl && { baseURL: baseUrl })
	});
}

/**
 * Generates text using AWS Bedrock models.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.profile - This is the AWS profile name. We use the apiKey param, only to work with the style of param passing.
 * @param {string} params.modelId - The specific Bedrock model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {string} [params.baseUrl] - Optional custom endpoint URL.
 * @returns {Promise<object>} The generated text content and usage.
 * @throws {Error} If the API call fails.
 */
export async function generateBedrockText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	...rest // Capture any other Vercel AI SDK compatible parameters
}) {
	log('debug', `Generating AWS Bedrock text with model: ${modelId}`);

	try {
		const client = getClient(apiKey, baseUrl);
		const result = await generateText({
			model: client(modelId),
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
		});
		
		log(
			'debug',
			`AWS Bedrock generateText result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		
		return {
			text: result.text,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log('error', `AWS Bedrock generateText failed: ${error.message}`);
		throw error;
	}
}

/**
 * Streams text using AWS Bedrock models.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} params.apiKey - This is the AWS profile name. We use the apiKey param, only to work with the style of param passing.
 * @param {string} params.modelId - The specific Bedrock model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {string} [params.baseUrl] - Optional custom endpoint URL.
 * @returns {Promise<object>} The full stream result object.
 * @throws {Error} If the API call fails to initiate the stream.
 */
export async function streamBedrockText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	...rest // Capture any other Vercel AI SDK compatible parameters
}) {
	log('debug', `Streaming AWS Bedrock text with model: ${modelId}`);
	
	try {
		const client = getClient(apiKey, baseUrl);
		
		const stream = await streamText({
			model: client(modelId),
			messages: messages,
			maxTokens: maxTokens,
			temperature: temperature
		});
		
		return stream;
	} catch (error) {
		log('error', `AWS Bedrock streamText failed: ${error.message}`, error.stack);
		throw error;
	}
}

/**
 * Generates a structured object using AWS Bedrock models.
 *
 * @param {object} params - Parameters for object generation.
 * @param {string} params.apiKey - This is the AWS profile name. We use the apiKey param, only to work with the style of param passing.
 * @param {string} params.modelId - The specific Bedrock model ID.
 * @param {Array<object>} params.messages - The messages array.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the object.
 * @param {string} params.objectName - A name for the object/tool.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @param {string} [params.baseUrl] - Optional custom endpoint URL.
 * @returns {Promise<object>} The generated object matching the schema and usage.
 * @throws {Error} If generation or validation fails.
 */
export async function generateBedrockObject({
	apiKey,
	modelId,
	messages,
	schema,
	objectName = 'generated_object',
	maxTokens,
	temperature,
	maxRetries = 3,
	baseUrl,
	...rest // Capture any other Vercel AI SDK compatible parameters
}) {
	log(
		'debug',
		`Generating AWS Bedrock object ('${objectName}') with model: ${modelId}`
	);
	
	try {
		const client = getClient(apiKey, baseUrl);
		
		const result = await generateObject({
			model: client(modelId),
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
			`AWS Bedrock generateObject result received. Tokens: ${result.usage.completionTokens}/${result.usage.promptTokens}`
		);
		
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
			`AWS Bedrock generateObject ('${objectName}') failed: ${error.message}`
		);
		throw error;
	}
}