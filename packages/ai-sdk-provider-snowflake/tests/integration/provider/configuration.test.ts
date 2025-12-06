/**
 * Provider Configuration Integration Tests
 *
 * Tests for Snowflake provider configuration including:
 * - Provider creation with various settings
 * - Execution mode configuration
 * - Connection configuration
 * - Timeout settings
 * - Auto mode
 * - Default provider instance
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { generateText } from 'ai';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake, snowflake } from '../../../src/index.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

const TEST_MODEL = 'cortex/claude-haiku-4-5';

describeWithCredentials('Provider Configuration Integration Tests', () => {
	describe('Provider Creation', () => {
		it('should create provider with default settings', () => {
			const provider = createSnowflake();

			expect(provider).toBeDefined();
			expect(typeof provider).toBe('function');
			expect(typeof provider.languageModel).toBe('function');
		});

		it('should create provider with custom settings', () => {
			const provider = createSnowflake({
				connection: 'test-connection',
				timeout: 120000,
				executionMode: 'rest'
			});

			expect(provider).toBeDefined();
		});

		it('should create language model from provider', () => {
			const provider = createSnowflake();
			const model = provider(TEST_MODEL);

			expect(model).toBeDefined();
			expect(model.provider).toBe('snowflake');
			expect(model.modelId).toBe(TEST_MODEL);
		});

		it.concurrent('should create provider with default settings (parallel)', async () => {
			const provider = createSnowflake();
			expect(provider).toBeDefined();
			expect(typeof provider).toBe('function');
		});

		it.concurrent('should create provider with custom timeout', async () => {
			const provider = createSnowflake({ timeout: 120000 });
			expect(provider).toBeDefined();
		});

		it.concurrent('should create provider with custom connection', async () => {
			const provider = createSnowflake({ connection: 'test-connection' });
			expect(provider).toBeDefined();
		});
	});

	describe('Execution Modes', () => {
		it.concurrent(
			'should create provider with explicit execution mode',
			async () => {
				const restProvider = createSnowflake({ executionMode: 'rest' });
				const cliProvider = createSnowflake({ executionMode: 'cli' });
				const autoProvider = createSnowflake({ executionMode: 'auto' });
				expect(restProvider).toBeDefined();
				expect(cliProvider).toBeDefined();
				expect(autoProvider).toBeDefined();
			}
		);

		it('should auto-detect and use available execution mode', async () => {
			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider(TEST_MODEL);

			const result = await generateText({
				model,
				prompt: 'Say "test" and nothing else.',
				maxOutputTokens: 20
			});

			expect(result.text).toBeDefined();
			expect(result.text.toLowerCase()).toContain('test');
		}, 120000);
	});

	describe('Provider Methods', () => {
		it('should have languageModel function', () => {
			const provider = createSnowflake();
			expect(typeof provider.languageModel).toBe('function');
		});

		it('should create working language model', () => {
			const provider = createSnowflake();
			const model = provider.languageModel(TEST_MODEL);

			expect(model).toBeDefined();
			expect(model.provider).toBe('snowflake');
			expect(model.modelId).toBe(TEST_MODEL);
		});

		it.concurrent('should have languageModel method', async () => {
			const provider = createSnowflake();
			expect(provider.languageModel).toBeDefined();
			expect(typeof provider.languageModel).toBe('function');
		});

		it.concurrent(
			'should create model with provider name snowflake',
			async () => {
				const provider = createSnowflake({ executionMode: 'rest' });
				const model = provider(TEST_MODEL);
				expect(model.provider).toBe('snowflake');
			}
		);

		it.concurrent('should preserve model ID in created model', async () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/claude-haiku-4-5');
			expect(model.modelId).toBe('cortex/claude-haiku-4-5');
		});
	});

	describe('Default Provider Instance', () => {
		it('should work with default snowflake provider', async () => {
			const model = snowflake(TEST_MODEL, { executionMode: 'rest' });

			const result = await generateText({
				model,
				prompt: 'Say "default" and nothing else.',
				maxOutputTokens: 20
			});

			expect(result.text).toBeDefined();
			expect(result.text.toLowerCase()).toContain('default');
		}, 60000);
	});

	describe('Connection Configuration', () => {
		it('should work with explicit connection name if set', async () => {
			const connectionName = process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
			if (!connectionName) {
				console.log('Skipping: No default connection name configured');
				return;
			}

			const provider = createSnowflake({
				connection: connectionName,
				executionMode: 'rest'
			});
			const model = provider(TEST_MODEL);

			const result = await generateText({
				model,
				prompt: 'Say "connection" and nothing else.',
				maxOutputTokens: 20
			});

			expect(result.text).toBeDefined();
		}, 60000);
	});
});

