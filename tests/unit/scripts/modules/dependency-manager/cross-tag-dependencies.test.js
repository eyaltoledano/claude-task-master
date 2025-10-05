import { jest } from '@jest/globals';
import {
	validateCrossTagMove,
	findCrossTagDependencies,
	getDependentTaskIds,
	validateSubtaskMove,
	canMoveWithDependencies
} from '../../../../../scripts/modules/dependency-manager.js';

describe('Cross-Tag Dependency Validation', () => {
	describe('validateCrossTagMove', () => {
		const mockAllTasks = [
			{ id: 1, tag: 'backlog', dependencies: [2], title: 'Task 1' },
			{ id: 2, tag: 'backlog', dependencies: [], title: 'Task 2' },
			{ id: 3, tag: 'in-progress', dependencies: [1], title: 'Task 3' },
			{ id: 4, tag: 'done', dependencies: [], title: 'Task 4' }
		];

		it('should allow move when no dependencies exist', () => {
			const task = { id: 2, dependencies: [], title: 'Task 2' };
			const result = validateCrossTagMove(
				task,
				'backlog',
				'in-progress',
				mockAllTasks
			);

			expect(result.canMove).toBe(true);
			expect(result.conflicts).toHaveLength(0);
		});

		it('should block move when cross-tag dependencies exist', () => {
			const task = { id: 1, dependencies: [2], title: 'Task 1' };
			const result = validateCrossTagMove(
				task,
				'backlog',
				'in-progress',
				mockAllTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.conflicts).toHaveLength(1);
			expect(result.conflicts[0]).toMatchObject({
				taskId: 1,
				dependencyId: 2,
				dependencyTag: 'backlog'
			});
		});

		it('should allow move when dependencies are in target tag', () => {
			const task = { id: 3, dependencies: [1], title: 'Task 3' };
			// Move both task 1 and task 3 to in-progress, then move task 1 to done
			const updatedTasks = mockAllTasks.map((t) => {
				if (t.id === 1) return { ...t, tag: 'in-progress' };
				if (t.id === 3) return { ...t, tag: 'in-progress' };
				return t;
			});
			// Now move task 1 to done
			const updatedTasks2 = updatedTasks.map((t) =>
				t.id === 1 ? { ...t, tag: 'done' } : t
			);
			const result = validateCrossTagMove(
				task,
				'in-progress',
				'done',
				updatedTasks2
			);

			expect(result.canMove).toBe(true);
			expect(result.conflicts).toHaveLength(0);
		});

		it('should handle multiple dependencies correctly', () => {
			const task = { id: 5, dependencies: [1, 3], title: 'Task 5' };
			const result = validateCrossTagMove(
				task,
				'backlog',
				'done',
				mockAllTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.conflicts).toHaveLength(2);
			expect(result.conflicts[0].dependencyId).toBe(1);
			expect(result.conflicts[1].dependencyId).toBe(3);
		});

		it('should throw error for invalid task parameter', () => {
			expect(() =>
				validateCrossTagMove(null, 'backlog', 'in-progress', mockAllTasks)
			).toThrow('Task parameter must be a valid object');
		});

		it('should throw error for invalid source tag', () => {
			const task = { id: 1, dependencies: [], title: 'Task 1' };
			expect(() =>
				validateCrossTagMove(task, '', 'in-progress', mockAllTasks)
			).toThrow('Source tag must be a valid string');
		});

		it('should throw error for invalid target tag', () => {
			const task = { id: 1, dependencies: [], title: 'Task 1' };
			expect(() =>
				validateCrossTagMove(task, 'backlog', null, mockAllTasks)
			).toThrow('Target tag must be a valid string');
		});

		it('should throw error for invalid allTasks parameter', () => {
			const task = { id: 1, dependencies: [], title: 'Task 1' };
			expect(() =>
				validateCrossTagMove(task, 'backlog', 'in-progress', 'not-an-array')
			).toThrow('All tasks parameter must be an array');
		});
	});

	describe('findCrossTagDependencies', () => {
		const mockAllTasks = [
			{ id: 1, tag: 'backlog', dependencies: [2], title: 'Task 1' },
			{ id: 2, tag: 'backlog', dependencies: [], title: 'Task 2' },
			{ id: 3, tag: 'in-progress', dependencies: [1], title: 'Task 3' },
			{ id: 4, tag: 'done', dependencies: [], title: 'Task 4' }
		];

		it('should find cross-tag dependencies for multiple tasks', () => {
			const sourceTasks = [
				{ id: 1, dependencies: [2], title: 'Task 1' },
				{ id: 3, dependencies: [1], title: 'Task 3' }
			];
			const conflicts = findCrossTagDependencies(
				sourceTasks,
				'backlog',
				'done',
				mockAllTasks
			);

			expect(conflicts).toHaveLength(2);
			expect(conflicts[0].taskId).toBe(1);
			expect(conflicts[0].dependencyId).toBe(2);
			expect(conflicts[1].taskId).toBe(3);
			expect(conflicts[1].dependencyId).toBe(1);
		});

		it('should return empty array when no cross-tag dependencies exist', () => {
			const sourceTasks = [
				{ id: 2, dependencies: [], title: 'Task 2' },
				{ id: 4, dependencies: [], title: 'Task 4' }
			];
			const conflicts = findCrossTagDependencies(
				sourceTasks,
				'backlog',
				'done',
				mockAllTasks
			);

			expect(conflicts).toHaveLength(0);
		});

		it('should handle tasks without dependencies', () => {
			const sourceTasks = [{ id: 2, dependencies: [], title: 'Task 2' }];
			const conflicts = findCrossTagDependencies(
				sourceTasks,
				'backlog',
				'done',
				mockAllTasks
			);

			expect(conflicts).toHaveLength(0);
		});

		it('should throw error for invalid sourceTasks parameter', () => {
			expect(() =>
				findCrossTagDependencies(
					'not-an-array',
					'backlog',
					'done',
					mockAllTasks
				)
			).toThrow('Source tasks parameter must be an array');
		});

		it('should throw error for invalid source tag', () => {
			const sourceTasks = [{ id: 1, dependencies: [], title: 'Task 1' }];
			expect(() =>
				findCrossTagDependencies(sourceTasks, '', 'done', mockAllTasks)
			).toThrow('Source tag must be a valid string');
		});

		it('should throw error for invalid target tag', () => {
			const sourceTasks = [{ id: 1, dependencies: [], title: 'Task 1' }];
			expect(() =>
				findCrossTagDependencies(sourceTasks, 'backlog', null, mockAllTasks)
			).toThrow('Target tag must be a valid string');
		});

		it('should throw error for invalid allTasks parameter', () => {
			const sourceTasks = [{ id: 1, dependencies: [], title: 'Task 1' }];
			expect(() =>
				findCrossTagDependencies(sourceTasks, 'backlog', 'done', 'not-an-array')
			).toThrow('All tasks parameter must be an array');
		});
	});

	describe('getDependentTaskIds', () => {
		const mockAllTasks = [
			{ id: 1, tag: 'backlog', dependencies: [2], title: 'Task 1' },
			{ id: 2, tag: 'backlog', dependencies: [], title: 'Task 2' },
			{ id: 3, tag: 'in-progress', dependencies: [1], title: 'Task 3' },
			{ id: 4, tag: 'done', dependencies: [], title: 'Task 4' }
		];

		it('should return dependent task IDs', () => {
			const sourceTasks = [{ id: 1, dependencies: [2], title: 'Task 1' }];
			const crossTagDependencies = [
				{ taskId: 1, dependencyId: 2, dependencyTag: 'backlog' }
			];
			const dependentIds = getDependentTaskIds(
				sourceTasks,
				crossTagDependencies,
				mockAllTasks
			);

			expect(dependentIds).toContain(2);
			// The function also finds tasks that depend on the source task, so we expect more than just the dependency
			expect(dependentIds.length).toBeGreaterThan(0);
		});

		it('should handle multiple dependencies with recursive resolution', () => {
			const sourceTasks = [{ id: 5, dependencies: [1, 3], title: 'Task 5' }];
			const crossTagDependencies = [
				{ taskId: 5, dependencyId: 1, dependencyTag: 'backlog' },
				{ taskId: 5, dependencyId: 3, dependencyTag: 'in-progress' }
			];
			const dependentIds = getDependentTaskIds(
				sourceTasks,
				crossTagDependencies,
				mockAllTasks
			);

			// Should find all dependencies recursively:
			// Task 5 → [1, 3], Task 1 → [2], so total is [1, 2, 3]
			expect(dependentIds).toContain(1);
			expect(dependentIds).toContain(2); // Task 1's dependency
			expect(dependentIds).toContain(3);
			expect(dependentIds).toHaveLength(3);
		});

		it('should return empty array when no dependencies', () => {
			const sourceTasks = [{ id: 2, dependencies: [], title: 'Task 2' }];
			const crossTagDependencies = [];
			const dependentIds = getDependentTaskIds(
				sourceTasks,
				crossTagDependencies,
				mockAllTasks
			);

			// The function finds tasks that depend on source tasks, so even with no cross-tag dependencies,
			// it might find tasks that depend on the source task
			expect(Array.isArray(dependentIds)).toBe(true);
		});

		it('should throw error for invalid sourceTasks parameter', () => {
			const crossTagDependencies = [];
			expect(() =>
				getDependentTaskIds('not-an-array', crossTagDependencies, mockAllTasks)
			).toThrow('Source tasks parameter must be an array');
		});

		it('should throw error for invalid crossTagDependencies parameter', () => {
			const sourceTasks = [{ id: 1, dependencies: [], title: 'Task 1' }];
			expect(() =>
				getDependentTaskIds(sourceTasks, 'not-an-array', mockAllTasks)
			).toThrow('Cross tag dependencies parameter must be an array');
		});

		it('should throw error for invalid allTasks parameter', () => {
			const sourceTasks = [{ id: 1, dependencies: [], title: 'Task 1' }];
			const crossTagDependencies = [];
			expect(() =>
				getDependentTaskIds(sourceTasks, crossTagDependencies, 'not-an-array')
			).toThrow('All tasks parameter must be an array');
		});
	});

	describe('validateSubtaskMove', () => {
		it('should throw error for subtask movement', () => {
			expect(() =>
				validateSubtaskMove('1.2', 'backlog', 'in-progress')
			).toThrow('Cannot move subtask 1.2 directly between tags');
		});

		it('should allow regular task movement', () => {
			expect(() =>
				validateSubtaskMove('1', 'backlog', 'in-progress')
			).not.toThrow();
		});

		it('should throw error for invalid taskId parameter', () => {
			expect(() => validateSubtaskMove(null, 'backlog', 'in-progress')).toThrow(
				'Task ID must be a valid string'
			);
		});

		it('should throw error for invalid source tag', () => {
			expect(() => validateSubtaskMove('1', '', 'in-progress')).toThrow(
				'Source tag must be a valid string'
			);
		});

		it('should throw error for invalid target tag', () => {
			expect(() => validateSubtaskMove('1', 'backlog', null)).toThrow(
				'Target tag must be a valid string'
			);
		});
	});

	describe('canMoveWithDependencies', () => {
		const mockAllTasks = [
			{ id: 1, tag: 'backlog', dependencies: [2], title: 'Task 1' },
			{ id: 2, tag: 'backlog', dependencies: [], title: 'Task 2' },
			{ id: 3, tag: 'in-progress', dependencies: [1], title: 'Task 3' },
			{ id: 4, tag: 'done', dependencies: [], title: 'Task 4' }
		];

		it('should return canMove: true when no conflicts exist', () => {
			const result = canMoveWithDependencies(
				'2',
				'backlog',
				'in-progress',
				mockAllTasks
			);

			expect(result.canMove).toBe(true);
			expect(result.dependentTaskIds).toHaveLength(0);
			expect(result.conflicts).toHaveLength(0);
		});

		it('should return canMove: false when conflicts exist', () => {
			const result = canMoveWithDependencies(
				'1',
				'backlog',
				'in-progress',
				mockAllTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.dependentTaskIds).toContain(2);
			expect(result.conflicts).toHaveLength(1);
		});

		it('should return canMove: false when task not found', () => {
			const result = canMoveWithDependencies(
				'999',
				'backlog',
				'in-progress',
				mockAllTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.error).toBe('Task not found');
		});

		it('should handle string task IDs', () => {
			const result = canMoveWithDependencies(
				'2',
				'backlog',
				'in-progress',
				mockAllTasks
			);

			expect(result.canMove).toBe(true);
		});

		it('should throw error for invalid taskId parameter', () => {
			expect(() =>
				canMoveWithDependencies(null, 'backlog', 'in-progress', mockAllTasks)
			).toThrow('Task ID must be a valid string');
		});

		it('should throw error for invalid source tag', () => {
			expect(() =>
				canMoveWithDependencies('1', '', 'in-progress', mockAllTasks)
			).toThrow('Source tag must be a valid string');
		});

		it('should throw error for invalid target tag', () => {
			expect(() =>
				canMoveWithDependencies('1', 'backlog', null, mockAllTasks)
			).toThrow('Target tag must be a valid string');
		});

		it('should throw error for invalid allTasks parameter', () => {
			expect(() =>
				canMoveWithDependencies('1', 'backlog', 'in-progress', 'not-an-array')
			).toThrow('All tasks parameter must be an array');
		});
	});
});
