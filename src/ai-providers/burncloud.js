import { createBurnCloud } from '@burncloud/ai-sdk-provider';
import { generateText, streamText, generateObject } from 'ai';
import { log } from '../../scripts/modules/utils.js';

function getClient(apiKey, baseUrl) {
	if (!apiKey) throw new Error('BurnCloud API key is required.');
	return createBurnCloud({
		apiKey,
		baseURL: baseUrl || 'https://ai.burncloud.com/v1'
	});
}

/**
 * 使用 BurnCloud 聊天模型生成文本。
 *
 * @param {object} params - 文本生成参数。
 * @param {string} params.apiKey - BurnCloud API key。
 * @param {string} params.modelId - BurnCloud 模型 ID。
 * @param {Array<object>} params.messages - 消息对象数组（system, user, assistant）。
 * @param {number} [params.maxTokens] - 最大生成 token 数。
 * @param {number} [params.temperature] - 采样温度。
 * @param {string} [params.baseUrl] - BurnCloud API 基础 URL。
 * @returns {Promise<string>} 生成的文本内容。
 * @throws {Error} 如果 API 调用失败。
 */
async function generateBurnCloudText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	...rest
}) {
	if (!apiKey) throw new Error('BurnCloud API key is required.');
	if (!modelId) throw new Error('BurnCloud model ID is required.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const burncloud = getClient(apiKey, baseUrl);
		const model = burncloud.chat(modelId);

		const result = await generateText({
			model,
			messages,
			maxTokens,
			temperature,
			...rest
		});

		if (!result || typeof result.text !== 'string') {
			log(
				'warn',
				`BurnCloud generateText for model ${modelId} did not return expected text.`,
				{ result }
			);
			throw new Error('Failed to extract text from BurnCloud response.');
		}
		if (!result.usage) {
			log(
				'warn',
				`BurnCloud generateText for model ${modelId} did not return usage data.`,
				{ result }
			);
		}

		log('debug', `BurnCloud generateText completed for model ${modelId}`);
		return {
			text: result.text,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		let detailedMessage = `BurnCloud generateText failed for model ${modelId}: ${error.message}`;
		if (error.cause) {
			detailedMessage += `\n\nCause:\n\n ${typeof error.cause === 'string' ? error.cause : JSON.stringify(error.cause)}`;
		}
		if (error.data) {
			detailedMessage += `\n\nData:\n\n ${JSON.stringify(error.data)}`;
		}
		log('error', detailedMessage, { originalErrorObject: error });
		throw error;
	}
}

/**
 * 使用 BurnCloud 聊天模型流式生成文本。
 *
 * @param {object} params - 文本流式生成参数。
 * @param {string} params.apiKey - BurnCloud API key。
 * @param {string} params.modelId - BurnCloud 模型 ID。
 * @param {Array<object>} params.messages - 消息对象数组。
 * @param {number} [params.maxTokens] - 最大生成 token 数。
 * @param {number} [params.temperature] - 采样温度。
 * @param {string} [params.baseUrl] - BurnCloud API 基础 URL。
 * @returns {Promise<ReadableStream<string>>} 文本流。
 * @throws {Error} 如果 API 调用失败。
 */
async function streamBurnCloudText({
	apiKey,
	modelId,
	messages,
	maxTokens,
	temperature,
	baseUrl,
	...rest
}) {
	if (!apiKey) throw new Error('BurnCloud API key is required.');
	if (!modelId) throw new Error('BurnCloud model ID is required.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const burncloud = getClient(apiKey, baseUrl);
		const model = burncloud.chat(modelId);

		const stream = await streamText({
			model,
			messages,
			maxTokens,
			temperature,
			...rest
		});
		return stream;
	} catch (error) {
		let detailedMessage = `BurnCloud streamText failed for model ${modelId}: ${error.message}`;
		if (error.cause) {
			detailedMessage += `\n\nCause:\n\n ${typeof error.cause === 'string' ? error.cause : JSON.stringify(error.cause)}`;
		}
		if (error.data) {
			detailedMessage += `\n\nData:\n\n ${JSON.stringify(error.data)}`;
		}
		log('error', detailedMessage, { originalErrorObject: error });
		throw error;
	}
}

/**
 * 使用 BurnCloud 聊天模型生成结构化对象。
 *
 * @param {object} params - 对象生成参数。
 * @param {string} params.apiKey - BurnCloud API key。
 * @param {string} params.modelId - BurnCloud 模型 ID。
 * @param {import('zod').ZodSchema} params.schema - 期望对象的 Zod schema。
 * @param {Array<object>} params.messages - 消息对象数组。
 * @param {string} [params.objectName='generated_object'] - 对象/工具名称。
 * @param {number} [params.maxRetries=3] - 最大重试次数。
 * @param {number} [params.maxTokens] - 最大 token 数。
 * @param {number} [params.temperature] - 采样温度。
 * @param {string} [params.baseUrl] - BurnCloud API 基础 URL。
 * @returns {Promise<object>} 匹配 schema 的对象。
 * @throws {Error} 如果 API 调用或校验失败。
 */
async function generateBurnCloudObject({
	apiKey,
	modelId,
	schema,
	messages,
	objectName = 'generated_object',
	maxRetries = 3,
	maxTokens,
	temperature,
	baseUrl,
	...rest
}) {
	if (!apiKey) throw new Error('BurnCloud API key is required.');
	if (!modelId) throw new Error('BurnCloud model ID is required.');
	if (!schema) throw new Error('Zod schema is required for object generation.');
	if (!messages || messages.length === 0)
		throw new Error('Messages array cannot be empty.');

	try {
		const burncloud = getClient(apiKey, baseUrl);
		const model = burncloud.chat(modelId);

		const result = await generateObject({
			model,
			schema,
			mode: 'tool',
			tool: {
				name: objectName,
				description: `Generate an object conforming to the ${objectName} schema.`,
				parameters: schema
			},
			messages,
			maxTokens,
			temperature,
			maxRetries,
			...rest
		});

		if (!result || typeof result.object === 'undefined') {
			log(
				'warn',
				`BurnCloud generateObject for model ${modelId} did not return expected object.`,
				{ result }
			);
			throw new Error('Failed to extract object from BurnCloud response.');
		}
		if (!result.usage) {
			log(
				'warn',
				`BurnCloud generateObject for model ${modelId} did not return usage data.`,
				{ result }
			);
		}

		log('debug', `BurnCloud generateObject completed for model ${modelId}`);
		return {
			object: result.object,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		let detailedMessage = `BurnCloud generateObject failed for model ${modelId}: ${error.message}`;
		if (error.cause) {
			detailedMessage += `\n\nCause:\n\n ${typeof error.cause === 'string' ? error.cause : JSON.stringify(error.cause)}`;
		}
		if (error.data) {
			detailedMessage += `\n\nData:\n\n ${JSON.stringify(error.data)}`;
		}
		log('error', detailedMessage, { originalErrorObject: error });
		throw error;
	}
}

export {
	generateBurnCloudText,
	streamBurnCloudText,
	generateBurnCloudObject
}; 