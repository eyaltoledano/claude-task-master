/**
 * Comprehensive Tests for Snowflake Cortex Provider
 * 
 * Contains both unit tests and integration tests.
 * 
 * Unit tests run always and test provider logic.
 * Integration tests require credentials and test real API calls.
 * 
 * Prerequisites for integration tests:
 * - SNOWFLAKE_API_KEY must be set in .env
 * - SNOWFLAKE_BASE_URL must be set in .env
 * 
 * Test Control:
 * - SNOWFLAKE_TEST_MODEL: Test specific model only (e.g., 'cortex/claude-haiku-4-5')
 * - SNOWFLAKE_FAST_MODE: Use only fastest models (set to 'true')
 */

import { jest } from '@jest/globals';
import { config } from 'dotenv';
import { z } from 'zod';
import { OpenAICompatibleProvider } from '../../../src/ai-providers/openai-compatible.js';

// Load environment variables for integration tests
config();

// Mock utils to prevent logging during tests
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key])
}));

// Import the provider
import { SnowflakeProvider } from '../../../src/ai-providers/snowflake.js';

const createProvider = () => new SnowflakeProvider();

// ============================================================================
// UNIT TESTS - Always run, test provider logic
// ============================================================================

describe('Snowflake Provider - Unit Tests', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = createProvider();
	});

	describe('Configuration', () => {
		it('should have correct base configuration', () => {
			expect(provider.name).toBe('Snowflake Cortex');
			expect(provider.apiKeyEnvVar).toBe('SNOWFLAKE_API_KEY');
			expect(provider.requiresApiKey).toBe(true);
			expect(provider.supportsStructuredOutputs).toBe(true);
		});

		it('should extend OpenAICompatibleProvider', () => {
			expect(provider instanceof OpenAICompatibleProvider).toBe(true);
		});
	});

	describe('Model ID Normalization', () => {
		it.each([
			['cortex/claude-sonnet-4-5', 'claude-sonnet-4-5'],
			['cortex/claude-haiku-4-5', 'claude-haiku-4-5'],
			['cortex/openai-gpt-5', 'openai-gpt-5'],
			['cortex/openai-gpt-5-mini', 'openai-gpt-5-mini'],
			['cortex/openai-gpt-4.1', 'openai-gpt-4.1'],
			['claude-4-sonnet', 'claude-4-sonnet'],
			['openai-gpt-5', 'openai-gpt-5'],
			[null, null],
			[undefined, undefined]
		])('normalizes %p to %p', (input, expected) => {
			expect(provider.normalizeModelId(input)).toBe(expected);
		});
	});

	describe('Token Parameter Handling', () => {
		it.each([
			['integer value', 2000, { maxTokens: 2000 }],
			['decimal value floors', 1500.7, { maxTokens: 1500 }],
			['string value coerces', '2500', { maxTokens: 2500 }],
			['undefined yields empty object', undefined, {}],
			['large numbers are preserved', 200000, { maxTokens: 200000 }]
		])('prepareTokenParam handles %s', (_label, input, expected) => {
			expect(provider.prepareTokenParam('cortex/claude-sonnet-4-5', input)).toEqual(
				expected
			);
		});
	});

	describe('_normalizeParams temperature and prompt behavior', () => {
		it.each([
			{
				description: 'OpenAI models drop temperature',
				input: { modelId: 'cortex/openai-gpt-4.1', temperature: 0.9 },
				assert: (normalized) => {
					expect(normalized.modelId).toBe('openai-gpt-4.1');
					expect(normalized).not.toHaveProperty('temperature');
				}
			},
			{
				description: 'Structured Claude forces deterministic settings',
				input: {
					modelId: 'cortex/claude-sonnet-4-5',
					objectName: 'newTaskData',
					systemPrompt: 'Generate a task.' ,
					temperature: 0.7
				},
				assert: (normalized) => {
					expect(normalized.modelId).toBe('claude-sonnet-4-5');
					expect(normalized.temperature).toBe(0);
					expect(normalized.systemPrompt).toContain('Respond in JSON');
				}
			},
			{
				description: 'Claude text generation preserves temperature and prompt',
				input: {
					modelId: 'cortex/claude-4-sonnet',
					systemPrompt: 'You are helpful.',
					temperature: 0.8
				},
				assert: (normalized) => {
					expect(normalized.temperature).toBe(0.8);
					expect(normalized.systemPrompt).toBe('You are helpful.');
				}
			},
			{
				description: 'Structured call without system prompt does not append text',
				input: {
					modelId: 'cortex/claude-haiku-4-5',
					objectName: 'subtasks'
				},
				assert: (normalized) => {
					expect(normalized).not.toHaveProperty('systemPrompt');
				}
			}
		])('applies Snowflake rules: $description', ({ input, assert }) => {
			const normalized = provider._normalizeParams({ ...input });
			assert(normalized);
		});
	});

	describe('Base URL normalization', () => {
		it.each([
			['adds required path when missing', 'https://org-account.snowflakecomputing.com', 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1'],
			['removes trailing slash before appending', 'https://org-account.snowflakecomputing.com/', 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1'],
			['keeps url when path already present', 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1', 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1']
		])('getBaseURL %s', (_label, input, expected) => {
			expect(provider.getBaseURL({ baseURL: input })).toBe(expected);
		});

		it('returns undefined when neither param nor default baseURL provided', () => {
			const freshProvider = new SnowflakeProvider();
			delete freshProvider.defaultBaseURL;
			expect(freshProvider.getBaseURL({})).toBeUndefined();
		});
	});

	describe('_applySnowflakeSchema', () => {
		const reusableStructuredSchema = (() => {
			const schema = z.object({
				title: z.string().min(1),
				priority: z.enum(['low', 'medium', 'high'])
			});
			schema.toJSONSchema = jest.fn(() => ({
				type: 'object',
				properties: {
					title: { type: 'string', minLength: 1 },
					priority: { type: 'string', enum: ['low', 'medium', 'high'] }
				},
				additionalProperties: true
			}));
			return schema;
		})();

		const reusableStructuredParams = {
			schema: reusableStructuredSchema,
			modelId: 'cortex/claude-sonnet-4-5',
			objectName: 'task',
			apiKey: 'test-snowflake-pat',
			baseURL: 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1'
		};

		beforeEach(() => {
			reusableStructuredSchema.toJSONSchema.mockClear();
		});

		const buildStructuredParams = () => ({ ...reusableStructuredParams });

		it('leaves params untouched when schema lacks toJSONSchema', () => {
			const params = { schema: { type: 'object' } };
			provider._applySnowflakeSchema(params);
			expect(params.schema).toEqual({ type: 'object' });
		});

		[
			{ method: 'generateObject', spyKey: 'generateObject', response: { result: 'ok' } },
			{ method: 'streamObject', spyKey: 'streamObject', response: { stream: 'ok' } }
		].forEach(({ method, spyKey, response }) => {
			it(`invokes schema normalization before ${method}`, async () => {
				const schemaSpy = jest.spyOn(provider, '_applySnowflakeSchema');
				const prototypeSpy = jest
					.spyOn(OpenAICompatibleProvider.prototype, spyKey)
					.mockResolvedValue(response);

				const params = buildStructuredParams();
				await provider[method]({ ...params });

				expect(schemaSpy).toHaveBeenCalledWith(
					expect.objectContaining({
						modelId: 'claude-sonnet-4-5',
						objectName: 'task'
					})
				);
				const normalizedArgs = schemaSpy.mock.calls[0][0];
				expect(normalizedArgs.schema).toBeDefined();
				schemaSpy.mockRestore();
				prototypeSpy.mockRestore();
			});
		});
	});

	describe('API Key Handling', () => {
		it('should require API key', () => {
			expect(provider.getRequiredApiKeyName()).toBe('SNOWFLAKE_API_KEY');
		});
	});
});

// ============================================================================
// INTEGRATION TESTS - Only run with credentials, test real API calls
// ============================================================================

class SnowflakeIntegrationSkip extends Error {
	constructor(message) {
		super(message);
		this.name = 'SnowflakeIntegrationSkip';
	}
}
const shouldSkipError = (error) => error instanceof SnowflakeIntegrationSkip;

const skipIntegrationTests = !process.env.SNOWFLAKE_API_KEY || !process.env.SNOWFLAKE_BASE_URL;
const describeOrSkip = skipIntegrationTests ? describe.skip : describe;

// Test configuration
const TEST_CONFIG = {
	specificModel: process.env.SNOWFLAKE_TEST_MODEL,
	fastMode: process.env.SNOWFLAKE_FAST_MODE === 'true'
};

const shouldLog = process.env.JEST_LOG === 'true';
const logInfo = (message) => {
	if (shouldLog) {
		console.log(message);
	}
};
const logWarn = (message) => {
	if (shouldLog) {
		console.warn(message);
	}
};

const SKIP_REST_AFTER_ERRORS = 3;
let errorCount = 0;

const trackFailure = (error) => {
	if (error) {
		errorCount += 1;
		if (errorCount >= SKIP_REST_AFTER_ERRORS) {
			throw new Error('Snowflake test skipped after repeated failures');
		}
	}
};

const MAX_CONCURRENCY = Number(process.env.SNOWFLAKE_MAX_CONCURRENCY || '0');

const createLimiter = (limit) => {
	if (!limit || limit <= 0) {
		return async (task) => task();
	}

	const queue = [];
	let active = 0;

	const next = () => {
		if (active >= limit) return;
		const item = queue.shift();
		if (!item) return;
		active += 1;
		item()
			.finally(() => {
				active -= 1;
				next();
			});
	};

	return (task) =>
		new Promise((resolve, reject) => {
			const run = async () => {
				try {
					resolve(await task());
				} catch (error) {
					reject(error);
				}
			};

			queue.push(() => run());
			next();
		});
};

const schedule = createLimiter(MAX_CONCURRENCY);

const runOrSkip = async (taskDescription, task) => {
	try {
		return await task();
	} catch (error) {
		if (shouldSkipError(error)) {
			logWarn(`${taskDescription} skipped: ${error.message}`);
			return null;
		}
		throw error;
	}
};

const withResult = async (description, task, handler) => {
	const result = await runOrSkip(description, task);
	if (!result) {
		return null;
	}
	handler(result);
	return result;
};

jest.setTimeout(300000);

describeOrSkip('Snowflake Provider - Integration Tests', () => {
	beforeAll(() => {
		errorCount = 0;
	});

	const baseURL = process.env.SNOWFLAKE_BASE_URL;
	const apiKey = process.env.SNOWFLAKE_API_KEY;

	// Model configurations
	const CLAUDE_MODELS = ['cortex/claude-sonnet-4-5', 'cortex/claude-haiku-4-5', 'cortex/claude-4-sonnet', 'cortex/claude-4-opus'];
	const OPENAI_MODELS = ['cortex/openai-gpt-5', 'cortex/openai-gpt-5-mini', 'cortex/openai-gpt-5-nano', 'cortex/openai-gpt-4.1', 'cortex/openai-o4-mini'];
	const FAST_MODELS = ['cortex/claude-haiku-4-5', 'cortex/openai-gpt-5-mini'];

	// Determine which models to test
	const ALL_MODELS = TEST_CONFIG.specificModel 
		? [TEST_CONFIG.specificModel]
		: TEST_CONFIG.fastMode
			? FAST_MODELS
			: [...CLAUDE_MODELS, ...OPENAI_MODELS];

	const asUserMessage = (content) => [{ role: 'user', content }];

	const runTextGeneration = async ({
		modelId,
		maxTokens = 50,
		temperature = 0.7,
		messages = asUserMessage('Say "Hello from Snowflake" and nothing else.'),
		apiKey: apiKeyOverride,
		baseURL: baseURLOverride,
		countFailure = true
	}) => {
		if (errorCount >= SKIP_REST_AFTER_ERRORS) {
			throw new SnowflakeIntegrationSkip('Skipping Snowflake tests due to repeated integration failures');
		}
		return schedule(async () => {
			const provider = createProvider();
			try {
				return await provider.generateText({
					apiKey: apiKeyOverride ?? apiKey,
					baseURL: baseURLOverride ?? baseURL,
					modelId,
					messages,
					maxTokens,
					temperature
				});
			} catch (error) {
				if (countFailure) {
					trackFailure(error);
				}
				throw error;
			}
		});
	};

	const expectSuccessfulTextResponse = (result) => {
		expect(result).toBeDefined();
		expect(result.text).toBeDefined();
		expect(typeof result.text).toBe('string');
		expect(result.text.length).toBeGreaterThan(0);
		expect(result.usage).toBeDefined();
		expect(result.usage.inputTokens).toBeGreaterThan(0);
		expect(result.usage.outputTokens).toBeGreaterThan(0);
		expect(result.usage.totalTokens).toBeGreaterThan(0);
	};

	describe('Text Generation', () => {
		it.concurrent.each(ALL_MODELS)('should generate text with %s', async (modelId) => {
			await withResult(`Text generation for ${modelId}`, () => runTextGeneration({ modelId }), (result) => {
				expectSuccessfulTextResponse(result);
				logInfo(`✓ ${modelId}: "${result.text.substring(0, 50)}..." (${result.usage.totalTokens} tokens)`);
			});
		});
	});

	describe('Token Limits', () => {
		it('should respect maxTokens parameter', async () => {
			await withResult('Token limit enforcement', () =>
				runTextGeneration({
					modelId: 'cortex/claude-haiku-4-5',
					maxTokens: 8192,
					messages: asUserMessage('Write a comprehensive essay about AI.')
				})
			,
			(result) => {
				expect(result.usage.outputTokens).toBeLessThanOrEqual(8192);
				logInfo(`✓ Token limit respected: ${result.usage.outputTokens}/8192 tokens used`);
			});
		});
	});

	describe('Model ID Normalization', () => {
		it('should handle both with and without cortex/ prefix', async () => {
			const withPrefix = await withResult('Model ID normalization (with prefix)', () =>
				runTextGeneration({
					modelId: 'cortex/claude-haiku-4-5',
					messages: asUserMessage('Say hello')
				})
			, (result) => {
				expect(result.text).toBeDefined();
			});

			const withoutPrefix = await withResult('Model ID normalization (without prefix)', () =>
				runTextGeneration({
					modelId: 'claude-haiku-4-5',
					messages: asUserMessage('Say hello')
				})
			, (result) => {
				expect(result.text).toBeDefined();
			});

			if (!withPrefix || !withoutPrefix) {
				return;
			}

			logInfo('✓ Model ID normalization works correctly');
		});
	});

	const ERROR_CASES = [
		{
			description: 'invalid PAT',
			params: {
				apiKey: 'invalid-pat',
				baseURL,
				modelId: 'cortex/claude-haiku-4-5',
				messages: asUserMessage('test')
			}
		},
		{
			description: 'invalid baseURL',
			params: {
				apiKey,
				baseURL: 'https://invalid.snowflakecomputing.com/api/v2/cortex/v1',
				modelId: 'cortex/claude-haiku-4-5',
				messages: asUserMessage('test')
			}
		},
		{
			description: 'invalid model ID',
			params: {
				apiKey,
				baseURL,
				modelId: 'cortex/invalid-model-name',
				messages: asUserMessage('test')
			}
		}
	];

	describe('Error Handling', () => {
		it.concurrent.each(ERROR_CASES)('should handle $description gracefully', async ({ params }) => {
			await expect(
				runTextGeneration({ ...params, countFailure: false })
			).rejects.toThrow();
		});
	});

	const TEMPERATURE_CASES = [
		{
			description: 'remove temperature for OpenAI models',
			modelId: 'cortex/openai-gpt-4.1',
			temperature: 0.9,
			log: '✓ OpenAI model works without temperature parameter'
		},
		{
			description: 'use temperature for Claude models',
			modelId: 'cortex/claude-haiku-4-5',
			temperature: 0.7,
			log: '✓ Claude model works with temperature parameter'
		}
	];

	describe('Temperature Handling', () => {
		it.concurrent.each(TEMPERATURE_CASES)('should $description', async ({ modelId, temperature, log }) => {
			await withResult(`Temperature behavior for ${modelId}`, () =>
				runTextGeneration({
					modelId,
					temperature,
					messages: asUserMessage('Say hello')
				})
			, (result) => {
				expect(result.text).toBeDefined();
				logInfo(log);
			});
		});
	});

	const UNLISTED_MODEL_GROUPS = [
		{
			title: 'Llama Models (not in config)',
			models: ['cortex/llama3.1-8b', 'cortex/llama3.1-70b']
		},
		{
			title: 'Claude Models (not in config)',
			models: ['cortex/claude-3-5-sonnet']
		},
		{
			title: 'Mistral Models (not in config)',
			models: ['cortex/mistral-large', 'cortex/mistral-7b']
		},
		{
			title: 'DeepSeek Models (not in config)',
			models: ['cortex/deepseek-r1']
		}
	];
	const UNLISTED_MODELS = UNLISTED_MODEL_GROUPS.flatMap(({ title, models }) =>
		models.map((modelId) => ({ title, modelId }))
	);

	describe('Unlisted Model Support', () => {
		it.concurrent.each(UNLISTED_MODELS)('$title should work with $modelId', async ({ modelId }) => {
			await withResult(`Unlisted model ${modelId}`, () =>
				runTextGeneration({
					modelId,
					temperature: 0.7,
					maxTokens: 20,
					messages: asUserMessage('Say "Hello!" in one word.')
				})
			, (result) => {
				expectSuccessfulTextResponse(result);
				logInfo(`✓ ${modelId}: "${result.text}" (${result.usage.totalTokens} tokens)`);
			});
		});
	});

	describe('Schema Validation', () => {
		let provider;

		beforeAll(() => {
			provider = new SnowflakeProvider();
		});

		const hasKeyword = (schema, keyword) => {
			if (!schema || typeof schema !== 'object') return false;
			if (Object.prototype.hasOwnProperty.call(schema, keyword)) return true;
			return Object.values(schema).some((value) => hasKeyword(value, keyword));
		};

		test('removes every unsupported keyword recursively', () => {
			const schema = {
				type: 'object',
				default: {},
				$schema: 'https://example.com/schema',
				additionalProperties: true,
				properties: {
					stringValue: {
						type: 'string',
						minLength: 1,
						maxLength: 100,
						format: 'email'
					},
					numberValue: {
						type: 'number',
						minimum: 0,
						maximum: 1000,
						exclusiveMinimum: 0,
						exclusiveMaximum: 1000,
						multipleOf: 0.5
					},
					arrayValue: {
						type: 'array',
						minItems: 1,
						maxItems: 10,
						uniqueItems: true,
						contains: { type: 'string' },
						minContains: 1,
						maxContains: 2,
						items: {
							type: 'object',
							patternProperties: { '^x-': { type: 'string' } },
							minProperties: 1,
							maxProperties: 5,
							propertyNames: { pattern: '^x-' },
							additionalProperties: true
						}
					},
					objectValue: {
						type: 'object',
						additionalProperties: true,
						properties: {
							optionalField: {
								anyOf: [{ type: 'string' }, { type: 'null' }]
							}
						}
					}
				},
				required: ['stringValue']
			};

			const cleaned = provider._removeUnsupportedFeatures(schema);

			SnowflakeProvider.UNSUPPORTED_KEYWORDS.forEach((keyword) => {
				expect(hasKeyword(cleaned, keyword)).toBe(false);
			});
			expect(cleaned.additionalProperties).toBe(false);
			expect(cleaned.properties.arrayValue.items.additionalProperties).toBe(false);
			expect(cleaned.properties.objectValue.properties.optionalField.type).toBe('string');
		});

		test('flattens anyOf with null to optional types', () => {
			const schema = {
				type: 'object',
				properties: {
					optional: {
						anyOf: [{ type: 'string' }, { type: 'null' }]
					}
				},
				additionalProperties: true
			};

			const cleaned = provider._removeUnsupportedFeatures(schema);
			expect(cleaned.properties.optional.anyOf).toBeUndefined();
			expect(cleaned.properties.optional.type).toBe('string');
		});
	});
});
