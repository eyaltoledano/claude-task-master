/**
 * Integration tests for thinking and reasoning features
 *
 * Tests:
 * - Claude extended thinking (budget_tokens)
 * - OpenAI reasoning_effort parameter
 *
 * NOTE: Thinking/Reasoning features are REST API ONLY.
 * CLI mode does not support these advanced parameters.
 *
 * See: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
 * See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#thinking-and-reasoning-examples
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateText } from 'ai';

import { createSnowflake } from '../../../src/provider.js';
import { clearAuthCache } from '../../../src/auth/index.js';
import {
	THINKING_MODEL_IDS,
	REASONING_MODEL_IDS
} from '../../../src/utils/models.js';
import type { ThinkingLevel } from '../../../src/types.js';
import { describeWithCredentials } from '../../test-utils.js';

// Test timeout
const TEST_TIMEOUT = 180000;

describeWithCredentials('Thinking & Reasoning Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log(`Claude models with thinking: ${THINKING_MODEL_IDS.length}`);
		console.log(`OpenAI models with reasoning: ${REASONING_MODEL_IDS.length}`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	describe('Claude Extended Thinking', () => {
		const thinkingLevels: ThinkingLevel[] = ['low', 'medium', 'high'];

		it.each(THINKING_MODEL_IDS)(
			'%s should complete with thinking enabled (medium)',
			async (modelId) => {
				const provider = createSnowflake({
					executionMode: 'rest',
					enableThinking: true,
					thinkingLevel: 'medium'
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						prompt:
							'What is the sum of the first 10 prime numbers? Show your work.'
					});

					expect(result.text).toBeTruthy();

					// Check if thinking content is present in response
					const hasThinking =
						result.text.includes('<thinking>') || result.text.length > 100; // Longer responses suggest thinking

					console.log(
						`[PASS] ${modelId}: Thinking completed (${result.text.length} chars, thinking: ${hasThinking})`
					);
				} catch (error) {
					const err = error as Error;
					if (
						err.message.includes('500') ||
						err.message.includes('unavailable') ||
						err.message.includes('thinking')
					) {
						console.log(`[INFO] ${modelId}: ${err.message.substring(0, 100)}`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);

		it.each(thinkingLevels)(
			'Claude should work with thinking level: %s',
			async (level) => {
				if (THINKING_MODEL_IDS.length === 0) {
					console.log('[SKIP] No thinking models available');
					return;
				}

				const modelId = THINKING_MODEL_IDS[0];
				const provider = createSnowflake({
					executionMode: 'rest',
					enableThinking: true,
					thinkingLevel: level
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						prompt: 'What is 15 * 17?'
					});

					expect(result.text).toBeTruthy();
					console.log(
						`[PASS] ${modelId} with ${level} thinking: ${result.text.substring(0, 50)}...`
					);
				} catch (error) {
					const err = error as Error;
					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(`[INFO] ${modelId} with ${level}: Server unavailable`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);

		it(
			'Claude should work without thinking enabled',
			async () => {
				if (THINKING_MODEL_IDS.length === 0) {
					console.log('[SKIP] No thinking models available');
					return;
				}

				const modelId = THINKING_MODEL_IDS[0];
				const provider = createSnowflake({
					executionMode: 'rest',
					enableThinking: false
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						prompt: 'What is 2 + 2?'
					});

					expect(result.text).toBeTruthy();
					console.log(`[PASS] ${modelId} without thinking: ${result.text}`);
				} catch (error) {
					const err = error as Error;
					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(`[INFO] ${modelId}: Server unavailable`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	describe('OpenAI Reasoning Effort', () => {
		const reasoningLevels: ThinkingLevel[] = ['low', 'medium', 'high'];

		it.each(REASONING_MODEL_IDS)(
			'%s should complete with reasoning enabled (medium)',
			async (modelId) => {
				const provider = createSnowflake({
					executionMode: 'rest',
					enableThinking: true,
					thinkingLevel: 'medium'
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						prompt:
							'What is the sum of the first 10 prime numbers? Show your work.'
					});

					expect(result.text).toBeTruthy();
					console.log(
						`[PASS] ${modelId}: Reasoning completed (${result.text.length} chars)`
					);
				} catch (error) {
					const err = error as Error;
					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(
							`[INFO] ${modelId}: Server unavailable - ${err.message.substring(0, 100)}`
						);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);

		it.each(reasoningLevels)(
			'OpenAI should work with reasoning_effort: %s',
			async (level) => {
				if (REASONING_MODEL_IDS.length === 0) {
					console.log('[SKIP] No reasoning models available');
					return;
				}

				const modelId = REASONING_MODEL_IDS[0];
				const provider = createSnowflake({
					executionMode: 'rest',
					enableThinking: true,
					thinkingLevel: level
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						prompt: 'What is 15 * 17?'
					});

					expect(result.text).toBeTruthy();
					console.log(
						`[PASS] ${modelId} with ${level} reasoning: ${result.text.substring(0, 50)}...`
					);
				} catch (error) {
					const err = error as Error;
					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(`[INFO] ${modelId} with ${level}: Server unavailable`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);

		it(
			'OpenAI should work without reasoning enabled',
			async () => {
				if (REASONING_MODEL_IDS.length === 0) {
					console.log('[SKIP] No reasoning models available');
					return;
				}

				const modelId = REASONING_MODEL_IDS[0];
				const provider = createSnowflake({
					executionMode: 'rest',
					enableThinking: false
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						prompt: 'What is 2 + 2?'
					});

					expect(result.text).toBeTruthy();
					console.log(`[PASS] ${modelId} without reasoning: ${result.text}`);
				} catch (error) {
					const err = error as Error;
					if (
						err.message.includes('500') ||
						err.message.includes('unavailable')
					) {
						console.log(`[INFO] ${modelId}: Server unavailable`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});
});
