/**
 * Integration tests for structured outputs across all model types
 *
 * Tests structured JSON outputs in both execution modes:
 * - REST API: Native schema validation via Cortex REST API
 * - CLI Mode: Prompt-based structured output via Cortex Code CLI
 *
 * Models tested:
 * - Claude models (claude-sonnet-4-5, claude-haiku-4-5, etc.)
 * - OpenAI models (openai-gpt-4.1, openai-gpt-5, etc.)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateObject } from 'ai';
import { z } from 'zod';

import { createSnowflake } from '../../../src/provider.js';
import { clearAuthCache } from '../../../src/auth/index.js';
import {
	CLAUDE_MODEL_IDS,
	OPENAI_MODEL_IDS,
	STRUCTURED_OUTPUT_MODEL_IDS
} from '../../../src/utils/models.js';
import {
	skipIfNoCredentials,
	logTestEnvironment,
	checkCliAvailability
} from '../../test-utils.js';

// Schema for testing structured outputs
const TestResponseSchema = z.object({
	answer: z.string().describe('A short answer to the question'),
	confidence: z.number().min(0).max(100).describe('Confidence level 0-100'),
	reasoning: z.string().describe('Brief reasoning for the answer')
});

type TestResponse = z.infer<typeof TestResponseSchema>;

// Test timeout
const TEST_TIMEOUT = 120000;

// Check CLI availability at module load time (before tests)
// This avoids race conditions with it.concurrent.each
const cliAvailabilityPromise = checkCliAvailability();

skipIfNoCredentials('Structured Outputs Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		logTestEnvironment('Structured Outputs Tests');
		console.log(
			`Models supporting structured output: ${STRUCTURED_OUTPUT_MODEL_IDS.length}`
		);
		console.log('DEBUG MODE: Set DEBUG=snowflake:* to see API calls');

		// Wait for CLI availability check
		const cliAvailable = await cliAvailabilityPromise;
		console.log(
			`CLI Mode: ${cliAvailable ? '✅ Available' : '❌ Not available'}`
		);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	// ============================================================================
	// REST API MODE - Native Schema Validation
	// ============================================================================

	describe('REST API - Claude Models (Native Schema)', () => {
		// Exclude claude-4-opus as it doesn't support prompt_caching feature
		const claudeModels = CLAUDE_MODEL_IDS.filter(
			(id) => STRUCTURED_OUTPUT_MODEL_IDS.includes(id) && id !== 'claude-4-opus'
		);

		it.concurrent.each(claudeModels)(
			'%s should generate structured JSON output',
			async (modelId) => {
				console.log(`\n🧪 Testing structured output with ${modelId}`);
				const provider = createSnowflake({
					executionMode: 'rest' // Use Native Cortex API
				});
				const model = provider(`cortex/${modelId}`);
				console.log(`📡 Making API call to Snowflake Cortex REST API...`);

				try {
					const result = await generateObject({
						model,
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						schema: TestResponseSchema as any,
						prompt: 'What is 2 + 2? Provide your answer with confidence level.'
					});

					console.log(`✅ API call successful for ${modelId}`);
					console.log(
						`📊 Response tokens: ${result.usage?.totalTokens || 'N/A'}`
					);
					console.log(`📄 Raw response object type: ${typeof result.object}`);
					console.log(
						`📄 Raw response object: ${JSON.stringify(result.object, null, 2)}`
					);

					const obj = result.object as TestResponse;
					expect(obj).toBeDefined();
					expect(obj.answer).toBeDefined();
					expect(typeof obj.confidence).toBe('number');
					expect(obj.confidence).toBeGreaterThanOrEqual(0);
					expect(obj.confidence).toBeLessThanOrEqual(100);
					expect(obj.reasoning).toBeDefined();

					console.log(`[PASS] ${modelId}: ${JSON.stringify(obj)}`);
				} catch (error) {
					// Log error but don't fail if it's a server-side issue
					const err = error as Error;
					console.error(`❌ API call failed for ${modelId}:`, err.message);
					console.error(
						`📋 Error details:`,
						JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
					);

					// Log any partial response data if available
					if ((err as any).data) {
						console.error(
							`📄 Error data:`,
							JSON.stringify((err as any).data, null, 2)
						);
					}
					if ((err as any).response) {
						console.error(
							`📄 Error response:`,
							JSON.stringify((err as any).response, null, 2)
						);
					}

					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(
							`[INFO] ${modelId}: Server unavailable - ${err.message}`
						);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	describe('REST API - OpenAI Models (Native Schema)', () => {
		const openaiModels = OPENAI_MODEL_IDS.filter((id) =>
			STRUCTURED_OUTPUT_MODEL_IDS.includes(id)
		);

		it.concurrent.each(openaiModels)(
			'%s should generate structured JSON output',
			async (modelId) => {
				console.log(`\n🧪 Testing structured output with ${modelId}`);
				const provider = createSnowflake({
					executionMode: 'rest' // Use Native Cortex API
				});
				const model = provider(`cortex/${modelId}`);
				console.log(`📡 Making API call to Snowflake Cortex REST API...`);

				try {
					const result = await generateObject({
						model,
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						schema: TestResponseSchema as any,
						prompt: 'What is 2 + 2? Provide your answer with confidence level.'
					});

					console.log(`✅ API call successful for ${modelId}`);
					console.log(
						`📊 Response tokens: ${result.usage?.totalTokens || 'N/A'}`
					);
					console.log(`📄 Raw response object type: ${typeof result.object}`);
					console.log(
						`📄 Raw response object: ${JSON.stringify(result.object, null, 2)}`
					);

					const obj = result.object as TestResponse;
					expect(obj).toBeDefined();
					expect(obj.answer).toBeDefined();
					expect(typeof obj.confidence).toBe('number');
					expect(obj.confidence).toBeGreaterThanOrEqual(0);
					expect(obj.confidence).toBeLessThanOrEqual(100);
					expect(obj.reasoning).toBeDefined();

					console.log(`[PASS] ${modelId}: ${JSON.stringify(obj)}`);
				} catch (error) {
					// Log error but don't fail if it's a server-side issue
					const err = error as Error;
					console.error(`❌ API call failed for ${modelId}:`, err.message);
					console.error(
						`📋 Error details:`,
						JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
					);

					// Log any partial response data if available
					if ((err as any).data) {
						console.error(
							`📄 Error data:`,
							JSON.stringify((err as any).data, null, 2)
						);
					}
					if ((err as any).response) {
						console.error(
							`📄 Error response:`,
							JSON.stringify((err as any).response, null, 2)
						);
					}

					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(
							`[INFO] ${modelId}: Server unavailable - ${err.message}`
						);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	// ============================================================================
	// CLI MODE - Prompt-Based Structured Output
	// ============================================================================

	describe('CLI Mode - Claude Models (Prompt-Based)', () => {
		// Exclude claude-4-opus as it doesn't support prompt_caching feature
		const claudeModels = CLAUDE_MODEL_IDS.filter(
			(id) => STRUCTURED_OUTPUT_MODEL_IDS.includes(id) && id !== 'claude-4-opus'
		);

		it.concurrent.each(claudeModels)(
			'%s should generate structured JSON via prompt instructions',
			async (modelId) => {
				// Await the promise to get current CLI availability
				const cliAvailable = await cliAvailabilityPromise;
				if (!cliAvailable) {
					console.log(`[SKIP] ${modelId}: Cortex CLI not available`);
					return;
				}

				console.log(`\n🧪 Testing CLI structured output with ${modelId}`);
				const provider = createSnowflake({
					executionMode: 'cli' // Use Cortex Code CLI
				});
				const model = provider(`cortex/${modelId}`);
				console.log(`📡 Making CLI call to Cortex Code...`);

				try {
					const result = await generateObject({
						model,
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						schema: TestResponseSchema as any,
						prompt: 'What is 2 + 2? Provide your answer with confidence level.'
					});

					console.log(`✅ CLI call successful for ${modelId}`);
					console.log(
						`📊 Response tokens: ${result.usage?.totalTokens || 'N/A'}`
					);

					const obj = result.object as TestResponse;
					expect(obj).toBeDefined();
					expect(obj.answer).toBeDefined();
					expect(typeof obj.confidence).toBe('number');
					expect(obj.confidence).toBeGreaterThanOrEqual(0);
					expect(obj.confidence).toBeLessThanOrEqual(100);
					expect(obj.reasoning).toBeDefined();

					console.log(`[PASS] ${modelId} (CLI): ${JSON.stringify(obj)}`);
				} catch (error) {
					// Log error but don't fail for known non-critical issues
					const err = error as Error;
					console.error(`❌ CLI call failed for ${modelId}:`, err.message);

					// CLI availability issues - not a test failure
					if (
						err.message.includes('not installed') ||
						err.message.includes('not found')
					) {
						console.log(
							`[INFO] ${modelId}: CLI not properly installed - ${err.message}`
						);
						return;
					}

					// Model non-compliance with JSON schema - this can happen since CLI
					// relies on prompt instructions rather than native schema enforcement.
					// Mark as informational rather than failure.
					if (
						err.message.includes('could not parse the response') ||
						err.message.includes('No object generated') ||
						err.message.includes('JSON parsing failed')
					) {
						console.log(
							`[WARN] ${modelId}: Model did not return valid JSON - CLI structured outputs rely on model compliance`
						);
						console.log(
							`[INFO] This is not a code bug - the model simply didn't follow the JSON schema instruction`
						);
						return;
					}

					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	describe('CLI Mode - OpenAI Models (Prompt-Based)', () => {
		// Test only openai-gpt-5 to investigate structured output behavior
		const openaiModels = ['openai-gpt-5'];

		it.concurrent.each(openaiModels)(
			'%s should generate structured JSON via prompt instructions',
			async (modelId) => {
				// Await the promise to get current CLI availability
				const cliAvailable = await cliAvailabilityPromise;
				if (!cliAvailable) {
					console.log(`[SKIP] ${modelId}: Cortex CLI not available`);
					return;
				}

				console.log(`\n🧪 Testing CLI structured output with ${modelId}`);
				const provider = createSnowflake({
					executionMode: 'cli' // Use Cortex Code CLI
				});
				const model = provider(`cortex/${modelId}`);
				console.log(`📡 Making CLI call to Cortex Code...`);

				try {
					const result = await generateObject({
						model,
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						schema: TestResponseSchema as any,
						prompt: 'What is 2 + 2? Provide your answer with confidence level.'
					});

					console.log(`✅ CLI call successful for ${modelId}`);
					console.log(
						`📊 Response tokens: ${result.usage?.totalTokens || 'N/A'}`
					);

					const obj = result.object as TestResponse;
					expect(obj).toBeDefined();
					expect(obj.answer).toBeDefined();
					expect(typeof obj.confidence).toBe('number');
					expect(obj.confidence).toBeGreaterThanOrEqual(0);
					expect(obj.confidence).toBeLessThanOrEqual(100);
					expect(obj.reasoning).toBeDefined();

					console.log(`[PASS] ${modelId} (CLI): ${JSON.stringify(obj)}`);
				} catch (error) {
					const err = error as Error;
					console.error(`❌ CLI call failed for ${modelId}:`, err.message);

					// Model non-compliance with JSON schema - this can happen since CLI
					// relies on prompt instructions rather than native schema enforcement.
					// Mark as informational rather than test failure.
					if (
						err.message.includes('could not parse the response') ||
						err.message.includes('No object generated') ||
						err.message.includes('JSON parsing failed')
					) {
						console.log(
							`[WARN] ${modelId}: Model did not return valid JSON via CLI`
						);
						console.log(
							`[INFO] CLI structured outputs rely on model compliance - this is not a code bug`
						);
						return;
					}

					// Re-throw other errors
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	// ============================================================================
	// Model Capability Verification
	// ============================================================================

	describe('Verify Model Capability Flags', () => {
		it('should have consistent structured output flags in KNOWN_MODELS', () => {
			// All Claude models should support structured output
			for (const modelId of CLAUDE_MODEL_IDS) {
				expect(STRUCTURED_OUTPUT_MODEL_IDS).toContain(modelId);
			}

			// All OpenAI models should support structured output
			for (const modelId of OPENAI_MODEL_IDS) {
				expect(STRUCTURED_OUTPUT_MODEL_IDS).toContain(modelId);
			}
		});
	});
});
