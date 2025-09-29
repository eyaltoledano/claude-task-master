/**
 * Tests for JSON extraction utilities
 */

import { describe, expect, it } from 'vitest';
import { extractJson } from './json-extractor.js';

describe('extractJson', () => {
	it('should extract JSON from markdown code blocks', () => {
		const text = '```json\n{"name": "test", "value": 42}\n```';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should extract JSON from generic code blocks', () => {
		const text = '```\n{"name": "test", "value": 42}\n```';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should remove JavaScript variable declarations', () => {
		const text = 'const result = {"name": "test", "value": 42};';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should handle let variable declarations', () => {
		const text = 'let data = {"name": "test", "value": 42};';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should handle var variable declarations', () => {
		const text = 'var config = {"name": "test", "value": 42};';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should extract JSON arrays', () => {
		const text = '[{"name": "test1"}, {"name": "test2"}]';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual([{ name: 'test1' }, { name: 'test2' }]);
	});

	it('should convert JavaScript object literals to JSON', () => {
		const text = "{name: 'test', value: 42}";
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should return valid JSON (canonical formatting)', () => {
		const text = '{"name": "test", "value": 42}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
	});

	it('should return original text when JSON parsing fails completely', () => {
		const text = 'This is not JSON at all';
		const result = extractJson(text);
		expect(result).toBe('This is not JSON at all');
	});

	it('should handle complex nested objects', () => {
		const text =
			'```json\n{\n  "user": {\n    "name": "John",\n    "age": 30\n  },\n  "items": [1, 2, 3]\n}\n```';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({
			user: {
				name: 'John',
				age: 30
			},
			items: [1, 2, 3]
		});
	});

	it('should handle mixed quotes in object literals', () => {
		const text = `{name: "test", value: 'mixed quotes'}`;
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test', value: 'mixed quotes' });
	});
});
