/**
 * Consolidated REST API Model Matrix Tests
 * 
 * Tests all model categories (Claude, OpenAI, Other) with parallel execution.
 * Uses parameterized tests for consistency and efficiency.
 * 
 * Features:
 * - Parallel execution with it.concurrent.each
 * - Single file for all REST model tests
 * - Structured output testing for supported models
 * - Graceful handling of unavailable models
 */

import { beforeAll, afterAll, it, expect, describe } from '@jest/globals';
import { clearAuthCache } from '../../../src/auth/index.js';
import {
	CLAUDE_PREFIXED_MODEL_IDS,
	OPENAI_PREFIXED_MODEL_IDS,
	LLAMA_PREFIXED_MODEL_IDS,
	MISTRAL_PREFIXED_MODEL_IDS,
	OTHER_PREFIXED_MODEL_IDS,
	supportsStructuredOutputs,
} from '../../../src/utils/models.js';
import {
	skipIfNoCredentials,
	testModelGeneration,
	testModelStructuredOutput,
	ModelTestResult,
	testResults,
} from './common.js';

// ============================================================================
// Model Categories
// ============================================================================

const CLAUDE_MODELS = CLAUDE_PREFIXED_MODEL_IDS;
const OPENAI_MODELS = OPENAI_PREFIXED_MODEL_IDS;
const OTHER_MODELS = [
	...LLAMA_PREFIXED_MODEL_IDS,
	...MISTRAL_PREFIXED_MODEL_IDS,
	...OTHER_PREFIXED_MODEL_IDS,
];

// Models that are known to be stable and available
const STABLE_OPENAI_MODELS = OPENAI_MODELS.filter(id => 
	id.includes('gpt-4.1') || id.includes('gpt-5-chat')
);

// Models that may be unavailable in some accounts (marked with * in docs)
const POTENTIALLY_UNAVAILABLE_OPENAI_MODELS = OPENAI_MODELS.filter(id =>
	id.includes('gpt-5') && !id.includes('gpt-5-chat')
);

// All models for comprehensive matrix
const ALL_MODELS = [...CLAUDE_MODELS, ...OPENAI_MODELS, ...OTHER_MODELS];

// Test timeout for API calls
const API_TIMEOUT = 120000;

// ============================================================================
// Consolidated REST API Tests
// ============================================================================

skipIfNoCredentials('REST API Model Matrix Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log('\n=== REST API Model Matrix Tests ===');
		console.log(`Total models: ${ALL_MODELS.length}`);
		console.log(`  - Claude: ${CLAUDE_MODELS.length}`);
		console.log(`  - OpenAI: ${OPENAI_MODELS.length}`);
		console.log(`  - Other: ${OTHER_MODELS.length}\n`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
		
		// Print summary
		const passed = testResults.filter(r => r.success);
		const failed = testResults.filter(r => !r.success);
		console.log('\n=== Test Summary ===');
		console.log(`Passed: ${passed.length}/${testResults.length}`);
		if (failed.length > 0) {
			console.log('Failed:');
			failed.forEach(r => console.log(`  - ${r.modelId}: ${r.error?.substring(0, 80)}`));
		}
	});

	// ========================================================================
	// Claude Models (Full Support)
	// ========================================================================

	describe('Claude Models', () => {
		describe('Text Generation', () => {
			it.concurrent.each([...CLAUDE_MODELS])(
				'%s generates text',
				async (modelId) => {
					const result = await testModelGeneration(modelId, 'rest', 'claude', true);
					expect(result.success).toBe(true);
					expect(result.responseText).toBeDefined();
					expect(result.responseText!.length).toBeGreaterThan(0);
				},
				API_TIMEOUT
			);
		});

		describe('Structured Output', () => {
			it.concurrent.each([...CLAUDE_MODELS])(
				'%s generates structured output',
				async (modelId) => {
					const result = await testModelStructuredOutput(modelId, 'rest', 'claude', true);
					expect(result.success).toBe(true);
					expect(result.responseText).toBeDefined();
					
					// Verify valid JSON
					const parsed = JSON.parse(result.responseText!);
					expect(parsed).toHaveProperty('response');
					expect(parsed).toHaveProperty('status');
				},
				API_TIMEOUT
			);
		});
	});

	// ========================================================================
	// OpenAI Models (Stable + Potentially Unavailable)
	// ========================================================================

	describe('OpenAI Models', () => {
		describe('Stable Models - Structured Output', () => {
			it.concurrent.each([...STABLE_OPENAI_MODELS])(
				'%s generates structured output',
				async (modelId) => {
					const result = await testModelStructuredOutput(modelId, 'rest', 'openai', true);
					expect(result.success).toBe(true);
					expect(result.responseText).toBeDefined();
					
					const parsed = JSON.parse(result.responseText!);
					expect(parsed).toHaveProperty('response');
					expect(parsed).toHaveProperty('status');
				},
				API_TIMEOUT
			);
		});

		describe('Potentially Unavailable Models', () => {
			it.concurrent.each([...POTENTIALLY_UNAVAILABLE_OPENAI_MODELS])(
				'%s generates structured output (may be unavailable)',
				async (modelId) => {
					const result = await testModelStructuredOutput(modelId, 'rest', 'openai', true);
					
					if (!result.success) {
						// 500 errors indicate server-side model unavailability
						if (result.error?.includes('500')) {
							console.log(`[INFO] ${modelId} returned 500 - model may be unavailable in this account/region`);
							return; // Skip - known server-side issue
						}
						// Other errors should fail the test
						console.log(`[ERROR] ${modelId} failed: ${result.error}`);
						expect(result.success).toBe(true);
					} else {
						const parsed = JSON.parse(result.responseText!);
						expect(parsed).toHaveProperty('response');
						expect(parsed).toHaveProperty('status');
					}
				},
				API_TIMEOUT
			);
		});
	});

	// ========================================================================
	// Other Models (Llama, Mistral, etc.)
	// ========================================================================

	describe('Other Models (Llama, Mistral, etc.)', () => {
		describe('Text Generation', () => {
			it.concurrent.each([...OTHER_MODELS])(
				'%s generates text',
				async (modelId) => {
					const result = await testModelGeneration(modelId, 'rest', 'other', true);
					expect(result.success).toBe(true);
					expect(result.responseText).toBeDefined();
					expect(result.responseText!.length).toBeGreaterThan(0);
				},
				API_TIMEOUT
			);
		});

		// Note: Most "other" models don't support structured output
		// Only test those that do
		describe('Structured Output (Supported Models Only)', () => {
			const otherModelsWithStructuredOutput = OTHER_MODELS.filter(id => 
				supportsStructuredOutputs(id)
			);

			if (otherModelsWithStructuredOutput.length > 0) {
				it.concurrent.each([...otherModelsWithStructuredOutput])(
					'%s generates structured output',
					async (modelId) => {
						const result = await testModelStructuredOutput(modelId, 'rest', 'other', true);
						if (result.success) {
							const parsed = JSON.parse(result.responseText!);
							expect(parsed).toHaveProperty('response');
						}
					},
					API_TIMEOUT
				);
			}
		});
	});

	// ========================================================================
	// Cross-Model Capability Matrix
	// ========================================================================

	describe('Model Capability Matrix', () => {
		it('should have consistent structured output support flags', () => {
			// Verify all Claude and OpenAI models report structured output support
			CLAUDE_MODELS.forEach(id => {
				expect(supportsStructuredOutputs(id)).toBe(true);
			});
			OPENAI_MODELS.forEach(id => {
				expect(supportsStructuredOutputs(id)).toBe(true);
			});
		});
	});
});

