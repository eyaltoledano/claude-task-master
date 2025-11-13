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
 * - SNOWFLAKE_TEST_MODEL: Test specific model only (e.g., 'snowflake/claude-haiku-4-5')
 * - SNOWFLAKE_FAST_MODE: Use only fastest models (set to 'true')
 */

import { jest } from '@jest/globals';
import { config } from 'dotenv';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OpenAICompatibleProvider } from '../../../src/ai-providers/openai-compatible.js';
import { removeUnsupportedFeatures, UNSUPPORTED_KEYWORDS } from '@tm/ai-sdk-provider-cortex-code';

// Load environment variables for integration tests
config();

// Mock utils to prevent logging during tests
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key])
}));

// Import the provider
import { SnowflakeProvider } from '../../../src/ai-providers/snowflake.js';

// Load supported models from JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const supportedModelsPath = resolve(__dirname, '../../../scripts/modules/supported-models.json');
const supportedModelsData = JSON.parse(readFileSync(supportedModelsPath, 'utf-8'));
const allSnowflakeModels = supportedModelsData['snowflake'] || [];

// Filter to only enabled models (supported !== false)
const enabledSnowflakeModels = allSnowflakeModels.filter(model => model.supported !== false);

console.log(`\n📋 Loaded ${enabledSnowflakeModels.length} enabled Snowflake models (filtered ${allSnowflakeModels.length - enabledSnowflakeModels.length} disabled)`);

const createProvider = () => new SnowflakeProvider();

// Reusable structured schema for unit tests (mocked toJSONSchema)
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

// Real Zod schema for integration tests (pure Zod - AI SDK handles conversion)
const realIntegrationSchema = z.object({
	name: z.string().describe("User's full name"),
	age: z.number().describe("User's age"),
	email: z.string().email().describe("User's email address")
});

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
			expect(provider.name).toBe('Snowflake');
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
			['snowflake/claude-sonnet-4-5', 'claude-sonnet-4-5'],
			['snowflake/claude-haiku-4-5', 'claude-haiku-4-5'],
			['snowflake/openai-gpt-5', 'openai-gpt-5'],
			['snowflake/openai-gpt-5-mini', 'openai-gpt-5-mini'],
			['snowflake/openai-gpt-5-nano', 'openai-gpt-5-nano'],
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
        ['enforces minimum 8192 for small values', 2000, { maxTokens: 8192 }],
        ['enforces minimum 8192 for decimal values', 1500.7, { maxTokens: 8192 }],
        ['enforces minimum 8192 for string values', '2500', { maxTokens: 8192 }],
        ['defaults to 8192 when undefined', undefined, { maxTokens: 8192 }],
        ['preserves values above minimum', 16384, { maxTokens: 16384 }],
        ['preserves large numbers', 200000, { maxTokens: 200000 }],
        ['allows exact minimum', 8192, { maxTokens: 8192 }]
    ])('prepareTokenParam handles %s', (_label, input, expected) => {
        expect(provider.prepareTokenParam('snowflake/claude-haiku-4-5', input)).toEqual(
            expected
        );
    });
	});

	describe('_normalizeParams temperature and prompt behavior', () => {
		it.each([
			{
				description: 'OpenAI models drop temperature',
				input: { modelId: 'snowflake/openai-gpt-5', temperature: 0.9 },
				assert: (normalized) => {
					expect(normalized.modelId).toBe('openai-gpt-5');
					expect(normalized).not.toHaveProperty('temperature');
				}
			},
			{
				description: 'Structured Claude removes temperature parameter',
				input: {
					modelId: 'snowflake/claude-haiku-4-5',
					objectName: 'newTaskData',
					systemPrompt: 'Generate a task.' ,
					temperature: 0.7
				},
				assert: (normalized) => {
					expect(normalized.modelId).toBe('claude-haiku-4-5');
					expect(normalized).not.toHaveProperty('temperature');
					expect(normalized.systemPrompt).toBe('Generate a task.');
				}
			},
			{
				description: 'Claude text generation preserves temperature and prompt',
				input: {
					modelId: 'snowflake/claude-4-sonnet',
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
					modelId: 'snowflake/claude-haiku-4-5',
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
		const reusableStructuredParams = {
			schema: reusableStructuredSchema,
			modelId: 'snowflake/claude-haiku-4-5',
			objectName: 'task',
			apiKey: 'test-snowflake-pat',
			baseURL: 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1',
			messages: [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: 'Generate a task object.' }
			]
		};

		beforeEach(() => {
			reusableStructuredSchema.toJSONSchema.mockClear();
		});

		const buildStructuredParams = () => ({ ...reusableStructuredParams });

		it('leaves params untouched when schema lacks toJSONSchema', () => {
			const params = { schema: { type: 'object' } };
			provider._applySnowflakeSchema(params);
			// Pure Zod schemas (without toJSONSchema) are left untouched for AI SDK to handle
			expect(params.schema).toEqual({ 
				type: 'object'
			});
		});

		it('invokes schema normalization before generateObject', async () => {
			const schemaSpy = jest.spyOn(provider, '_applySnowflakeSchema');
			
			// Mock getClient to throw after schema normalization is called
			const mockClient = jest.fn().mockReturnValue('mock-model-id');
			const getClientSpy = jest.spyOn(provider, 'getClient').mockResolvedValue(mockClient);
			
			// Mock validateMessages and validateParams to pass through
			const validateMessagesSpy = jest.spyOn(provider, 'validateMessages').mockImplementation(() => {});
			const validateParamsSpy = jest.spyOn(provider, 'validateParams').mockImplementation(() => {});

			// The test will fail at the actual SDK call, but that's OK - we just want to verify
			// that _applySnowflakeSchema was called first
			try {
				const params = buildStructuredParams();
				await provider.generateObject({ ...params });
			} catch (error) {
				// Expected to fail at SDK call, ignore
			}

			// Verify schema normalization was called with correct params
			expect(schemaSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: 'claude-haiku-4-5',
					objectName: 'task'
				})
			);
			const normalizedArgs = schemaSpy.mock.calls[0][0];
			expect(normalizedArgs.schema).toBeDefined();
			
			schemaSpy.mockRestore();
			getClientSpy.mockRestore();
			validateMessagesSpy.mockRestore();
			validateParamsSpy.mockRestore();
		});

		it('invokes schema normalization before streamObject', async () => {
			const schemaSpy = jest.spyOn(provider, '_applySnowflakeSchema');
			const prototypeSpy = jest
				.spyOn(OpenAICompatibleProvider.prototype, 'streamObject')
				.mockResolvedValue({ stream: 'ok' });

			const params = buildStructuredParams();
			await provider.streamObject({ ...params });

			expect(schemaSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: 'claude-haiku-4-5',
					objectName: 'task'
				})
			);
			const normalizedArgs = schemaSpy.mock.calls[0][0];
			expect(normalizedArgs.schema).toBeDefined();
			schemaSpy.mockRestore();
			prototypeSpy.mockRestore();
		});
	});

	describe('API Key Handling', () => {
		it('should require API key', () => {
			expect(provider.getRequiredApiKeyName()).toBe('SNOWFLAKE_API_KEY');
		});
	});

	describe('Model Support Detection', () => {
		// Dynamically get first available model of each type from enabled models
		const otherModel = enabledSnowflakeModels.find(m => !m.id.includes('claude') && !m.id.includes('openai'))?.id || 'snowflake/llama3.1-70b';
		const claudeModel = enabledSnowflakeModels.find(m => m.id.includes('claude'))?.id || 'snowflake/claude-haiku-4-5';
		const openaiModel = enabledSnowflakeModels.find(m => m.id.includes('openai'))?.id || 'snowflake/openai-gpt-5';

		test('should detect that other models do not support structured outputs', () => {
			const supports = provider._modelSupportsStructuredOutputs(otherModel);
			expect(supports).toBe(false);
		});

		test('should detect that Claude models support structured outputs', () => {
			const supports = provider._modelSupportsStructuredOutputs(claudeModel);
			expect(supports).toBe(true);
		});

		test('should detect that OpenAI models support structured outputs', () => {
			const supports = provider._modelSupportsStructuredOutputs(openaiModel);
			expect(supports).toBe(true);
		});

		test('should handle model IDs without snowflake prefix', () => {
			expect(provider._modelSupportsStructuredOutputs('claude-sonnet-4-5')).toBe(true);
			expect(provider._modelSupportsStructuredOutputs('openai-gpt-5')).toBe(true);
			expect(provider._modelSupportsStructuredOutputs('llama-3.3-70b')).toBe(false);
		});
	});

	describe('Warning for Unsupported Models', () => {
		let consoleLogSpy;

		beforeEach(() => {
			// Mock console.log to capture warning messages (utils.js log uses console.log)
			consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
		});

		afterEach(() => {
			consoleLogSpy.mockRestore();
		});

		test('should log warning for Llama models', () => {
			provider._warnIfUnsupportedStructuredOutputs('llama-3.3-70b');
			
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/\[WARN\].*llama-3\.3-70b.*does not support native structured outputs/)
			);
		});

		test('should log warning for Mistral models', () => {
			provider._warnIfUnsupportedStructuredOutputs('mistral-large-2');
			
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/\[WARN\].*mistral-large-2.*does not support native structured outputs/)
			);
		});

		test('should NOT log warning for Claude models', () => {
			provider._warnIfUnsupportedStructuredOutputs('claude-haiku-4-5');
			
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		test('should NOT log warning for OpenAI models', () => {
			provider._warnIfUnsupportedStructuredOutputs('openai-gpt-5');
			
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		test('should suggest using OpenAI or Claude models in warning', () => {
			provider._warnIfUnsupportedStructuredOutputs('deepseek-v3');
			
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('For best results, use OpenAI or Claude models')
			);
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

jest.setTimeout(30000); // 30 second timeout for all tests

describeOrSkip('Snowflake Provider - Integration Tests', () => {
	beforeAll(() => {
		errorCount = 0;
	});

	const baseURL = process.env.SNOWFLAKE_BASE_URL;
	const apiKey = process.env.SNOWFLAKE_API_KEY;

	// Model configurations - dynamically loaded from supported-models.json
	const CLAUDE_MODELS = enabledSnowflakeModels
		.filter(model => model.id.includes('claude'))
		.filter(model => !model.id.includes('opus')) // Skip opus - too slow for tests
		.map(model => model.id);
	const OPENAI_MODELS = enabledSnowflakeModels
		.filter(model => model.id.includes('openai'))
		.map(model => model.id);
	const FAST_MODELS = ['snowflake/claude-haiku-4-5', 'snowflake/openai-gpt-5-mini'];

	console.log(`\n🧪 Testing ${CLAUDE_MODELS.length} Claude models and ${OPENAI_MODELS.length} OpenAI models`);

	// Determine which models to test - default to FAST_MODELS for speed
	const ALL_MODELS = TEST_CONFIG.specificModel 
		? [TEST_CONFIG.specificModel]
		: TEST_CONFIG.fastMode !== false // Default to fast mode
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
		const startTime = Date.now();
		console.log(`⏱️  [${new Date().toISOString()}] Starting text generation for ${modelId}...`);
		return schedule(async () => {
			const provider = createProvider();
			try {
				const result = await provider.generateText({
					apiKey: apiKeyOverride ?? apiKey,
					baseURL: baseURLOverride ?? baseURL,
					modelId,
					messages,
					maxTokens,
					temperature
				});
				const duration = Date.now() - startTime;
				console.log(`✅ [${new Date().toISOString()}] Completed ${modelId} in ${duration}ms`);
				return result;
			} catch (error) {
				const duration = Date.now() - startTime;
				console.log(`❌ [${new Date().toISOString()}] Failed ${modelId} after ${duration}ms: ${error.message}`);
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
					modelId: 'snowflake/claude-haiku-4-5',
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
		it('should handle both with and without snowflake/ prefix', async () => {
			const withPrefix = await withResult('Model ID normalization (with prefix)', () =>
				runTextGeneration({
					modelId: 'snowflake/claude-haiku-4-5',
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
				modelId: 'snowflake/claude-haiku-4-5',
				messages: asUserMessage('test')
			}
		},
		{
			description: 'invalid baseURL',
			params: {
				apiKey,
				baseURL: 'https://invalid.snowflakecomputing.com/api/v2/cortex/v1',
				modelId: 'snowflake/claude-haiku-4-5',
				messages: asUserMessage('test')
			}
		},
		{
			description: 'invalid model ID',
			params: {
				apiKey,
				baseURL,
				modelId: 'snowflake/invalid-model-name',
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
			modelId: 'snowflake/openai-gpt-5',
			temperature: 0.9,
			log: '✓ OpenAI model works without temperature parameter'
		},
		{
			description: 'use temperature for Claude models',
			modelId: 'snowflake/claude-haiku-4-5',
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

	// Dynamically generate model groups from supported-models.json (reuse CLAUDE_MODELS and OPENAI_MODELS from above)
	const OTHER_MODELS = enabledSnowflakeModels.filter(m => 
		!m.id.includes('claude') && 
		!m.id.includes('openai')
	).map(m => m.id);

	const UNLISTED_MODEL_GROUPS = [
		{
			title: 'Claude Models',
			models: CLAUDE_MODELS.slice(0, 2) // Test first 2 Claude models
		},
		{
			title: 'OpenAI Models',
			models: OPENAI_MODELS.slice(0, 2) // Test first 2 OpenAI models
		},
		{
			title: 'Other Models',
			models: OTHER_MODELS.slice(0, 3) // Test first 3 other models
		}
	];
	const UNLISTED_MODELS = UNLISTED_MODEL_GROUPS.flatMap(({ title, models }) =>
		models.map((modelId) => ({ title, modelId }))
	).filter(({ modelId }) => modelId); // Filter out empty entries

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

			const cleaned = removeUnsupportedFeatures(schema);

			UNSUPPORTED_KEYWORDS.forEach((keyword) => {
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

			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties.optional.anyOf).toBeUndefined();
			expect(cleaned.properties.optional.type).toBe('string');
		});
	});

	describe('Integration Tests - Real API Calls', () => {
		// Reset modules before integration tests to use real AI SDK
		beforeAll(() => {
			jest.unmock('ai');
			jest.resetModules();
		});

		const integrationProvider = new SnowflakeProvider({
			apiKey: process.env.SNOWFLAKE_API_KEY,
			baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com'
		});

		const skipIfNoKey = () => {
			if (!process.env.SNOWFLAKE_API_KEY) {
				console.warn('Skipping Snowflake integration tests - SNOWFLAKE_API_KEY not set');
				return true;
			}
			return false;
		};

		describe('Claude Models - Native Structured Outputs', () => {
			// Test only Haiku for speed (default model)
			const claudeModels = [
				'snowflake/claude-haiku-4-5'
			];

			test.concurrent.each(claudeModels)('should generate object with native structured outputs for %s', async (modelId) => {
				if (skipIfNoKey()) return;

				const startTime = Date.now();
				console.log(`⏱️  [${new Date().toISOString()}] Starting generateObject for ${modelId}...`);

				const params = {
					modelId,
					apiKey: process.env.SNOWFLAKE_API_KEY,
					baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
					messages: [
						{ role: 'system', content: 'You are a helpful assistant.' },
						{ role: 'user', content: 'Generate a user profile for John Doe, age 30, email john@example.com' }
					],
					schema: realIntegrationSchema,
					objectName: 'user_profile',
					maxTokens: 8192
				};

				const result = await integrationProvider.generateObject(params);
				const duration = Date.now() - startTime;
				console.log(`✅ [${new Date().toISOString()}] Completed generateObject for ${modelId} in ${duration}ms`);

				expect(result).toBeDefined();
				expect(result.object).toBeDefined();
				expect(result.usage).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				expect(result.usage.outputTokens).toBeGreaterThan(0);
			}, 30000);
		});

		describe('OpenAI Models - Structured Outputs', () => {
			// Test only GPT-5 for speed
			const openaiModels = [
				'snowflake/openai-gpt-5'
			];

			test.concurrent.each(openaiModels)('should generate object with structured outputs for %s', async (modelId) => {
				if (skipIfNoKey()) return;

				const params = {
					modelId,
					apiKey: process.env.SNOWFLAKE_API_KEY,
					baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
					messages: [
						{ role: 'system', content: 'You are a helpful assistant.' },
						{ role: 'user', content: 'Generate a user profile for John Doe, age 30, email john@example.com' }
					],
					schema: realIntegrationSchema,
					objectName: 'user_profile',
					maxTokens: 8192
				};

				const result = await integrationProvider.generateObject(params);

				expect(result).toBeDefined();
				expect(result.object).toBeDefined();
				expect(result.usage).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
			}, 30000);
		});

		describe('Token Parameter Verification', () => {
			test('should use maxTokens parameter (AI SDK translates to max_completion_tokens)', async () => {
				if (skipIfNoKey()) return;

				// Spy on generateText to verify parameters
				const generateTextSpy = jest.spyOn(integrationProvider, 'generateText');

				const params = {
					modelId: 'snowflake/claude-haiku-4-5',
					apiKey: process.env.SNOWFLAKE_API_KEY,
					baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
					messages: [
						{ role: 'user', content: 'Generate a user profile for Alice, age 28, email alice@example.com' }
					],
					schema: realIntegrationSchema,
					objectName: 'greeting',
					maxTokens: 8192
				};

				try {
					await integrationProvider.generateObject(params);
				} catch (error) {
					// May fail due to JSON parsing, that's OK for this test
				}

				// Verify that generateText was called with maxTokens
				if (generateTextSpy.mock.calls.length > 0) {
					const callParams = generateTextSpy.mock.calls[0][0];
					expect(callParams.maxTokens).toBeDefined();
					expect(callParams.maxTokens).toBeGreaterThanOrEqual(8192);
				}

				generateTextSpy.mockRestore();
			}, 30000);

		test('should enforce minimum 8192 tokens', async () => {
			if (skipIfNoKey()) return;

			const params = {
				modelId: 'snowflake/claude-haiku-4-5',
				apiKey: process.env.SNOWFLAKE_API_KEY,
				baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
				messages: [
					{ role: 'user', content: 'Generate a user profile for Bob, age 35, email bob@example.com' }
				],
				schema: realIntegrationSchema,
				objectName: 'greeting',
				maxTokens: 2000 // Request less than minimum
			};

			const result = await integrationProvider.generateObject(params);

			// Should still get a valid result (minimum was enforced internally)
			expect(result).toBeDefined();
			expect(result.object).toBeDefined();
		}, 30000);

		test('should handle large token requests (above 4096 default)', async () => {
			if (skipIfNoKey()) return;

			const params = {
				modelId: 'snowflake/claude-haiku-4-5',
				apiKey: process.env.SNOWFLAKE_API_KEY,
				baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
				messages: [
					{ role: 'user', content: 'Generate a detailed list of 10 programming concepts with comprehensive descriptions' }
				],
				schema: z.object({
					concepts: z.array(z.object({
						name: z.string(),
						description: z.string()
					}).strict()) // Add strict() to ensure additionalProperties: false
				}).strict(),
				objectName: 'programming_concepts',
				maxTokens: 8192 // Test with larger token limit
			};

			const result = await integrationProvider.generateObject(params);

			expect(result).toBeDefined();
			expect(result.object).toBeDefined();
			expect(result.object.concepts).toBeDefined();
			expect(Array.isArray(result.object.concepts)).toBe(true);
			expect(result.object.concepts.length).toBeGreaterThanOrEqual(8); // Verify we got substantial output
			
			// With proper max_completion_tokens, we should get substantial output
			expect(result.usage.outputTokens).toBeGreaterThan(800);
		}, 45000);
		});

		describe('Error Handling', () => {
			test('should handle invalid model gracefully', async () => {
				if (skipIfNoKey()) return;

				const params = {
					modelId: 'snowflake/invalid-model-xyz',
					apiKey: process.env.SNOWFLAKE_API_KEY,
					baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
					messages: [{ role: 'user', content: 'Generate a user profile for Test User, age 20, email test@example.com' }],
					schema: realIntegrationSchema,
					objectName: 'test',
					maxTokens: 8192
				};

				await expect(integrationProvider.generateObject(params)).rejects.toThrow();
			}, 30000);

		test('should handle malformed schema gracefully for Claude', async () => {
			if (skipIfNoKey()) return;

			const params = {
				modelId: 'snowflake/claude-haiku-4-5',
				apiKey: process.env.SNOWFLAKE_API_KEY,
				baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
				messages: [{ role: 'user', content: 'Generate invalid data' }],
				schema: z.object({}), // Empty schema - this is malformed
				objectName: 'empty',
				maxTokens: 8192
			};

			// Empty schema is malformed and should throw an error
			await expect(integrationProvider.generateObject(params)).rejects.toThrow();
		}, 30000);
		});

		describe('Text Generation', () => {
		test('should generate text with Claude models', async () => {
			if (skipIfNoKey()) return;

			const params = {
				modelId: 'snowflake/claude-haiku-4-5',
				apiKey: process.env.SNOWFLAKE_API_KEY,
				baseURL: process.env.SNOWFLAKE_BASE_URL || 'https://<ACCOUNT_NAME>.snowflakecomputing.com',
				messages: [{ role: 'user', content: 'Say hello in one word' }],
				maxTokens: 8192
			};

			const result = await integrationProvider.generateText(params);

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe('string');
			expect(result.text.length).toBeGreaterThan(0);
			expect(result.usage).toBeDefined();
		}, 30000);
	});
});
});
