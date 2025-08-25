/**
 * tests/unit/utils/json-extract.test.js
 * Unit tests for the extractJsonTolerant utility
 */

import { jest } from '@jest/globals';

describe('extractJsonTolerant', () => {
	let extractJsonTolerant;

	beforeEach(async () => {
		// Reset modules before each test
		jest.resetModules();
		const module = await import('../../../src/utils/json-extract.js');
		extractJsonTolerant = module.extractJsonTolerant;
	});

	describe('basic JSON extraction', () => {
		it('should extract clean JSON object', () => {
			const input = '{"key": "value", "number": 123}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ key: 'value', number: 123 });
		});

		it('should extract clean JSON array', () => {
			const input = '[1, 2, 3, "four"]';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual([1, 2, 3, 'four']);
		});

		it('should handle nested structures', () => {
			const input = '{"outer": {"inner": [1, 2, {"deep": true}]}}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({
				outer: { inner: [1, 2, { deep: true }] }
			});
		});
	});

	describe('markdown code block extraction', () => {
		it('should extract from markdown json code block', () => {
			const input = '```json\n{"extracted": true}\n```';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ extracted: true });
		});

		it('should extract from markdown code block without language', () => {
			const input = '```\n{"extracted": true}\n```';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ extracted: true });
		});

		it('should extract with surrounding text', () => {
			const input =
				'Here is the response:\n```json\n{"data": 42}\n```\nEnd of response';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ data: 42 });
		});
	});

	describe('variable declaration extraction', () => {
		it('should extract from const declaration', () => {
			const input = 'const result = {"status": "ok"};';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ status: 'ok' });
		});

		it('should extract from let declaration', () => {
			const input = 'let data = {"value": 100};';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ value: 100 });
		});

		it('should extract from var declaration', () => {
			const input = 'var config = {"enabled": false};';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ enabled: false });
		});
	});

	describe('JSONC features (comments and trailing commas)', () => {
		it('should handle trailing commas', () => {
			const input = '{"a": 1, "b": 2,}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ a: 1, b: 2 });
		});

		it('should handle trailing commas in arrays', () => {
			const input = '[1, 2, 3,]';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual([1, 2, 3]);
		});

		it('should handle nested trailing commas', () => {
			const input = '{"arr": [1, 2,], "obj": {"x": 1,},}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ arr: [1, 2], obj: { x: 1 } });
		});
	});

	describe('prefix removal', () => {
		it('should remove "Here\'s the JSON" prefix', () => {
			const input = 'Here\'s the JSON: {"result": true}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ result: true });
		});

		it('should remove "The JSON" prefix', () => {
			const input = 'The JSON response: {"status": 200}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ status: 200 });
		});
	});

	describe('edge cases', () => {
		it('should return original text for non-JSON', () => {
			const input = 'This is not JSON at all';
			const result = extractJsonTolerant(input);
			expect(result).toBe(input);
		});

		it('should handle empty input', () => {
			const result = extractJsonTolerant('');
			expect(result).toBe('');
		});

		it('should handle null input', () => {
			const result = extractJsonTolerant(null);
			expect(result).toBe(null);
		});

		it('should handle undefined input', () => {
			const result = extractJsonTolerant(undefined);
			expect(result).toBe(undefined);
		});

		it('should handle very short input', () => {
			const result = extractJsonTolerant('x');
			expect(result).toBe('x');
		});

		it('should extract first JSON when multiple present', () => {
			const input = '{"first": 1} some text {"second": 2}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ first: 1 });
		});

		it('should handle escaped characters', () => {
			const input =
				'{"path": "C:\\\\Users\\\\file.txt", "quote": "\\"text\\""}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({
				path: 'C:\\Users\\file.txt',
				quote: '"text"'
			});
		});
	});

	describe('incomplete JSON handling', () => {
		it('should return original for unclosed object', () => {
			const input = '{"incomplete": "object"';
			const result = extractJsonTolerant(input);
			// Should attempt repair but if it fails, return original
			expect(typeof result).toBe('string');
		});

		it('should return original for unclosed array', () => {
			const input = '[1, 2, 3';
			const result = extractJsonTolerant(input);
			// Should attempt repair but if it fails, return original
			expect(typeof result).toBe('string');
		});
	});

	describe('complex mixed content', () => {
		it('should extract from prose with JSON', () => {
			const input = `
				The server returned the following response:
				{"status": "success", "data": {"id": 123, "name": "test"}}
				Please process accordingly.
			`;
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({
				status: 'success',
				data: { id: 123, name: 'test' }
			});
		});

		it('should handle JSON with special characters', () => {
			const input = '{"emoji": "🚀", "unicode": "\\u0041", "tab": "\\t"}';
			const result = extractJsonTolerant(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({
				emoji: '🚀',
				unicode: 'A',
				tab: '\t'
			});
		});
	});
});
