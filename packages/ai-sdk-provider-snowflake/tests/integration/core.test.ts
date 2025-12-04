/**
 * Core Integration Tests for Snowflake Provider
 *
 * Tests essential provider functionality with real Snowflake API calls.
 * For comprehensive model testing, see matrix/rest.test.ts
 * For feature-specific tests, see features/*.test.ts
 *
 * Environment setup:
 * - Set SNOWFLAKE_API_KEY with SNOWFLAKE_ACCOUNT (URL derived automatically), OR
 * - Set SNOWFLAKE_API_KEY with SNOWFLAKE_BASE_URL (explicit URL), OR
 * - Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, and either:
 *   - SNOWFLAKE_PRIVATE_KEY_PATH (key pair auth)
 *   - SNOWFLAKE_PASSWORD (password auth)
 *   - Configure ~/.snowflake/connections.toml
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateText, generateObject, streamText } from 'ai';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
	createSnowflake,
	snowflake,
	getAvailableModels
} from '../../src/index.js';
import { authenticate, clearAuthCache } from '../../src/auth/index.js';
import type { SnowflakeProviderSettings } from '../../src/types.js';
import {
	skipIfNoCredentials,
	getCredentialInfo,
	logTestEnvironment
} from '../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

// Log credential status
console.log(getCredentialInfo());

// Test model
const TEST_MODEL = 'cortex/claude-haiku-4-5';
const API_TIMEOUT = 60000;

skipIfNoCredentials('Core Integration Tests', () => {
	beforeAll(() => {
		clearAuthCache();
		logTestEnvironment('Core Integration Tests');
	});

	afterAll(() => {
		clearAuthCache();
	});

	// ========================================================================
	// Authentication Tests
	// ========================================================================

	describe('Authentication', () => {
		it('should authenticate successfully with available credentials', async () => {
			const result = await authenticate({});
			expect(result).toBeDefined();
			expect(result.accessToken).toBeDefined();
			expect(result.baseURL).toBeDefined();
			expect(result.baseURL).toContain('snowflakecomputing.com');
		});

		it('should cache tokens and reuse them', async () => {
			const result1 = await authenticate({});
			const result2 = await authenticate({});
			// Should return the same cached token
			expect(result1.accessToken).toBe(result2.accessToken);
		});

		it('should authenticate with specific connection name if configured', async () => {
			const connectionName = process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
			if (!connectionName) {
				console.log('Skipping: SNOWFLAKE_DEFAULT_CONNECTION_NAME not set');
				return;
			}
			const result = await authenticate({ connection: connectionName });
			expect(result.accessToken).toBeDefined();
		});
	});

	// ========================================================================
	// REST API Mode - Basic Operations
	// ========================================================================

	describe('REST API Mode', () => {
		const restSettings: SnowflakeProviderSettings = { executionMode: 'rest' };

		it.concurrent(
			'should generate text using REST API',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					prompt: 'Say "Hello from Snowflake Cortex" exactly',
					maxTokens: 50
				});

				expect(result.text).toBeDefined();
				expect(result.text.length).toBeGreaterThan(0);
				expect(result.usage?.totalTokens).toBeGreaterThan(0);
			},
			API_TIMEOUT
		);

		it.concurrent(
			'should generate structured output',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const PersonSchema = z.object({
					name: z.string().describe('The name'),
					age: z.number().describe('The age')
				});

				const result = await generateObject({
					model,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					schema: PersonSchema as any,
					prompt: 'Generate: name="Alice", age=30'
				});

				expect(result.object).toBeDefined();
				expect(result.object).toHaveProperty('name');
				expect(result.object).toHaveProperty('age');
			},
			API_TIMEOUT
		);

		it.concurrent(
			'should handle system messages',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					system:
						'You are a helpful assistant. Always respond with exactly one word.',
					prompt: 'What color is the sky?',
					maxTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// CLI Mode
	// ========================================================================

	describe('CLI Mode', () => {
		const cliSettings: SnowflakeProviderSettings = { executionMode: 'cli' };

		it(
			'should fail gracefully if CLI not installed',
			async () => {
				const provider = createSnowflake(cliSettings);
				const model = provider(TEST_MODEL);

				try {
					await generateText({
						model,
						prompt: 'Say hello',
						maxTokens: 20
					});
					// If we get here, CLI is installed and working
					expect(true).toBe(true);
				} catch (error: any) {
					// Expected if CLI is not installed
					expect(
						error.message.includes('not installed') ||
							error.message.includes('not found') ||
							error.message.includes('CLI') ||
							error.message.includes('ENOENT')
					).toBe(true);
				}
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Auto Mode
	// ========================================================================

	describe('Auto Mode', () => {
		it.concurrent(
			'should automatically select execution mode',
			async () => {
				const provider = createSnowflake({ executionMode: 'auto' });
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					prompt: 'Say "auto mode works"',
					maxTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Default Provider Instance
	// ========================================================================

	describe('Default Provider Instance', () => {
		it.concurrent(
			'should work with the default snowflake instance',
			async () => {
				const model = snowflake(TEST_MODEL);

				const result = await generateText({
					model,
					prompt: 'Say "default instance works"',
					maxTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Model ID Variations
	// ========================================================================

	describe('Model ID Variations', () => {
		const restSettings: SnowflakeProviderSettings = { executionMode: 'rest' };

		it.concurrent(
			'should handle model IDs with cortex/ prefix',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider('cortex/claude-haiku-4-5');

				const result = await generateText({
					model,
					prompt: 'Say "prefix test"',
					maxTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			API_TIMEOUT
		);

		it.concurrent(
			'should handle model IDs with uppercase',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider('cortex/CLAUDE-HAIKU-4-5');

				const result = await generateText({
					model,
					prompt: 'Say "uppercase test"',
					maxTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Parallel API Calls (Performance)
	// ========================================================================

	describe('Parallel API Calls', () => {
		const restSettings: SnowflakeProviderSettings = { executionMode: 'rest' };

		it('should handle concurrent requests', async () => {
			const provider = createSnowflake(restSettings);
			const model = provider(TEST_MODEL);

			const promises = Array.from({ length: 3 }, (_, i) =>
				generateText({
					model,
					prompt: `Say "${i}"`,
					maxTokens: 10
				})
			);

			const results = await Promise.all(promises);
			expect(results).toHaveLength(3);
			results.forEach((result) => {
				expect(result.text).toBeDefined();
			});
		}, 180000);
	});

	// ========================================================================
	// Error Handling
	// ========================================================================

	describe('Error Handling', () => {
		it(
			'should handle invalid model ID gracefully',
			async () => {
				const provider = createSnowflake({ executionMode: 'rest' });
				const model = provider('cortex/non-existent-model-xyz-12345');

				try {
					await generateText({
						model,
						prompt: 'This should fail',
						maxTokens: 10
					});
					// Should not reach here
					expect(true).toBe(false);
				} catch (error) {
					// Expected: some form of error
					expect(error).toBeDefined();
				}
			},
			API_TIMEOUT
		);
	});

	// ========================================================================
	// Provider Configuration
	// ========================================================================

	describe('Provider Configuration', () => {
		it('should create provider with custom timeout', () => {
			const provider = createSnowflake({ timeout: 120000 });
			expect(provider).toBeDefined();
		});

		it('should have languageModel method', () => {
			const provider = createSnowflake();
			expect(typeof provider.languageModel).toBe('function');
		});

		it('should create model with correct provider name', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider(TEST_MODEL);
			expect(model.provider).toBe('snowflake');
			expect(model.modelId).toBe(TEST_MODEL);
		});
	});

	// ========================================================================
	// Available Models
	// ========================================================================

	describe('Available Models', () => {
		it('should list available models', () => {
			const models = getAvailableModels();
			expect(Array.isArray(models)).toBe(true);
			expect(models.length).toBeGreaterThan(0);
			expect(models.some((m) => m.includes('claude'))).toBe(true);
			expect(
				models.some((m) => m.includes('openai') || m.includes('gpt'))
			).toBe(true);
		});
	});
});

export { TEST_MODEL };
