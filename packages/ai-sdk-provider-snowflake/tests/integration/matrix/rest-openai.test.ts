import { beforeAll, afterAll, it, expect, describe } from '@jest/globals';
import { clearAuthCache } from '../../../src/auth/index.js';
import { OPENAI_PREFIXED_MODEL_IDS } from '../../../src/utils/models.js';
import {
	skipIfNoCredentials,
	testModelGeneration,
	testModelStructuredOutput
} from './common.js';

/**
 * OpenAI models tests - both simple text and structured output
 * Per Snowflake docs: https://docs.snowflake.com/en/user-guide/snowflake-cortex/open_ai_sdk
 * 
 * For OpenAI (GPT) models with structured output:
 * - Uses OpenAI-compatible format: { type: 'json_schema', json_schema: { name, schema, strict } }
 * - additionalProperties field must be set to false in every node of the schema
 * - The required field must be included and contain the names of every property
 * 
 * Note: Some GPT-5 models (marked with * in docs) may not be available in all accounts/regions
 * and will return 500 errors. These are gracefully handled as "model unavailable".
 */

// Models that are known to be stable and available
const STABLE_OPENAI_MODELS = OPENAI_PREFIXED_MODEL_IDS.filter(id => 
	id.includes('gpt-4.1') || id.includes('gpt-5-chat')
);

// Models that may be unavailable in some accounts (marked with * in docs)
const POTENTIALLY_UNAVAILABLE_MODELS = OPENAI_PREFIXED_MODEL_IDS.filter(id =>
	id.includes('gpt-5') && !id.includes('gpt-5-chat')
);

skipIfNoCredentials('REST API - OpenAI Models Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log(`\n=== OpenAI REST API Tests ===`);
		console.log(`Stable models: ${STABLE_OPENAI_MODELS.length}`);
		console.log(`Potentially unavailable models: ${POTENTIALLY_UNAVAILABLE_MODELS.length}\n`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	// Test stable models - these should always pass
	describe('Stable OpenAI Models - Structured Output', () => {
		it.concurrent.each([...STABLE_OPENAI_MODELS])(
			'%s generates structured output via REST',
			async (modelId) => {
				const result = await testModelStructuredOutput(modelId, 'rest', 'openai', true);
				expect(result.success).toBe(true);
				expect(result.responseText).toBeDefined();
				expect(result.responseText!.length).toBeGreaterThan(0);
				
				// Verify it's valid JSON
				const parsed = JSON.parse(result.responseText!);
				expect(parsed).toHaveProperty('response');
				expect(parsed).toHaveProperty('status');
			},
			120000
		);
	});

	// Test potentially unavailable models - gracefully handle 500 errors
	describe('Potentially Unavailable OpenAI Models', () => {
		it.concurrent.each([...POTENTIALLY_UNAVAILABLE_MODELS])(
			'%s generates structured output via REST (may be unavailable)',
			async (modelId) => {
				const result = await testModelStructuredOutput(modelId, 'rest', 'openai', true);
				
				if (!result.success) {
					// Check if it's a 500 error (server-side model unavailability)
					if (result.error?.includes('500')) {
						console.log(`[INFO] ${modelId} returned 500 - model may be unavailable in this account/region`);
						// Skip assertion - this is a known server-side issue
						return;
					}
					// Other errors should still fail the test
					console.log(`[ERROR] ${modelId} failed with unexpected error: ${result.error}`);
					expect(result.success).toBe(true); // Force failure for non-500 errors
				} else {
					// Model worked! Verify the response
					expect(result.responseText).toBeDefined();
					const parsed = JSON.parse(result.responseText!);
					expect(parsed).toHaveProperty('response');
					expect(parsed).toHaveProperty('status');
				}
			},
			120000
		);
	});
});
