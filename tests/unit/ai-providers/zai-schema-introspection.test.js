import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { ZAIProvider } from '../../../src/ai-providers/zai.js';

describe('ZAIProvider - Schema Introspection', () => {
	const provider = new ZAIProvider();

	it('should find array property in schema with single array', () => {
		const schema = z.object({
			subtasks: z.array(z.string()),
			metadata: z.object({ count: z.number() }).nullable()
		});

		const result = provider.findArrayPropertyInSchema(schema);
		expect(result).toBe('subtasks');
	});

	it('should find first array property when multiple arrays exist', () => {
		const schema = z.object({
			tasks: z.array(z.string()),
			items: z.array(z.number())
		});

		const result = provider.findArrayPropertyInSchema(schema);
		expect(result).toBe('tasks');
	});

	it('should handle schema with no arrays', () => {
		const schema = z.object({
			name: z.string(),
			count: z.number()
		});

		const result = provider.findArrayPropertyInSchema(schema);
		expect(result).toBeNull();
	});

	it('should handle non-object schemas gracefully', () => {
		const schema = z.array(z.string());

		const result = provider.findArrayPropertyInSchema(schema);
		expect(result).toBeNull();
	});

	it('should find complexityAnalysis array property', () => {
		const schema = z.object({
			complexityAnalysis: z.array(
				z.object({
					taskId: z.number(),
					score: z.number()
				})
			),
			metadata: z
				.union([z.object({ total: z.number() }), z.null()])
				.default(null)
		});

		const result = provider.findArrayPropertyInSchema(schema);
		expect(result).toBe('complexityAnalysis');
	});

	it('should work with actual PRD response schema', () => {
		const schema = z.object({
			tasks: z.array(
				z.object({
					id: z.number(),
					title: z.string()
				})
			),
			metadata: z
				.union([
					z.object({
						projectName: z.string(),
						totalTasks: z.number()
					}),
					z.null()
				])
				.default(null)
		});

		const result = provider.findArrayPropertyInSchema(schema);
		expect(result).toBe('tasks');
	});
});
