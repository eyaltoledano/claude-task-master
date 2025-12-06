/**
 * Claude-Specific Features Integration Tests
 *
 * Tests for Claude model-specific features including:
 * - Prompt caching
 * - Reasoning mode (low, medium, high)
 * - Feature compatibility with non-Claude models
 *
 * Note: These tests may be skipped if Claude models aren't available
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { generateText } from 'ai';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake } from '../../../src/index.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

describeWithCredentials('Claude-Specific Features Integration Tests', () => {
	describe('Prompt Caching', () => {
		it('should work with prompt caching enabled for Claude model (if available)', async () => {
			// Use Claude models from the single source of truth
			const { CLAUDE_PREFIXED_MODEL_IDS } = await import(
				'../../../src/utils/models.js'
			);
			const CLAUDE_MODELS = CLAUDE_PREFIXED_MODEL_IDS;

			let result1;
			let workingModel: string | null = null;

			// Try each Claude model to find one that works
			for (const modelId of CLAUDE_MODELS) {
				try {
					const provider = createSnowflake({
						executionMode: 'rest',
						enablePromptCaching: true
					});
					const model = provider(modelId);

					const systemPrompt = 'You are a helpful assistant. Be concise.';
					result1 = await generateText({
						model,
						system: systemPrompt,
						prompt: 'What is 2+2?',
						maxOutputTokens: 50
					});

					if (result1.text) {
						workingModel = modelId;
						console.log(`Claude model available: ${modelId}`);
						break;
					}
				} catch (error) {
					// Try next model
					console.log(`Claude model ${modelId} not available, trying next...`);
				}
			}

			if (!workingModel || !result1) {
				console.log('Skipping: No Claude models available in this region');
				return; // Skip test if no Claude model works
			}

			expect(result1.text).toBeDefined();
			expect(result1.text.length).toBeGreaterThan(0);
			console.log('Prompt caching test usage:', result1.usage);
		}, 120000);
	});

	describe('Reasoning Mode', () => {
		it('should work with reasoning mode enabled for Claude model (if available)', async () => {
			// Use Claude models from the single source of truth
			const { CLAUDE_PREFIXED_MODEL_IDS } = await import(
				'../../../src/utils/models.js'
			);
			const CLAUDE_MODELS = CLAUDE_PREFIXED_MODEL_IDS;

			let result;
			let workingModel: string | null = null;

			for (const modelId of CLAUDE_MODELS) {
				try {
					const provider = createSnowflake({
						executionMode: 'rest',
						reasoning: 'low'
					});
					const model = provider(modelId);

					result = await generateText({
						model,
						prompt: 'What is the capital of France? Answer in one word.',
						maxOutputTokens: 50
					});

					if (result.text) {
						workingModel = modelId;
						console.log(`Claude model available for reasoning: ${modelId}`);
						break;
					}
				} catch (error) {
					console.log(
						`Claude model ${modelId} not available for reasoning, trying next...`
					);
				}
			}

			if (!workingModel || !result) {
				console.log('Skipping: No Claude models available for reasoning test');
				return;
			}

			expect(result.text).toBeDefined();
			expect(result.text.toLowerCase()).toContain('paris');
			console.log('Reasoning mode usage:', result.usage);
		}, 120000);
	});

	describe('Feature Compatibility', () => {
		it('should work normally without Claude features on other models', async () => {
			const provider = createSnowflake({
				executionMode: 'rest',
				enablePromptCaching: true, // Should be ignored for non-Claude
				reasoning: 'high' // Should be ignored for non-Claude
			});
			// Use a non-Claude model to test that Claude features are ignored
			const model = provider('cortex/llama3.1-8b');

			const result = await generateText({
				model,
				system: 'You are a helpful assistant.',
				prompt: 'What is 1+1?',
				maxOutputTokens: 50
			});

			expect(result.text).toBeDefined();
			expect(result.text.length).toBeGreaterThan(0);
		}, 60000);
	});
});

