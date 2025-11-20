/**
 * @fileoverview Unit tests for TaskEntity validation
 * Tests that validation errors are properly thrown with correct error codes
 */

import { describe, expect, it } from 'vitest';
import { TaskEntity } from './task.entity.js';
import { ERROR_CODES, TaskMasterError } from '../../../common/errors/task-master-error.js';
import type { Task } from '../../../common/types/index.js';

describe('TaskEntity', () => {
	describe('validation', () => {
		it('should create a valid task entity', () => {
			const validTask: Task = {
				id: '1',
				title: 'Test Task',
				description: 'A valid test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: 'Some details',
				testStrategy: 'Unit tests',
				subtasks: []
			};

			const entity = new TaskEntity(validTask);

			expect(entity.id).toBe('1');
			expect(entity.title).toBe('Test Task');
			expect(entity.description).toBe('A valid test task');
			expect(entity.status).toBe('pending');
			expect(entity.priority).toBe('high');
		});

		it('should throw VALIDATION_ERROR when id is missing', () => {
			const invalidTask = {
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as any;

			expect(() => new TaskEntity(invalidTask)).toThrow(TaskMasterError);

			try {
				new TaskEntity(invalidTask);
				expect.fail('Should have thrown an error');
			} catch (error: any) {
				expect(error).toBeInstanceOf(TaskMasterError);
				expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
				expect(error.message).toContain('Task ID is required');
			}
		});

		it('should throw VALIDATION_ERROR when title is missing', () => {
			const invalidTask = {
				id: '1',
				title: '',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as Task;

			expect(() => new TaskEntity(invalidTask)).toThrow(TaskMasterError);

			try {
				new TaskEntity(invalidTask);
				expect.fail('Should have thrown an error');
			} catch (error: any) {
				expect(error).toBeInstanceOf(TaskMasterError);
				expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
				expect(error.message).toContain('Task title is required');
			}
		});

		it('should throw VALIDATION_ERROR when description is missing', () => {
			const invalidTask = {
				id: '1',
				title: 'Test Task',
				description: '',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as Task;

			expect(() => new TaskEntity(invalidTask)).toThrow(TaskMasterError);

			try {
				new TaskEntity(invalidTask);
				expect.fail('Should have thrown an error');
			} catch (error: any) {
				expect(error).toBeInstanceOf(TaskMasterError);
				expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
				expect(error.message).toContain('Task description is required');
			}
		});

		it('should throw VALIDATION_ERROR when title is only whitespace', () => {
			const invalidTask = {
				id: '1',
				title: '   ',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as Task;

			expect(() => new TaskEntity(invalidTask)).toThrow(TaskMasterError);

			try {
				new TaskEntity(invalidTask);
				expect.fail('Should have thrown an error');
			} catch (error: any) {
				expect(error).toBeInstanceOf(TaskMasterError);
				expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
				expect(error.message).toContain('Task title is required');
			}
		});

		it('should throw VALIDATION_ERROR when description is only whitespace', () => {
			const invalidTask = {
				id: '1',
				title: 'Test Task',
				description: '   ',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as Task;

			expect(() => new TaskEntity(invalidTask)).toThrow(TaskMasterError);

			try {
				new TaskEntity(invalidTask);
				expect.fail('Should have thrown an error');
			} catch (error: any) {
				expect(error).toBeInstanceOf(TaskMasterError);
				expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
				expect(error.message).toContain('Task description is required');
			}
		});

		it('should convert numeric id to string', () => {
			const taskWithNumericId = {
				id: 123,
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as any;

			const entity = new TaskEntity(taskWithNumericId);

			expect(entity.id).toBe('123');
			expect(typeof entity.id).toBe('string');
		});

		it('should convert dependency ids to strings', () => {
			const taskWithNumericDeps = {
				id: '1',
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [1, 2, '3'] as any,
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const entity = new TaskEntity(taskWithNumericDeps);

			expect(entity.dependencies).toEqual(['1', '2', '3']);
			entity.dependencies.forEach((dep) => {
				expect(typeof dep).toBe('string');
			});
		});

		it('should normalize subtask ids to strings for parent and numbers for subtask', () => {
			const taskWithSubtasks = {
				id: '1',
				title: 'Parent Task',
				description: 'A parent task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: [
					{
						id: '1' as any,
						parentId: '1',
						title: 'Subtask 1',
						description: 'First subtask',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: ''
					},
					{
						id: 2 as any,
						parentId: 1 as any,
						title: 'Subtask 2',
						description: 'Second subtask',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: ''
					}
				]
			} as Task;

			const entity = new TaskEntity(taskWithSubtasks);

			expect(entity.subtasks[0].id).toBe(1);
			expect(typeof entity.subtasks[0].id).toBe('number');
			expect(entity.subtasks[0].parentId).toBe('1');
			expect(typeof entity.subtasks[0].parentId).toBe('string');

			expect(entity.subtasks[1].id).toBe(2);
			expect(typeof entity.subtasks[1].id).toBe('number');
			expect(entity.subtasks[1].parentId).toBe('1');
			expect(typeof entity.subtasks[1].parentId).toBe('string');
		});
	});

	describe('fromObject', () => {
		it('should create TaskEntity from plain object', () => {
			const plainTask: Task = {
				id: '1',
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const entity = TaskEntity.fromObject(plainTask);

			expect(entity).toBeInstanceOf(TaskEntity);
			expect(entity.id).toBe('1');
			expect(entity.title).toBe('Test Task');
		});

		it('should throw validation error for invalid object', () => {
			const invalidTask = {
				id: '1',
				title: '',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			} as Task;

			expect(() => TaskEntity.fromObject(invalidTask)).toThrow(TaskMasterError);
		});
	});

	describe('fromArray', () => {
		it('should create array of TaskEntities from plain objects', () => {
			const plainTasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'First task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: 'Second task',
					status: 'in-progress',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];

			const entities = TaskEntity.fromArray(plainTasks);

			expect(entities).toHaveLength(2);
			expect(entities[0]).toBeInstanceOf(TaskEntity);
			expect(entities[1]).toBeInstanceOf(TaskEntity);
			expect(entities[0].id).toBe('1');
			expect(entities[1].id).toBe('2');
		});

		it('should throw validation error if any task is invalid', () => {
			const tasksWithInvalid: Task[] = [
				{
					id: '1',
					title: 'Valid Task',
					description: 'First task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Invalid Task',
					description: '', // Invalid - missing description
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];

			expect(() => TaskEntity.fromArray(tasksWithInvalid)).toThrow(
				TaskMasterError
			);
		});
	});

	describe('toJSON', () => {
		it('should convert TaskEntity to plain object', () => {
			const taskData: Task = {
				id: '1',
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: ['2', '3'],
				details: 'Some details',
				testStrategy: 'Unit tests',
				subtasks: []
			};

			const entity = new TaskEntity(taskData);
			const json = entity.toJSON();

			expect(json).toEqual({
				id: '1',
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				priority: 'high',
				dependencies: ['2', '3'],
				details: 'Some details',
				testStrategy: 'Unit tests',
				subtasks: []
			});
		});
	});
});
