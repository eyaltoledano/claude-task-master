/**
 * @fileoverview Tests for task ID normalization utilities
 */

import { describe, it, expect } from 'vitest';
import {
	normalizeTaskId,
	normalizeSubtaskId,
	normalizeDependency,
	normalizeDependencies,
	normalizeSubtask,
	normalizeTask,
	normalizeTaskIds
} from './task-id-normalizer.js';
import type { Task, Subtask } from '../types/index.js';

describe('Task ID Normalizer', () => {
	describe('normalizeTaskId', () => {
		it('converts string numbers to strings', () => {
			expect(normalizeTaskId('1')).toBe('1');
			expect(normalizeTaskId('5')).toBe('5');
			expect(normalizeTaskId('123')).toBe('123');
		});

		it('converts positive integers to strings', () => {
			expect(normalizeTaskId(1)).toBe('1');
			expect(normalizeTaskId(42)).toBe('42');
			expect(normalizeTaskId(5)).toBe('5');
		});

		it('preserves non-numeric string IDs', () => {
			expect(normalizeTaskId('HAM-123')).toBe('HAM-123');
		});

		it('returns null for invalid values', () => {
			expect(normalizeTaskId('')).toBeNull();
			expect(normalizeTaskId(null)).toBeNull();
			expect(normalizeTaskId(undefined)).toBeNull();
		});

		it('returns null for non-positive numeric inputs', () => {
			expect(normalizeTaskId(0)).toBeNull();
			expect(normalizeTaskId(-1)).toBeNull();
		});

		it('preserves negative string IDs as non-numeric strings', () => {
			// '-5' is treated as a non-numeric string ID (like 'HAM-123')
			expect(normalizeTaskId('-5')).toBe('-5');
		});

		it('extracts task part from subtask ID format as string', () => {
			expect(normalizeTaskId('5.1')).toBe('5');
			expect(normalizeTaskId('10.2.3')).toBe('10');
		});

		it('handles NaN-producing inputs safely', () => {
			expect(normalizeTaskId(NaN)).toBeNull();
			expect(normalizeTaskId('NaN')).toBe('NaN');
		});
	});

	describe('normalizeSubtaskId', () => {
		it('converts string numbers to strings', () => {
			expect(normalizeSubtaskId('1')).toBe('1');
			expect(normalizeSubtaskId('3')).toBe('3');
		});

		it('converts positive integers to strings', () => {
			expect(normalizeSubtaskId(1)).toBe('1');
			expect(normalizeSubtaskId(3)).toBe('3');
		});

		it('extracts subtask part from full subtask ID as string', () => {
			expect(normalizeSubtaskId('5.1')).toBe('1');
			expect(normalizeSubtaskId('10.2')).toBe('2');
			expect(normalizeSubtaskId('1.2.3')).toBe('3');
		});

		it('preserves non-numeric string IDs', () => {
			expect(normalizeSubtaskId('abc')).toBe('abc');
		});

		it('returns null for invalid values', () => {
			expect(normalizeSubtaskId(null)).toBeNull();
			expect(normalizeSubtaskId(0)).toBeNull();
		});
	});

	describe('normalizeDependency', () => {
		it('converts task references to strings', () => {
			expect(normalizeDependency('5')).toBe('5');
			expect(normalizeDependency(5)).toBe('5');
			expect(normalizeDependency('123')).toBe('123');
		});

		it('keeps subtask references as strings', () => {
			expect(normalizeDependency('7.1')).toBe('7.1');
			expect(normalizeDependency('1.2.3')).toBe('1.2.3');
			expect(normalizeDependency('3.1')).toBe('3.1');
		});

		it('returns string for non-numeric values', () => {
			expect(normalizeDependency('abc')).toBe('abc');
		});

		it('returns empty string for null/undefined', () => {
			expect(normalizeDependency(null)).toBe('');
			expect(normalizeDependency(undefined)).toBe('');
		});

		it('returns empty string for invalid numeric values', () => {
			expect(normalizeDependency(NaN)).toBe('');
		});

		it('converts zero and negative numbers to strings', () => {
			expect(normalizeDependency(0)).toBe('0');
			expect(normalizeDependency(-3)).toBe('-3');
		});
	});

	describe('normalizeDependencies', () => {
		it('normalizes an array of dependencies to strings', () => {
			const result = normalizeDependencies(['1', '2', '3.1', 'abc']);
			expect(result).toEqual(['1', '2', '3.1', 'abc']);
		});

		it('filters out empty values', () => {
			const result = normalizeDependencies(['1', null, '2', undefined]);
			// null and undefined become '', which gets filtered out
			expect(result).toEqual(['1', '2']);
		});

		it('returns empty array for null/undefined input', () => {
			expect(normalizeDependencies(null)).toEqual([]);
			expect(normalizeDependencies(undefined)).toEqual([]);
		});

		it('returns empty array for non-array input', () => {
			expect(normalizeDependencies('not-an-array' as any)).toEqual([]);
		});
	});

	describe('normalizeSubtask', () => {
		it('normalizes subtask with string ID and string parentId', () => {
			const subtask = {
				id: '1',
				title: 'Test Subtask',
				description: 'Description',
				status: 'pending' as const,
				priority: 'medium' as const,
				dependencies: ['2', '3.1'],
				details: '',
				testStrategy: ''
			};

			const result = normalizeSubtask(subtask as any, '5');

			expect(result.id).toBe('1');
			expect(result.parentId).toBe('5');
			expect(result.dependencies).toEqual(['2', '3.1']);
		});

		it('handles non-numeric subtask ID gracefully', () => {
			const subtask = {
				id: 'abc',
				title: 'Test',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: ''
			};

			const result = normalizeSubtask(subtask as any, '1');

			// 'abc' is preserved as a non-empty string ID
			expect(result.id).toBe('abc');
			expect(result.parentId).toBe('1');
		});

		it('rejects negative subtask IDs with fallback', () => {
			const subtask = {
				id: -5,
				title: 'Test',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: ''
			};

			const result = normalizeSubtask(subtask as any, '1');

			// Negative IDs produce null from normalizeSubtaskId, fallback to parentId-based string
			expect(result.id).toBe('1.0');
			expect(result.parentId).toBe('1');
		});

		it('rejects Infinity subtask ID with fallback', () => {
			const subtask = {
				id: Infinity,
				title: 'Test',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: ''
			};

			const result = normalizeSubtask(subtask as any, '1');
			expect(result.id).toBe('1.0');
		});

		it('rejects zero subtask ID with fallback', () => {
			const subtask = {
				id: 0,
				title: 'Test',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: ''
			};

			const result = normalizeSubtask(subtask as any, '1');

			// Zero produces null from normalizeSubtaskId, fallback to parentId-based string
			expect(result.id).toBe('1.0');
		});

		it('handles undefined/null subtask ID with fallback', () => {
			const subtask1 = {
				id: undefined,
				title: 'Test',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: ''
			};

			const subtask2 = {
				id: null,
				title: 'Test',
				description: '',
				status: 'pending' as const,
				priority: 'low' as const,
				dependencies: [],
				details: '',
				testStrategy: ''
			};

			expect(normalizeSubtask(subtask1 as any, '1').id).toBe('1.0');
			expect(normalizeSubtask(subtask2 as any, '1').id).toBe('1.0');
		});
	});

	describe('normalizeTask', () => {
		it('normalizes a complete task with subtasks to strings', () => {
			const task: Task = {
				id: '5',
				title: 'Test Task',
				description: 'Description',
				status: 'pending',
				priority: 'high',
				dependencies: ['1', '2', '3.1'],
				details: '',
				testStrategy: '',
				subtasks: [
					{
						id: '1',
						parentId: '5',
						title: 'Subtask 1',
						description: '',
						status: 'pending',
						priority: 'medium',
						dependencies: ['1', '2.1'],
						details: '',
						testStrategy: ''
					} as Subtask
				]
			};

			const result = normalizeTask(task);

			expect(result.id).toBe('5');
			expect(result.dependencies).toEqual(['1', '2', '3.1']);
			expect(result.subtasks[0].id).toBe('1');
			expect(result.subtasks[0].parentId).toBe('5');
			expect(result.subtasks[0].dependencies).toEqual(['1', '2.1']);
		});

		it('handles task without subtasks', () => {
			const task: Task = {
				id: '10',
				title: 'Simple Task',
				description: '',
				status: 'done',
				priority: 'low',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			expect(result.id).toBe('10');
			expect(result.subtasks).toEqual([]);
		});

		it('converts numeric task ID to string', () => {
			const task: Task = {
				id: 5 as any,
				title: 'Numeric Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			expect(result.id).toBe('5');
		});

		it('preserves non-numeric string IDs (API IDs like HAM-1)', () => {
			const task: Task = {
				id: 'HAM-123',
				title: 'API Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			expect(result.id).toBe('HAM-123');
		});

		it('preserves other non-numeric string IDs', () => {
			const task: Task = {
				id: 'abc',
				title: 'Test Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			expect(result.id).toBe('abc');
		});

		it('rejects negative task IDs with string fallback', () => {
			const task: Task = {
				id: -5 as any,
				title: 'Negative ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			// Negative IDs produce null, fallback to string "0"
			expect(result.id).toBe('0');
		});

		it('rejects zero task ID with string fallback', () => {
			const task: Task = {
				id: 0 as any,
				title: 'Zero ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			// Zero produces null, fallback to string "0"
			expect(result.id).toBe('0');
		});

		it('handles undefined/null task ID with string fallback', () => {
			const task1: Task = {
				id: undefined as any,
				title: 'Undefined ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const task2: Task = {
				id: null as any,
				title: 'Null ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			expect(normalizeTask(task1).id).toBe('0');
			expect(normalizeTask(task2).id).toBe('0');
		});

		it('handles NaN task ID with string fallback', () => {
			const task: Task = {
				id: NaN as any,
				title: 'NaN ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			// NaN produces null, fallback to string "0"
			expect(result.id).toBe('0');
		});

		it('rejects Infinity task ID with string fallback', () => {
			const task: Task = {
				id: Infinity as any,
				title: 'Infinity ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);
			expect(result.id).toBe('0');
		});

		it('handles empty string task ID with string fallback', () => {
			const task: Task = {
				id: '',
				title: 'Empty ID Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const result = normalizeTask(task);

			// Empty string produces null, fallback to string "0"
			expect(result.id).toBe('0');
		});

		it('subtasks preserve parentId when parent has string ID', () => {
			const task: Task = {
				id: 'HAM-123',
				title: 'API Task',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: [
					{
						id: '1',
						parentId: 'HAM-123',
						title: 'Subtask 1',
						description: '',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: ''
					} as Subtask
				]
			};

			const result = normalizeTask(task);

			expect(result.id).toBe('HAM-123');
			expect(result.subtasks[0].parentId).toBe('HAM-123');
		});
	});

	describe('normalizeTaskIds', () => {
		it('normalizes an array of tasks to string IDs', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'high',
					dependencies: ['2'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'done',
					priority: 'low',
					dependencies: ['1', '3.1'],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];

			const result = normalizeTaskIds(tasks as Task[]);

			expect(result[0].id).toBe('1');
			expect(result[0].dependencies).toEqual(['2']);
			expect(result[1].id).toBe('2');
			expect(result[1].dependencies).toEqual(['1', '3.1']);
		});

		it('returns empty array for non-array input', () => {
			expect(normalizeTaskIds(null as any)).toEqual([]);
			expect(normalizeTaskIds(undefined as any)).toEqual([]);
			expect(normalizeTaskIds('not-an-array' as any)).toEqual([]);
		});

		it('converts mixed numeric and string IDs to strings', () => {
			const tasks: Task[] = [
				{
					id: 1 as any, // Numeric - should become "1"
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: [2, '3.1'] as any, // Mixed types - all become strings
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2', // Already string
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];

			const result = normalizeTaskIds(tasks as Task[]);

			expect(result[0].id).toBe('1');
			expect(result[0].dependencies).toEqual(['2', '3.1']);
			expect(result[1].id).toBe('2');
		});
	});
});
