/**
 * Integration tests for class interactions - PARALLEL FEATURE MATRIX
 * No real API calls - just class integration
 */

import { describe, it, expect } from '@jest/globals';
import { createCortexCode } from '../../src/core/provider.js';
import { ConnectionManager } from '../../src/cli/connection-manager.js';
import { ModelHelpers } from '../../src/utils/model-helpers.js';
import { StructuredOutputGenerator } from '../../src/schema/structured-output.js';

// Provider creation matrix - runs in parallel
const providerCreationMatrix = [
	['Default settings', {}],
	['Custom timeout', { defaultSettings: { timeout: 120000 } }],
	['Custom connection', { defaultSettings: { connection: 'test' } }]
] as const;

describe.each(providerCreationMatrix)(
	'Provider Creation: %s',
	(...args) => {
		const [testName, settings] = args;
		it('should create provider', () => {
			const provider = createCortexCode(settings);
			expect(provider).toBeDefined();
			expect(typeof provider).toBe('function');
		});
	}
);

// Model creation matrix - runs in parallel
const modelCreationMatrix = [
	['llama3-70b', 'cortex/llama3-70b'],
	['claude-sonnet-4-5', 'cortex/claude-sonnet-4-5'],
	['mistral-large2', 'cortex/mistral-large2']
] as const;

describe.each(modelCreationMatrix)('Model Creation: %s', (...args) => {
	const [modelId, fullModelId] = args;
	it('should create language model', () => {
		const provider = createCortexCode();
		const model = provider(fullModelId);

		expect(model).toBeDefined();
		expect(model.provider).toBe('cortex-code');
		expect(model.modelId).toBe(fullModelId);
	});
});

// Model capability flow matrix - runs in parallel
const capabilityFlowMatrix = [
	['claude-sonnet-4-5', true, true, true],
	['openai-gpt-5', true, true, false],
	['mistral-large2', false, true, true],
	['llama3-70b', false, true, true]
] as const;

describe.each(capabilityFlowMatrix)(
	'Capability Flow: %s',
	(...args) => {
		const [rawModelId, supportsStructured, supportsTemp, supportsTempStructured] = args;
		it('should have correct capabilities', () => {
			const normalized = ModelHelpers.normalizeModelId(`cortex/${rawModelId}`);

			expect(ModelHelpers.supportsStructuredOutputs(normalized)).toBe(supportsStructured);
			expect(ModelHelpers.supportsTemperature(normalized, false)).toBe(supportsTemp);
			expect(ModelHelpers.supportsTemperature(normalized, true)).toBe(
				supportsTempStructured
			);
		});
	}
);

// Connection validation flow
describe('Connection Validation', () => {
	it('should skip in test env', async () => {
		const result = await ConnectionManager.validateAuth();
		expect(result.valid).toBe(true);
	});

	it('should validate connection structure', () => {
		const connection = { account: 'test', user: 'user', password: 'pass' };
		expect(() => ConnectionManager.validateConnection(connection)).not.toThrow();
	});

	it('should provide setup instructions', () => {
		const instructions = ConnectionManager.getSetupInstructions();
		expect(instructions).toContain('cortex --version');
	});
});

// Structured output preparation matrix - runs in parallel
const outputPrepMatrix = [
	[
		'Simple',
		{ type: 'object' as const, properties: { name: { type: 'string' as const } } },
		'Person'
	],
	[
		'Complex',
		{
			type: 'object' as const,
			properties: {
				user: {
					type: 'object' as const,
					properties: { id: { type: 'number' as const } }
				}
			}
		},
		'UserWrapper'
	]
] as const;

describe.each(outputPrepMatrix)(
	'Structured Output Prep: %s',
	(...args) => {
		const [testName, schema, objectName] = args;
		it('should prepare messages', () => {
			const messages = StructuredOutputGenerator.prepareMessages({
				schema,
				objectName,
				messages: [{ role: 'user', content: 'Test' }]
			});

			expect(messages.length).toBeGreaterThan(0);
			expect(messages[0].role).toBe('system');
			expect(messages[0].content).toContain(objectName);
		});
	}
);

// JSON extraction flow matrix - runs in parallel
const jsonExtractionFlowMatrix = [
	['{"name": "John"}', { name: 'John' }],
	['Response: {"age": 30}', { age: 30 }],
	['```json\n{"id": 1}\n```', { id: 1 }]
] as const;

describe.each(jsonExtractionFlowMatrix)(
	'JSON Extraction: %s',
	(...args) => {
		const [response, expected] = args;
		it('should extract and parse', () => {
			const parsed = StructuredOutputGenerator.extractAndParse(response);
			expect(parsed).toEqual(expected);
		});
	}
);

// End-to-end integration flow
describe('E2E Integration Flow', () => {
	it('should support complete workflow', () => {
		const modelId = 'cortex/claude-sonnet-4-5';
		const normalized = ModelHelpers.normalizeModelId(modelId);

		// Check capabilities
		const supportsStructured = ModelHelpers.supportsStructuredOutputs(normalized);
		expect(supportsStructured).toBe(true);

		// Prepare structured output
		if (supportsStructured) {
			const schema = {
				type: 'object' as const,
				properties: { result: { type: 'string' as const } }
			};

			const messages = StructuredOutputGenerator.prepareMessages({
				schema,
				objectName: 'Response',
				messages: [{ role: 'user', content: 'Test' }]
			});

			expect(messages[0].role).toBe('system');
			expect(messages[0].content).toContain('Response');
		}
	});
});

// Backward compatibility test
describe('Backward Compatibility', () => {
	it('should support function APIs', async () => {
		const result = await ConnectionManager.validateAuth({ skipValidation: true });
		expect(result.valid).toBe(true);

		expect(typeof ConnectionManager.validateAuth).toBe('function');
		expect(typeof StructuredOutputGenerator.generateObject).toBe('function');
		expect(typeof ModelHelpers.normalizeModelId).toBe('function');
	});
});

// Error handling tests
describe('Error Handling', () => {
	it('should throw for invalid connection', () => {
		expect(() =>
			ConnectionManager.validateConnection({ account: '', user: '', password: '' } as any)
		).toThrow(/Missing required fields/);
	});

	it('should reject for missing schema', async () => {
		await expect(
			StructuredOutputGenerator.generateObject({
				generateText: jest.fn() as any,
				schema: null as any,
				objectName: 'Test',
				messages: []
			})
		).rejects.toThrow(/Schema is required/);
	});
});

// Performance matrix - runs in parallel
const performanceMatrix = [
	['Schema transformation', 100],
	['Model normalization', 1000]
] as const;

describe.each(performanceMatrix)('Performance: %s', (...args) => {
	const [testName, iterations] = args;
	it('should be fast with caching', () => {
		const start = performance.now();

		if (testName === 'Schema transformation') {
			const schema = {
				type: 'object' as const,
				properties: { field: { type: 'string' as const, minLength: 5 } }
			};
			for (let i = 0; i < iterations; i++) {
				StructuredOutputGenerator.prepareMessages({
					schema,
					objectName: 'Test',
					messages: []
				});
			}
		} else {
			for (let i = 0; i < iterations; i++) {
				ModelHelpers.normalizeModelId('cortex/CLAUDE-SONNET-4-5');
			}
		}

		const duration = performance.now() - start;
		const threshold = testName === 'Schema transformation' ? 100 : 10;
		expect(duration).toBeLessThan(threshold);
	});
});
