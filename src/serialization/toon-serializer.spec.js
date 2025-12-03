/**
 * Tests for TOON serialization utilities
 */

import { describe, it, expect } from '@jest/globals';
import { jsonToToon, toonToJson, estimateTokenSavings, validateToonRoundTrip } from './toon-serializer.js';

describe('TOON Serializer', () => {
	describe('jsonToToon', () => {
		it('should convert primitive values correctly', () => {
			expect(jsonToToon(42)).toBe('42');
			expect(jsonToToon(true)).toBe('true');
			expect(jsonToToon(false)).toBe('false');
			expect(jsonToToon(null)).toBe('null');
			expect(jsonToToon('hello')).toBe('hello');
			expect(jsonToToon('hello world')).toBe('"hello world"');
		});

		it('should convert simple objects to TOON format', () => {
			const input = { name: 'John', age: 30 };
			const result = jsonToToon(input);
			expect(result).toBe('{name:John age:30}');
		});

		it('should convert arrays to TOON format', () => {
			const input = ['apple', 'banana', 'cherry'];
			const result = jsonToToon(input);
			expect(result).toBe('[apple banana cherry]');
		});

		it('should handle nested objects', () => {
			const input = {
				user: {
					name: 'John',
					age: 30
				},
				active: true
			};
			const result = jsonToToon(input);
			expect(result).toBe('{user:{name:John age:30} active:true}');
		});

		it('should handle arrays of objects', () => {
			const input = [
				{ name: 'John', age: 30 },
				{ name: 'Jane', age: 25 }
			];
			const result = jsonToToon(input);
			expect(result).toBe('[{name:John age:30} {name:Jane age:25}]');
		});

		it('should handle empty containers', () => {
			expect(jsonToToon([])).toBe('[]');
			expect(jsonToToon({})).toBe('{}');
		});

		it('should escape quotes in strings', () => {
			const input = { message: 'She said "hello"' };
			const result = jsonToToon(input);
			expect(result).toBe('{message:"She said \\"hello\\""}');
		});
	});

	describe('toonToJson', () => {
		it('should convert primitive values correctly', () => {
			expect(toonToJson('42')).toBe(42);
			expect(toonToJson('true')).toBe(true);
			expect(toonToJson('false')).toBe(false);
			expect(toonToJson('null')).toBe(null);
			expect(toonToJson('hello')).toBe('hello');
			expect(toonToJson('"hello world"')).toBe('hello world');
		});

		it('should convert TOON objects back to JSON', () => {
			const input = '{name:John age:30}';
			const result = toonToJson(input);
			expect(result).toEqual({ name: 'John', age: 30 });
		});

		it('should convert TOON arrays back to JSON', () => {
			const input = '[apple banana cherry]';
			const result = toonToJson(input);
			expect(result).toEqual(['apple', 'banana', 'cherry']);
		});

		it('should handle nested structures', () => {
			const input = '{user:{name:John age:30} active:true}';
			const result = toonToJson(input);
			expect(result).toEqual({
				user: {
					name: 'John',
					age: 30
				},
				active: true
			});
		});

		it('should handle arrays of objects', () => {
			const input = '[{name:John age:30} {name:Jane age:25}]';
			const result = toonToJson(input);
			expect(result).toEqual([
				{ name: 'John', age: 30 },
				{ name: 'Jane', age: 25 }
			]);
		});

		it('should handle empty containers', () => {
			expect(toonToJson('[]')).toEqual([]);
			expect(toonToJson('{}')).toEqual({});
		});

		it('should handle quoted strings with escaped quotes', () => {
			const input = '{message:"She said \\"hello\\""}';
			const result = toonToJson(input);
			expect(result).toEqual({ message: 'She said "hello"' });
		});
	});

	describe('estimateTokenSavings', () => {
		it('should calculate token savings for typical data', () => {
			const data = {
				users: [
					{ id: 1, name: 'John', email: 'john@example.com', active: true },
					{ id: 2, name: 'Jane', email: 'jane@example.com', active: false }
				]
			};
			
			const savings = estimateTokenSavings(data);
			expect(savings).toBeDefined();
			expect(savings.characterSavings).toBeGreaterThan(0);
			expect(savings.savingsPercentage).toBeGreaterThan(0);
			expect(savings.estimatedTokenSavings).toBeGreaterThan(0);
		});

		it('should handle edge cases', () => {
			expect(estimateTokenSavings(null)).toBeDefined();
			expect(estimateTokenSavings({})).toBeDefined();
			expect(estimateTokenSavings([])).toBeDefined();
		});
	});

	describe('validateToonRoundTrip', () => {
		it('should validate successful round-trips', () => {
			const testCases = [
				{ name: 'John', age: 30 },
				[1, 2, 3, 'hello'],
				{ users: [{ id: 1, active: true }] },
				42,
				'hello world',
				true,
				null
			];

			for (const testCase of testCases) {
				const validation = validateToonRoundTrip(testCase);
				expect(validation.isValid).toBe(true);
				expect(validation.error).toBeUndefined();
			}
		});

		it('should provide detailed validation results', () => {
			const data = { test: 'data' };
			const validation = validateToonRoundTrip(data);
			
			expect(validation).toHaveProperty('isValid');
			expect(validation).toHaveProperty('original');
			expect(validation).toHaveProperty('toon');
			expect(validation).toHaveProperty('reconstructed');
			expect(validation.original).toEqual(data);
		});
	});

	describe('complex data structures', () => {
		it('should handle task management data', () => {
			const taskData = {
				id: 'task-123',
				title: 'Implement TOON serialization',
				status: 'in-progress',
				priority: 'high',
				assignee: {
					name: 'John Doe',
					email: 'john@taskmaster.dev'
				},
				subtasks: [
					{
						id: 'subtask-1',
						title: 'Create TOON serializer',
						status: 'done'
					},
					{
						id: 'subtask-2', 
						title: 'Add LLM integration',
						status: 'in-progress'
					}
				],
				tags: ['feature', 'optimization', 'llm'],
				metadata: {
					created: '2024-12-03T12:30:00Z',
					updated: '2024-12-03T13:45:00Z'
				}
			};

			const validation = validateToonRoundTrip(taskData);
			expect(validation.isValid).toBe(true);
			
			const savings = estimateTokenSavings(taskData);
			expect(savings.savingsPercentage).toBeGreaterThan(20); // Should provide significant savings
		});
	});
});