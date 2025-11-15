/**
 * @fileoverview Tests for dashboard component calculations
 * Bug fix: Cancelled tasks should be treated as complete
 */

import type { Task } from '@tm/core';
import { describe, expect, it } from 'vitest';
import {
	type TaskStatistics,
	calculateDependencyStatistics,
	calculateSubtaskStatistics,
	calculateTaskStatistics
} from '../../../src/ui/components/dashboard.component.js';

describe('dashboard.component - Bug Fix: Cancelled Tasks as Complete', () => {
	describe('calculateTaskStatistics', () => {
		it('should treat cancelled tasks as complete in percentage calculation', () => {
			// Arrange: 14 done, 1 cancelled = 100% complete
			const tasks: Task[] = [
				...Array.from({ length: 14 }, (_, i) => ({
					id: i + 1,
					title: `Task ${i + 1}`,
					status: 'done' as const,
					dependencies: []
				})),
				{
					id: 15,
					title: 'Cancelled Task',
					status: 'cancelled' as const,
					dependencies: []
				}
			];

			// Act
			const stats = calculateTaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(15);
			expect(stats.done).toBe(14);
			expect(stats.cancelled).toBe(1);
			expect(stats.completedCount).toBe(15); // done + cancelled
			// BUG: Current code shows 93% (14/15), should be 100% (15/15)
			expect(stats.completionPercentage).toBe(100);
		});

		it('should treat completed status as complete in percentage calculation', () => {
			// Arrange: Mix of done, completed, cancelled
			const tasks: Task[] = [
				{
					id: 1,
					title: 'Done Task',
					status: 'done' as const,
					dependencies: []
				},
				{
					id: 2,
					title: 'Completed Task',
					status: 'completed' as const,
					dependencies: []
				},
				{
					id: 3,
					title: 'Cancelled Task',
					status: 'cancelled' as const,
					dependencies: []
				},
				{
					id: 4,
					title: 'Pending Task',
					status: 'pending' as const,
					dependencies: []
				}
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
				{
					id: 1,
					title: 'Cancelled 1',
					status: 'cancelled' as const,
					dependencies: []
				},
				{
					id: 2,
					title: 'Cancelled 2',
					status: 'cancelled' as const,
					dependencies: []
				}
			];

			// Act
			const stats = calculateTaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(2);
			expect(stats.cancelled).toBe(2);
			expect(stats.completedCount).toBe(2); // All cancelled = all complete
			// BUG: Current code shows 0%, should be 100%
			expect(stats.completionPercentage).toBe(100);
		});

		it('should show 0% completion when no tasks are complete', () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: 1,
					title: 'Pending Task',
					status: 'pending' as const,
					dependencies: []
				},
				{
					id: 2,
					title: 'In Progress Task',
					status: 'in-progress' as const,
					dependencies: []
				}
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
				{
					id: 1,
					title: 'Parent Task',
					status: 'in-progress' as const,
					dependencies: [],
					subtasks: [
						{ id: '1', title: 'Sub 1', status: 'done' },
						{ id: '2', title: 'Sub 2', status: 'done' },
						{ id: '3', title: 'Sub 3', status: 'done' },
						{ id: '4', title: 'Sub 4', status: 'cancelled' }
					]
				}
			];

			// Act
			const stats = calculateSubtaskStatistics(tasks);

			// Assert
			expect(stats.total).toBe(4);
			expect(stats.done).toBe(3);
			expect(stats.cancelled).toBe(1);
			expect(stats.completedCount).toBe(4); // done + cancelled
			// BUG: Current code shows 75% (3/4), should be 100% (4/4)
			expect(stats.completionPercentage).toBe(100);
		});

		it('should handle completed status in subtasks', () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: 1,
					title: 'Parent Task',
					status: 'in-progress' as const,
					dependencies: [],
					subtasks: [
						{ id: '1', title: 'Sub 1', status: 'done' },
						{ id: '2', title: 'Sub 2', status: 'completed' },
						{ id: '3', title: 'Sub 3', status: 'pending' }
					]
				}
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
				...Array.from({ length: 13 }, (_, i) => ({
					id: i + 1,
					title: `Task ${i + 1}`,
					status: 'done' as const,
					dependencies: []
				})),
				{
					id: 14,
					title: 'Cancelled Dependency',
					status: 'cancelled' as const,
					dependencies: []
				},
				{
					id: 15,
					title: 'Dependent Task',
					status: 'pending' as const,
					dependencies: [14]
				}
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert
			// Task 15 should be ready to work on since its dependency (14) is cancelled
			// BUG: Current code shows task 15 as blocked, should show as ready
			expect(stats.tasksBlockedByDeps).toBe(0);
			expect(stats.tasksReadyToWork).toBeGreaterThan(0);
		});

		it('should treat completed status as satisfied dependencies', () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: 1,
					title: 'Completed Dependency',
					status: 'completed' as const,
					dependencies: []
				},
				{
					id: 2,
					title: 'Dependent Task',
					status: 'pending' as const,
					dependencies: [1]
				}
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert
			expect(stats.tasksBlockedByDeps).toBe(0);
			expect(stats.tasksReadyToWork).toBe(1);
		});

		it('should count tasks with cancelled dependencies as ready', () => {
			// Arrange: Multiple tasks depending on cancelled tasks
			const tasks: Task[] = [
				{
					id: 1,
					title: 'Cancelled Task',
					status: 'cancelled' as const,
					dependencies: []
				},
				{
					id: 2,
					title: 'Dependent 1',
					status: 'pending' as const,
					dependencies: [1]
				},
				{
					id: 3,
					title: 'Dependent 2',
					status: 'pending' as const,
					dependencies: [1]
				}
			];

			// Act
			const stats = calculateDependencyStatistics(tasks);

			// Assert
			expect(stats.tasksBlockedByDeps).toBe(0);
			expect(stats.tasksReadyToWork).toBe(2); // Both dependents should be ready
		});
	});
});
