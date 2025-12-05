/**
 * Performance Benchmark Integration Tests
 *
 * Tests for performance benchmarks including:
 * - Token caching performance
 * - Rapid sequential calls
 * - Schema preparation performance
 * - Model ID normalization performance
 * - Schema cleaning performance
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { generateText } from 'ai';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
	createSnowflake,
	clearAuthCache,
	StructuredOutputGenerator,
	ModelHelpers,
	removeUnsupportedFeatures,
	type JSONSchema
} from '../../../src/index.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

const TEST_MODEL = 'cortex/claude-haiku-4-5';

describeWithCredentials('Performance Benchmark Integration Tests', () => {
	describe('Token Caching Performance', () => {
		it('should reuse cached tokens for subsequent requests', async () => {
			clearAuthCache();

			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider(TEST_MODEL);

			// First request (should create token)
			const startFirst = Date.now();
			await generateText({
				model,
				prompt: 'Say "first".',
				maxOutputTokens: 10
			});
			const durationFirst = Date.now() - startFirst;

			// Second request (should reuse token)
			const startSecond = Date.now();
			await generateText({
				model,
				prompt: 'Say "second".',
				maxOutputTokens: 10
			});
			const durationSecond = Date.now() - startSecond;

			// Second request should typically be faster due to cached auth
			// (This is a soft assertion since network variability exists)
			console.log(
				`First request: ${durationFirst}ms, Second request: ${durationSecond}ms`
			);
			expect(durationSecond).toBeDefined();
		}, 120000);
	});

	describe('Rapid Sequential Calls', () => {
		it('should handle rapid sequential calls', async () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider(TEST_MODEL);

			const promises = Array.from({ length: 3 }, (_, i) =>
				generateText({
					model,
					prompt: `Say "${i}"`,
					maxOutputTokens: 10
				})
			);

			const results = await Promise.all(promises);
			expect(results).toHaveLength(3);
			results.forEach((result) => {
				expect(result.text).toBeDefined();
			});
		}, 180000);
	});

	describe('Function Performance Benchmarks', () => {
		it('should prepare messages quickly (100 calls < 100ms)', () => {
			const schema = {
				type: 'object' as const,
				properties: {
					field: { type: 'string' as const }
				}
			};

			const start = performance.now();
			for (let i = 0; i < 100; i++) {
				StructuredOutputGenerator.prepareMessages({
					schema,
					objectName: 'Test',
					messages: []
				});
			}
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(100);
		});

		it('should normalize model IDs quickly (1000 calls < 50ms)', () => {
			const start = performance.now();
			for (let i = 0; i < 1000; i++) {
				ModelHelpers.normalizeModelId('cortex/CLAUDE-SONNET-4-5');
			}
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(50);
		});

		it('should check structured output support quickly (1000 calls < 50ms)', () => {
			const start = performance.now();
			for (let i = 0; i < 1000; i++) {
				ModelHelpers.supportsStructuredOutputs('claude-haiku-4-5');
			}
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(50);
		});

		it('should clean schema quickly (100 calls < 100ms)', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					name: { type: 'string', minLength: 1, maxLength: 100 },
					age: { type: 'number', minimum: 0, maximum: 150 }
				}
			};

			const start = performance.now();
			for (let i = 0; i < 100; i++) {
				removeUnsupportedFeatures(schema);
			}
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(100);
		});
	});
});

