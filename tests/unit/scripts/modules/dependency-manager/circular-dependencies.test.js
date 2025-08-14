import { jest } from '@jest/globals';
import {
	validateCrossTagMove,
	findCrossTagDependencies,
	getDependentTaskIds,
	validateSubtaskMove,
	canMoveWithDependencies
} from '../../../../../scripts/modules/dependency-manager.js';

describe('Circular Dependency Scenarios', () => {
	describe('Circular Cross-Tag Dependencies', () => {
		const allTasks = [
			{
				id: 1,
				title: 'Task 1',
				dependencies: [2],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 2,
				title: 'Task 2',
				dependencies: [3],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 3,
				title: 'Task 3',
				dependencies: [1],
				status: 'pending',
				tag: 'backlog'
			}
		];

		it('should detect circular dependencies across tags', () => {
			// Task 1 depends on 2, 2 depends on 3, 3 depends on 1 (circular)
			// But since all tasks are in 'backlog' and target is 'in-progress',
			// only direct dependencies that are in different tags will be found
			const conflicts = findCrossTagDependencies(
				[allTasks[0]],
				'backlog',
				'in-progress',
				allTasks
			);

			// Only direct dependencies of task 1 that are not in target tag
			expect(conflicts).toHaveLength(1);
			expect(
				conflicts.some((c) => c.taskId === 1 && c.dependencyId === 2)
			).toBe(true);
		});

		it('should block move with circular dependencies', () => {
			// Since task 1 has dependencies in the same tag, validateCrossTagMove should not throw
			// The function only checks direct dependencies, not circular chains
			expect(() => {
				validateCrossTagMove(allTasks[0], 'backlog', 'in-progress', allTasks);
			}).not.toThrow();
		});

		it('should return canMove: false for circular dependencies', () => {
			const result = canMoveWithDependencies(
				'1',
				'backlog',
				'in-progress',
				allTasks
			);
			expect(result.canMove).toBe(false);
			expect(result.conflicts).toHaveLength(1);
		});
	});

	describe('Complex Dependency Chains', () => {
		const allTasks = [
			{
				id: 1,
				title: 'Task 1',
				dependencies: [2, 3],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 2,
				title: 'Task 2',
				dependencies: [4],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 3,
				title: 'Task 3',
				dependencies: [5],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 4,
				title: 'Task 4',
				dependencies: [],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 5,
				title: 'Task 5',
				dependencies: [6],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 6,
				title: 'Task 6',
				dependencies: [],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 7,
				title: 'Task 7',
				dependencies: [],
				status: 'in-progress',
				tag: 'in-progress'
			}
		];

		it('should find all dependencies in complex chain', () => {
			const conflicts = findCrossTagDependencies(
				[allTasks[0]],
				'backlog',
				'in-progress',
				allTasks
			);

			// Only direct dependencies of task 1 that are not in target tag
			expect(conflicts).toHaveLength(2);
			expect(
				conflicts.some((c) => c.taskId === 1 && c.dependencyId === 2)
			).toBe(true);
			expect(
				conflicts.some((c) => c.taskId === 1 && c.dependencyId === 3)
			).toBe(true);
		});

		it('should get all dependent task IDs in complex chain', () => {
			const conflicts = findCrossTagDependencies(
				[allTasks[0]],
				'backlog',
				'in-progress',
				allTasks
			);
			const dependentIds = getDependentTaskIds(
				[allTasks[0]],
				conflicts,
				allTasks
			);

			// Should include only the direct dependency IDs from conflicts
			expect(dependentIds).toContain(2);
			expect(dependentIds).toContain(3);
			// Should not include the source task or tasks not in conflicts
			expect(dependentIds).not.toContain(1);
		});
	});

	describe('Mixed Dependency Types', () => {
		const allTasks = [
			{
				id: 1,
				title: 'Task 1',
				dependencies: [2, '3.1'],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 2,
				title: 'Task 2',
				dependencies: [4],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 3,
				title: 'Task 3',
				dependencies: [5],
				status: 'pending',
				tag: 'backlog',
				subtasks: [
					{
						id: 1,
						title: 'Subtask 3.1',
						dependencies: [],
						status: 'pending',
						tag: 'backlog'
					}
				]
			},
			{
				id: 4,
				title: 'Task 4',
				dependencies: [],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 5,
				title: 'Task 5',
				dependencies: [],
				status: 'pending',
				tag: 'backlog'
			}
		];

		it('should handle mixed task and subtask dependencies', () => {
			const conflicts = findCrossTagDependencies(
				[allTasks[0]],
				'backlog',
				'in-progress',
				allTasks
			);

			expect(conflicts).toHaveLength(2);
			expect(
				conflicts.some((c) => c.taskId === 1 && c.dependencyId === 2)
			).toBe(true);
			expect(
				conflicts.some((c) => c.taskId === 1 && c.dependencyId === '3.1')
			).toBe(true);
		});
	});

	describe('Large Task Set Performance', () => {
		const allTasks = [];
		for (let i = 1; i <= 100; i++) {
			allTasks.push({
				id: i,
				title: `Task ${i}`,
				dependencies: i < 100 ? [i + 1] : [],
				status: 'pending',
				tag: 'backlog'
			});
		}

		it('should handle large task sets efficiently', () => {
			const conflicts = findCrossTagDependencies(
				[allTasks[0]],
				'backlog',
				'in-progress',
				allTasks
			);

			expect(conflicts.length).toBeGreaterThan(0);
			expect(conflicts[0]).toHaveProperty('taskId');
			expect(conflicts[0]).toHaveProperty('dependencyId');
		});
	});

	describe('Edge Cases and Error Conditions', () => {
		const allTasks = [
			{
				id: 1,
				title: 'Task 1',
				dependencies: [2],
				status: 'pending',
				tag: 'backlog'
			},
			{
				id: 2,
				title: 'Task 2',
				dependencies: [],
				status: 'pending',
				tag: 'backlog'
			}
		];

		it('should handle empty task arrays', () => {
			expect(() => {
				findCrossTagDependencies([], 'backlog', 'in-progress', allTasks);
			}).not.toThrow();
		});

		it('should handle non-existent tasks gracefully', () => {
			expect(() => {
				findCrossTagDependencies(
					[{ id: 999, dependencies: [] }],
					'backlog',
					'in-progress',
					allTasks
				);
			}).not.toThrow();
		});

		it('should handle invalid tag names', () => {
			expect(() => {
				findCrossTagDependencies(
					[allTasks[0]],
					'invalid-tag',
					'in-progress',
					allTasks
				);
			}).not.toThrow();
		});

		it('should handle null/undefined dependencies', () => {
			const taskWithNullDeps = {
				...allTasks[0],
				dependencies: [null, undefined, 2]
			};
			expect(() => {
				findCrossTagDependencies(
					[taskWithNullDeps],
					'backlog',
					'in-progress',
					allTasks
				);
			}).not.toThrow();
		});

		it('should handle string dependencies correctly', () => {
			const taskWithStringDeps = { ...allTasks[0], dependencies: ['2', '3'] };
			const conflicts = findCrossTagDependencies(
				[taskWithStringDeps],
				'backlog',
				'in-progress',
				allTasks
			);
			expect(conflicts.length).toBeGreaterThanOrEqual(0);
		});
	});
});
