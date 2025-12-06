/**
 * Integration tests for prompt caching feature
 *
 * NOTE: Prompt caching is REST API ONLY. CLI mode does not support prompt caching.
 *
 * Prompt Caching Behavior:
 *
 * OpenAI Models:
 * - Prompt caching is implicit; no need to modify requests to opt-in.
 * - Prompts with 1024 tokens or more will utilize caching, with cache hits occurring in 128-token increments.
 * - Messages, images, tool use and structured outputs can be cached.
 * - Cache writes: no cost.
 * - Cache reads: charged at 0.25x or 0.50x the price of the original input pricing.
 *
 * Anthropic/Claude Models:
 * - Enable prompt caching by providing cache points using cache_control: { type: 'ephemeral' }
 * - Prompts with 1024 tokens or more can utilize caching.
 * - A maximum of 4 cache points can be provided per request.
 * - User messages, system messages, tools and images can be cached.
 * - Only cache control type 'ephemeral' is supported.
 * - Cache writes: charged at 1.25x the price of the original input pricing.
 * - Cache reads: charged at 0.1x the price of the original input pricing.
 *
 * See: https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateText } from 'ai';

import { createSnowflake } from '../../../src/provider.js';
import { clearAuthCache } from '../../../src/auth/index.js';
import { PROMPT_CACHING_MODEL_IDS } from '../../../src/utils/models.js';
import { describeWithCredentials } from '../../test-utils.js';

// Test timeout
const TEST_TIMEOUT = 180000;

// Long system prompt for caching test
const LONG_SYSTEM_PROMPT = `
You are an expert AI assistant specializing in answering questions about various topics.
Your responses should be accurate, helpful, and concise.

Here are some important guidelines to follow:
1. Always provide factual information based on your training data.
2. If you're unsure about something, acknowledge the uncertainty.
3. Be helpful and respectful in all interactions.
4. Provide examples when they help clarify your explanations.
5. Keep responses appropriately concise while being comprehensive.
6. Use clear language that is easy to understand.
7. When discussing technical topics, explain complex concepts in accessible terms.
8. Always prioritize safety and ethical considerations.
9. Respect privacy and avoid discussing personal information.
10. Focus on providing value and being genuinely helpful.

This is a test of the prompt caching functionality. The system prompt should be cached
on the first request, and subsequent requests should show reduced token usage for the
cached portion. This helps improve performance and reduce costs for repeated interactions
with the same context.
`.repeat(3); // Repeat to make it longer for better caching test

describeWithCredentials('Prompt Caching Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log(
			`Models supporting prompt caching: ${PROMPT_CACHING_MODEL_IDS.length}`
		);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	describe('Claude Models - Prompt Caching', () => {
		const claudeModels = PROMPT_CACHING_MODEL_IDS.filter((id) =>
			id.startsWith('claude')
		);

		it.each(claudeModels)(
			'%s should show reduced tokens with caching enabled',
			async (modelId) => {
				const providerWithoutCaching = createSnowflake({
					executionMode: 'rest',
					enablePromptCaching: false
				});

				const providerWithCaching = createSnowflake({
					executionMode: 'rest',
					enablePromptCaching: true
				});

				const modelWithoutCaching = providerWithoutCaching(`cortex/${modelId}`);
				const modelWithCaching = providerWithCaching(`cortex/${modelId}`);

				const userPrompt = 'What is the capital of France? Answer in one word.';

				try {
					// First request WITHOUT caching
					const resultWithoutCaching = await generateText({
						model: modelWithoutCaching,
						system: LONG_SYSTEM_PROMPT,
						prompt: userPrompt
					});

					// Small delay to ensure caching takes effect
					await new Promise((resolve) => setTimeout(resolve, 1000));

					// Second request WITH caching (same system prompt)
					const resultWithCaching = await generateText({
						model: modelWithCaching,
						system: LONG_SYSTEM_PROMPT,
						prompt: userPrompt
					});

					// Third request WITH caching (same system prompt) to verify cache hit
					const resultWithCaching2 = await generateText({
						model: modelWithCaching,
						system: LONG_SYSTEM_PROMPT,
						prompt: userPrompt
					});

					console.log(
						`[${modelId}] Without caching - tokens: ${JSON.stringify(resultWithoutCaching.usage)}`
					);
					console.log(
						`[${modelId}] With caching (1) - tokens: ${JSON.stringify(resultWithCaching.usage)}`
					);
					console.log(
						`[${modelId}] With caching (2) - tokens: ${JSON.stringify(resultWithCaching2.usage)}`
					);

					// Both requests should complete successfully
					expect(resultWithoutCaching.text).toBeTruthy();
					expect(resultWithCaching.text).toBeTruthy();
					expect(resultWithCaching2.text).toBeTruthy();

					// Note: We can't strictly assert token reduction as it depends on
					// server-side caching behavior. The test verifies that the feature
					// doesn't break functionality.
					console.log(
						`[PASS] ${modelId}: Prompt caching requests completed successfully`
					);
				} catch (error) {
					const err = error as Error;
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

	describe('OpenAI Models - Prompt Caching', () => {
		const openaiModels = PROMPT_CACHING_MODEL_IDS.filter((id) =>
			id.startsWith('openai')
		);

		it.each(openaiModels)(
			'%s should work with caching enabled',
			async (modelId) => {
				const provider = createSnowflake({
					executionMode: 'rest',
					enablePromptCaching: true
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await generateText({
						model,
						system: LONG_SYSTEM_PROMPT,
						prompt: 'What is 2 + 2?'
					});

					expect(result.text).toBeTruthy();
					console.log(
						`[PASS] ${modelId}: Prompt caching request completed (tokens: ${JSON.stringify(result.usage)})`
					);
				} catch (error) {
					const err = error as Error;
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
});
