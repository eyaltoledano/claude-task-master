import { describe, it, expect } from '@jest/globals';
import { prdResponseSchema } from '../../../../../scripts/modules/task-manager/parse-prd/parse-prd-config.js';

describe('PRD Response Schema', () => {
	const validTask = {
		id: 1,
		title: 'Test Task',
		description: 'Test description',
		details: 'Test details',
		testStrategy: 'Test strategy',
		priority: 'high',
		dependencies: [],
		status: 'pending'
	};

	describe('Valid responses', () => {
		it('should accept response with tasks and metadata', () => {
			const response = {
				tasks: [validTask],
				metadata: {
					projectName: 'Test Project',
					totalTasks: 1,
					sourceFile: 'test.txt',
					generatedAt: '2025-01-01T00:00:00Z'
				}
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(true);
		});

		it('should accept response with tasks and null metadata', () => {
			const response = {
				tasks: [validTask],
				metadata: null
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(true);
		});

		it('should accept response with only tasks (no metadata field)', () => {
			// This is what ZAI returns - just the tasks array without metadata
			const response = {
				tasks: [validTask]
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(true);
			if (result.success) {
				// With .default(null), omitted metadata becomes null
				expect(result.data.metadata).toBeNull();
			}
		});

		it('should accept response with multiple tasks', () => {
			const response = {
				tasks: [validTask, { ...validTask, id: 2, title: 'Second Task' }]
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(true);
		});
	});

	describe('Invalid responses', () => {
		it('should reject response without tasks field', () => {
			const response = {
				metadata: null
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(false);
		});

		it('should reject response with empty tasks array and invalid metadata', () => {
			const response = {
				tasks: [],
				metadata: 'invalid'
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(false);
		});

		it('should reject task with missing required fields', () => {
			const response = {
				tasks: [
					{
						id: 1,
						title: 'Test'
						// missing other required fields
					}
				]
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(false);
		});

		it('should reject task with invalid priority', () => {
			const response = {
				tasks: [
					{
						...validTask,
						priority: 'invalid'
					}
				]
			};

			const result = prdResponseSchema.safeParse(response);
			expect(result.success).toBe(false);
		});
	});

	describe('ZAI-specific response format', () => {
		it('should handle ZAI response format (tasks only, no metadata)', () => {
			// This is the actual format ZAI returns
			const zaiResponse = {
				tasks: [
					{
						id: 24,
						title: 'Core Todo Data Management',
						description:
							'Implement the core data structure and CRUD operations',
						status: 'pending',
						dependencies: [],
						priority: 'high',
						details: 'Create a Todo data model with properties...',
						testStrategy: 'Unit tests for TodoManager class...'
					},
					{
						id: 25,
						title: 'Todo UI and User Interactions',
						description: 'Create the user interface components',
						status: 'pending',
						dependencies: [24],
						priority: 'high',
						details: 'Build a simple HTML/CSS/JS interface...',
						testStrategy: 'UI component tests...'
					}
				]
			};

			const result = prdResponseSchema.safeParse(zaiResponse);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.tasks).toHaveLength(2);
				// With .default(null), omitted metadata becomes null (not undefined)
				expect(result.data.metadata).toBeNull();
			}
		});
	});
});
