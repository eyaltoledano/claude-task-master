/**
 * Unit tests for schema transformation - PARALLEL FEATURE MATRIX
 */

import { describe, it, expect } from '@jest/globals';
import { UNSUPPORTED_KEYWORDS, removeUnsupportedFeatures, type JSONSchema } from '../../src/schema/transformer.js';
import { ModelHelpers } from '../../src/utils/model-helpers.js';

// Unsupported keywords validation matrix
const unsupportedKeywordsMatrix = [
	['minLength'],
	['maxLength'],
	['minimum'],
	['maximum'],
	['format'],
	['minItems'],
	['maxItems'],
	['uniqueItems'],
	['minProperties'],
	['maxProperties'],
	['patternProperties']
] as const;

describe.each(unsupportedKeywordsMatrix)('Unsupported Keyword: %s', (...args) => {
	const [keyword] = args;
	it('should be in UNSUPPORTED_KEYWORDS', () => {
		expect(UNSUPPORTED_KEYWORDS).toContain(keyword);
	});
});

// Constraint removal matrix - runs in parallel
const constraintRemovalMatrix = [
	[
		'String constraints',
		{ type: 'string', minLength: 5, maxLength: 100, format: 'email' },
		['minLength', 'maxLength', 'format'],
		['type']
	],
	[
		'Number constraints',
		{ type: 'number', minimum: 0, maximum: 100, multipleOf: 5 },
		['minimum', 'maximum', 'multipleOf'],
		['type']
	],
	[
		'Array constraints',
		{ type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: { type: 'string' } },
		['minItems', 'maxItems', 'uniqueItems'],
		['type', 'items']
	]
] as const;

describe.each(constraintRemovalMatrix)(
	'Constraint Removal: %s',
	(...args) => {
		const [testName, schema, shouldBeRemoved, shouldBeKept] = args;
		it('should remove unsupported and keep supported', () => {
			const cleaned = removeUnsupportedFeatures(schema);

			shouldBeRemoved.forEach((key) => {
				expect((cleaned as any)[key]).toBeUndefined();
			});

			shouldBeKept.forEach((key) => {
				expect((cleaned as any)[key]).toBeDefined();
			});
		});
	}
);

// Edge cases matrix - runs in parallel
const edgeCasesMatrix = [
	['null', null, null],
	['undefined', undefined, undefined],
	['string', 'string', 'string'],
	['number', 123, 123]
] as const;

describe.each(edgeCasesMatrix)('Edge Case: %s', (...args) => {
	const [testName, input, expected] = args;
	it('should handle correctly', () => {
		expect(removeUnsupportedFeatures(input as any)).toBe(expected);
	});
});

// Object additionalProperties test
describe('Object Schema', () => {
	it('should set additionalProperties: false', () => {
		const schema: JSONSchema = {
			type: 'object',
			properties: { name: { type: 'string' } }
		};
		const cleaned = removeUnsupportedFeatures(schema);
		expect(cleaned.additionalProperties).toBe(false);
	});
});

// anyOf null handling
describe('anyOf with null', () => {
	it('should simplify to type', () => {
		const schema: JSONSchema = {
			anyOf: [{ type: 'string' }, { type: 'null' }]
		};
		const cleaned = removeUnsupportedFeatures(schema);
		expect(cleaned.type).toBe('string');
		expect(cleaned.anyOf).toBeUndefined();
	});
});

// Recursive cleaning tests
describe('Recursive Cleaning', () => {
	it('should clean nested objects', () => {
		const schema: JSONSchema = {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						email: { type: 'string', minLength: 5 }
					}
				}
			}
		};
		const cleaned = removeUnsupportedFeatures(schema);
		expect(cleaned.properties?.user?.properties?.email?.minLength).toBeUndefined();
	});

	it('should clean array items', () => {
		const schema: JSONSchema = {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'number', minimum: 1 }
				}
			}
		};
		const cleaned = removeUnsupportedFeatures(schema);
		expect((cleaned.items as JSONSchema)?.properties?.id?.minimum).toBeUndefined();
	});

	it('should clean oneOf schemas', () => {
		const schema: JSONSchema = {
			oneOf: [
				{ type: 'string', minLength: 5 },
				{ type: 'number', minimum: 0 }
			]
		};
		const cleaned = removeUnsupportedFeatures(schema);
		expect(cleaned.oneOf?.[0]?.minLength).toBeUndefined();
		expect(cleaned.oneOf?.[1]?.minimum).toBeUndefined();
	});
});

// Cache test
describe('Caching', () => {
	it('should use cache for repeated calls', () => {
		const schema: JSONSchema = { type: 'string', minLength: 5 };
		const cleaned1 = removeUnsupportedFeatures(schema);
		const cleaned2 = removeUnsupportedFeatures(schema);
		expect(cleaned1).toBe(cleaned2);
	});
});

// Model helpers integration matrix
const modelHelpersMatrix = [
	['claude-sonnet-4-5', true],
	['openai-gpt-5', true],
	['mistral-large', false],
	['llama3-70b', false]
] as const;

describe.each(modelHelpersMatrix)(
	'Model Integration: %s',
	(...args) => {
		const [modelId, supportsStructured] = args;
		it('should have correct structured output support', () => {
			expect(ModelHelpers.supportsStructuredOutputs(modelId)).toBe(supportsStructured);
		});
	}
);

// Complex schema test
describe('Complex Schema', () => {
	it('should handle real-world task schema', () => {
		const schema: JSONSchema = {
			type: 'object',
			properties: {
				id: { type: 'number', minimum: 1 },
				title: { type: 'string', minLength: 1, maxLength: 200 },
				status: { type: 'string', enum: ['pending', 'done'] },
				dependencies: {
					type: 'array',
					items: { type: 'number', minimum: 1 },
					minItems: 0
				}
			},
			required: ['id', 'title'],
			additionalProperties: false
		};

		const cleaned = removeUnsupportedFeatures(schema);

		expect(cleaned.properties?.id?.minimum).toBeUndefined();
		expect(cleaned.properties?.title?.minLength).toBeUndefined();
		expect(cleaned.type).toBe('object');
		expect(cleaned.required).toEqual(['id', 'title']);
	});
});
