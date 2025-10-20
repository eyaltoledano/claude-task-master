import { describe, it, expect, vi } from 'vitest';
import { TaskMapper } from './TaskMapper.js';
import type { Tables } from '../types/database.types.js';

type TaskRow = Tables<'tasks'>;

describe('TaskMapper', () => {
	describe('extractMetadataField', () => {
		it('should extract string field from metadata', () => {
			const taskRow: TaskRow = {
				id: '123',
				display_id: '1',
				title: 'Test Task',
				description: 'Test description',
				status: 'todo',
				priority: 'medium',
				parent_task_id: null,
				subtask_position: 0,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				metadata: {
					details: 'Some details',
					testStrategy: 'Test with unit tests'
				},
				complexity: null,
				assignee_id: null,
				estimated_hours: null,
				actual_hours: null,
				due_date: null,
				completed_at: null
			};

			const task = TaskMapper.mapDatabaseTaskToTask(taskRow, [], new Map());

			expect(task.details).toBe('Some details');
			expect(task.testStrategy).toBe('Test with unit tests');
		});

		it('should use default value when metadata field is missing', () => {
			const taskRow: TaskRow = {
				id: '123',
				display_id: '1',
				title: 'Test Task',
				description: 'Test description',
				status: 'todo',
				priority: 'medium',
				parent_task_id: null,
				subtask_position: 0,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				metadata: {},
				complexity: null,
				assignee_id: null,
				estimated_hours: null,
				actual_hours: null,
				due_date: null,
				completed_at: null
			};

			const task = TaskMapper.mapDatabaseTaskToTask(taskRow, [], new Map());

			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
		});

		it('should use default value when metadata is null', () => {
			const taskRow: TaskRow = {
				id: '123',
				display_id: '1',
				title: 'Test Task',
				description: 'Test description',
				status: 'todo',
				priority: 'medium',
				parent_task_id: null,
				subtask_position: 0,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				metadata: null,
				complexity: null,
				assignee_id: null,
				estimated_hours: null,
				actual_hours: null,
				due_date: null,
				completed_at: null
			};

			const task = TaskMapper.mapDatabaseTaskToTask(taskRow, [], new Map());

			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
		});

		it('should use default value and warn when metadata field has wrong type', () => {
			const consoleWarnSpy = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => {});

			const taskRow: TaskRow = {
				id: '123',
				display_id: '1',
				title: 'Test Task',
				description: 'Test description',
				status: 'todo',
				priority: 'medium',
				parent_task_id: null,
				subtask_position: 0,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				metadata: {
					details: 12345, // Wrong type: number instead of string
					testStrategy: ['test1', 'test2'] // Wrong type: array instead of string
				},
				complexity: null,
				assignee_id: null,
				estimated_hours: null,
				actual_hours: null,
				due_date: null,
				completed_at: null
			};

			const task = TaskMapper.mapDatabaseTaskToTask(taskRow, [], new Map());

			// Should use empty string defaults when type doesn't match
			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');

			// Should have logged warnings
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Type mismatch in metadata field "details"')
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Type mismatch in metadata field "testStrategy"'
				)
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('mapStatus', () => {
		it('should map database status to internal status', () => {
			expect(TaskMapper.mapStatus('todo')).toBe('pending');
			expect(TaskMapper.mapStatus('in_progress')).toBe('in-progress');
			expect(TaskMapper.mapStatus('done')).toBe('done');
		});
	});
});
