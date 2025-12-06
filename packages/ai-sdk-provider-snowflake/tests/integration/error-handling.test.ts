/**
 * Error Handling Integration Tests
 *
 * Tests for error handling including:
 * - Invalid model errors
 * - Empty prompt handling
 * - Malformed JSON handling
 * - Missing schema errors
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect, jest } from '@jest/globals';
import { generateText } from 'ai';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake, StructuredOutputGenerator } from '../../src/index.js';
import { describeWithCredentials } from '../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

const TEST_MODEL = 'cortex/claude-haiku-4-5';

describeWithCredentials('Error Handling Integration Tests', () => {
	describe('Model Errors', () => {
		// Use it.concurrent for parallel execution of error tests
		it.concurrent(
			'should handle invalid model gracefully',
			async () => {
				const provider = createSnowflake({ executionMode: 'rest' });
				const model = provider('cortex/invalid-model-xyz');

				await expect(
					generateText({
						model,
						prompt: 'Hello',
						maxOutputTokens: 10
					})
				).rejects.toThrow();
			},
			60000
		);
	});

	describe('Prompt Errors', () => {
		it.concurrent(
			'should handle empty prompt',
			async () => {
				const provider = createSnowflake({ executionMode: 'rest' });
				const model = provider(TEST_MODEL);

				// Empty prompt should either throw or return empty
				try {
					const result = await generateText({
						model,
						prompt: '',
						maxOutputTokens: 10
					});
					// If it doesn't throw, result should be defined
					expect(result).toBeDefined();
				} catch (error) {
					// If it throws, that's also acceptable behavior
					expect(error).toBeDefined();
				}
			},
			60000
		);
	});

	describe('Structured Output Generator Errors', () => {
		it('should handle missing schema in StructuredOutputGenerator', async () => {
			const mockGenerateText = jest.fn();

			await expect(
				StructuredOutputGenerator.generateObject({
					generateText: mockGenerateText as any,
					schema: null as any,
					objectName: 'Test',
					messages: []
				})
			).rejects.toThrow();
		});

		it('should handle empty messages in StructuredOutputGenerator', async () => {
			const mockGenerateText = jest.fn();
			const schema = {
				type: 'object',
				properties: { name: { type: 'string' } }
			};

			// Should not throw for empty messages - generator adds system message
			const messages = StructuredOutputGenerator.prepareMessages({
				schema: schema as any,
				objectName: 'Test',
				messages: []
			});
			expect(messages.length).toBeGreaterThan(0);
		});

		it('should handle malformed JSON in extractAndParse', () => {
			const malformedResponse = 'This is not JSON at all';
			expect(() =>
				StructuredOutputGenerator.extractAndParse(malformedResponse)
			).toThrow();
		});
	});
});

