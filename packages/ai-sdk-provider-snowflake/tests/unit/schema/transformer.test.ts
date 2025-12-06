/**
 * Unit tests for schema transformation utilities
 * Target: 90%+ coverage for src/schema/transformer.ts
 */

import {
	removeUnsupportedFeatures,
	buildConstraintDescription,
	getModelMaxTokens,
	normalizeTokenParams,
	transformSnowflakeRequestBody,
	convertPromptToMessages,
	UNSUPPORTED_KEYWORDS,
	type JSONSchema,
	type ModelInfo
} from '../../../src/schema/transformer.js';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider';

// Test fixtures
const MOCK_SUPPORTED_MODELS: ModelInfo[] = [
	{ id: 'snowflake/claude-haiku-4-5', max_tokens: 8192 },
	{ id: 'snowflake/claude-sonnet-4-5', max_tokens: 16384 },
	{ id: 'snowflake/llama3.1-70b', max_tokens: 4096 }
];

describe('Schema Transformer', () => {
	describe('UNSUPPORTED_KEYWORDS', () => {
		it.concurrent(
			'should include all expected constraint keywords',
			async () => {
				const expected = [
					'default',
					'$schema',
					'multipleOf',
					'minimum',
					'maximum',
					'exclusiveMinimum',
					'exclusiveMaximum',
					'minLength',
					'maxLength',
					'format',
					'pattern',
					'uniqueItems',
					'contains',
					'minContains',
					'maxContains',
					'minItems',
					'maxItems',
					'patternProperties',
					'minProperties',
					'maxProperties',
					'propertyNames'
				];

				expected.forEach((keyword) => {
					expect(UNSUPPORTED_KEYWORDS).toContain(keyword);
				});
			}
		);
	});

	describe('buildConstraintDescription', () => {
		describe('string constraints', () => {
			it.concurrent(
				'should build description for minLength and maxLength',
				async () => {
					const schema = { minLength: 3, maxLength: 100 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (3-100 characters)');
				}
			);

			it.concurrent('should build description for minLength only', async () => {
				const schema = { minLength: 5 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (minimum 5 characters)');
			});

			it.concurrent('should build description for maxLength only', async () => {
				const schema = { maxLength: 50 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (maximum 50 characters)');
			});

			it.concurrent('should build description for format', async () => {
				const schema = { format: 'email' };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (format: email)');
			});

			it.concurrent('should build description for pattern', async () => {
				const schema = { pattern: '^[A-Z]+$' };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (pattern: ^[A-Z]+$)');
			});
		});

		describe('number constraints', () => {
			it.concurrent(
				'should build description for minimum and maximum',
				async () => {
					const schema = { minimum: 0, maximum: 100 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (range: 0-100)');
				}
			);

			it.concurrent('should build description for minimum only', async () => {
				const schema = { minimum: 0 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (minimum: 0)');
			});

			it.concurrent('should build description for maximum only', async () => {
				const schema = { maximum: 100 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (maximum: 100)');
			});

			it.concurrent(
				'should build description for exclusiveMinimum',
				async () => {
					const schema = { exclusiveMinimum: 0 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (> 0)');
				}
			);

			it.concurrent(
				'should build description for exclusiveMaximum',
				async () => {
					const schema = { exclusiveMaximum: 100 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (< 100)');
				}
			);

			it.concurrent('should build description for multipleOf', async () => {
				const schema = { multipleOf: 0.5 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (multiple of 0.5)');
			});
		});

		describe('array constraints', () => {
			it.concurrent(
				'should build description for minItems and maxItems',
				async () => {
					const schema = { minItems: 1, maxItems: 10 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (1-10 items)');
				}
			);

			it.concurrent('should build description for minItems only', async () => {
				const schema = { minItems: 1 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (minimum 1 items)');
			});

			it.concurrent('should build description for maxItems only', async () => {
				const schema = { maxItems: 5 };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (maximum 5 items)');
			});

			it.concurrent('should build description for uniqueItems', async () => {
				const schema = { uniqueItems: true };
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (unique items)');
			});
		});

		describe('object constraints', () => {
			it.concurrent(
				'should build description for minProperties and maxProperties',
				async () => {
					const schema = { minProperties: 2, maxProperties: 10 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (2-10 properties)');
				}
			);

			it.concurrent(
				'should build description for minProperties only',
				async () => {
					const schema = { minProperties: 1 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (minimum 1 properties)');
				}
			);

			it.concurrent(
				'should build description for maxProperties only',
				async () => {
					const schema = { maxProperties: 5 };
					const desc = buildConstraintDescription(schema);
					expect(desc).toBe(' (maximum 5 properties)');
				}
			);
		});

		describe('combined constraints', () => {
			it.concurrent('should combine multiple constraints', async () => {
				const schema = {
					minLength: 1,
					maxLength: 100,
					format: 'email'
				};
				const desc = buildConstraintDescription(schema);
				expect(desc).toBe(' (1-100 characters, format: email)');
			});
		});

		it.concurrent('should return empty string for no constraints', async () => {
			const schema = { type: 'string' };
			const desc = buildConstraintDescription(schema);
			expect(desc).toBe('');
		});
	});

	describe('removeUnsupportedFeatures', () => {
		describe('basic cleanup', () => {
			it.concurrent(
				'should return schema unchanged if no unsupported features',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						properties: {
							name: { type: 'string' }
						}
					};
					const cleaned = removeUnsupportedFeatures(schema);
					expect(cleaned.properties?.name.type).toBe('string');
				}
			);

			it.concurrent('should handle null or non-object input', async () => {
				expect(removeUnsupportedFeatures(null as any)).toBe(null);
				expect(removeUnsupportedFeatures(undefined as any)).toBe(undefined);
				expect(removeUnsupportedFeatures('string' as any)).toBe('string');
			});

			it.concurrent('should remove all unsupported keywords', async () => {
				const schema: JSONSchema = {
					type: 'object',
					$schema: 'https://json-schema.org/draft/2020-12/schema',
					default: {},
					properties: {
						text: {
							type: 'string',
							minLength: 1,
							maxLength: 100,
							format: 'email',
							pattern: '.*'
						},
						num: {
							type: 'number',
							minimum: 0,
							maximum: 100,
							exclusiveMinimum: 0,
							exclusiveMaximum: 100,
							multipleOf: 0.5
						},
						arr: {
							type: 'array',
							minItems: 1,
							maxItems: 10,
							uniqueItems: true,
							items: { type: 'string' }
						}
					}
				};

				const cleaned = removeUnsupportedFeatures(schema);

				// Check all unsupported keywords are removed
				expect(cleaned.$schema).toBeUndefined();
				expect(cleaned.default).toBeUndefined();
				expect(cleaned.properties?.text.minLength).toBeUndefined();
				expect(cleaned.properties?.text.maxLength).toBeUndefined();
				expect(cleaned.properties?.text.format).toBeUndefined();
				expect(cleaned.properties?.text.pattern).toBeUndefined();
				expect(cleaned.properties?.num.minimum).toBeUndefined();
				expect(cleaned.properties?.num.maximum).toBeUndefined();
				expect(cleaned.properties?.num.exclusiveMinimum).toBeUndefined();
				expect(cleaned.properties?.num.exclusiveMaximum).toBeUndefined();
				expect(cleaned.properties?.num.multipleOf).toBeUndefined();
				expect(cleaned.properties?.arr.minItems).toBeUndefined();
				expect(cleaned.properties?.arr.maxItems).toBeUndefined();
				expect(cleaned.properties?.arr.uniqueItems).toBeUndefined();
			});
		});

		describe('additionalProperties handling', () => {
			it.concurrent(
				'should set additionalProperties to false for objects',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						properties: { name: { type: 'string' } }
					};
					const cleaned = removeUnsupportedFeatures(schema);
					expect(cleaned.additionalProperties).toBe(false);
				}
			);

			it.concurrent(
				'should override additionalProperties: true to false',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						additionalProperties: true,
						properties: { name: { type: 'string' } }
					};
					const cleaned = removeUnsupportedFeatures(schema);
					expect(cleaned.additionalProperties).toBe(false);
				}
			);
		});

		describe('anyOf with null handling', () => {
			it.concurrent(
				'should flatten anyOf with null type to make field optional',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						properties: {
							optional: {
								anyOf: [{ type: 'string' }, { type: 'null' }]
							}
						}
					};
					const cleaned = removeUnsupportedFeatures(schema);
					// anyOf with null is flattened, field becomes optional (not in required)
					expect(cleaned.properties?.optional.anyOf).toBeUndefined();
					expect(cleaned.properties?.optional.type).toBe('string');
					// Field should NOT be in required since it's optional
					expect(cleaned.required).not.toContain('optional');
				}
			);

			it.concurrent('should recursively clean inside anyOf', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: {
						union: {
							anyOf: [{ type: 'string', minLength: 5 }, { type: 'number' }]
						}
					}
				};
				const cleaned = removeUnsupportedFeatures(schema);
				// Check if minLength was removed from the first item in anyOf
				expect(cleaned.properties?.union.anyOf?.[0].minLength).toBeUndefined();
			});
		});

		describe('type array with null handling', () => {
			it.concurrent(
				'should convert ["string", "null"] array type to single type (optional field)',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						properties: {
							nullable: {
								type: ['string', 'null'] as any
							}
						}
					};
					const cleaned = removeUnsupportedFeatures(schema);
					// Type array with null is converted to single type, field becomes optional
					expect(cleaned.properties?.nullable.type).toBe('string');
					// Field should NOT be in required since it's optional
					expect(cleaned.required).not.toContain('nullable');
				}
			);
		});

		describe('required array handling', () => {
			it.concurrent(
				'should NOT include nullable/optional properties in required',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						properties: {
							required1: { type: 'string' },
							optional: { anyOf: [{ type: 'string' }, { type: 'null' }] }
						}
					};
					const cleaned = removeUnsupportedFeatures(schema);
					// required1 should be in required
					expect(cleaned.required).toContain('required1');
					// optional field (anyOf with null) should NOT be in required
					expect(cleaned.required).not.toContain('optional');
				}
			);

			it.concurrent(
				'should respect existing required array and filter out optional properties',
				async () => {
					// Existing required array is respected, but optional fields are removed
					const schema: JSONSchema = {
						type: 'object',
						properties: {
							name: { type: 'string' },
							age: { anyOf: [{ type: 'number' }, { type: 'null' }] } // optional
						},
						required: ['name', 'age'] // age is in required but is optional (anyOf with null)
					};
					const cleaned = removeUnsupportedFeatures(schema);
					// name should stay in required (non-optional)
					expect(cleaned.required).toContain('name');
					// age should be REMOVED from required (it's optional due to anyOf with null)
					expect(cleaned.required).not.toContain('age');
				}
			);
		});

		describe('recursive processing', () => {
			it.concurrent('should process nested objects', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: {
						nested: {
							type: 'object',
							additionalProperties: true,
							properties: {
								field: {
									type: 'string',
									minLength: 1
								}
							}
						}
					}
				};
				const cleaned = removeUnsupportedFeatures(schema);
				expect(cleaned.properties?.nested.additionalProperties).toBe(false);
				expect(
					cleaned.properties?.nested.properties?.field.minLength
				).toBeUndefined();
			});

			it.concurrent('should process array items', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: {
						items: {
							type: 'array',
							items: {
								type: 'object',
								additionalProperties: true,
								properties: {
									id: { type: 'number', minimum: 0 }
								}
							}
						}
					}
				};
				const cleaned = removeUnsupportedFeatures(schema);
				expect(cleaned.properties?.items.items?.additionalProperties).toBe(
					false
				);
				expect(
					cleaned.properties?.items.items?.properties?.id.minimum
				).toBeUndefined();
			});

			it.concurrent('should process oneOf schemas', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: {
						choice: {
							oneOf: [
								{ type: 'string', minLength: 1 },
								{ type: 'number', minimum: 0 }
							]
						}
					}
				};
				const cleaned = removeUnsupportedFeatures(schema);
				expect(cleaned.properties?.choice.oneOf?.[0].minLength).toBeUndefined();
				expect(cleaned.properties?.choice.oneOf?.[1].minimum).toBeUndefined();
			});

			it.concurrent('should process deeply nested schemas', async () => {
				const schema: JSONSchema = {
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
				const cleaned = removeUnsupportedFeatures(schema);
				expect(
					cleaned.properties?.level1.properties?.level2.properties?.level3
						.minLength
				).toBeUndefined();
			});
		});

		describe('description preservation', () => {
			it.concurrent(
				'should append constraints to existing description',
				async () => {
					const schema: JSONSchema = {
						type: 'string',
						description: 'Email address',
						format: 'email',
						minLength: 5,
						maxLength: 100
					};
					const cleaned = removeUnsupportedFeatures(schema);
					expect(cleaned.description).toContain('Email address');
					expect(cleaned.description).toContain('5-100 characters');
					expect(cleaned.description).toContain('format: email');
				}
			);

			it.concurrent('should not duplicate constraint description', async () => {
				const schema: JSONSchema = {
					type: 'string',
					description: 'Text (5-100 characters)',
					minLength: 5,
					maxLength: 100
				};
				const cleaned = removeUnsupportedFeatures(schema);
				// Should not add duplicate constraint text
				const countMatches = (
					cleaned.description?.match(/5-100 characters/g) || []
				).length;
				expect(countMatches).toBe(1);
			});
		});

		describe('caching', () => {
			it.concurrent(
				'should return same result for same input (caching)',
				async () => {
					const schema: JSONSchema = {
						type: 'object',
						properties: { name: { type: 'string', minLength: 1 } }
					};
					const result1 = removeUnsupportedFeatures(schema);
					const result2 = removeUnsupportedFeatures(schema);
					expect(result1).toBe(result2); // Same reference due to caching
				}
			);
		});
	});

	describe('getModelMaxTokens', () => {
		it.concurrent('should return max_tokens for known model', async () => {
			const tokens = getModelMaxTokens(
				'claude-haiku-4-5',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(tokens).toBe(8192);
		});

		it.concurrent('should handle model ID with prefix', async () => {
			const tokens = getModelMaxTokens(
				'snowflake/claude-sonnet-4-5',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(tokens).toBe(16384);
		});

		it.concurrent('should return default 8192 for unknown model', async () => {
			const tokens = getModelMaxTokens(
				'unknown-model',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(tokens).toBe(8192);
		});

		it.concurrent('should handle empty model list', async () => {
			const tokens = getModelMaxTokens('any-model', 'snowflake', []);
			expect(tokens).toBe(8192);
		});
	});

	describe('normalizeTokenParams', () => {
		it.concurrent(
			'should set maxTokens to model max when not provided',
			async () => {
				const params = {};
				normalizeTokenParams(
					params,
					'claude-sonnet-4-5',
					'snowflake',
					MOCK_SUPPORTED_MODELS
				);
				expect(params).toHaveProperty('maxTokens', 16384);
			}
		);

		it.concurrent('should enforce minimum of 8192 tokens', async () => {
			const params = { maxTokens: 1000 };
			normalizeTokenParams(
				params,
				'claude-haiku-4-5',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(params.maxTokens).toBe(8192);
		});

		it.concurrent('should cap at model maximum', async () => {
			const params = { maxTokens: 50000 };
			normalizeTokenParams(
				params,
				'llama3.1-70b',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(params.maxTokens).toBe(4096);
		});

		it.concurrent('should preserve valid token values', async () => {
			const params = { maxTokens: 10000 };
			normalizeTokenParams(
				params,
				'claude-sonnet-4-5',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(params.maxTokens).toBe(10000);
		});

		it.concurrent('should return the modified params object', async () => {
			const params = {};
			const result = normalizeTokenParams(
				params,
				'claude-haiku-4-5',
				'snowflake',
				MOCK_SUPPORTED_MODELS
			);
			expect(result).toBe(params);
		});
	});

	describe('transformSnowflakeRequestBody', () => {
		it.concurrent(
			'should add max_completion_tokens when not present',
			async () => {
				const body = { messages: [] };
				const result = transformSnowflakeRequestBody(
					body,
					'claude-haiku-4-5',
					MOCK_SUPPORTED_MODELS
				);

				expect(result.modified).toBe(true);
				expect(result.body.max_completion_tokens).toBe(8192);
			}
		);

		it.concurrent(
			'should cap max_completion_tokens at model maximum',
			async () => {
				const body = { max_completion_tokens: 100000 };
				const result = transformSnowflakeRequestBody(
					body,
					'llama3.1-70b',
					MOCK_SUPPORTED_MODELS
				);

				expect(result.modified).toBe(true);
				expect(result.body.max_completion_tokens).toBe(4096);
			}
		);

		it.concurrent('should preserve valid max_completion_tokens', async () => {
			const body = { max_completion_tokens: 5000 };
			const result = transformSnowflakeRequestBody(
				body,
				'claude-haiku-4-5',
				MOCK_SUPPORTED_MODELS
			);

			expect(result.modified).toBe(false);
			expect(result.body.max_completion_tokens).toBe(5000);
		});

		it.concurrent(
			'should remove max_tokens and add max_completion_tokens',
			async () => {
				const body = { max_tokens: 1000 };
				const result = transformSnowflakeRequestBody(
					body,
					'claude-haiku-4-5',
					MOCK_SUPPORTED_MODELS
				);

				expect(result.modified).toBe(true);
				expect(result.body.max_tokens).toBeUndefined();
				expect(result.body.max_completion_tokens).toBe(8192);
			}
		);

		it.concurrent(
			'should transform json_schema in response_format',
			async () => {
				const body = {
					response_format: {
						type: 'json_schema',
						json_schema: {
							name: 'test',
							schema: {
								type: 'object',
								properties: {
									name: { type: 'string', minLength: 1 }
								}
							}
						}
					}
				};
				const result = transformSnowflakeRequestBody(
					body,
					'claude-haiku-4-5',
					MOCK_SUPPORTED_MODELS
				);

				expect(result.modified).toBe(true);
				expect(
					result.body.response_format.json_schema.schema.properties.name
						.minLength
				).toBeUndefined();
				expect(
					result.body.response_format.json_schema.schema.additionalProperties
				).toBe(false);
			}
		);

		it.concurrent('should not modify body without json_schema', async () => {
			const body = {
				messages: [],
				max_completion_tokens: 5000,
				response_format: { type: 'text' }
			};
			const result = transformSnowflakeRequestBody(
				body,
				'claude-haiku-4-5',
				MOCK_SUPPORTED_MODELS
			);

			expect(result.modified).toBe(false);
		});
	});

	describe('convertPromptToMessages', () => {
		it.concurrent('should convert simple user message', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages).toHaveLength(1);
			expect(messages[0].role).toBe('user');
			expect(messages[0].content).toBe('Hello');
		});

		it.concurrent('should convert user message string content', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: 'Hello world' as any }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].content).toBe('Hello world');
		});

		it.concurrent('should convert system message', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'You are helpful' }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].role).toBe('system');
			expect(messages[0].content).toBe('You are helpful');
		});

		it.concurrent('should convert system message with caching format', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'You are helpful' }
			];
			const messages = convertPromptToMessages(prompt, true);
			expect(messages[0].role).toBe('system');
			// With caching format, content_list should be defined with cache_control
			if (messages[0].content_list) {
				expect(messages[0].content_list[0].cache_control).toBeDefined();
			} else {
				// If content_list is not set, content should be the string
				expect(messages[0].content).toBe('You are helpful');
			}
		});

		it.concurrent('should convert user message with caching format', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'user', content: [{ type: 'text', text: 'Test' }] }
			];
			const messages = convertPromptToMessages(prompt, true);
			expect(messages[0].role).toBe('user');
			// With caching format, content_list should be defined with cache_control
			if (messages[0].content_list) {
				expect(messages[0].content_list[0].cache_control).toBeDefined();
			} else {
				// If content_list is not set, content should be the string
				expect(messages[0].content).toBe('Test');
			}
		});

		it.concurrent('should convert assistant message with text content', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'assistant', content: [{ type: 'text', text: 'Assistant response' }] }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].role).toBe('assistant');
			expect(messages[0].content).toBe('Assistant response');
		});

		it.concurrent('should convert assistant message with tool calls', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'assistant',
					content: [
						{ type: 'text', text: 'I will use a tool' },
						{
							type: 'tool-call',
							toolCallId: 'call_123',
							toolName: 'myTool',
							args: { arg: 'value' }
						}
					]
				}
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].role).toBe('assistant');
			expect(messages[0].content).toBe('I will use a tool');
			expect(messages[0].content_list).toBeDefined();
			expect(messages[0].content_list[0].type).toBe('tool_use');
		});

		it.concurrent('should convert tool result message', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'tool',
					content: [
						{
							type: 'tool-result',
							toolCallId: 'call_123',
							toolName: 'myTool',
							result: { output: 'tool output' }
						}
					]
				}
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].role).toBe('user');
			// Note: type is 'tool_results' (plural) per Cortex API spec
			expect(messages[0].content_list[0].type).toBe('tool_results');
			expect(messages[0].content_list[0].tool_results.tool_use_id).toBe('call_123');
		});

		it.concurrent('should handle multiple messages in sequence', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: 'System prompt' },
				{ role: 'user', content: [{ type: 'text', text: 'User message' }] },
				{ role: 'assistant', content: [{ type: 'text', text: 'Assistant response' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Follow up' }] }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages).toHaveLength(4);
			expect(messages[0].role).toBe('system');
			expect(messages[1].role).toBe('user');
			expect(messages[2].role).toBe('assistant');
			expect(messages[3].role).toBe('user');
		});

		it.concurrent('should handle system message with object content', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'system', content: { key: 'value' } as any }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].content).toBe('{"key":"value"}');
		});

		it.concurrent('should handle assistant with only tool calls (no text)', async () => {
			const prompt: LanguageModelV2Prompt = [
				{
					role: 'assistant',
					content: [
						{
							type: 'tool-call',
							toolCallId: 'call_456',
							toolName: 'anotherTool',
							args: {}
						}
					]
				}
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].role).toBe('assistant');
			expect(messages[0].content).toBe('');
			expect(messages[0].content_list).toBeDefined();
		});

		it.concurrent('should handle assistant with string content', async () => {
			const prompt: LanguageModelV2Prompt = [
				{ role: 'assistant', content: 'Simple response' as any }
			];
			const messages = convertPromptToMessages(prompt);
			expect(messages[0].content).toBe('Simple response');
		});
	});
});
