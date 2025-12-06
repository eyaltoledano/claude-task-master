/**
 * Model ID Handling Integration Tests
 *
 * Tests for model ID variations and handling including:
 * - Model IDs with and without cortex/ prefix
 * - Model ID normalization
 * - Different model types
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { generateText } from 'ai';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake } from '../../../src/index.js';
import type { SnowflakeProviderSettings } from '../../../src/types.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

describeWithCredentials('Model ID Handling Integration Tests', () => {
	const restSettings: SnowflakeProviderSettings = {
		executionMode: 'rest'
	};

	describe('Model ID Variations', () => {
		// Use it.concurrent for parallel execution
		it.concurrent(
			'should handle model ID without cortex/ prefix',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider('llama3.1-8b'); // Use valid model without prefix

				const result = await generateText({
					model,
					prompt: 'Say "prefix" and nothing else.',
					maxOutputTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			60000
		);

		it.concurrent(
			'should handle model ID with cortex/ prefix',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider('cortex/llama3.1-8b'); // Use valid model with prefix

				const result = await generateText({
					model,
					prompt: 'Say "prefixed" and nothing else.',
					maxOutputTokens: 20
				});

				expect(result.text).toBeDefined();
			},
			60000
		);
	});

	describe('Different Model Types', () => {
		// Test a variety of models to ensure compatibility
		// Note: Model availability varies by Snowflake account
		const modelsToTest = [
			'cortex/llama3.1-8b',
			'cortex/mistral-large2'
			// Add more models if available in your account
		];

		// Use it.concurrent.each for parallel model testing
		it.concurrent.each(modelsToTest)(
			'should work with model: %s',
			async (modelId) => {
				const provider = createSnowflake(restSettings);
				const model = provider(modelId);

				const result = await generateText({
					model,
					prompt: 'Say "ok" and nothing else.',
					maxOutputTokens: 10
				});

				expect(result.text).toBeDefined();
			},
			60000
		);
	});

	describe('Temperature Support', () => {
		it.concurrent(
			'should work with temperature for Claude models',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider('cortex/claude-haiku-4-5');

				const result = await generateText({
					model,
					prompt: 'Say "temperature test"',
					temperature: 0.7
				});

				expect(result.text).toBeDefined();
			},
			60000
		);

		it.concurrent(
			'should work with OpenAI models',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider('cortex/openai-gpt-5');

				try {
					const result = await generateText({
						model,
						prompt: 'Say "openai test"'
					});

					expect(result.text).toBeDefined();
				} catch (error) {
					// Skip if OpenAI model is not available (500 internal error = model unavailable)
					if (error instanceof Error && error.message.includes('500')) {
						console.log('Skipping: OpenAI model not available (500 error)');
						return;
					}
					throw error;
				}
			},
			60000
		);
	});
});

