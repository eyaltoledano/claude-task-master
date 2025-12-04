/**
 * Shared test schemas and fixtures for Snowflake provider tests
 *
 * Model lists are imported from src/utils/models.ts - the SINGLE SOURCE OF TRUTH
 */

import { z } from 'zod';

// Import model lists from the single source of truth
export {
	KNOWN_MODELS,
	ALL_MODEL_IDS,
	ALL_PREFIXED_MODEL_IDS,
	CLAUDE_MODEL_IDS,
	CLAUDE_PREFIXED_MODEL_IDS,
	OPENAI_MODEL_IDS,
	OPENAI_PREFIXED_MODEL_IDS,
	LLAMA_MODEL_IDS,
	LLAMA_PREFIXED_MODEL_IDS,
	MISTRAL_MODEL_IDS,
	MISTRAL_PREFIXED_MODEL_IDS,
	OTHER_MODEL_IDS,
	OTHER_PREFIXED_MODEL_IDS,
	STRUCTURED_OUTPUT_MODEL_IDS,
	STRUCTURED_OUTPUT_PREFIXED_MODEL_IDS,
	NO_STRUCTURED_OUTPUT_MODEL_IDS,
	NO_STRUCTURED_OUTPUT_PREFIXED_MODEL_IDS
} from '../../src/utils/models.js';

// =============== Test Constants ===============

/**
 * Default test model - Claude Haiku 4.5 (fast and reliable)
 */
export const TEST_MODEL = 'cortex/claude-haiku-4-5';

/**
 * Non-Claude model for specific tests
 */
export const TEST_MODEL_NON_CLAUDE = 'cortex/llama3.1-8b';

// =============== Zod Schemas for generateObject tests ===============

export const PersonSchema = z.object({
	name: z.string().describe('The name of the person'),
	age: z.number().describe('The age of the person')
});

export const TaskSchema = z.object({
	id: z.number().describe('Task ID'),
	title: z.string().describe('Task title'),
	done: z.boolean().describe('Whether the task is complete')
});

export const UserProfileSchema = z.object({
	username: z.string(),
	score: z.number(),
	active: z.boolean()
});

// =============== JSON Schema objects for schema transformation tests ===============

export const SIMPLE_OBJECT_SCHEMA = {
	type: 'object' as const,
	properties: {
		name: { type: 'string' as const },
		age: { type: 'number' as const }
	},
	required: ['name', 'age']
};

export const SCHEMA_WITH_STRING_CONSTRAINTS = {
	type: 'object' as const,
	properties: {
		text: {
			type: 'string' as const,
			minLength: 1,
			maxLength: 100,
			format: 'email'
		}
	}
};

export const SCHEMA_WITH_NUMBER_CONSTRAINTS = {
	type: 'object' as const,
	properties: {
		value: {
			type: 'number' as const,
			minimum: 0,
			maximum: 100,
			exclusiveMinimum: 0,
			exclusiveMaximum: 100,
			multipleOf: 0.5
		}
	}
};

export const SCHEMA_WITH_ARRAY_CONSTRAINTS = {
	type: 'object' as const,
	properties: {
		items: {
			type: 'array' as const,
			minItems: 1,
			maxItems: 10,
			uniqueItems: true,
			items: { type: 'string' as const }
		}
	}
};

export const SCHEMA_WITH_OBJECT_CONSTRAINTS = {
	type: 'object' as const,
	properties: {
		data: {
			type: 'object' as const,
			minProperties: 1,
			maxProperties: 10,
			patternProperties: { '^x-': { type: 'string' as const } }
		}
	}
};

export const SCHEMA_WITH_UNSUPPORTED_KEYWORDS = {
	type: 'object' as const,
	default: {},
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	additionalProperties: true,
	properties: {
		stringValue: {
			type: 'string' as const,
			minLength: 1,
			maxLength: 100,
			format: 'email'
		},
		numberValue: {
			type: 'number' as const,
			minimum: 0,
			maximum: 1000,
			exclusiveMinimum: 0,
			exclusiveMaximum: 1000,
			multipleOf: 0.5
		},
		arrayValue: {
			type: 'array' as const,
			minItems: 1,
			maxItems: 10,
			uniqueItems: true,
			items: { type: 'object' as const, additionalProperties: true }
		}
	},
	required: ['stringValue']
};

export const DEEPLY_NESTED_SCHEMA = {
	type: 'object' as const,
	properties: {
		level1: {
			type: 'object' as const,
			properties: {
				level2: {
					type: 'object' as const,
					properties: {
						level3: {
							type: 'string' as const,
							minLength: 10
						}
					}
				}
			}
		}
	}
};

export const SCHEMA_WITH_ANYOF_NULL = {
	type: 'object' as const,
	properties: {
		optional: {
			anyOf: [{ type: 'string' as const }, { type: 'null' as const }]
		}
	},
	additionalProperties: true
};

// =============== Test prompt matrices ===============

/**
 * Simple text generation test matrix
 * Each entry: [testName, prompt, expectedPattern]
 */
export const TEXT_GENERATION_MATRIX: ReadonlyArray<
	readonly [string, string, RegExp]
> = [
	['Simple greeting', 'Say "hello" and nothing else.', /hello/i],
	['Math question', 'What is 2+2? Answer with just the number.', /4/],
	['Single word', 'Say "test" only.', /test/i]
];

/**
 * Multi-turn conversation test matrix
 * Each entry: [testName, messages, expectedPattern]
 */
export const CONVERSATION_MATRIX: ReadonlyArray<
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

// =============== Test helper functions ===============

/**
 * Check if a JSON schema object contains a specific keyword anywhere
 */
export function hasKeyword(obj: unknown, keyword: string): boolean {
	if (!obj || typeof obj !== 'object') return false;
	if (Object.prototype.hasOwnProperty.call(obj, keyword)) return true;
	return Object.values(obj as Record<string, unknown>).some((value) =>
		hasKeyword(value, keyword)
	);
}

/**
 * Keywords that should be removed from schemas for Snowflake Cortex
 */
export const SCHEMA_UNSUPPORTED_KEYWORDS = [
	'$schema',
	'default',
	'minLength',
	'maxLength',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minProperties',
	'maxProperties',
	'patternProperties',
	'format'
];
