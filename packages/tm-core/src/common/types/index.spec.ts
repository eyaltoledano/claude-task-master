/**
 * @fileoverview Tests for core type definitions and type guards
 */

import { describe, it, expect } from 'vitest';
import {
	isTaskStatus,
	isTaskPriority,
	isTaskComplexity,
	isValidTaskIdType,
	isTask,
	isSubtask
} from './index.js';
import type { Task, Subtask, TaskStatus, TaskPriority } from './index.js';

describe('Type Guards', () => {
	describe('isTaskStatus', () => {
		it('returns true for valid status values', () => {
			expect(isTaskStatus('pending')).toBe(true);
			expect(isTaskStatus('in-progress')).toBe(true);
			expect(isTaskStatus('done')).toBe(true);
			expect(isTaskStatus('deferred')).toBe(true);
			expect(isTaskStatus('cancelled')).toBe(true);
			expect(isTaskStatus('blocked')).toBe(true);
			expect(isTaskStatus('review')).toBe(true);
		});

		it('returns false for invalid values', () => {
			expect(isTaskStatus('invalid')).toBe(false);
			expect(isTaskStatus('')).toBe(false);
			expect(isTaskStatus(123)).toBe(false);
			expect(isTaskStatus(null)).toBe(false);
			expect(isTaskStatus(undefined)).toBe(false);
		});
	});

	describe('isTaskPriority', () => {
		it('returns true for valid priority values', () => {
			expect(isTaskPriority('low')).toBe(true);
			expect(isTaskPriority('medium')).toBe(true);
			expect(isTaskPriority('high')).toBe(true);
			expect(isTaskPriority('critical')).toBe(true);
		});

		it('returns false for invalid values', () => {
			expect(isTaskPriority('invalid')).toBe(false);
			expect(isTaskPriority('')).toBe(false);
			expect(isTaskPriority(1)).toBe(false);
		});
	});

	describe('isTaskComplexity', () => {
		it('returns true for valid complexity values', () => {
			expect(isTaskComplexity('simple')).toBe(true);
			expect(isTaskComplexity('moderate')).toBe(true);
			expect(isTaskComplexity('complex')).toBe(true);
			expect(isTaskComplexity('very-complex')).toBe(true);
		});

		it('returns false for invalid values', () => {
			expect(isTaskComplexity('invalid')).toBe(false);
			expect(isTaskComplexity(5)).toBe(false);
		});
	});

	describe('isValidTaskIdType', () => {
		it('returns true for number IDs', () => {
			expect(isValidTaskIdType(1)).toBe(true);
			expect(isValidTaskIdType(42)).toBe(true);
			expect(isValidTaskIdType(0)).toBe(true);
			expect(isValidTaskIdType(-1)).toBe(true); // Still a number
		});

		it('returns true for string IDs', () => {
			expect(isValidTaskIdType('1')).toBe(true);
			expect(isValidTaskIdType('HAM-123')).toBe(true);
			expect(isValidTaskIdType('1.2')).toBe(true);
			expect(isValidTaskIdType('')).toBe(true); // Empty string is still a string
		});

		it('returns false for non-number/string values', () => {
			expect(isValidTaskIdType(null)).toBe(false);
			expect(isValidTaskIdType(undefined)).toBe(false);
			expect(isValidTaskIdType({})).toBe(false);
			expect(isValidTaskIdType([])).toBe(false);
		});
	});

	describe('isTask', () => {
		const createValidTask = (overrides: Partial<Task> = {}): Task => ({
			id: 1,
			title: 'Test Task',
			description: 'Test description',
			status: 'pending' as TaskStatus,
			priority: 'medium' as TaskPriority,
			dependencies: [],
			details: 'Test details',
			testStrategy: 'Test strategy',
			subtasks: [],
			...overrides
		});

		it('returns true for valid task with numeric ID', () => {
			const task = createValidTask({ id: 1 });
			expect(isTask(task)).toBe(true);
		});

		it('returns true for valid task with string ID', () => {
			const task = createValidTask({ id: 'HAM-123' });
			expect(isTask(task)).toBe(true);
		});

		it('returns true for valid task with string numeric ID', () => {
			const task = createValidTask({ id: '42' });
			expect(isTask(task)).toBe(true);
		});

		it('returns false for null/undefined', () => {
			expect(isTask(null)).toBe(false);
			expect(isTask(undefined)).toBe(false);
		});

		it('returns false for non-object', () => {
			expect(isTask('string')).toBe(false);
			expect(isTask(123)).toBe(false);
		});

		it('returns false for invalid id type', () => {
			const task = createValidTask();
			(task as any).id = {}; // Invalid type
			expect(isTask(task)).toBe(false);
		});

		it('returns false for missing required fields', () => {
			const task = createValidTask();
			delete (task as any).title;
			expect(isTask(task)).toBe(false);
		});

		it('returns false for invalid status', () => {
			const task = createValidTask();
			(task as any).status = 'invalid-status';
			expect(isTask(task)).toBe(false);
		});

		it('returns false for invalid priority', () => {
			const task = createValidTask();
			(task as any).priority = 'invalid-priority';
			expect(isTask(task)).toBe(false);
		});

		it('returns false for non-array dependencies', () => {
			const task = createValidTask();
			(task as any).dependencies = 'not-array';
			expect(isTask(task)).toBe(false);
		});

		it('returns false for non-array subtasks', () => {
			const task = createValidTask();
			(task as any).subtasks = 'not-array';
			expect(isTask(task)).toBe(false);
		});
	});

	describe('isSubtask', () => {
		const createValidSubtask = (overrides: Partial<Subtask> = {}): Subtask => ({
			id: 1,
			parentId: 5,
			title: 'Test Subtask',
			description: 'Test description',
			status: 'pending' as TaskStatus,
			priority: 'medium' as TaskPriority,
			dependencies: [],
			details: 'Test details',
			testStrategy: 'Test strategy',
			...overrides
		});

		it('returns true for valid subtask with numeric ID and parentId', () => {
			const subtask = createValidSubtask({ id: 1, parentId: 5 });
			expect(isSubtask(subtask)).toBe(true);
		});

		it('returns true for valid subtask with string ID and parentId', () => {
			const subtask = createValidSubtask({ id: '1', parentId: '5' });
			expect(isSubtask(subtask)).toBe(true);
		});

		it('returns true for valid subtask with mixed ID types', () => {
			// Numeric ID, string parentId
			const subtask1 = createValidSubtask({ id: 1, parentId: '5' });
			expect(isSubtask(subtask1)).toBe(true);

			// String ID, numeric parentId
			const subtask2 = createValidSubtask({ id: '1', parentId: 5 });
			expect(isSubtask(subtask2)).toBe(true);
		});

		it('returns false for null/undefined', () => {
			expect(isSubtask(null)).toBe(false);
			expect(isSubtask(undefined)).toBe(false);
		});

		it('returns false for non-object', () => {
			expect(isSubtask('string')).toBe(false);
			expect(isSubtask(123)).toBe(false);
		});

		it('returns false for invalid id type', () => {
			const subtask = createValidSubtask();
			(subtask as any).id = {}; // Invalid type
			expect(isSubtask(subtask)).toBe(false);
		});

		it('returns false for invalid parentId type', () => {
			const subtask = createValidSubtask();
			(subtask as any).parentId = {}; // Invalid type
			expect(isSubtask(subtask)).toBe(false);
		});

		it('returns false if subtasks property exists', () => {
			const subtask = createValidSubtask();
			(subtask as any).subtasks = []; // Subtasks cannot have subtasks
			expect(isSubtask(subtask)).toBe(false);
		});

		it('returns false for invalid status', () => {
			const subtask = createValidSubtask();
			(subtask as any).status = 'invalid-status';
			expect(isSubtask(subtask)).toBe(false);
		});

		it('returns false for invalid priority', () => {
			const subtask = createValidSubtask();
			(subtask as any).priority = 'invalid-priority';
			expect(isSubtask(subtask)).toBe(false);
		});
	});
});
