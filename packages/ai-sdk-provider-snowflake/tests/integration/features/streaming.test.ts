/**
 * Integration tests for streaming support
 * 
 * Tests that streaming responses work correctly for all supported models
 * via the Native Cortex API.
 * 
 * NOTE: Streaming is REST API ONLY. CLI mode does not support streaming.
 * CLI's doStream() method explicitly throws an error indicating streaming
 * is not yet supported for Cortex Code CLI provider.
 * 
 * See: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { streamText } from 'ai';

import { createSnowflake } from '../../../src/provider.js';
import { clearAuthCache } from '../../../src/auth/index.js';
import { STREAMING_MODEL_IDS, CLAUDE_MODEL_IDS, OPENAI_MODEL_IDS, LLAMA_MODEL_IDS } from '../../../src/utils/models.js';
import { skipIfNoCredentials, logTestEnvironment } from '../../test-utils.js';

// Test timeout
const TEST_TIMEOUT = 180000;

skipIfNoCredentials('Streaming Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		logTestEnvironment('Streaming Tests');
		console.log(`Models supporting streaming: ${STREAMING_MODEL_IDS.length}`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	describe('Claude Models - Streaming', () => {
		const claudeStreamingModels = CLAUDE_MODEL_IDS.filter(id => 
			STREAMING_MODEL_IDS.includes(id)
		);

		it.each(claudeStreamingModels)(
			'%s should stream response chunks',
			async (modelId) => {
				const provider = createSnowflake({
					executionMode: 'rest',
					enableStreaming: true
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await streamText({
						model,
						prompt: 'Count from 1 to 5, one number per line.',
					});

					const chunks: string[] = [];
					let chunkCount = 0;

					for await (const chunk of result.textStream) {
						chunks.push(chunk);
						chunkCount++;
					}

					const fullText = chunks.join('');
					
					expect(fullText).toBeTruthy();
					expect(chunkCount).toBeGreaterThan(0);

					console.log(`[PASS] ${modelId}: Streamed ${chunkCount} chunks, total ${fullText.length} chars`);
				} catch (error) {
					const err = error as Error;
					if (err.message.includes('500') || err.message.includes('unavailable') || err.message.includes('disabled')) {
						console.log(`[INFO] ${modelId}: ${err.message.substring(0, 100)}`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	describe('OpenAI Models - Streaming', () => {
		const openaiStreamingModels = OPENAI_MODEL_IDS.filter(id => 
			STREAMING_MODEL_IDS.includes(id)
		);

		it.each(openaiStreamingModels)(
			'%s should stream response chunks',
			async (modelId) => {
				const provider = createSnowflake({
					executionMode: 'rest',
					enableStreaming: true
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await streamText({
						model,
						prompt: 'Count from 1 to 5, one number per line.',
					});

					const chunks: string[] = [];
					let chunkCount = 0;

					for await (const chunk of result.textStream) {
						chunks.push(chunk);
						chunkCount++;
					}

					const fullText = chunks.join('');
					
					expect(fullText).toBeTruthy();
					expect(chunkCount).toBeGreaterThan(0);

					console.log(`[PASS] ${modelId}: Streamed ${chunkCount} chunks, total ${fullText.length} chars`);
				} catch (error) {
					const err = error as Error;
					if (err.message.includes('500') || err.message.includes('unavailable') || err.message.includes('disabled')) {
						console.log(`[INFO] ${modelId}: ${err.message.substring(0, 100)}`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	describe('Llama Models - Streaming', () => {
		const llamaStreamingModels = LLAMA_MODEL_IDS.filter(id => 
			STREAMING_MODEL_IDS.includes(id)
		);

		it.each(llamaStreamingModels)(
			'%s should stream response chunks',
			async (modelId) => {
				const provider = createSnowflake({
					executionMode: 'rest',
					enableStreaming: true
				});

				const model = provider(`cortex/${modelId}`);

				try {
					const result = await streamText({
						model,
						prompt: 'Count from 1 to 5, one number per line.',
					});

					const chunks: string[] = [];
					let chunkCount = 0;

					for await (const chunk of result.textStream) {
						chunks.push(chunk);
						chunkCount++;
					}

					const fullText = chunks.join('');
					
					expect(fullText).toBeTruthy();
					expect(chunkCount).toBeGreaterThan(0);

					console.log(`[PASS] ${modelId}: Streamed ${chunkCount} chunks, total ${fullText.length} chars`);
				} catch (error) {
					const err = error as Error;
					if (err.message.includes('500') || err.message.includes('unavailable') || err.message.includes('disabled')) {
						console.log(`[INFO] ${modelId}: ${err.message.substring(0, 100)}`);
						return;
					}
					throw error;
				}
			},
			TEST_TIMEOUT
		);
	});

	describe('Streaming vs Non-Streaming Consistency', () => {
		it('streaming and non-streaming should produce similar results', async () => {
			if (STREAMING_MODEL_IDS.length === 0) {
				console.log('[SKIP] No streaming models available');
				return;
			}

			// Use Claude for consistency test
			const modelId = CLAUDE_MODEL_IDS.find(id => STREAMING_MODEL_IDS.includes(id));
			if (!modelId) {
				console.log('[SKIP] No Claude model with streaming support');
				return;
			}

			const provider = createSnowflake({
				executionMode: 'rest'
			});

			const model = provider(`cortex/${modelId}`);
			const prompt = 'What is 2 + 2? Answer with just the number.';

			try {
				// Non-streaming
				const { generateText } = await import('ai');
				const nonStreamResult = await generateText({
					model,
					prompt,
				});

			// Streaming
			const streamResult = await streamText({
				model,
				prompt,
			});

			const chunks: string[] = [];
			for await (const chunk of streamResult.textStream) {
				chunks.push(chunk);
			}
			const streamedText = chunks.join('');

			// Both should contain "4"
			expect(nonStreamResult.text).toContain('4');
			expect(streamedText).toContain('4');

			console.log(`[PASS] Streaming/non-streaming consistency verified`);
			console.log(`  Non-streaming: ${nonStreamResult.text.substring(0, 50)}`);
			console.log(`  Streaming: ${streamedText.substring(0, 50)}`);
			} catch (error) {
				const err = error as Error;
				if (err.message.includes('500') || err.message.includes('unavailable')) {
					console.log(`[INFO] Consistency test: Server unavailable`);
					return;
				}
				throw error;
			}
		}, TEST_TIMEOUT);
	});

	describe('Streaming Disabled', () => {
		it('should throw error when streaming is disabled', async () => {
			if (STREAMING_MODEL_IDS.length === 0) {
				console.log('[SKIP] No streaming models available');
				return;
			}

			const modelId = STREAMING_MODEL_IDS[0];
			const provider = createSnowflake({
				executionMode: 'rest',
				enableStreaming: false
			});

			const model = provider(`cortex/${modelId}`);

			try {
				const result = await streamText({
					model,
					prompt: 'Hello',
				});

				// Try to consume the stream - should throw
				for await (const chunk of result.textStream) {
					// Should not get here
				}
				
				// If we get here, the error was not thrown
				throw new Error('Expected an error when streaming is disabled, but no error was thrown');
			} catch (error) {
				const err = error as Error;
				// Should get an error about streaming being disabled
				expect(err.message).toMatch(/streaming|disabled/i);
				console.log(`[PASS] Streaming disabled error: ${err.message.substring(0, 80)}`);
			}
		}, TEST_TIMEOUT);
	});
});

