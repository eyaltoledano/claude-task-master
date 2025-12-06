/**
 * Unit tests for structured output utilities
 * Target: 90%+ coverage for src/schema/structured-output.ts
 */

import {
	extractJson,
	extractStreamJson,
	isValidJson,
	cleanJsonText,
	StructuredOutputGenerator
} from '../../../src/schema/structured-output.js';
import type { JSONSchema } from '../../../src/schema/transformer.js';

describe('Structured Output Utilities', () => {
	describe('extractJson', () => {
		it.concurrent(
			'should return null for null/undefined/non-string input',
			async () => {
				expect(extractJson(null as any)).toBeNull();
				expect(extractJson(undefined as any)).toBeNull();
				expect(extractJson(123 as any)).toBeNull();
				expect(extractJson({} as any)).toBeNull();
			}
		);

		it.concurrent('should return null for empty string', async () => {
			expect(extractJson('')).toBeNull();
		});

		it.concurrent('should parse valid JSON directly', async () => {
			const json = '{"name": "John", "age": 30}';
			expect(extractJson(json)).toEqual({ name: 'John', age: 30 });
		});

		it.concurrent('should parse valid JSON array directly', async () => {
			const json = '[1, 2, 3]';
			expect(extractJson(json)).toEqual([1, 2, 3]);
		});

		it.concurrent('should extract JSON from markdown code block', async () => {
			const text = '```json\n{"id": 1}\n```';
			expect(extractJson(text)).toEqual({ id: 1 });
		});

		it.concurrent(
			'should extract JSON from code block without language tag',
			async () => {
				const text = '```\n{"id": 2}\n```';
				expect(extractJson(text)).toEqual({ id: 2 });
			}
		);

		it.concurrent(
			'should extract JSON object from surrounding text',
			async () => {
				const text =
					'Here is the result: {"name": "test"} - that was the output';
				expect(extractJson(text)).toEqual({ name: 'test' });
			}
		);

		it.concurrent(
			'should extract JSON array from surrounding text',
			async () => {
				const text = 'The results are: [1, 2, 3] and that is all.';
				expect(extractJson(text)).toEqual([1, 2, 3]);
			}
		);

		it.concurrent('should return null for invalid JSON', async () => {
			expect(extractJson('not json at all')).toBeNull();
		});

		it.concurrent('should handle nested JSON objects', async () => {
			const json = '{"outer": {"inner": {"deep": 123}}}';
			expect(extractJson(json)).toEqual({ outer: { inner: { deep: 123 } } });
		});

		it.concurrent('should support generic type parameter', async () => {
			interface Person {
				name: string;
				age: number;
			}
			const json = '{"name": "Alice", "age": 25}';
			const result = extractJson<Person>(json);
			expect(result?.name).toBe('Alice');
			expect(result?.age).toBe(25);
		});
	});

	describe('extractStreamJson', () => {
		it.concurrent(
			'should return empty array for null/undefined/non-string',
			async () => {
				expect(extractStreamJson(null as any)).toEqual([]);
				expect(extractStreamJson(undefined as any)).toEqual([]);
				expect(extractStreamJson(123 as any)).toEqual([]);
			}
		);

		it.concurrent('should return empty array for empty string', async () => {
			expect(extractStreamJson('')).toEqual([]);
		});

		it.concurrent('should parse NDJSON (newline-delimited JSON)', async () => {
			const ndjson = '{"id": 1}\n{"id": 2}\n{"id": 3}';
			expect(extractStreamJson(ndjson)).toEqual([
				{ id: 1 },
				{ id: 2 },
				{ id: 3 }
			]);
		});

		it.concurrent('should skip empty lines', async () => {
			const ndjson = '{"id": 1}\n\n{"id": 2}\n\n';
			expect(extractStreamJson(ndjson)).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it.concurrent('should skip invalid JSON lines', async () => {
			const mixed = '{"valid": true}\ninvalid line\n{"also": "valid"}';
			expect(extractStreamJson(mixed)).toEqual([
				{ valid: true },
				{ also: 'valid' }
			]);
		});

		it.concurrent('should handle whitespace around lines', async () => {
			const ndjson = '  {"id": 1}  \n  {"id": 2}  ';
			expect(extractStreamJson(ndjson)).toEqual([{ id: 1 }, { id: 2 }]);
		});
	});

	describe('isValidJson', () => {
		it.concurrent(
			'should return false for null/undefined/non-string',
			async () => {
				expect(isValidJson(null as any)).toBe(false);
				expect(isValidJson(undefined as any)).toBe(false);
				expect(isValidJson(123 as any)).toBe(false);
			}
		);

		it.concurrent('should return false for empty string', async () => {
			expect(isValidJson('')).toBe(false);
		});

		it.concurrent('should return true for valid JSON object', async () => {
			expect(isValidJson('{"key": "value"}')).toBe(true);
		});

		it.concurrent('should return true for valid JSON array', async () => {
			expect(isValidJson('[1, 2, 3]')).toBe(true);
		});

		it.concurrent('should return true for JSON primitives', async () => {
			expect(isValidJson('"string"')).toBe(true);
			expect(isValidJson('123')).toBe(true);
			expect(isValidJson('true')).toBe(true);
			expect(isValidJson('null')).toBe(true);
		});

		it.concurrent('should return false for invalid JSON', async () => {
			expect(isValidJson('not json')).toBe(false);
			expect(isValidJson('{invalid}')).toBe(false);
			expect(isValidJson("{'single': 'quotes'}")).toBe(false);
		});
	});

	describe('cleanJsonText', () => {
		it.concurrent(
			'should return empty string for null/undefined/non-string',
			async () => {
				expect(cleanJsonText(null as any)).toBe('');
				expect(cleanJsonText(undefined as any)).toBe('');
				expect(cleanJsonText(123 as any)).toBe('');
			}
		);

		it.concurrent('should trim whitespace', async () => {
			expect(cleanJsonText('  {"key": "value"}  ')).toBe('{"key": "value"}');
		});

		it.concurrent('should remove single-line comments', async () => {
			const json = '{\n  "key": "value" // comment\n}';
			const cleaned = cleanJsonText(json);
			expect(cleaned).not.toContain('//');
			expect(cleaned).toContain('"key": "value"');
		});

		it.concurrent('should remove multi-line comments', async () => {
			const json = '{ /* comment */ "key": "value" }';
			const cleaned = cleanJsonText(json);
			expect(cleaned).not.toContain('/*');
			expect(cleaned).not.toContain('*/');
			expect(cleaned).toContain('"key": "value"');
		});

		it.concurrent('should remove trailing commas in objects', async () => {
			const json = '{"a": 1, "b": 2,}';
			const cleaned = cleanJsonText(json);
			expect(cleaned).toBe('{"a": 1, "b": 2}');
		});

		it.concurrent('should remove trailing commas in arrays', async () => {
			const json = '[1, 2, 3,]';
			const cleaned = cleanJsonText(json);
			expect(cleaned).toBe('[1, 2, 3]');
		});

		it.concurrent('should handle complex cleaning scenarios', async () => {
			const json = `{
				"key": "value", // inline comment
				/* block
				comment */
				"array": [1, 2,],
			}`;
			const cleaned = cleanJsonText(json);
			expect(cleaned).not.toContain('//');
			expect(cleaned).not.toContain('/*');
			expect(cleaned.match(/,\s*[\]}]/g)).toBeNull(); // No trailing commas
		});
	});

	describe('StructuredOutputGenerator', () => {
		describe('buildSystemPrompt', () => {
			it.concurrent('should include schema and object name', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: { name: { type: 'string' } }
				};
				const prompt = StructuredOutputGenerator.buildSystemPrompt(
					schema,
					'Person'
				);

				expect(prompt).toContain('Person');
				expect(prompt).toContain('"type": "object"');
				expect(prompt).toContain('valid JSON object');
			});

			it.concurrent('should include formatting instructions', async () => {
				const schema: JSONSchema = { type: 'object' };
				const prompt = StructuredOutputGenerator.buildSystemPrompt(
					schema,
					'Test'
				);

				expect(prompt).toContain('no code blocks');
				expect(prompt).toContain('no markdown');
				expect(prompt).toContain('raw JSON');
			});
		});

		describe('prepareMessages', () => {
			it.concurrent('should add system message with schema', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: { name: { type: 'string' } }
				};
				const messages = StructuredOutputGenerator.prepareMessages({
					schema,
					objectName: 'Person',
					messages: [{ role: 'user', content: 'Generate person' }]
				});

				expect(messages.length).toBe(2);
				expect(messages[0].role).toBe('system');
				expect(messages[0].content).toContain('Person');
				expect(messages[1].role).toBe('user');
			});

			it.concurrent('should clean schema before including', async () => {
				const schema: JSONSchema = {
					type: 'object',
					properties: {
						name: { type: 'string', minLength: 1 }
					}
				};
				const messages = StructuredOutputGenerator.prepareMessages({
					schema,
					objectName: 'Test',
					messages: []
				});

				// System message should not contain minLength after cleaning
				expect(messages[0].content).not.toContain('minLength');
			});
		});

		describe('extractFirstJsonObject', () => {
			it.concurrent('should return null if no opening brace', async () => {
				expect(
					StructuredOutputGenerator.extractFirstJsonObject('no json here')
				).toBeNull();
			});

			it.concurrent('should extract simple object', async () => {
				const text = 'Result: {"id": 1}';
				expect(StructuredOutputGenerator.extractFirstJsonObject(text)).toBe(
					'{"id": 1}'
				);
			});

			it.concurrent('should handle nested objects', async () => {
				const text = '{"outer": {"inner": 1}}';
				expect(StructuredOutputGenerator.extractFirstJsonObject(text)).toBe(
					'{"outer": {"inner": 1}}'
				);
			});

			it.concurrent('should handle braces inside strings', async () => {
				const text = '{"text": "hello {world}"}';
				expect(StructuredOutputGenerator.extractFirstJsonObject(text)).toBe(
					'{"text": "hello {world}"}'
				);
			});

			it.concurrent('should handle escaped quotes', async () => {
				const text = '{"text": "say \\"hello\\""}';
				expect(StructuredOutputGenerator.extractFirstJsonObject(text)).toBe(
					'{"text": "say \\"hello\\""}'
				);
			});

			it.concurrent('should handle escaped backslashes', async () => {
				const text = '{"path": "C:\\\\Users\\\\test"}';
				const result = StructuredOutputGenerator.extractFirstJsonObject(text);
				expect(result).toBe('{"path": "C:\\\\Users\\\\test"}');
			});

			it.concurrent('should return null for unmatched braces', async () => {
				const text = '{"incomplete": true';
				expect(
					StructuredOutputGenerator.extractFirstJsonObject(text)
				).toBeNull();
			});
		});

		describe('parseWithFallback', () => {
			it.concurrent('should parse valid JSON', async () => {
				const result =
					StructuredOutputGenerator.parseWithFallback('{"key": "value"}');
				expect(result).toEqual({ key: 'value' });
			});

			it.concurrent('should fix unquoted property names', async () => {
				const result =
					StructuredOutputGenerator.parseWithFallback('{key: "value"}');
				expect(result).toEqual({ key: 'value' });
			});

			it.concurrent('should throw for completely invalid JSON', async () => {
				expect(() => {
					StructuredOutputGenerator.parseWithFallback('not json at all');
				}).toThrow('Failed to parse JSON response');
			});

			it.concurrent('should include helpful error message', async () => {
				try {
					StructuredOutputGenerator.parseWithFallback('invalid json');
					fail('Should have thrown');
				} catch (error) {
					expect((error as Error).message).toContain('Text (first 300 chars):');
				}
			});
		});

		describe('extractAndParse', () => {
			it.concurrent(
				'should extract and parse JSON from clean response',
				async () => {
					const result =
						StructuredOutputGenerator.extractAndParse('{"name": "John"}');
					expect(result).toEqual({ name: 'John' });
				}
			);

			it.concurrent('should extract from markdown code block', async () => {
				const text = '```json\n{"id": 1}\n```';
				const result = StructuredOutputGenerator.extractAndParse(text);
				expect(result).toEqual({ id: 1 });
			});

			it.concurrent('should extract from surrounding text', async () => {
				const text = 'Here is the result: {"data": true}';
				const result = StructuredOutputGenerator.extractAndParse(text);
				expect(result).toEqual({ data: true });
			});

			it.concurrent('should throw for no JSON found', async () => {
				expect(() => {
					StructuredOutputGenerator.extractAndParse('no json here');
				}).toThrow('Could not extract JSON object');
			});

			it.concurrent('should handle whitespace', async () => {
				const text = '   {"trimmed": true}   ';
				const result = StructuredOutputGenerator.extractAndParse(text);
				expect(result).toEqual({ trimmed: true });
			});
		});

		describe('generateObject', () => {
			it.concurrent('should throw if schema is missing', async () => {
				await expect(
					StructuredOutputGenerator.generateObject({
						generateText: jest.fn(),
						schema: null as any,
						objectName: 'Test',
						messages: []
					})
				).rejects.toThrow('Schema is required');
			});

			it.concurrent('should throw if objectName is missing', async () => {
				await expect(
					StructuredOutputGenerator.generateObject({
						generateText: jest.fn(),
						schema: { type: 'object' },
						objectName: '' as any,
						messages: []
					})
				).rejects.toThrow('Object name is required');
			});

			it.concurrent('should throw if generateText is missing', async () => {
				await expect(
					StructuredOutputGenerator.generateObject({
						generateText: null as any,
						schema: { type: 'object' },
						objectName: 'Test',
						messages: []
					})
				).rejects.toThrow('generateText function is required');
			});

			it.concurrent(
				'should generate and parse object successfully',
				async () => {
					const mockGenerateText = jest.fn().mockResolvedValue({
						text: '{"name": "Alice", "age": 25}',
						finishReason: 'stop',
						usage: { promptTokens: 100, completionTokens: 50 }
					});

					const result = await StructuredOutputGenerator.generateObject({
						generateText: mockGenerateText,
						schema: {
							type: 'object',
							properties: {
								name: { type: 'string' },
								age: { type: 'number' }
							}
						},
						objectName: 'Person',
						messages: [{ role: 'user', content: 'Generate Alice, age 25' }]
					});

					expect(result.object).toEqual({ name: 'Alice', age: 25 });
					expect(result.finishReason).toBe('stop');
					expect(result.usage.promptTokens).toBe(100);
					expect(result.usage.completionTokens).toBe(50);
				}
			);

			it.concurrent(
				'should call onWarning for unsupported models',
				async () => {
					const mockGenerateText = jest.fn().mockResolvedValue({
						text: '{"data": true}'
					});
					const mockOnWarning = jest.fn();

					await StructuredOutputGenerator.generateObject({
						generateText: mockGenerateText,
						schema: { type: 'object' },
						objectName: 'Test',
						messages: [],
						modelId: 'llama3.1-8b', // Unsupported for structured outputs
						onWarning: mockOnWarning
					});

					expect(mockOnWarning).toHaveBeenCalled();
					expect(mockOnWarning.mock.calls[0][0]).toContain('does not support');
				}
			);

			it.concurrent('should not warn for supported models', async () => {
				const mockGenerateText = jest.fn().mockResolvedValue({
					text: '{"data": true}'
				});
				const mockOnWarning = jest.fn();

				await StructuredOutputGenerator.generateObject({
					generateText: mockGenerateText,
					schema: { type: 'object' },
					objectName: 'Test',
					messages: [],
					modelId: 'claude-haiku-4-5', // Supported
					onWarning: mockOnWarning
				});

				expect(mockOnWarning).not.toHaveBeenCalled();
			});

			it.concurrent(
				'should use default maxTokens if not provided',
				async () => {
					const mockGenerateText = jest.fn().mockResolvedValue({
						text: '{}'
					});

					await StructuredOutputGenerator.generateObject({
						generateText: mockGenerateText,
						schema: { type: 'object' },
						objectName: 'Test',
						messages: []
					});

					expect(mockGenerateText).toHaveBeenCalledWith(
						expect.objectContaining({ maxTokens: 2048 })
					);
				}
			);

			it.concurrent('should use provided maxTokens', async () => {
				const mockGenerateText = jest.fn().mockResolvedValue({
					text: '{}'
				});

				await StructuredOutputGenerator.generateObject({
					generateText: mockGenerateText,
					schema: { type: 'object' },
					objectName: 'Test',
					messages: [],
					maxTokens: 4096
				});

				expect(mockGenerateText).toHaveBeenCalledWith(
					expect.objectContaining({ maxTokens: 4096 })
				);
			});

			it.concurrent('should handle missing usage in response', async () => {
				const mockGenerateText = jest.fn().mockResolvedValue({
					text: '{"data": true}'
					// No usage field
				});

				const result = await StructuredOutputGenerator.generateObject({
					generateText: mockGenerateText,
					schema: { type: 'object' },
					objectName: 'Test',
					messages: []
				});

				expect(result.usage.promptTokens).toBe(0);
				expect(result.usage.completionTokens).toBe(0);
			});

			it.concurrent(
				'should handle missing finishReason in response',
				async () => {
					const mockGenerateText = jest.fn().mockResolvedValue({
						text: '{"data": true}'
						// No finishReason
					});

					const result = await StructuredOutputGenerator.generateObject({
						generateText: mockGenerateText,
						schema: { type: 'object' },
						objectName: 'Test',
						messages: []
					});

					expect(result.finishReason).toBe('stop');
				}
			);

			it.concurrent('should include warnings from generateText', async () => {
				const mockGenerateText = jest.fn().mockResolvedValue({
					text: '{}',
					warnings: ['Some warning']
				});

				const result = await StructuredOutputGenerator.generateObject({
					generateText: mockGenerateText,
					schema: { type: 'object' },
					objectName: 'Test',
					messages: []
				});

				expect(result.warnings).toEqual(['Some warning']);
			});
		});
	});
});
