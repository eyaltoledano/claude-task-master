/**
 * Schema Transformation Integration Tests
 *
 * Tests for JSON schema transformation and cleaning including:
 * - Removal of unsupported keywords
 * - Recursive schema cleaning
 * - anyOf/null flattening
 * - Various constraint types
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect } from '@jest/globals';
import { config } from 'dotenv';
import { resolve } from 'path';
import {
	removeUnsupportedFeatures,
	UNSUPPORTED_KEYWORDS,
	type JSONSchema
} from '../../../src/index.js';
import { describeWithCredentials } from '../../test-utils.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

describeWithCredentials('Schema Transformation Integration Tests', () => {
	describe('Basic Schema Cleaning', () => {
		it.concurrent('should remove unsupported schema keywords', async () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					name: { type: 'string', minLength: 1, maxLength: 100 },
					age: { type: 'number', minimum: 0, maximum: 150 }
				},
				required: ['name']
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties!.name.minLength).toBeUndefined();
			expect(cleaned.properties!.name.maxLength).toBeUndefined();
			expect(cleaned.properties!.age.minimum).toBeUndefined();
			expect(cleaned.properties!.age.maximum).toBeUndefined();
			expect(cleaned.additionalProperties).toBe(false);
		});

		it.concurrent('should recursively clean nested schemas', async () => {
			const schema: JSONSchema = {
				type: 'object',
				default: {},
				$schema: 'https://example.com/schema',
				additionalProperties: true,
				properties: {
					stringValue: {
						type: 'string',
						minLength: 1,
						maxLength: 100,
						format: 'email'
					},
					numberValue: {
						type: 'number',
						minimum: 0,
						maximum: 1000,
						exclusiveMinimum: 0,
						exclusiveMaximum: 1000,
						multipleOf: 0.5
					},
					arrayValue: {
						type: 'array',
						minItems: 1,
						maxItems: 10,
						uniqueItems: true,
						items: { type: 'object', additionalProperties: true }
					}
				},
				required: ['stringValue']
			};
			const cleaned = removeUnsupportedFeatures(schema);
			const hasKeyword = (obj: unknown, keyword: string): boolean => {
				if (!obj || typeof obj !== 'object') return false;
				if (Object.prototype.hasOwnProperty.call(obj, keyword)) return true;
				return Object.values(obj).some((value) => hasKeyword(value, keyword));
			};
			UNSUPPORTED_KEYWORDS.forEach((keyword) =>
				expect(hasKeyword(cleaned, keyword)).toBe(false)
			);
			expect(cleaned.additionalProperties).toBe(false);
		});

		it.concurrent(
			'should flatten anyOf with null to optional types',
			async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: {
						optional: {
							anyOf: [{ type: 'string' }, { type: 'null' }]
						}
					},
					additionalProperties: true
				};
				const cleaned = removeUnsupportedFeatures(schema);
				expect(cleaned.properties?.optional.anyOf).toBeUndefined();
				expect(cleaned.properties?.optional.type).toBe('string');
			}
		);
	});

	describe('Constraint Removal', () => {
		it('should leave plain object schema type intact', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: { name: { type: 'string' } }
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.type).toBe('object');
			expect(cleaned.properties!.name.type).toBe('string');
		});

		it('should set additionalProperties to false', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: { name: { type: 'string' } },
				additionalProperties: true
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.additionalProperties).toBe(false);
		});

		it('should remove string constraints', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					text: {
						type: 'string',
						minLength: 1,
						maxLength: 100,
						format: 'email'
					}
				}
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties!.text.minLength).toBeUndefined();
			expect(cleaned.properties!.text.maxLength).toBeUndefined();
			expect(cleaned.properties!.text.format).toBeUndefined();
		});

		it('should remove number constraints', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					value: {
						type: 'number',
						minimum: 0,
						maximum: 100,
						exclusiveMinimum: 0,
						exclusiveMaximum: 100,
						multipleOf: 0.5
					}
				}
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties!.value.minimum).toBeUndefined();
			expect(cleaned.properties!.value.maximum).toBeUndefined();
			expect(cleaned.properties!.value.exclusiveMinimum).toBeUndefined();
			expect(cleaned.properties!.value.exclusiveMaximum).toBeUndefined();
			expect(cleaned.properties!.value.multipleOf).toBeUndefined();
		});

		it('should remove array constraints', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					items: {
						type: 'array',
						minItems: 1,
						maxItems: 10,
						uniqueItems: true,
						items: { type: 'string' }
					}
				}
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties!.items.minItems).toBeUndefined();
			expect(cleaned.properties!.items.maxItems).toBeUndefined();
			expect(cleaned.properties!.items.uniqueItems).toBeUndefined();
		});

		it('should remove $schema and default keywords', () => {
			const schema: JSONSchema = {
				$schema: 'https://json-schema.org/draft/2020-12/schema',
				type: 'object',
				default: {},
				properties: {
					name: { type: 'string', default: '' }
				}
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.$schema).toBeUndefined();
			expect(cleaned.default).toBeUndefined();
			expect(cleaned.properties!.name.default).toBeUndefined();
		});
	});

	describe('Nested Schema Handling', () => {
		it('should recursively clean nested schemas', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					nested: {
						type: 'object',
						additionalProperties: true,
						properties: {
							field: {
								type: 'string',
								minLength: 5,
								maxLength: 100
							}
						}
					}
				}
			};
			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties!.nested.additionalProperties).toBe(false);
			expect(
				cleaned.properties!.nested.properties!.field.minLength
			).toBeUndefined();
			expect(
				cleaned.properties!.nested.properties!.field.maxLength
			).toBeUndefined();
		});

		it('should handle deeply nested schemas', () => {
			const deepSchema: JSONSchema = {
				type: 'object',
				properties: {
					level1: {
						type: 'object',
						properties: {
							level2: {
								type: 'object',
								properties: {
									level3: {
										type: 'string',
										minLength: 10
									}
								}
							}
						}
					}
				}
			};

			const cleaned = removeUnsupportedFeatures(deepSchema);
			expect(
				cleaned.properties!.level1.properties!.level2.properties!.level3.minLength
			).toBeUndefined();
		});
	});

	describe('Schema Transformation Matrix', () => {
		const schemaTransformationMatrix: [string, JSONSchema, string[]][] = [
			[
				'String constraints',
				{
					type: 'object',
					properties: {
						text: {
							type: 'string',
							minLength: 5,
							maxLength: 100,
							format: 'email'
						}
					}
				},
				['minLength', 'maxLength', 'format']
			],
			[
				'Number constraints',
				{
					type: 'object',
					properties: {
						value: {
							type: 'number',
							minimum: 0,
							maximum: 100
						}
					}
				},
				['minimum', 'maximum']
			],
			[
				'Array constraints',
				{
					type: 'object',
					properties: {
						items: {
							type: 'array',
							minItems: 1,
							maxItems: 5,
							uniqueItems: true,
							items: { type: 'string' }
						}
					}
				},
				['minItems', 'maxItems', 'uniqueItems']
			],
			[
				'Object constraints',
				{
					type: 'object',
					properties: {
						data: {
							type: 'object',
							minProperties: 1,
							maxProperties: 10,
							patternProperties: { '^x-': { type: 'string' } }
						}
					}
				},
				['minProperties', 'maxProperties', 'patternProperties']
			]
		];

		it.each(schemaTransformationMatrix)(
			'should remove %s',
			(_name: string, schema: JSONSchema, removedKeys: string[]) => {
				const cleaned = removeUnsupportedFeatures(schema);
				const firstPropKey = Object.keys(cleaned.properties ?? {})[0];
				const cleanedProp = cleaned.properties?.[firstPropKey];

				removedKeys.forEach((key) => {
					expect((cleanedProp as Record<string, unknown>)?.[key]).toBeUndefined();
				});
			}
		);

		it('should flatten anyOf with null to optional type', () => {
			const schema: JSONSchema = {
				type: 'object',
				properties: {
					optional: {
						anyOf: [{ type: 'string' }, { type: 'null' }]
					}
				}
			};

			const cleaned = removeUnsupportedFeatures(schema);
			expect(cleaned.properties!.optional.anyOf).toBeUndefined();
			expect(cleaned.properties!.optional.type).toBe('string');
		});
	});
});

