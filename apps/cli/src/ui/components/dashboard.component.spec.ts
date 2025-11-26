/**
 * @fileoverview Tests for dashboard component calculations
 * Bug fix: Cancelled tasks should be treated as complete
 */

import type { Subtask, Task, TaskStatus } from '@tm/core';
import { describe, expect, it } from 'vitest';
import {
	calculateDependencyStatistics,
	calculateSubtaskStatistics,
	calculateTaskStatistics
} from './dashboard.component.js';

/**
 * Local test helpers for dashboard statistics tests.
 *
 * These helpers create minimal task structures focused on status for statistics
 * calculations. Only `id` and `status` are typically needed - all other fields
 * have sensible defaults.
 */
const createTestTask = (
	overrides: Partial<Omit<Task, 'id'>> & Pick<Task, 'id'>
): Task => ({
	title: '',
	description: '',
	status: 'pending',
	priority: 'medium',
	dependencies: [],
	details: '',
	testStrategy: '',
	subtasks: [],
	...overrides
});

const createTestSubtask = (
	id: number | string,
	parentId: string,
	status: TaskStatus
): Subtask => ({
	id,
	parentId,
	title: '',
	status,
	description: '',
	priority: 'medium',
	dependencies: [],
	details: '',
	testStrategy: ''
});

describe('dashboard.component - Bug Fix: Cancelled Tasks as Complete', () => {
	describe('calculateTaskStatistics', () => {
		it('should treat cancelled tasks as complete in percentage calculation', () => {
			// Arrange: 14 done, 1 cancelled = 100% complete
			const tasks: Task[] = [
				...Array.from({ length: 14 }, (_, i) =>
					createTestTask({ id: String(i + 1), status: 'done' })
				),
				createTestTask({ id: '15', status: 'cancelled' })
			];

			// Act
			const stats = calculateTaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(15);
			expect(stats.done).toBe(14);
			expect(stats.cancelled).toBe(1);
			expect(stats.completedCount).toBe(15); // done + cancelled
			expect(stats.completionPercentage).toBe(100);
		});

		it('should treat completed status as complete in percentage calculation', () => {
			// Arrange: Mix of done, completed, cancelled, pending
			const tasks: Task[] = [
				createTestTask({ id: '1', status: 'done' }),
				createTestTask({ id: '2', status: 'completed' }),
				createTestTask({ id: '3', status: 'cancelled' }),
				createTestTask({ id: '4', status: 'pending' })
			];

			// Act
			const stats = calculateTaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(4);
			expect(stats.done).toBe(1);
			expect(stats.cancelled).toBe(1);
			expect(stats.completedCount).toBe(3); // done + completed + cancelled
			// 3 complete out of 4 total = 75%
			expect(stats.completionPercentage).toBe(75);
		});

		it('should show 100% completion when all tasks are cancelled', () => {
			// Arrange
			const tasks: Task[] = [
				createTestTask({ id: '1', status: 'cancelled' }),
				createTestTask({ id: '2', status: 'cancelled' })
			];

			// Act
			const stats = calculateTaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(2);
			expect(stats.cancelled).toBe(2);
			expect(stats.completedCount).toBe(2); // All cancelled = all complete
			expect(stats.completionPercentage).toBe(100);
		});

		it('should show 0% completion when no tasks are complete', () => {
			// Arrange
			const tasks: Task[] = [
				createTestTask({ id: '1', status: 'pending' }),
				createTestTask({ id: '2', status: 'in-progress' })
			];

			// Act
			const stats = calculateTaskStatistics(tasks);

			// Assert
			expect(stats.completionPercentage).toBe(0);
		});
	});

	describe('calculateSubtaskStatistics', () => {
		it('should treat cancelled subtasks as complete in percentage calculation', () => {
			// Arrange: Task with 3 done subtasks and 1 cancelled = 100%
			const tasks: Task[] = [
				createTestTask({
					id: '1',
					status: 'in-progress',
					subtasks: [
						createTestSubtask('1', '1', 'done'),
						createTestSubtask('2', '1', 'done'),
						createTestSubtask('3', '1', 'done'),
						createTestSubtask('4', '1', 'cancelled')
					]
				})
			];

			// Act
			const stats = calculateSubtaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(4);
			expect(stats.done).toBe(3);
			expect(stats.cancelled).toBe(1);
			expect(stats.completedCount).toBe(4); // done + cancelled
			expect(stats.completionPercentage).toBe(100);
		});

		it('should handle completed status in subtasks', () => {
			// Arrange
			const tasks: Task[] = [
				createTestTask({
					id: '1',
					status: 'in-progress',
					subtasks: [
						createTestSubtask('1', '1', 'done'),
						createTestSubtask('2', '1', 'completed'),
						createTestSubtask('3', '1', 'pending')
					]
				})
			];

			// Act
			const stats = calculateSubtaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(3);
			expect(stats.completedCount).toBe(2); // done + completed
			// 2 complete (done + completed) out of 3 = 67%
			expect(stats.completionPercentage).toBe(67);
		});
	});

	describe('calculateDependencyStatistics', () => {
		it('should treat cancelled tasks as satisfied dependencies', () => {
			// Arrange: Task 15 depends on cancelled task 14
			const tasks: Task[] = [
				...Array.from({ length: 13 }, (_, i) =>
					createTestTask({ id: String(i + 1), status: 'done' })
				),
				createTestTask({ id: '14', status: 'cancelled' }),
				createTestTask({ id: '15', status: 'pending', dependencies: ['14'] })
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert: Task 15 should be ready since its dependency (14) is cancelled
			expect(stats.tasksBlockedByDeps).toBe(0);
			expect(stats.tasksReadyToWork).toBe(1);
		});

		it('should treat completed status as satisfied dependencies', () => {
			// Arrange
			const tasks: Task[] = [
				createTestTask({ id: '1', status: 'completed' }),
				createTestTask({ id: '2', status: 'pending', dependencies: ['1'] })
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert
			expect(stats.tasksBlockedByDeps).toBe(0);
			expect(stats.tasksReadyToWork).toBe(1);
		});

		it('should count tasks with cancelled dependencies as ready', () => {
			// Arrange: Multiple tasks depending on cancelled task
			const tasks: Task[] = [
				createTestTask({ id: '1', status: 'cancelled' }),
				createTestTask({ id: '2', status: 'pending', dependencies: ['1'] }),
				createTestTask({ id: '3', status: 'pending', dependencies: ['1'] })
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert
			expect(stats.tasksBlockedByDeps).toBe(0);
			expect(stats.tasksReadyToWork).toBe(2); // Both dependents should be ready
		});

		it('should block tasks when only some dependencies are complete', () => {
			// Arrange: Task 3 depends on task 1 (cancelled) and task 2 (pending)
			const tasks: Task[] = [
				createTestTask({ id: '1', status: 'cancelled' }),
				createTestTask({ id: '2', status: 'pending' }),
				createTestTask({ id: '3', status: 'pending', dependencies: ['1', '2'] })
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert: Task 3 blocked by pending task 2, only task 2 is ready
			expect(stats.tasksBlockedByDeps).toBe(1);
			expect(stats.tasksReadyToWork).toBe(1);
		});
	});
});
