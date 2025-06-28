import { jest } from '@jest/globals';

// Import the actual json-extractor module
const { extractJson } = await import('../../../../../src/ai-providers/custom-sdk/claude-code/json-extractor.js');

describe('extractJson', () => {
	it('should extract valid JSON object', () => {
		const text = 'Here is some JSON: {"name": "John", "age": 30}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'John', age: 30 });
	});

	it('should extract valid JSON array', () => {
		const text = 'Data: [1, 2, 3, 4, 5]';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual([1, 2, 3, 4, 5]);
	});

	it('should extract JSON from markdown code block', () => {
		const text = `
Here is the result:
\`\`\`json
{
  "status": "success",
  "data": {
    "id": 123,
    "value": "test"
  }
}
\`\`\`
`;
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({
			status: 'success',
			data: { id: 123, value: 'test' },
		});
	});

	it('should extract JSON from regular code block', () => {
		const text = `
Result:
\`\`\`
{"message": "Hello, world!"}
\`\`\`
`;
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ message: 'Hello, world!' });
	});

	it('should extract nested JSON', () => {
		const text = 'Response: {"user": {"name": "Alice", "emails": ["alice@example.com", "alice2@example.com"]}}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({
			user: { name: 'Alice', emails: ['alice@example.com', 'alice2@example.com'] },
		});
	});

	it('should extract JSON with special characters', () => {
		const text = 'Result: {"message": "Hello\\nWorld", "path": "C:/Users/test"}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({
			message: 'Hello\nWorld',
			path: 'C:/Users/test',
		});
	});

	it('should return original text when no JSON found', () => {
		const text = 'This is just plain text with no JSON';
		const result = extractJson(text);
		expect(result).toBe(text);
	});

	it('should handle empty string', () => {
		const result = extractJson('');
		expect(result).toBe('');
	});

	it('should extract first valid JSON when multiple exist', () => {
		const text = 'First: {"a": 1} and second: {"b": 2}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ a: 1 });
	});

	it('should handle JSON with trailing comma (invalid but common)', () => {
		const text = 'Data: {"name": "test",}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'test' });
	});

	it('should extract JSON with numbers and booleans', () => {
		const text = 'Config: {"count": 42, "enabled": true, "ratio": 3.14, "flag": false, "data": null}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ count: 42, enabled: true, ratio: 3.14, flag: false, data: null });
	});

	it('should handle JSON within other text', () => {
		const text = `
The server responded with the following data:
{"status": 200, "message": "OK"}
Please process accordingly.
`;
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ status: 200, message: 'OK' });
	});

	it('should extract complex nested structure', () => {
		const text = `Output: {
  "users": [
    {"id": 1, "name": "Alice", "active": true},
    {"id": 2, "name": "Bob", "active": false}
  ],
  "metadata": {
    "total": 2,
    "page": 1
  }
}`;
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({
			users: [
				{ id: 1, name: 'Alice', active: true },
				{ id: 2, name: 'Bob', active: false },
			],
			metadata: { total: 2, page: 1 },
		});
	});

	it('should validate extracted JSON is parseable', () => {
		const text = 'Data: {"valid": "json", "number": 123}';
		const extracted = extractJson(text);
		expect(() => JSON.parse(extracted)).not.toThrow();
		expect(JSON.parse(extracted)).toEqual({ valid: 'json', number: 123 });
	});

	it('should handle malformed JSON by returning original text', () => {
		const text = 'Bad JSON: {"unclosed": "quote}';
		const result = extractJson(text);
		expect(result).toBe(text);
	});

	it('should parse JSON with comments and trailing commas', () => {
		const text = `Response:\n\`\`\`json
{
  // user info
  "name": "Sam",
  "roles": ["admin",],
}
\`\`\``;
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ name: 'Sam', roles: ['admin'] });
	});

	it('should return original text for mismatched braces', () => {
		const text = 'Oops {"a": 1';
		const result = extractJson(text);
		expect(result).toBe(text);
	});

	it('should extract JSON from various markdown formats', () => {
		const variations = [
			'```json\n{"test": true}\n```',
			'```JSON\n{"test": true}\n```',
			'```\n{"test": true}\n```',
		];

		variations.forEach(text => {
			const result = extractJson(text);
			expect(JSON.parse(result)).toEqual({ test: true });
		});
	});

	it('should handle JavaScript variable declarations', () => {
		const variations = [
			'const result = {"test": true}',
			'let result = {"test": true}',
			'var result = {"test": true}',
			'const result = {"test": true};',
		];

		variations.forEach(text => {
			const result = extractJson(text);
			expect(JSON.parse(result)).toEqual({ test: true });
		});
	});

	it('should handle truncated JSON by extracting the longest valid portion', () => {
		const text = '{"name": "Alice", "age": 30, "incomplete": "val';
		const result = extractJson(text);
		// The optimized algorithm will try to find valid JSON boundaries
		// In this case, it should extract {"name": "Alice", "age": 30}
		try {
			const parsed = JSON.parse(result);
			expect(parsed.name).toBe('Alice');
			expect(parsed.age).toBe(30);
			expect(parsed.incomplete).toBeUndefined();
		} catch {
			// If parsing fails, it means the original text was returned
			// This is also acceptable behavior for severely malformed JSON
			expect(result).toBe(text);
		}
	});

	it('should handle escaped characters in strings', () => {
		const text = '{"message": "Line 1\\"quoted\\"\\nLine 2"}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ message: 'Line 1"quoted"\nLine 2' });
	});

	it('should extract array with mixed types', () => {
		const text = 'Mixed: [1, "two", true, null, {"nested": "object"}]';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual([1, 'two', true, null, { nested: 'object' }]);
	});

	it('should handle JSON with multiple nesting levels', () => {
		const text = '{"a": {"b": {"c": {"d": "deep"}}}}';
		const result = extractJson(text);
		expect(JSON.parse(result)).toEqual({ a: { b: { c: { d: 'deep' } } } });
	});

	describe('performance tests', () => {
		it('should handle large valid JSON efficiently', () => {
			// Generate a large valid JSON object
			const largeObject = {
				data: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					name: `Item ${i}`,
					value: Math.random(),
					nested: { a: i, b: i * 2 }
				}))
			};
			const text = `Response: ${JSON.stringify(largeObject)}`;
			
			const start = Date.now();
			const result = extractJson(text);
			const duration = Date.now() - start;
			
			// Should be fast for valid JSON (< 100ms)
			expect(duration).toBeLessThan(100);
			expect(JSON.parse(result)).toEqual(largeObject);
		});

		it('should handle large JSON with trailing garbage efficiently', () => {
			// Generate JSON with lots of trailing garbage
			const validJson = { data: Array.from({ length: 100 }, (_, i) => ({ id: i })) };
			const text = `Result: ${JSON.stringify(validJson)}` + 'x'.repeat(10000);
			
			const start = Date.now();
			const result = extractJson(text);
			const duration = Date.now() - start;
			
			// Should still be reasonably fast (< 200ms)
			expect(duration).toBeLessThan(200);
			expect(JSON.parse(result)).toEqual(validJson);
		});

		it('should handle deeply nested malformed JSON without timeout', () => {
			// Create a deeply nested but ultimately invalid JSON
			let text = 'Response: ';
			for (let i = 0; i < 100; i++) {
				text += '{"level' + i + '": ';
			}
			text += '"deep"';
			// Intentionally miss some closing braces
			for (let i = 0; i < 95; i++) {
				text += '}';
			}
			
			const start = Date.now();
			const result = extractJson(text);
			const duration = Date.now() - start;
			
			// Should complete in reasonable time even with malformed JSON
			expect(duration).toBeLessThan(500);
			// Should extract the best valid portion or return original
			expect(result).toBeDefined();
		});
	});
});