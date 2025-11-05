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

// Load environment variables for integration tests
config();

// Mock utils to prevent logging during tests
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key])
}));

// Import the provider
import { SnowflakeProvider } from '../../../src/ai-providers/snowflake.js';

// ============================================================================
// UNIT TESTS - Always run, test provider logic
// ============================================================================

describe('Snowflake Provider - Unit Tests', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new SnowflakeProvider();
	});

	describe('Configuration', () => {
		it('should have correct base configuration', () => {
			expect(provider.name).toBe('Snowflake Cortex');
			expect(provider.apiKeyEnvVar).toBe('SNOWFLAKE_API_KEY');
			expect(provider.requiresApiKey).toBe(true);
			expect(provider.supportsStructuredOutputs).toBe(true);
		});

		it('should extend OpenAICompatibleProvider', () => {
			expect(provider.constructor.name).toBe('SnowflakeProvider');
			expect(typeof provider.generateText).toBe('function');
			expect(typeof provider.generateObject).toBe('function');
		});
	});

	describe('Model ID Normalization', () => {
		it('should strip cortex/ prefix from model IDs', () => {
			expect(provider.normalizeModelId('cortex/claude-sonnet-4-5')).toBe('claude-sonnet-4-5');
			expect(provider.normalizeModelId('cortex/claude-haiku-4-5')).toBe('claude-haiku-4-5');
			expect(provider.normalizeModelId('cortex/claude-4-sonnet')).toBe('claude-4-sonnet');
			expect(provider.normalizeModelId('cortex/claude-4-opus')).toBe('claude-4-opus');
		});

		it('should strip cortex/ prefix from OpenAI models', () => {
			expect(provider.normalizeModelId('cortex/openai-gpt-5')).toBe('openai-gpt-5');
			expect(provider.normalizeModelId('cortex/openai-gpt-5-mini')).toBe('openai-gpt-5-mini');
			expect(provider.normalizeModelId('cortex/openai-gpt-5-nano')).toBe('openai-gpt-5-nano');
			expect(provider.normalizeModelId('cortex/openai-gpt-4.1')).toBe('openai-gpt-4.1');
			expect(provider.normalizeModelId('cortex/openai-o4-mini')).toBe('openai-o4-mini');
		});

		it('should return unchanged ID without cortex/ prefix', () => {
			expect(provider.normalizeModelId('claude-4-sonnet')).toBe('claude-4-sonnet');
			expect(provider.normalizeModelId('openai-gpt-5')).toBe('openai-gpt-5');
		});

		it('should handle null/undefined model IDs', () => {
			expect(provider.normalizeModelId(null)).toBeNull();
			expect(provider.normalizeModelId(undefined)).toBeUndefined();
		});
	});

	describe('Token Parameter Handling', () => {
		it('should use maxTokens parameter (OpenAI-compatible)', () => {
			const result = provider.prepareTokenParam('cortex/claude-sonnet-4-5', 2000);
			expect(result).toEqual({ maxTokens: 2000 });
		});

		it('should floor decimal maxTokens values', () => {
			const result = provider.prepareTokenParam('cortex/openai-gpt-5', 1500.7);
			expect(result).toEqual({ maxTokens: 1500 });
		});

		it('should handle string maxTokens values', () => {
			const result = provider.prepareTokenParam('cortex/claude-4-opus', '2500');
			expect(result).toEqual({ maxTokens: 2500 });
		});

		it('should return empty object when maxTokens is undefined', () => {
			const result = provider.prepareTokenParam('cortex/claude-haiku-4-5', undefined);
			expect(result).toEqual({});
		});

		it('should handle very large maxTokens', () => {
			const result = provider.prepareTokenParam('cortex/claude-4-sonnet', 200000);
			expect(result).toEqual({ maxTokens: 200000 });
		});
	});

	describe('Temperature Parameter Handling', () => {
		describe('OpenAI Models', () => {
			it('should remove temperature for OpenAI models', () => {
				const params = {
					modelId: 'cortex/openai-gpt-5',
					messages: [{ role: 'user', content: 'test' }],
					temperature: 0.7
				};
				const normalized = provider._normalizeParams(params);
				expect(normalized.temperature).toBeUndefined();
			});

			it('should remove temperature for openai-gpt-4.1', () => {
				const params = {
					modelId: 'cortex/openai-gpt-4.1',
					temperature: 0.8
				};
				const normalized = provider._normalizeParams(params);
				expect(normalized.temperature).toBeUndefined();
			});

			it('should remove temperature for o-series models', () => {
				const params = {
					modelId: 'cortex/openai-o4-mini',
					temperature: 0.5
				};
				const normalized = provider._normalizeParams(params);
				expect(normalized.temperature).toBeUndefined();
			});
		});

		describe('Claude Models', () => {
			it('should set temperature to 0 for structured outputs', () => {
				const params = {
					modelId: 'cortex/claude-sonnet-4-5',
					objectName: 'newTaskData',
					temperature: 0.7
				};
				const normalized = provider._normalizeParams(params);
				expect(normalized.temperature).toBe(0);
			});

			it('should preserve temperature for text generation', () => {
				const params = {
					modelId: 'cortex/claude-4-sonnet',
					temperature: 0.8
				};
				const normalized = provider._normalizeParams(params);
				expect(normalized.temperature).toBe(0.8);
			});

			it('should not add temperature if not present', () => {
				const params = {
					modelId: 'cortex/claude-haiku-4-5'
				};
				const normalized = provider._normalizeParams(params);
				expect('temperature' in normalized).toBe(false);
			});
		});
	});

	describe('Schema Compatibility', () => {
		it('should provide Snowflake-compatible schema for newTaskData', () => {
			const schema = provider._createSnowflakeCompatibleSchema('newTaskData');
			expect(schema).toBeDefined();
			expect(schema.type).toBe('object');
			expect(schema.properties).toHaveProperty('title');
			expect(schema.properties).toHaveProperty('description');
			expect(schema.properties).toHaveProperty('details');
			expect(schema.properties).toHaveProperty('testStrategy');
			expect(schema.properties).toHaveProperty('dependencies');
			expect(schema.required).toBeDefined();
			expect(schema.additionalProperties).toBe(false);
		});

		it('should provide Snowflake-compatible schema for subtasks', () => {
			const schema = provider._createSnowflakeCompatibleSchema('subtasks');
			expect(schema).toBeDefined();
			expect(schema.properties).toHaveProperty('subtasks');
			expect(schema.properties.subtasks.type).toBe('array');
			expect(schema.properties.subtasks.items).toBeDefined();
		});

		it('should provide Snowflake-compatible schema for tasks', () => {
			const schema = provider._createSnowflakeCompatibleSchema('tasks');
			expect(schema).toBeDefined();
			expect(schema.properties).toHaveProperty('tasks');
		});

		it('should provide Snowflake-compatible schema for complexityAnalysis', () => {
			const schema = provider._createSnowflakeCompatibleSchema('complexityAnalysis');
			expect(schema).toBeDefined();
			expect(schema.properties).toHaveProperty('complexityAnalysis');
		});

		it('should return null for unknown schema names', () => {
			const schema = provider._createSnowflakeCompatibleSchema('unknownSchema');
			expect(schema).toBeNull();
		});

		it('should ensure all schemas have additionalProperties: false', () => {
			const schemaNames = ['newTaskData', 'subtasks', 'tasks', 'complexityAnalysis'];
			schemaNames.forEach(name => {
				const schema = provider._createSnowflakeCompatibleSchema(name);
				expect(schema.additionalProperties).toBe(false);
			});
		});

		it('should ensure all schemas have required field', () => {
			const schemaNames = ['newTaskData', 'subtasks', 'tasks', 'complexityAnalysis'];
			schemaNames.forEach(name => {
				const schema = provider._createSnowflakeCompatibleSchema(name);
				expect(schema.required).toBeDefined();
				expect(Array.isArray(schema.required)).toBe(true);
			});
		});
	});

	describe('Prompt Optimization', () => {
		it('should add "Respond in JSON" to system prompt for structured outputs', () => {
			const params = {
				modelId: 'cortex/claude-sonnet-4-5',
				objectName: 'newTaskData',
				systemPrompt: 'Generate a task.',
				messages: [{ role: 'user', content: 'test' }]
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.systemPrompt).toContain('Respond in JSON');
		});

		it('should not modify system prompt for text generation', () => {
			const params = {
				modelId: 'cortex/claude-4-sonnet',
				systemPrompt: 'You are helpful.',
				messages: [{ role: 'user', content: 'test' }]
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.systemPrompt).toBe('You are helpful.');
		});

		it('should handle missing system prompt gracefully', () => {
			const params = {
				modelId: 'cortex/claude-haiku-4-5',
				objectName: 'subtasks',
				messages: [{ role: 'user', content: 'test' }]
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.systemPrompt).toBeUndefined();
		});
	});

	describe('API Key Handling', () => {
		it('should require API key', () => {
			expect(provider.isRequiredApiKey()).toBe(true);
			expect(provider.getRequiredApiKeyName()).toBe('SNOWFLAKE_API_KEY');
		});

		it('should validate when API key is missing', () => {
			expect(() => provider.validateAuth({})).toThrow(
				'Snowflake Cortex API key is required'
			);
		});

		it('should pass validation when API key is provided', () => {
			expect(() =>
				provider.validateAuth({ apiKey: 'test-snowflake-pat' })
			).not.toThrow();
		});
	});

	describe('Parameter Normalization', () => {
		it('should normalize model ID in all params', () => {
			const params = {
				modelId: 'cortex/claude-sonnet-4-5',
				messages: [{ role: 'user', content: 'test' }],
				temperature: 0.7
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.modelId).toBe('claude-sonnet-4-5');
		});

		it('should preserve all other parameters', () => {
			const params = {
				modelId: 'cortex/openai-gpt-5',
				messages: [{ role: 'user', content: 'test' }],
				maxTokens: 1000,
				customParam: 'value'
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.messages).toEqual(params.messages);
			expect(normalized.maxTokens).toBe(1000);
			expect(normalized.customParam).toBe('value');
		});

		it('should apply all transformations in correct order', () => {
			const params = {
				modelId: 'cortex/openai-gpt-5',
				objectName: 'newTaskData',
				systemPrompt: 'Generate task.',
				temperature: 0.7
			};
			const normalized = provider._normalizeParams(params);
			
			// Model ID normalized
			expect(normalized.modelId).toBe('openai-gpt-5');
			
			// Temperature removed for OpenAI
			expect(normalized.temperature).toBeUndefined();
			
			// System prompt optimized
			expect(normalized.systemPrompt).toContain('Respond in JSON');
		});
	});

	describe('Client Creation', () => {
		it('should throw error if API key is missing', () => {
			expect(() => provider.getClient({})).toThrow(
				'Snowflake Cortex API key is required'
			);
		});

		it('should create client with valid API key and baseURL', () => {
			const params = {
				apiKey: 'test-snowflake-pat',
				baseURL: 'https://org-account.snowflakecomputing.com/api/v2/cortex/v1'
			};

			const client = provider.getClient(params);
			expect(typeof client).toBe('function');

			// The client function should be callable and return a model object
			const model = client('claude-4-sonnet');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('claude-4-sonnet');
		});

		it('should handle normalized model IDs in client', () => {
			const client = provider.getClient({
				apiKey: 'test-pat',
				baseURL: 'https://test.snowflakecomputing.com/api/v2/cortex/v1'
			});

			// Test with prefixed model ID (should work after normalization)
			const claudeModel = client('claude-sonnet-4-5');
			expect(claudeModel.modelId).toBe('claude-sonnet-4-5');

			const openaiModel = client('openai-gpt-5');
			expect(openaiModel.modelId).toBe('openai-gpt-5');
		});
	});
});

// ============================================================================
// INTEGRATION TESTS - Only run with credentials, test real API calls
// ============================================================================

const skipIntegrationTests = !process.env.SNOWFLAKE_API_KEY || !process.env.SNOWFLAKE_BASE_URL;
const describeOrSkip = skipIntegrationTests ? describe.skip : describe;

// Test configuration
const TEST_CONFIG = {
	specificModel: process.env.SNOWFLAKE_TEST_MODEL,
	fastMode: process.env.SNOWFLAKE_FAST_MODE === 'true'
};

if (skipIntegrationTests) {
	console.log('\n⚠️  Skipping Snowflake integration tests: credentials not configured\n');
} else if (TEST_CONFIG.specificModel || TEST_CONFIG.fastMode) {
	console.log('\n📋 Integration Test Configuration:', TEST_CONFIG);
}

describeOrSkip('Snowflake Provider - Integration Tests', () => {
	let provider;
	const baseURL = process.env.SNOWFLAKE_BASE_URL;
	const apiKey = process.env.SNOWFLAKE_API_KEY;

	// Model configurations
	const CLAUDE_MODELS = ['cortex/claude-sonnet-4-5', 'cortex/claude-haiku-4-5', 'cortex/claude-4-sonnet', 'cortex/claude-4-opus'];
	const OPENAI_MODELS = ['cortex/openai-gpt-5', 'cortex/openai-gpt-5-mini', 'cortex/openai-gpt-5-nano', 'cortex/openai-gpt-4.1', 'cortex/openai-o4-mini'];
	const FAST_MODELS = ['cortex/claude-haiku-4-5', 'cortex/openai-gpt-4.1'];

	// Determine which models to test
	const ALL_MODELS = TEST_CONFIG.specificModel 
		? [TEST_CONFIG.specificModel]
		: TEST_CONFIG.fastMode
			? FAST_MODELS
			: [...CLAUDE_MODELS, ...OPENAI_MODELS];

	beforeEach(() => {
		provider = new SnowflakeProvider();
	});

	describe('Text Generation', () => {
		const createSimpleMessage = () => [{
			role: 'user',
			content: 'Say "Hello from Snowflake" and nothing else.'
		}];

		const testTextGeneration = async (modelId) => {
			const result = await provider.generateText({
				apiKey,
				baseURL,
				modelId,
				messages: createSimpleMessage(),
				maxTokens: 50,
				temperature: 0.7
			});

			expect(result).toBeDefined();
			expect(result.text).toBeDefined();
			expect(typeof result.text).toBe('string');
			expect(result.text.length).toBeGreaterThan(0);

			expect(result.usage).toBeDefined();
			expect(result.usage.inputTokens).toBeGreaterThan(0);
			expect(result.usage.outputTokens).toBeGreaterThan(0);
			expect(result.usage.totalTokens).toBeGreaterThan(0);

			return result;
		};

		ALL_MODELS.forEach(modelId => {
			const timeout = modelId.includes('opus') || modelId.includes('gpt-5') ? 60000 : 30000;
			
			it(`should generate text with ${modelId}`, async () => {
				const result = await testTextGeneration(modelId);
				console.log(`✓ ${modelId}: "${result.text.substring(0, 50)}..." (${result.usage.totalTokens} tokens)`);
			}, timeout);
		});
	});

	describe('Structured Output Generation', () => {
		const testStructuredOutput = async (modelId, objectName, systemPrompt, userPrompt, validator) => {
			const { jsonSchema: schemaHelper } = await import('ai');
			
			const snowflakeSchema = provider._createSnowflakeCompatibleSchema(objectName);
			if (!snowflakeSchema) {
				throw new Error(`No schema found for objectName: ${objectName}`);
			}

			const result = await provider.generateObject({
				apiKey,
				baseURL,
				modelId,
				objectName,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt }
				],
				schema: schemaHelper(snowflakeSchema),
				maxTokens: 8192
			});

			expect(result).toBeDefined();
			expect(result.object).toBeDefined();
			expect(typeof result.object).toBe('object');
			
			validator(result.object);

			expect(result.usage).toBeDefined();
			expect(result.usage.inputTokens).toBeGreaterThan(0);
			expect(result.usage.outputTokens).toBeGreaterThan(0);

			return result;
		};

		describe('newTaskData Schema', () => {
			const systemPrompt = 'Generate a task.';
			const userPrompt = 'Create an authentication task';
			const validator = (obj) => {
				expect(obj).toHaveProperty('title');
				expect(obj).toHaveProperty('description');
				expect(obj).toHaveProperty('details');
				expect(obj).toHaveProperty('testStrategy');
				expect(obj).toHaveProperty('dependencies');
				expect(Array.isArray(obj.dependencies)).toBe(true);
			};

			// Test with sample models from each family
			const SAMPLE_MODELS = TEST_CONFIG.specificModel 
				? [TEST_CONFIG.specificModel]
				: ['cortex/claude-haiku-4-5', 'cortex/openai-gpt-5-nano'];

			SAMPLE_MODELS.forEach(modelId => {
				it(`should generate valid newTaskData with ${modelId}`, async () => {
					const result = await testStructuredOutput(modelId, 'newTaskData', systemPrompt, userPrompt, validator);
					console.log(`✓ ${modelId}: newTaskData generated (${result.usage.totalTokens} tokens)`);
				}, 30000);
			});
		});

		describe('subtasks Schema', () => {
			const systemPrompt = 'Create subtasks.';
			const userPrompt = 'Break down auth task into 3 subtasks starting from ID 1';
			const validator = (obj) => {
				expect(obj).toHaveProperty('subtasks');
				expect(Array.isArray(obj.subtasks)).toBe(true);
				expect(obj.subtasks.length).toBeGreaterThan(0);
				
				const subtask = obj.subtasks[0];
				expect(subtask).toHaveProperty('id');
				expect(subtask).toHaveProperty('title');
				expect(subtask).toHaveProperty('description');
				expect(subtask).toHaveProperty('dependencies');
				expect(subtask).toHaveProperty('details');
				expect(subtask).toHaveProperty('status');
			};

			const SAMPLE_MODELS = TEST_CONFIG.specificModel 
				? [TEST_CONFIG.specificModel]
				: ['cortex/claude-sonnet-4-5', 'cortex/openai-gpt-4.1'];

			SAMPLE_MODELS.forEach(modelId => {
				it(`should generate valid subtasks with ${modelId}`, async () => {
					const result = await testStructuredOutput(modelId, 'subtasks', systemPrompt, userPrompt, validator);
					console.log(`✓ ${modelId}: ${result.object.subtasks.length} subtasks generated`);
				}, 30000);
			});
		});

		describe('complexityAnalysis Schema', () => {
			const systemPrompt = 'Analyze task complexity.';
			const userPrompt = 'Analyze: {"id": 1, "title": "Implement Auth", "description": "OAuth 2.0"}';
			const validator = (obj) => {
				expect(obj).toHaveProperty('complexityAnalysis');
				expect(Array.isArray(obj.complexityAnalysis)).toBe(true);
				
				const analysis = obj.complexityAnalysis[0];
				expect(analysis).toHaveProperty('taskId');
				expect(analysis).toHaveProperty('taskTitle');
				expect(analysis).toHaveProperty('complexityScore');
				expect(analysis).toHaveProperty('recommendedSubtasks');
				expect(analysis).toHaveProperty('expansionPrompt');
				expect(analysis).toHaveProperty('reasoning');
			};

			const SAMPLE_MODELS = TEST_CONFIG.specificModel 
				? [TEST_CONFIG.specificModel]
				: ['cortex/claude-haiku-4-5'];

			SAMPLE_MODELS.forEach(modelId => {
				it(`should generate valid complexity analysis with ${modelId}`, async () => {
					const result = await testStructuredOutput(modelId, 'complexityAnalysis', systemPrompt, userPrompt, validator);
					console.log(`✓ ${modelId}: complexity analysis generated`);
				}, 30000);
			});
		});
	});

	describe('Token Limits', () => {
		it('should respect maxTokens parameter', async () => {
			const result = await provider.generateText({
				apiKey,
				baseURL,
				modelId: 'cortex/claude-haiku-4-5',
				messages: [{ role: 'user', content: 'Write a comprehensive essay about AI.' }],
				maxTokens: 8192
			});

			expect(result.usage.outputTokens).toBeLessThanOrEqual(8192);
			console.log(`✓ Token limit respected: ${result.usage.outputTokens}/8192 tokens used`);
		}, 60000);
	});

	describe('Model ID Normalization', () => {
		it('should handle both with and without cortex/ prefix', async () => {
			const withPrefix = await provider.generateText({
				apiKey,
				baseURL,
				modelId: 'cortex/claude-haiku-4-5',
				messages: [{ role: 'user', content: 'Say hello' }],
				maxTokens: 50
			});

			const withoutPrefix = await provider.generateText({
				apiKey,
				baseURL,
				modelId: 'claude-haiku-4-5',
				messages: [{ role: 'user', content: 'Say hello' }],
				maxTokens: 50
			});

			expect(withPrefix.text).toBeDefined();
			expect(withoutPrefix.text).toBeDefined();
			console.log('✓ Model ID normalization works correctly');
		}, 30000);
	});

	describe('Error Handling', () => {
		it('should handle invalid PAT gracefully', async () => {
			await expect(
				provider.generateText({
					apiKey: 'invalid-pat',
					baseURL,
					modelId: 'cortex/claude-haiku-4-5',
					messages: [{ role: 'user', content: 'test' }]
				})
			).rejects.toThrow();
		}, 15000);

		it('should handle invalid baseURL gracefully', async () => {
			await expect(
				provider.generateText({
					apiKey,
					baseURL: 'https://invalid.snowflakecomputing.com/api/v2/cortex/v1',
					modelId: 'cortex/claude-haiku-4-5',
					messages: [{ role: 'user', content: 'test' }]
				})
			).rejects.toThrow();
		}, 15000);

		it('should handle invalid model ID gracefully', async () => {
			await expect(
				provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/invalid-model-name',
					messages: [{ role: 'user', content: 'test' }]
				})
			).rejects.toThrow();
		}, 15000);
	});

	describe('Temperature Handling', () => {
		it('should remove temperature for OpenAI models', async () => {
			const result = await provider.generateText({
				apiKey,
				baseURL,
				modelId: 'cortex/openai-gpt-4.1',
				messages: [{ role: 'user', content: 'Say hello' }],
				temperature: 0.9, // Should be removed internally
				maxTokens: 50
			});

			expect(result.text).toBeDefined();
			console.log('✓ OpenAI model works without temperature parameter');
		}, 30000);

		it('should use temperature for Claude models', async () => {
			const result = await provider.generateText({
				apiKey,
				baseURL,
				modelId: 'cortex/claude-haiku-4-5',
				messages: [{ role: 'user', content: 'Say hello' }],
				temperature: 0.7,
				maxTokens: 50
			});

		expect(result.text).toBeDefined();
		console.log('✓ Claude model works with temperature parameter');
	}, 30000);

	describe('Unlisted Model Support', () => {
		// Note: REST API model names use lowercase and differ from SQL function names
		// SQL: LLAMA3.1-8B (UPPERCASE) vs REST API: llama3.1-8b (lowercase)
		// Source: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#model-availability

		describe('Llama Models (not in config)', () => {
			it('should work with llama3.1-8b', async () => {
				const result = await provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/llama3.1-8b',
					messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
					temperature: 0.7,
					maxTokens: 20
				});

				expect(result).toBeDefined();
				expect(result.text).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				console.log(`✓ llama3.1-8b: "${result.text}" (${result.usage.totalTokens} tokens)`);
			}, 30000);

			it('should work with llama3.1-70b', async () => {
				const result = await provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/llama3.1-70b',
					messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
					temperature: 0.7,
					maxTokens: 20
				});

				expect(result).toBeDefined();
				expect(result.text).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				console.log(`✓ llama3.1-70b: "${result.text}" (${result.usage.totalTokens} tokens)`);
			}, 30000);
		});

		describe('Claude Models (not in config)', () => {
			it('should work with claude-3-5-sonnet', async () => {
				const result = await provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/claude-3-5-sonnet',
					messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
					temperature: 0.7,
					maxTokens: 20
				});

				expect(result).toBeDefined();
				expect(result.text).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				console.log(`✓ claude-3-5-sonnet: "${result.text}" (${result.usage.totalTokens} tokens)`);
			}, 30000);
		});

		describe('Mistral Models (not in config)', () => {
			it('should work with mistral-large', async () => {
				const result = await provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/mistral-large',
					messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
					temperature: 0.7,
					maxTokens: 20
				});

				expect(result).toBeDefined();
				expect(result.text).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				console.log(`✓ mistral-large: "${result.text}" (${result.usage.totalTokens} tokens)`);
			}, 30000);

			it('should work with mistral-7b', async () => {
				const result = await provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/mistral-7b',
					messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
					temperature: 0.7,
					maxTokens: 20
				});

				expect(result).toBeDefined();
				expect(result.text).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				console.log(`✓ mistral-7b: "${result.text}" (${result.usage.totalTokens} tokens)`);
			}, 30000);
		});

		describe('DeepSeek Models (not in config)', () => {
			it('should work with deepseek-r1', async () => {
				const result = await provider.generateText({
					apiKey,
					baseURL,
					modelId: 'cortex/deepseek-r1',
					messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
					temperature: 0.7,
					maxTokens: 20
				});

				expect(result).toBeDefined();
				expect(result.text).toBeDefined();
				expect(result.usage.totalTokens).toBeGreaterThan(0);
				console.log(`✓ deepseek-r1: "${result.text}" (${result.usage.totalTokens} tokens)`);
			}, 30000);
		});

		it('should handle structured outputs with unlisted models', async () => {
			const { jsonSchema: schemaHelper } = await import('ai');
			
			const snowflakeSchema = provider._createSnowflakeCompatibleSchema('newTaskData');
			expect(snowflakeSchema).toBeDefined();

			const result = await provider.generateObject({
				apiKey,
				baseURL,
				modelId: 'cortex/llama3.1-8b',
				objectName: 'newTaskData',
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: 'Create a task to write unit tests for a login function.' }
				],
				schema: schemaHelper(snowflakeSchema),
				maxTokens: 2000
			});

			expect(result).toBeDefined();
			expect(result.object).toBeDefined();
			expect(typeof result.object).toBe('object');
			
			// Validate task structure
			expect(result.object.title).toBeDefined();
			expect(typeof result.object.title).toBe('string');
			expect(result.object.description).toBeDefined();
			expect(result.object.details).toBeDefined();

			console.log(`✓ Unlisted model structured output: "${result.object.title}"`);
		}, 45000);
	});
});
});
