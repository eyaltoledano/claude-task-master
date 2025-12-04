import { beforeAll, afterAll, it, expect, describe } from '@jest/globals';
import { clearAuthCache } from '../../../src/auth/index.js';
import {
	CLAUDE_MODELS,
	skipIfNoCredentials,
	testModelGeneration,
	testModelStructuredOutput
} from './common.js';

/**
 * Claude models tests - both simple text and structured output
 * Per Snowflake docs: https://docs.snowflake.com/en/user-guide/snowflake-cortex/open_ai_sdk
 * 
 * For Claude models:
 * - Uses json_schema format for structured outputs
 * - Supports prompt caching via cache_control
 * - Supports reasoning tokens via reasoning field
 */

skipIfNoCredentials('REST API - Claude Models Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log(`\n=== Claude REST API Tests ===`);
		console.log(`Models: ${CLAUDE_MODELS.length}\n`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	// Test simple text generation
	describe('Claude Models - Simple Text Generation', () => {
		it.concurrent.each([...CLAUDE_MODELS])(
			'%s generates text via REST',
			async (modelId) => {
				const result = await testModelGeneration(modelId, 'rest', 'claude', true);
				expect(result.success).toBe(true);
				expect(result.responseText).toBeDefined();
				expect(result.responseText!.length).toBeGreaterThan(0);
			},
			120000
		);
	});

	// Test structured output - Claude supports json_schema format
	describe('Claude Models - Structured Output', () => {
		it.concurrent.each([...CLAUDE_MODELS])(
			'%s generates structured output via REST',
			async (modelId) => {
				const result = await testModelStructuredOutput(modelId, 'rest', 'claude', true);
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
});

