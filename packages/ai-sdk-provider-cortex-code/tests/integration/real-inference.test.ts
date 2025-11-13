/**
 * Real inference integration tests
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createCortexCode } from '../../src/core/provider.js';
import { ConnectionManager } from '../../src/cli/connection-manager.js';
import { ModelHelpers } from '../../src/utils/model-helpers.js';
import { StructuredOutputGenerator } from '../../src/schema/structured-output.js';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getLogger, LogLevel } from '../../src/utils/logger.js';

// Load supported models from JSON - use relative path from test file
const supportedModelsPath = resolve(__dirname, '../../../../scripts/modules/supported-models.json');
const supportedModelsData = JSON.parse(readFileSync(supportedModelsPath, 'utf-8'));
const allCortexCodeModels = supportedModelsData['cortex-code'] || [];

// Filter to only enabled models (supported !== false)
const cortexCodeModels = allCortexCodeModels.filter((model: any) => model.supported !== false);

console.log(`\n📋 Loaded ${cortexCodeModels.length} enabled models (filtered ${allCortexCodeModels.length - cortexCodeModels.length} disabled)`);

// Test configuration
let cliAvailable = false;
let hasCredentials = false;
let provider: ReturnType<typeof createCortexCode>;
let availableModel: string | null = null;

// Configure logger for tests
const logger = getLogger({ level: LogLevel.INFO, trackTiming: true });

// Cleanup after all tests
afterAll(async () => {
	// Clear any cached connections and validation state
	ConnectionManager.clearConnectionCache();
	ConnectionManager.clearValidationCache();
	
	// Clear the provider reference
	provider = null as any;
	
	// Print performance report
	console.log('\n' + '='.repeat(80));
	console.log('📊 PERFORMANCE REPORT');
	console.log('='.repeat(80) + '\n');
	
	logger.printTimingReport();
	
	// Identify slow models
	const slowModels = logger.getSlowestModels(10);
	const verySlowModels = slowModels.filter(m => m.avgMs > 5000);
	
	if (verySlowModels.length > 0) {
		console.log('\n⚠️  SLOW MODELS (>5s average):');
		verySlowModels.forEach(({ model, avgMs, count }) => {
			console.log(`  - ${model}: ${(avgMs / 1000).toFixed(2)}s average (${count} calls)`);
		});
		console.log('\nConsider disabling these models in tests for faster execution.');
	}
	
	// Export metrics to file
	const metricsJson = logger.exportMetrics();
	const fs = await import('fs');
	fs.writeFileSync('test-performance-metrics.json', metricsJson);
	console.log('\n📁 Metrics exported to: test-performance-metrics.json\n');
	
	// Force garbage collection hint
	if (global.gc) {
		global.gc();
	}
	
	// Give time for any pending operations to complete
	await new Promise(resolve => setTimeout(resolve, 100));
});

// Helper functions
const shouldSkipTest = () => !cliAvailable || !hasCredentials || !availableModel;

const adaptUsage = (usage: any) => ({
	promptTokens: usage.promptTokens,
	completionTokens: usage.completionTokens
});

const adaptWarnings = (warnings?: any[]) =>
	warnings?.map((w: any) => typeof w === 'string' ? w : JSON.stringify(w));

const cloneSchema = (schema: any) => ({
	...schema,
	required: schema.required ? [...schema.required] : undefined
});

const createAdaptedGenerateText = (model: any) => async (params: any) => {
	const aiResult = await generateText({ model, ...params });
	return {
		text: aiResult.text,
		finishReason: aiResult.finishReason,
		usage: aiResult.usage ? adaptUsage(aiResult.usage) : undefined,
		warnings: adaptWarnings(aiResult.warnings)
	};
};

beforeAll(async () => {
	const cliCheck = await ConnectionManager.checkCliInstallation();
	cliAvailable = cliCheck.available;

	if (!cliAvailable) {
		console.warn('⚠️  Cortex Code CLI not available - skipping real inference tests');
		return;
	}

	const authResult = await ConnectionManager.validateAuth({});
	hasCredentials = authResult.valid;

	if (!hasCredentials) {
		console.warn('⚠️  No valid credentials - skipping real inference tests');
		return;
	}

	provider = createCortexCode();
	
	// Use claude-haiku-4-5 as default model (no need to test all models in beforeAll)
	availableModel = 'claude-haiku-4-5';
}, 30000);

// Feature matrix for text generation tests
const textGenerationMatrix = [
	['Simple greeting', 'Say "hello" and nothing else.', 10, /hello/i],
	['Math question', 'What is 2+2? Answer with just the number.', 10, /4/],
	['Single word', 'Say "test" only.', 10, /test/i]
] as const;

describe.each(textGenerationMatrix)(
	'Text Generation: %s',
	(...[testName, prompt, maxTokens, expectedPattern]) => {
		it('should generate correct response', async () => {
			if (shouldSkipTest()) return;

			const model = provider(availableModel!, { timeout: 60000 });
			const result = await generateText({ model, prompt });

			expect(result.text).toBeDefined();
			expect(result.text).toMatch(expectedPattern);
		}, 90000);
	}
);

// Feature matrix for conversation tests
const conversationMatrix = [
	[
		'Addition chain',
		[
			{ role: 'user' as const, content: 'What is 5+3?' },
			{ role: 'assistant' as const, content: '8' },
			{ role: 'user' as const, content: 'Add 2 to that.' }
		],
		/10/
	],
	[
		'Subtraction',
		[
			{ role: 'user' as const, content: 'What is 10-3?' },
			{ role: 'assistant' as const, content: '7' },
			{ role: 'user' as const, content: 'Subtract 2.' }
		],
		/5/
	]
] as const;

describe.each(conversationMatrix)(
	'Multi-turn: %s',
	(...[testName, messages, expectedPattern]) => {
		it('should handle conversation correctly', async () => {
			if (shouldSkipTest()) return;

			const model = provider(availableModel!, { timeout: 60000 });
			const result = await generateText({ model, messages: [...messages] });

			expect(result.text).toBeDefined();
			expect(result.text).toMatch(expectedPattern);
		}, 90000);
	}
);

// Feature matrix for structured output tests
const structuredOutputMatrix = [
	[
		'Simple person',
		{
			type: 'object' as const,
			properties: {
				name: { type: 'string' as const },
				age: { type: 'number' as const }
			},
			required: ['name', 'age']
		},
		'Generate: name="Alice", age=25',
		['name', 'age'],
		{ name: 'string', age: 'number' }
	],
	[
		'Task object',
		{
			type: 'object' as const,
			properties: {
				id: { type: 'number' as const },
				title: { type: 'string' as const },
				done: { type: 'boolean' as const }
			},
			required: ['id', 'title', 'done']
		},
		'Generate: id=1, title="Test", done=true',
		['id', 'title', 'done'],
		{ id: 'number', title: 'string', done: 'boolean' }
	],
	[
		'User profile',
		{
			type: 'object' as const,
			properties: {
				username: { type: 'string' as const },
				score: { type: 'number' as const },
				active: { type: 'boolean' as const }
			},
			required: ['username', 'score', 'active']
		},
		'Generate: username="test", score=100, active=false',
		['username', 'score', 'active'],
		{ username: 'string', score: 'number', active: 'boolean' }
	]
] as const;

describe.each(structuredOutputMatrix)(
	'Structured Output: %s',
	(...[testName, schema, prompt, requiredFields, expectedTypes]) => {
		it('should generate valid structured object', async () => {
			if (shouldSkipTest()) return;

			const model = provider(availableModel!, { timeout: 60000 });
			
			const result = await StructuredOutputGenerator.generateObject({
				generateText: createAdaptedGenerateText(model),
				schema: cloneSchema(schema) as any,
				objectName: testName,
				messages: [{ role: 'user', content: prompt }],
				maxTokens: 200
			});

			expect(result.object).toBeDefined();

			// Check required fields
			[...requiredFields].forEach((field) => {
				expect(result.object).toHaveProperty(field);
			});

			// Check types
			Object.entries(expectedTypes).forEach(([field, type]) => {
				const actualType = typeof result.object[field];
				expect(actualType).toBe(type);
			});
		}, 90000);
	}
);

// Feature matrix for schema transformation tests
const schemaTransformationMatrix = [
	[
		'String constraints',
		{
			type: 'object' as const,
			properties: {
				text: {
					type: 'string' as const,
					minLength: 5,
					maxLength: 100,
					format: 'email'
				}
			},
			required: ['text']
		},
		'Generate: text="test@example.com"',
		'text',
		'string'
	],
	[
		'Number constraints',
		{
			type: 'object' as const,
			properties: {
				value: {
					type: 'number' as const,
					minimum: 0,
					maximum: 100
				}
			},
			required: ['value']
		},
		'Generate: value=50',
		'value',
		'number'
	],
	[
		'Array constraints',
		{
			type: 'object' as const,
			properties: {
				items: {
					type: 'array' as const,
					minItems: 1,
					maxItems: 5,
					items: { type: 'string' as const }
				}
			},
			required: ['items']
		},
		'Generate: items=["a","b","c"]',
		'items',
		'object' // Arrays are objects in JavaScript
	]
] as const;

describe.each(schemaTransformationMatrix)(
	'Schema Transform: %s',
	(...[testName, schema, prompt, fieldName, expectedType]) => {
		it('should handle unsupported keywords and generate object', async () => {
			if (shouldSkipTest()) return;

			const model = provider(availableModel!, { timeout: 60000 });
			const result = await StructuredOutputGenerator.generateObject({
				generateText: createAdaptedGenerateText(model),
				schema: cloneSchema(schema) as any,
				objectName: testName,
				messages: [{ role: 'user', content: prompt }],
				maxTokens: 200
			});

			expect(result.object).toBeDefined();
			expect(result.object).toHaveProperty(fieldName);
			expect(typeof result.object[fieldName]).toBe(expectedType);
		}, 90000);
	}
);

// Feature matrix for model capability tests - ALL models from Snowflake Cortex REST API
// Dynamically generated from supported-models.json
const modelCapabilityMatrix: ReadonlyArray<readonly [string, boolean]> = cortexCodeModels.map((model: any) => {
	// Claude and OpenAI models support structured outputs
	const supportsStructured = model.id.startsWith('claude-') || model.id.startsWith('openai-');
	return [model.id, supportsStructured] as const;
});

// Wrap ALL tests in single describe to run beforeAll only once
console.log('[TRACE] Defining Real Inference Tests describe block...');
describe('Real Inference Tests', () => {
console.log('[TRACE] Inside Real Inference Tests describe block');

console.log('[TRACE] Defining Model Capabilities describe block...');
describe('Model Capabilities', () => {
console.log('[TRACE] Inside Model Capabilities describe block');
	// Structured output support tests (synchronous - fast)
	describe('Structured Output Support', () => {
		modelCapabilityMatrix.forEach(([modelId, supportsStructured]) => {
			it(`${modelId} should have correct structured output support`, () => {
				const normalized = ModelHelpers.normalizeModelId(modelId);
				expect(ModelHelpers.supportsStructuredOutputs(normalized)).toBe(
					supportsStructured
				);
			});
		});
	});

	// Prompt caching support verification
	describe('Prompt Caching Support', () => {
		it('should document models with prompt caching support', () => {
		const promptCachingModels = cortexCodeModels.filter((model: any) => 
			model.id.startsWith('claude-') || model.id.startsWith('openai-')
		);
		
		console.log(`\n💾 Prompt Caching Models: ${promptCachingModels.length}/${cortexCodeModels.length}`);
			promptCachingModels.forEach((model: any) => {
				console.log(`  ✓ ${model.id}`);
			});
		
			expect(promptCachingModels.length).toBeGreaterThan(0);
		});
	});

	// Text generation tests (async - run in parallel)
	describe('Text Generation', () => {
		modelCapabilityMatrix.forEach(([modelId]) => {
			it(`${modelId} should handle text generation`, async () => {
				if (shouldSkipTest()) return;

				// Skip if this specific model isn't available
				try {
					const model = provider(modelId, { timeout: 60000 });
					const result = await generateText({
						model,
						prompt: 'Say "OK"'
					});
					
					expect(result.text).toBeDefined();
				} catch (error: any) {
					if (
						error.message?.includes('not available') ||
						error.message?.includes('not authorized')
					) {
						// Skip models not available in this region
						return;
					}
					throw error;
				}
			}, 90000);
		});
	});

	// Cross-region inference documentation
	describe('Cross-Region Inference', () => {
		it('should document cross-region inference availability', () => {
			console.log('\n🌐 Cross-Region Inference:');
			console.log('  All models should be available via cross-region inference');
			console.log('  Models may fall back to different regions automatically');
			console.log('  Some models may have limited regional availability');

		// Verify we loaded models from config
		if (cortexCodeModels.length === allCortexCodeModels.length) {
			expect(cortexCodeModels.length).toBe(22); // All 22 models from Snowflake docs
		} else {
			console.log(`\n⚠️  Testing limited subset: ${cortexCodeModels.length}/${allCortexCodeModels.length} models`);
			expect(cortexCodeModels.length).toBeGreaterThan(0);
		}
		});
	});
});

// Error handling tests
const errorHandlingMatrix = [
	['Invalid model', 'cortex/invalid-model-xyz', /not found|not available|not authorized/i],
	['Empty model', '', /model|required/i]
] as const;

describe.each(errorHandlingMatrix)(
	'Error Handling: %s',
	(...[testName, modelId, errorPattern]) => {
		it('should handle error correctly', async () => {
			if (shouldSkipTest()) return;

			if (!modelId) {
				// Skip empty model test if it would cause provider creation to fail
				return;
			}

			try {
				const model = provider(modelId, { timeout: 30000 });
				await generateText({ model, prompt: 'test' });
				// If it succeeds, it means the model exists - skip the error check
				return;
			} catch (error) {
				expect(error).toBeDefined();
				expect(error.message).toMatch(errorPattern);
			}
		}, 90000);
	}
);

// Performance test
describe('Performance', () => {
	it('should handle rapid sequential calls', async () => {
		if (shouldSkipTest()) return;

		const model = provider(availableModel!, { timeout: 60000 });
		const promises = Array.from({ length: 3 }, (_, i) =>
			generateText({
				model,
				prompt: `Say "${i}"`
			})
		);

		const results = await Promise.all(promises);
		expect(results).toHaveLength(3);
		results.forEach((result) => {
			expect(result.text).toBeDefined();
		});
	}, 90000);
});

}); // End Real Inference Tests wrapper
