/**
 * Unit tests for StructuredOutputGenerator - PARALLEL FEATURE MATRIX
 */

import { describe, it, expect, jest } from '@jest/globals';
import { StructuredOutputGenerator } from '../../../src/schema/structured-output.js';
import type { JSONSchema } from '../../../src/schema/transformer.js';

// System prompt validation matrix - runs in parallel
const systemPromptMatrix = [
	[
		'Simple object',
		{ type: 'object' as const, properties: { name: { type: 'string' as const } } },
		'Person',
		['Person', 'JSON object', '"name"']
	],
	[
		'Nested object',
		{
			type: 'object' as const,
			properties: {
				user: {
					type: 'object' as const,
					properties: { id: { type: 'number' as const } }
				}
			}
		},
		'UserWrapper',
		['UserWrapper', '"user"', '"id"']
	]
] as const;

describe.each(systemPromptMatrix)(
	'System Prompt: %s',
	(...args) => {
		const [testName, schema, objectName, expectedContent] = args;
		it('should build correct prompt', () => {
			const prompt = StructuredOutputGenerator.buildSystemPrompt(schema, objectName);

			expectedContent.forEach((content) => {
				expect(prompt).toContain(content);
			});

			expect(prompt).toContain('ONLY');
			expect(prompt).toContain('DO NOT wrap in markdown');
		});
	}
);

// Message preparation matrix - runs in parallel
const messagePrepMatrix = [
	[
		'Single user message',
		[{ role: 'user' as const, content: 'Test' }],
		2 // System + user
	],
	[
		'Conversation',
		[
			{ role: 'user' as const, content: 'First' },
			{ role: 'assistant' as const, content: 'Second' },
			{ role: 'user' as const, content: 'Third' }
		],
		4 // System + 3 messages
	],
	[
		'Empty messages',
		[],
		1 // Just system
	]
] as const;

describe.each(messagePrepMatrix)(
	'Message Preparation: %s',
	(...args) => {
		const [testName, messages, expectedLength] = args;
		it('should prepare messages correctly', () => {
			const schema = { type: 'object' as const, properties: {} };
			const result = StructuredOutputGenerator.prepareMessages({
				schema,
				objectName: 'Test',
				messages: messages as any
			});

			expect(result.length).toBe(expectedLength);
			expect(result[0].role).toBe('system');
		});
	}
);

// JSON extraction matrix - runs in parallel
const jsonExtractionMatrix = [
	['Simple object', '{"name": "John"}', '{"name": "John"}'],
	['With text before', 'Here is: {"name": "John"}', '{"name": "John"}'],
	['Nested object', '{"user": {"id": 1}}', '{"user": {"id": 1}}'],
	['Escaped quotes', '{"msg": "He said \\"hi\\""}', '{"msg": "He said \\"hi\\""}'],
	['With array', '{"items": [1, 2, 3]}', '{"items": [1, 2, 3]}'],
	['No JSON', 'Plain text', null]
] as const;

describe.each(jsonExtractionMatrix)(
	'JSON Extraction: %s',
	(...args) => {
		const [testName, input, expected] = args;
		it('should extract correctly', () => {
			const result = StructuredOutputGenerator.extractFirstJsonObject(input);
			expect(result).toBe(expected);
		});
	}
);

// JSON parsing matrix - runs in parallel
const jsonParsingMatrix = [
	['Valid JSON', '{"name": "John"}', { name: 'John' }],
	['Unquoted keys', '{name: "John"}', { name: 'John' }],
	['Nested', '{"user": {"id": 1}}', { user: { id: 1 } }],
	['Array', '{"items": [1, 2]}', { items: [1, 2] }]
] as const;

describe.each(jsonParsingMatrix)('JSON Parsing: %s', (...args) => {
	const [testName, input, expected] = args;
	it('should parse correctly', () => {
		const result = StructuredOutputGenerator.parseWithFallback(input);
		expect(result).toEqual(expected);
	});
});

// Extract and parse matrix - runs in parallel
const extractParseMatrix = [
	['Text with JSON', 'Response: {"name": "John"}', { name: 'John' }],
	['Markdown code', '```json\n{"name": "John"}\n```', { name: 'John' }],
	['Code block', '```\n{"name": "John"}\n```', { name: 'John' }]
] as const;

describe.each(extractParseMatrix)(
	'Extract and Parse: %s',
	(...args) => {
		const [testName, input, expected] = args;
		it('should extract and parse correctly', () => {
			const result = StructuredOutputGenerator.extractAndParse(input);
			expect(result).toEqual(expected);
		});
	}
);

// Generate object tests
describe('Generate Object', () => {
	it('should generate with valid response', async () => {
		const mockGenerateText = jest.fn(async () => ({
			text: '{"name": "John", "age": 30}',
			finishReason: 'stop' as const,
			usage: { promptTokens: 10, completionTokens: 20 }
		}));

		const result = await StructuredOutputGenerator.generateObject({
			generateText: mockGenerateText as any,
			schema: {
				type: 'object',
				properties: { name: { type: 'string' }, age: { type: 'number' } }
			},
			objectName: 'Person',
			messages: [{ role: 'user', content: 'Generate person' }]
		});

		expect(result.object).toEqual({ name: 'John', age: 30 });
		expect(result.usage.promptTokens).toBe(10);
	});

	// Validation error matrix - runs in parallel
	const validationErrorMatrix = [
		['Missing schema', { schema: null, objectName: 'Test', messages: [] }, /Schema is required/],
		[
			'Missing objectName',
			{
				schema: { type: 'object' },
				objectName: '',
				messages: []
			},
			/Object name is required/
		],
		[
			'Missing generateText',
			{
				generateText: null,
				schema: { type: 'object' },
				objectName: 'Test',
				messages: []
			},
			/generateText function is required/
		]
	] as const;

	describe.each(validationErrorMatrix)(
		'Validation: %s',
		(...args) => {
			const [testName, params, errorPattern] = args;
			it('should throw validation error', async () => {
				await expect(
					StructuredOutputGenerator.generateObject(params as any)
				).rejects.toThrow(errorPattern);
			});
		}
	);
});

// Static methods availability
const staticMethodsMatrix = [
	['buildSystemPrompt'],
	['prepareMessages'],
	['extractFirstJsonObject'],
	['parseWithFallback'],
	['extractAndParse'],
	['generateObject']
] as const;

describe.each(staticMethodsMatrix)('Static Method: %s', (...args) => {
	const [methodName] = args;
	it('should be available', () => {
		expect(typeof (StructuredOutputGenerator as any)[methodName]).toBe('function');
	});
});
