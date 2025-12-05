/**
 * Structured Output E2E Integration Tests
 *
 * End-to-end tests for structured output generation including:
 * - Simple object generation
 * - Complex object generation
 * - Various schema types
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { generateObject } from 'ai';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake, StructuredOutputGenerator } from '../../../src/index.js';
import type { SnowflakeProviderSettings } from '../../../src/types.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

const TEST_MODEL = 'cortex/claude-haiku-4-5';

describeWithCredentials('Structured Output E2E Integration Tests', () => {
	const restSettings: SnowflakeProviderSettings = { executionMode: 'rest' };

	describe('Structured Output Generation', () => {
		it.concurrent(
			'should generate simple person object',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const PersonSchema = z.object({
					name: z.string(),
					age: z.number()
				});

				// @ts-expect-error - Type instantiation is excessively deep with Zod + AI SDK
				const result = await generateObject({
					model,
					schema: PersonSchema,
					prompt: 'Generate: name="Alice", age=25'
				});

				expect(result.object).toBeDefined();
				expect(result.object).toHaveProperty('name');
				expect(result.object).toHaveProperty('age');
				expect(typeof result.object.name).toBe('string');
				expect(typeof result.object.age).toBe('number');
			},
			60000
		);

		it.concurrent(
			'should generate task object',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const TaskSchema = z.object({
					id: z.number(),
					title: z.string(),
					done: z.boolean()
				});

				// @ts-expect-error - Type instantiation is excessively deep with Zod + AI SDK
				const result = await generateObject({
					model,
					schema: TaskSchema,
					prompt: 'Generate: id=1, title="Test", done=true'
				});

				expect(result.object).toBeDefined();
				expect(result.object).toHaveProperty('id');
				expect(result.object).toHaveProperty('title');
				expect(result.object).toHaveProperty('done');
				expect(typeof result.object.id).toBe('number');
				expect(typeof result.object.title).toBe('string');
				expect(typeof result.object.done).toBe('boolean');
			},
			60000
		);

		it.concurrent(
			'should generate user profile object',
			async () => {
				const provider = createSnowflake(restSettings);
				const model = provider(TEST_MODEL);

				const UserSchema = z.object({
					username: z.string(),
					score: z.number(),
					active: z.boolean()
				});

				// @ts-expect-error - Type instantiation is excessively deep with Zod + AI SDK
				const result = await generateObject({
					model,
					schema: UserSchema,
					prompt: 'Generate: username="test", score=100, active=false'
				});

				expect(result.object).toBeDefined();
				expect(result.object).toHaveProperty('username');
				expect(result.object).toHaveProperty('score');
				expect(result.object).toHaveProperty('active');
			},
			60000
		);
	});

	describe('Structured Output Generator Utilities', () => {
		it('should prepare messages with schema', () => {
			const schema = {
				type: 'object' as const,
				properties: {
					name: { type: 'string' as const },
					age: { type: 'number' as const }
				}
			};

			const messages = StructuredOutputGenerator.prepareMessages({
				schema,
				objectName: 'Person',
				messages: [{ role: 'user', content: 'Generate person' }]
			});

			expect(messages.length).toBe(2);
			expect(messages[0].role).toBe('system');
			expect(messages[0].content).toContain('Person');
		});

		it('should extract and parse JSON responses', () => {
			const response = 'Here is the result: {"name": "John", "age": 30}';
			const parsed = StructuredOutputGenerator.extractAndParse(response);

			expect(parsed).toEqual({ name: 'John', age: 30 });
		});

		it('should extract JSON from markdown code blocks', () => {
			const response = '```json\n{"id": 1}\n```';
			const parsed = StructuredOutputGenerator.extractAndParse(response);

			expect(parsed).toEqual({ id: 1 });
		});

		it('should extract JSON from text with surrounding content', () => {
			const response =
				'Here is the result: {"name": "test"} - that was the output';
			const parsed = StructuredOutputGenerator.extractAndParse(response);
			expect(parsed).toEqual({ name: 'test' });
		});
	});
});

