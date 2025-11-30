/**
 * @fileoverview Test fixtures for creating valid task data structures
 *
 * WHY FIXTURES:
 * - Ensures all required fields are present (prevents validation errors)
 * - Provides consistent, realistic test data
 * - Easy to override specific fields for test scenarios
 * - Single source of truth for valid task structures
 *
 * USAGE:
 * ```ts
 * import { createTask, createTasksFile } from '@tm/core/testing';
 *
 * // Create a single task with defaults
 * const task = createTask({ id: 1, title: 'My Task', status: 'pending' });
 *
 * // Create a complete tasks.json structure
 * const tasksFile = createTasksFile({
 *   tasks: [
 *     createTask({ id: 1, title: 'Task 1' }),
 *     createTask({ id: 2, title: 'Task 2', dependencies: ['1'] })
 *   ]
 * });
 * ```
 */

import type { Subtask, Task, TaskMetadata } from '../common/types/index.js';

/**
 * File structure for tasks.json
 * Note: Uses the 'master' tag as the default tag name
 */
export interface TasksFile {
	master: {
		tasks: Task[];
		metadata: TaskMetadata;
	};
}

/**
 * Creates a valid task with all required fields
 *
 * DEFAULTS:
 * - id: Converted to string if number is provided
 * - status: 'pending'
 * - priority: 'medium'
 * - dependencies: []
 * - subtasks: []
 * - description: Same as title
 * - details: Empty string
 * - testStrategy: Empty string
 */
export function createTask(
	overrides: Partial<Omit<Task, 'id'>> & { id: number | string; title: string }
): Task {
	return {
		id: String(overrides.id),
		title: overrides.title,
		description: overrides.description ?? overrides.title,
		status: overrides.status ?? 'pending',
		priority: overrides.priority ?? 'medium',
		dependencies: overrides.dependencies ?? [],
		details: overrides.details ?? '',
		testStrategy: overrides.testStrategy ?? '',
		subtasks: overrides.subtasks ?? [],
		// Spread any additional optional fields
		...(overrides.createdAt && { createdAt: overrides.createdAt }),
		...(overrides.updatedAt && { updatedAt: overrides.updatedAt }),
		...(overrides.effort && { effort: overrides.effort }),
		...(overrides.actualEffort && { actualEffort: overrides.actualEffort }),
		...(overrides.tags && { tags: overrides.tags }),
		...(overrides.assignee && { assignee: overrides.assignee }),
		...(overrides.databaseId && { databaseId: overrides.databaseId }),
		...(overrides.complexity && { complexity: overrides.complexity }),
		...(overrides.recommendedSubtasks && {
			recommendedSubtasks: overrides.recommendedSubtasks
		}),
		...(overrides.expansionPrompt && {
			expansionPrompt: overrides.expansionPrompt
		}),
		...(overrides.complexityReasoning && {
			complexityReasoning: overrides.complexityReasoning
		})
	};
}

/**
 * Creates a valid subtask with all required fields
 *
 * DEFAULTS:
 * - id: Can be number or string
 * - status: 'pending'
 * - priority: 'medium'
 * - dependencies: []
 * - description: Same as title
 * - details: Empty string
 * - testStrategy: Empty string
 * - parentId: Derived from id if not provided (e.g., '1.2' -> parentId '1')
 */
export function createSubtask(
	overrides: Partial<Omit<Subtask, 'id' | 'parentId'>> & {
		id: number | string;
		title: string;
		parentId?: string;
	}
): Subtask {
	const idStr = String(overrides.id);
	const defaultParentId = idStr.includes('.') ? idStr.split('.')[0] : '1';

	return {
		id: overrides.id,
		parentId: overrides.parentId ?? defaultParentId,
		title: overrides.title,
		description: overrides.description ?? overrides.title,
		status: overrides.status ?? 'pending',
		priority: overrides.priority ?? 'medium',
		dependencies: overrides.dependencies ?? [],
		details: overrides.details ?? '',
		testStrategy: overrides.testStrategy ?? '',
		// Spread any additional optional fields
		...(overrides.createdAt && { createdAt: overrides.createdAt }),
		...(overrides.updatedAt && { updatedAt: overrides.updatedAt }),
		...(overrides.effort && { effort: overrides.effort }),
		...(overrides.actualEffort && { actualEffort: overrides.actualEffort }),
		...(overrides.tags && { tags: overrides.tags }),
		...(overrides.assignee && { assignee: overrides.assignee }),
		...(overrides.databaseId && { databaseId: overrides.databaseId }),
		...(overrides.complexity && { complexity: overrides.complexity }),
		...(overrides.recommendedSubtasks && {
			recommendedSubtasks: overrides.recommendedSubtasks
		}),
		...(overrides.expansionPrompt && {
			expansionPrompt: overrides.expansionPrompt
		}),
		...(overrides.complexityReasoning && {
			complexityReasoning: overrides.complexityReasoning
		})
	};
}

/**
 * Creates a complete tasks.json file structure
 *
 * DEFAULTS:
 * - Empty tasks array
 * - version: '1.0.0'
 * - lastModified: Current timestamp
 * - taskCount: Calculated from tasks array
 * - completedCount: Calculated from tasks array
 * - description: 'Test tasks'
 */
export function createTasksFile(overrides?: {
	tasks?: Task[];
	metadata?: Partial<TaskMetadata>;
}): TasksFile {
	const tasks = overrides?.tasks ?? [];
	const completedTasks = tasks.filter(
		(t) =>
			t.status === 'done' ||
			t.status === 'completed' ||
			t.status === 'cancelled'
	);

	const defaultMetadata: TaskMetadata = {
		version: '1.0.0',
		lastModified: new Date().toISOString(),
		taskCount: tasks.length,
		completedCount: completedTasks.length,
		description: 'Test tasks',
		...overrides?.metadata
	};

	return {
		master: {
			tasks,
			metadata: defaultMetadata
		}
	};
}

/**
 * Pre-built task scenarios for common test cases
 */
export const TaskScenarios = {
	/**
	 * Single pending task with no dependencies
	 */
	simplePendingTask: () =>
		createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Simple Task',
					description: 'A basic pending task'
				})
			]
		}),

	/**
	 * Linear dependency chain: 1 -> 2 -> 3
	 */
	linearDependencyChain: () =>
		createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Step 1', status: 'done' }),
				createTask({
					id: 2,
					title: 'Step 2',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Step 3',
					status: 'pending',
					dependencies: ['2']
				})
			]
		}),

	/**
	 * Tasks with mixed statuses
	 */
	mixedStatuses: () =>
		createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done Task', status: 'done' }),
				createTask({ id: 2, title: 'In Progress Task', status: 'in-progress' }),
				createTask({ id: 3, title: 'Pending Task', status: 'pending' }),
				createTask({ id: 4, title: 'Review Task', status: 'review' })
			]
		}),

	/**
	 * Task with subtasks
	 */
	taskWithSubtasks: () =>
		createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Parent Task',
					status: 'in-progress',
					subtasks: [
						createSubtask({ id: '1.1', title: 'Subtask 1', status: 'done' }),
						createSubtask({
							id: '1.2',
							title: 'Subtask 2',
							status: 'in-progress',
							dependencies: ['1.1']
						}),
						createSubtask({
							id: '1.3',
							title: 'Subtask 3',
							status: 'pending',
							dependencies: ['1.2']
						})
					]
				})
			]
		}),

	/**
	 * Complex dependency graph with multiple paths
	 */
	complexDependencies: () =>
		createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Foundation', status: 'done' }),
				createTask({
					id: 2,
					title: 'Build A',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Build B',
					status: 'done',
					dependencies: ['1']
				}),
				createTask({
					id: 4,
					title: 'Integration',
					status: 'pending',
					dependencies: ['2', '3']
				})
			]
		}),

	/**
	 * All tasks completed (for testing "no next task" scenario)
	 */
	allCompleted: () =>
		createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done 1', status: 'done' }),
				createTask({ id: 2, title: 'Done 2', status: 'done' }),
				createTask({ id: 3, title: 'Done 3', status: 'done' })
			]
		}),

	/**
	 * Empty task list
	 */
	empty: () => createTasksFile({ tasks: [] })
};
