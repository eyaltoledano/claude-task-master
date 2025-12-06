/**
 * REST API Mode Integration Tests
 *
 * Tests for Snowflake REST API execution mode including:
 * - Text generation
 * - Streaming
 * - System messages
 * - Structured output
 * - Multi-turn conversations
 * - Token limits
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { generateText, generateObject, streamText } from 'ai';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake } from '../../../src/index.js';
import type { SnowflakeProviderSettings } from '../../../src/types.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

const TEST_MODEL = 'cortex/claude-haiku-4-5';

describeWithCredentials('REST API Mode Integration Tests', () => {
	const restSettings: SnowflakeProviderSettings = {
		executionMode: 'rest'
	};

	describe('Text Generation', () => {
		// Use it.concurrent for parallel test execution
		it.concurrent(
			'should generate text using REST API',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					prompt: 'Say "Hello" and nothing else.',
					maxOutputTokens: 50
				});

				expect(result.text).toBeDefined();
				expect(result.text.toLowerCase()).toContain('hello');
			},
			60000
		);

		it.concurrent(
			'should handle system and user messages via REST API',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					system: 'You are a helpful assistant that responds briefly.',
					prompt: 'What is 2+2?',
					maxOutputTokens: 50
				});

				expect(result.text).toBeDefined();
				expect(result.text).toContain('4');
			},
			60000
		);

		it.concurrent(
			'should respect maxOutputTokens parameter via REST API',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					prompt: 'Write a very short sentence about cats.',
					maxOutputTokens: 100
				});

				// Verify we got a response
				expect(result.text).toBeDefined();
				expect(result.text.length).toBeGreaterThan(0);
				// Response should be reasonable length (not excessively long)
				expect(result.text.length).toBeLessThan(2000);
			},
			60000
		);
	});

	describe('Streaming', () => {
		it('should stream text using REST API', async () => {
			const provider = createSnowflake(restSettings);
			const model = provider(TEST_MODEL);

			const result = streamText({
				model,
				prompt: 'Count from 1 to 5.',
				maxOutputTokens: 100
			});

			const chunks: string[] = [];
			for await (const chunk of result.textStream) {
				chunks.push(chunk);
			}

			const fullText = chunks.join('');
			expect(fullText).toBeDefined();
			expect(fullText.length).toBeGreaterThan(0);
		}, 60000);
	});

	describe('Structured Output', () => {
		it.concurrent(
			'should generate structured output (JSON) via REST API',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const PersonSchema = z.object({
					name: z.string().describe('The name of the person'),
					age: z.number().describe('The age of the person')
				});

				// @ts-expect-error - Type instantiation is excessively deep with Zod + AI SDK
				const result = await generateObject({
					model,
					schema: PersonSchema,
					prompt: 'Generate a fictional person named John who is 30 years old.'
				});

				expect(result.object).toBeDefined();
				expect(result.object.name).toBeDefined();
				expect(typeof result.object.age).toBe('number');
			},
			60000
		);
	});

	describe('Multi-turn Conversations', () => {
		it.concurrent(
			'should handle multi-turn conversations via REST API',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					messages: [
						{ role: 'user', content: 'My name is Alice.' },
						{
							role: 'assistant',
							content: 'Hello Alice! Nice to meet you.'
						},
						{ role: 'user', content: 'What is my name?' }
					],
					maxOutputTokens: 50
				});

				expect(result.text).toBeDefined();
				expect(result.text.toLowerCase()).toContain('alice');
			},
			60000
		);
	});

	describe('Text Generation Matrix', () => {
		// Feature matrix for text generation tests
		const textGenerationMatrix: ReadonlyArray<
			readonly [string, string, RegExp]
		> = [
			['Simple greeting', 'Say "hello" and nothing else.', /hello/i],
			['Math question', 'What is 2+2? Answer with just the number.', /4/],
			['Single word', 'Say "test" only.', /test/i]
		];

		// Use it.concurrent.each for parallel test execution
		it.concurrent.each(textGenerationMatrix)(
			'should generate correct response: %s',
			async (testName, prompt, expectedPattern) => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					prompt,
					maxOutputTokens: 50
				});

				expect(result.text).toBeDefined();
				expect(result.text).toMatch(expectedPattern);
			},
			60000
		);
	});

	describe('Conversation Matrix', () => {
		// Feature matrix for conversation tests
		const conversationMatrix: ReadonlyArray<
			readonly [
				string,
				ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
				RegExp
			]
		> = [
			[
				'Addition chain',
				[
					{ role: 'user', content: 'What is 5+3?' },
					{ role: 'assistant', content: '8' },
					{ role: 'user', content: 'Add 2 to that.' }
				],
				/10/
			],
			[
				'Subtraction',
				[
					{ role: 'user', content: 'What is 10-3?' },
					{ role: 'assistant', content: '7' },
					{ role: 'user', content: 'Subtract 2.' }
				],
				/5/
			]
		];

		// Use it.concurrent.each for parallel test execution
		it.concurrent.each(conversationMatrix)(
			'should handle conversation: %s',
			async (testName, messages, expectedPattern) => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const result = await generateText({
					model,
					messages: [...messages],
					maxOutputTokens: 50
				});

				expect(result.text).toBeDefined();
				expect(result.text).toMatch(expectedPattern);
			},
			60000
		);
	});
});

