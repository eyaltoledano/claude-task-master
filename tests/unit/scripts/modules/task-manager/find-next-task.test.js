/**
 * Tests for the find-next-task.js module
 */
import { jest } from '@jest/globals';
import findNextTask from '../../../../../scripts/modules/task-manager/find-next-task.js';

describe('findNextTask', () => {
	test('should return the highest priority task with all dependencies satisfied', () => {
		const tasks = [
			{
				id: 1,
				title: 'Setup Project',
				status: 'done',
				dependencies: [],
				priority: 'high'
			},
			{
				id: 2,
				title: 'Implement Core Features',
				status: 'pending',
				dependencies: [1],
				priority: 'high'
			},
			{
				id: 3,
				title: 'Create Documentation',
				status: 'pending',
				dependencies: [1],
				priority: 'medium'
			},
			{
				id: 4,
				title: 'Deploy Application',
				status: 'pending',
				dependencies: [2, 3],
				priority: 'high'
			}
		];

		const nextTask = findNextTask(tasks);

		expect(nextTask).toBeDefined();
		expect(nextTask.id).toBe(2);
		expect(nextTask.title).toBe('Implement Core Features');
	});

	test('should prioritize by priority level when dependencies are equal', () => {
		const tasks = [
			{
				id: 1,
				title: 'Setup Project',
				status: 'done',
				dependencies: [],
				priority: 'high'
			},
			{
				id: 2,
				title: 'Low Priority Task',
				status: 'pending',
				dependencies: [1],
				priority: 'low'
			},
			{
				id: 3,
				title: 'Medium Priority Task',
				status: 'pending',
				dependencies: [1],
				priority: 'medium'
			},
			{
				id: 4,
				title: 'High Priority Task',
				status: 'pending',
				dependencies: [1],
				priority: 'high'
			}
		];

		const nextTask = findNextTask(tasks);

		expect(nextTask.id).toBe(4);
		expect(nextTask.priority).toBe('high');
	});

	test('should return null when all tasks are completed', () => {
		const tasks = [
			{
				id: 1,
				title: 'Setup Project',
				status: 'done',
				dependencies: [],
				priority: 'high'
			},
			{
				id: 2,
				title: 'Implement Features',
				status: 'done',
				dependencies: [1],
				priority: 'high'
			}
		];

		const nextTask = findNextTask(tasks);

		expect(nextTask).toBeNull();
	});

	test('should return null when all pending tasks have unsatisfied dependencies', () => {
		const tasks = [
			{
				id: 1,
				title: 'Setup Project',
				status: 'pending',
				dependencies: [2],
				priority: 'high'
			},
			{
				id: 2,
				title: 'Implement Features',
				status: 'pending',
				dependencies: [1],
				priority: 'high'
			}
		];

		const nextTask = findNextTask(tasks);

		expect(nextTask).toBeNull();
	});

	test('should handle empty tasks array', () => {
		const nextTask = findNextTask([]);

		expect(nextTask).toBeNull();
	});

	test('should consider subtask dependencies when finding next task', () => {
		const tasks = [
			{
				id: 1,
				title: 'Parent Task',
				status: 'in-progress',
				dependencies: [],
				priority: 'high',
				subtasks: [
					{
						id: 1,
						title: 'Subtask 1',
						status: 'done',
						dependencies: []
					},
					{
						id: 2,
						title: 'Subtask 2',
						status: 'pending',
						dependencies: []
					}
				]
			},
			{
				id: 2,
				title: 'Dependent Task',
				status: 'pending',
				dependencies: [1],
				priority: 'high'
			}
		];

		const nextTask = findNextTask(tasks);

		// Task 2 should not be returned because Task 1 is not completely done
		// (it has a pending subtask)
		expect(nextTask).not.toEqual(expect.objectContaining({ id: 2 }));
	});
});
