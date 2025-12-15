/**
 * @fileoverview Unit tests for TaskMapper
 *
 * Tests the mapping of database task rows to internal Task format,
 * with focus on metadata extraction including AI implementation guidance fields.
 */

import { describe, expect, it } from 'vitest';
import { TaskMapper } from './TaskMapper.js';
import { MetadataFixtures } from '../../testing/task-fixtures.js';
import type { Tables } from '../types/database.types.js';

type TaskRow = Tables<'tasks'>;

/**
 * Creates a mock database task row for testing
 */
function createMockTaskRow(overrides: Partial<TaskRow> = {}): TaskRow {
	return {
		id: 'uuid-123',
		display_id: 'HAM-1',
		title: 'Test Task',
		description: 'Test description',
		status: 'todo',
		priority: 'medium',
		brief_id: 'brief-123',
		parent_task_id: null,
		position: 1,
		subtask_position: 0,
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
		metadata: {},
		complexity: null,
		estimated_hours: null,
		actual_hours: 0,
		assignee_id: null,
		document_id: null,
		account_id: 'account-123',
		created_by: 'user-123',
		updated_by: 'user-123',
		completed_subtasks: 0,
		total_subtasks: 0,
		due_date: null,
		...overrides
	};
}

describe('TaskMapper', () => {
	describe('extractImplementationMetadata', () => {
		it('should extract all fields from complete metadata', () => {
			const result = TaskMapper.extractImplementationMetadata(
				MetadataFixtures.completeMetadata
			);

			expect(result.relevantFiles).toEqual([
				{
					path: 'src/service.ts',
					description: 'Main service file',
					action: 'modify'
				}
			]);
			expect(result.codebasePatterns).toEqual([
				'Use dependency injection',
				'Follow SOLID principles'
			]);
			expect(result.existingInfrastructure).toEqual([
				{
					name: 'Logger',
					location: 'src/common/logger.ts',
					usage: 'Use for structured logging'
				}
			]);
			expect(result.scopeBoundaries).toEqual({
				included: 'Core functionality',
				excluded: 'UI changes'
			});
			expect(result.implementationApproach).toBe(
				'Step-by-step implementation guide'
			);
			expect(result.technicalConstraints).toEqual([
				'Must be backwards compatible'
			]);
			expect(result.acceptanceCriteria).toEqual([
				'Feature works as expected',
				'Tests pass'
			]);
			expect(result.skills).toEqual(['TypeScript', 'Node.js']);
			expect(result.category).toBe('development');
		});

		it('should return undefined for missing fields', () => {
			const result = TaskMapper.extractImplementationMetadata(
				MetadataFixtures.minimalMetadata
			);

			expect(result.relevantFiles).toBeUndefined();
			expect(result.codebasePatterns).toBeUndefined();
			expect(result.existingInfrastructure).toBeUndefined();
			expect(result.scopeBoundaries).toBeUndefined();
			expect(result.implementationApproach).toBeUndefined();
			expect(result.technicalConstraints).toBeUndefined();
			expect(result.acceptanceCriteria).toBeUndefined();
			expect(result.skills).toBeUndefined();
			expect(result.category).toBeUndefined();
		});

		it('should handle null metadata gracefully', () => {
			const result = TaskMapper.extractImplementationMetadata(null);

			expect(result.relevantFiles).toBeUndefined();
			expect(result.codebasePatterns).toBeUndefined();
			expect(result.category).toBeUndefined();
		});

		it('should handle undefined metadata gracefully', () => {
			const result = TaskMapper.extractImplementationMetadata(undefined);

			expect(result.relevantFiles).toBeUndefined();
			expect(result.skills).toBeUndefined();
		});

		it('should handle empty metadata object', () => {
			const result = TaskMapper.extractImplementationMetadata(
				MetadataFixtures.emptyMetadata
			);

			expect(result.relevantFiles).toBeUndefined();
			expect(result.codebasePatterns).toBeUndefined();
		});

		it('should filter invalid items from arrays', () => {
			const result = TaskMapper.extractImplementationMetadata(
				MetadataFixtures.malformedMetadata
			);

			// codebasePatterns has [123, null, 'valid'] - should only keep 'valid'
			expect(result.codebasePatterns).toEqual(['valid']);

			// relevantFiles is 'not-an-array' - should be undefined
			expect(result.relevantFiles).toBeUndefined();

			// existingInfrastructure has invalid structure - should be undefined
			expect(result.existingInfrastructure).toBeUndefined();

			// scopeBoundaries is 'not-an-object' - should be undefined
			expect(result.scopeBoundaries).toBeUndefined();

			// category is 'invalid-category' - should be undefined
			expect(result.category).toBeUndefined();

			// skills is an object - should be undefined
			expect(result.skills).toBeUndefined();
		});

		it('should validate relevantFiles structure', () => {
			const metadata = {
				relevantFiles: [
					{ path: 'valid.ts', description: 'Valid file', action: 'modify' },
					{ path: 'missing-action.ts', description: 'Missing action' }, // Invalid
					{
						path: 'invalid-action.ts',
						description: 'Bad action',
						action: 'delete'
					}, // Invalid action
					{ description: 'No path', action: 'create' }, // Missing path
					'not-an-object' // Invalid type
				]
			};

			const result = TaskMapper.extractImplementationMetadata(metadata);

			expect(result.relevantFiles).toEqual([
				{ path: 'valid.ts', description: 'Valid file', action: 'modify' }
			]);
		});

		it('should validate existingInfrastructure structure', () => {
			const metadata = {
				existingInfrastructure: [
					{ name: 'Valid', location: 'src/valid.ts', usage: 'Use it' },
					{ name: 'Missing location', usage: 'Use it' }, // Invalid
					{ location: 'src/no-name.ts', usage: 'Use it' }, // Invalid
					{ name: 'No usage', location: 'src/test.ts' }, // Invalid
					'not-an-object' // Invalid type
				]
			};

			const result = TaskMapper.extractImplementationMetadata(metadata);

			expect(result.existingInfrastructure).toEqual([
				{ name: 'Valid', location: 'src/valid.ts', usage: 'Use it' }
			]);
		});

		it('should handle scopeBoundaries with partial data', () => {
			const metadataIncludedOnly = {
				scopeBoundaries: { included: 'Just included' }
			};
			const resultIncluded =
				TaskMapper.extractImplementationMetadata(metadataIncludedOnly);
			expect(resultIncluded.scopeBoundaries).toEqual({
				included: 'Just included'
			});

			const metadataExcludedOnly = {
				scopeBoundaries: { excluded: 'Just excluded' }
			};
			const resultExcluded =
				TaskMapper.extractImplementationMetadata(metadataExcludedOnly);
			expect(resultExcluded.scopeBoundaries).toEqual({
				excluded: 'Just excluded'
			});

			// Empty scopeBoundaries object should return undefined
			const metadataEmpty = {
				scopeBoundaries: {}
			};
			const resultEmpty =
				TaskMapper.extractImplementationMetadata(metadataEmpty);
			expect(resultEmpty.scopeBoundaries).toBeUndefined();
		});

		it('should validate category enum values', () => {
			const validCategories = [
				'research',
				'design',
				'development',
				'testing',
				'documentation',
				'review'
			] as const;

			for (const category of validCategories) {
				const result = TaskMapper.extractImplementationMetadata({ category });
				expect(result.category).toBe(category);
			}

			// Invalid category
			const invalidResult = TaskMapper.extractImplementationMetadata({
				category: 'invalid'
			});
			expect(invalidResult.category).toBeUndefined();
		});
	});

	describe('mapDatabaseTaskToTask', () => {
		it('should map basic task fields correctly', () => {
			const dbTask = createMockTaskRow();
			const result = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			expect(result.id).toBe('HAM-1');
			expect(result.databaseId).toBe('uuid-123');
			expect(result.title).toBe('Test Task');
			expect(result.description).toBe('Test description');
			expect(result.status).toBe('pending'); // 'todo' maps to 'pending'
			expect(result.priority).toBe('medium');
		});

		it('should extract implementation metadata from task', () => {
			const dbTask = createMockTaskRow({
				metadata: MetadataFixtures.completeMetadata
			});

			const result = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			expect(result.relevantFiles).toBeDefined();
			expect(result.relevantFiles?.[0].path).toBe('src/service.ts');
			expect(result.codebasePatterns).toEqual([
				'Use dependency injection',
				'Follow SOLID principles'
			]);
			expect(result.category).toBe('development');
			expect(result.skills).toEqual(['TypeScript', 'Node.js']);
		});

		it('should not add undefined metadata fields to result', () => {
			const dbTask = createMockTaskRow({
				metadata: MetadataFixtures.minimalMetadata
			});

			const result = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			// These should not be present as properties (not just undefined values)
			expect('relevantFiles' in result).toBe(false);
			expect('codebasePatterns' in result).toBe(false);
			expect('category' in result).toBe(false);
		});

		it('should map subtasks with implementation metadata', () => {
			const parentTask = createMockTaskRow({ id: 'parent-uuid' });
			const subtask = createMockTaskRow({
				id: 'subtask-uuid',
				display_id: 'HAM-1.1',
				parent_task_id: 'parent-uuid',
				metadata: {
					details: 'Subtask details',
					testStrategy: 'Subtask tests',
					category: 'testing',
					skills: ['Jest', 'Vitest'],
					acceptanceCriteria: ['Tests pass', 'Coverage > 80%']
				}
			});

			const result = TaskMapper.mapDatabaseTaskToTask(
				parentTask,
				[subtask],
				new Map()
			);

			expect(result.subtasks).toHaveLength(1);
			const mappedSubtask = result.subtasks[0];
			expect(mappedSubtask.id).toBe('HAM-1.1');
			expect(mappedSubtask.category).toBe('testing');
			expect(mappedSubtask.skills).toEqual(['Jest', 'Vitest']);
			expect(mappedSubtask.acceptanceCriteria).toEqual([
				'Tests pass',
				'Coverage > 80%'
			]);
		});

		it('should map status correctly', () => {
			const todoTask = createMockTaskRow({ status: 'todo' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(todoTask, [], new Map()).status
			).toBe('pending');

			const inProgressTask = createMockTaskRow({ status: 'in_progress' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(inProgressTask, [], new Map()).status
			).toBe('in-progress');

			const doneTask = createMockTaskRow({ status: 'done' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(doneTask, [], new Map()).status
			).toBe('done');
		});

		it('should map priority correctly', () => {
			const urgentTask = createMockTaskRow({ priority: 'urgent' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(urgentTask, [], new Map()).priority
			).toBe('critical');

			const highTask = createMockTaskRow({ priority: 'high' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(highTask, [], new Map()).priority
			).toBe('high');

			const mediumTask = createMockTaskRow({ priority: 'medium' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(mediumTask, [], new Map()).priority
			).toBe('medium');

			const lowTask = createMockTaskRow({ priority: 'low' });
			expect(
				TaskMapper.mapDatabaseTaskToTask(lowTask, [], new Map()).priority
			).toBe('low');
		});
	});

	describe('mapDatabaseTasksToTasks', () => {
		it('should group subtasks under parent tasks', () => {
			const parentTask = createMockTaskRow({
				id: 'parent-uuid',
				display_id: 'HAM-1'
			});
			const subtask1 = createMockTaskRow({
				id: 'subtask-1-uuid',
				display_id: 'HAM-1.1',
				parent_task_id: 'parent-uuid',
				subtask_position: 1
			});
			const subtask2 = createMockTaskRow({
				id: 'subtask-2-uuid',
				display_id: 'HAM-1.2',
				parent_task_id: 'parent-uuid',
				subtask_position: 2
			});

			const result = TaskMapper.mapDatabaseTasksToTasks(
				[parentTask, subtask1, subtask2],
				new Map()
			);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('HAM-1');
			expect(result[0].subtasks).toHaveLength(2);
			expect(result[0].subtasks[0].id).toBe('HAM-1.1');
			expect(result[0].subtasks[1].id).toBe('HAM-1.2');
		});

		it('should handle empty task list', () => {
			const result = TaskMapper.mapDatabaseTasksToTasks([], new Map());
			expect(result).toEqual([]);
		});

		it('should handle null task list', () => {
			const result = TaskMapper.mapDatabaseTasksToTasks(
				null as unknown as TaskRow[],
				new Map()
			);
			expect(result).toEqual([]);
		});

		it('should include implementation metadata in mapped tasks', () => {
			const task = createMockTaskRow({
				metadata: {
					details: 'Task details',
					implementationApproach: 'Step by step guide',
					technicalConstraints: ['Constraint 1', 'Constraint 2']
				}
			});

			const result = TaskMapper.mapDatabaseTasksToTasks([task], new Map());

			expect(result[0].implementationApproach).toBe('Step by step guide');
			expect(result[0].technicalConstraints).toEqual([
				'Constraint 1',
				'Constraint 2'
			]);
		});
	});
});
