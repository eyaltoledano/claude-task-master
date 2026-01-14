/**
 * @fileoverview Task filtering utilities for dependency and readiness analysis
 * Business logic for filtering tasks by actionable status, dependencies, and blocking relationships
 */

import type { Task, TaskStatus } from '../../../common/types/index.js';
import {
	TASK_STATUSES,
	isTaskComplete
} from '../../../common/constants/index.js';
import { getLogger } from '../../../common/logger/index.js';

const logger = getLogger('TaskFilters');

/**
 * Task with blocks field (inverse of dependencies)
 * A task's blocks array contains IDs of tasks that depend on it
 */
export type TaskWithBlocks = Task & { blocks: string[] };

/**
 * Statuses that are actionable (not deferred, blocked, or terminal)
 * Tasks with these statuses can be worked on when dependencies are satisfied
 */
export const ACTIONABLE_STATUSES: readonly TaskStatus[] = [
	'pending',
	'in-progress',
	'review'
] as const;

/**
 * Invalid dependency reference (task depends on non-existent task)
 */
export interface InvalidDependency {
	/** ID of the task with the invalid dependency */
	taskId: string;
	/** ID of the non-existent dependency */
	depId: string;
}

/**
 * Result of building the blocks map with validation information
 */
export interface BuildBlocksMapResult {
	/** Map of task ID -> array of task IDs that depend on it */
	blocksMap: Map<string, string[]>;
	/** Array of invalid dependency references (dependencies to non-existent tasks) */
	invalidDependencies: InvalidDependency[];
}

/**
 * Build a map of task ID -> array of task IDs that depend on it (blocks)
 * This is the inverse of the dependencies relationship
 *
 * Also validates dependencies and returns any references to non-existent tasks.
 *
 * @param tasks - Array of tasks to analyze
 * @returns Object containing the blocks map and any invalid dependency references
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { id: '1', dependencies: [] },
 *   { id: '2', dependencies: ['1'] },
 *   { id: '3', dependencies: ['1', '2'] }
 * ];
 * const { blocksMap, invalidDependencies } = buildBlocksMap(tasks);
 * // blocksMap.get('1') => ['2', '3']  // Task 1 blocks tasks 2 and 3
 * // blocksMap.get('2') => ['3']       // Task 2 blocks task 3
 * // blocksMap.get('3') => []          // Task 3 blocks nothing
 * // invalidDependencies => []         // No invalid deps in this example
 * ```
 */
export function buildBlocksMap(tasks: Task[]): BuildBlocksMapResult {
	const blocksMap = new Map<string, string[]>(
		tasks.map((task) => [String(task.id), []])
	);
	const invalidDependencies: InvalidDependency[] = [];

	// For each task, add it to the blocks list of each of its dependencies
	for (const task of tasks) {
		for (const depId of task.dependencies ?? []) {
			const depIdStr = String(depId);
			const blocks = blocksMap.get(depIdStr);
			if (blocks) {
				blocks.push(String(task.id));
			} else {
				// Dependency references a non-existent task
				invalidDependencies.push({
					taskId: String(task.id),
					depId: depIdStr
				});
			}
		}
	}

	return { blocksMap, invalidDependencies };
}

/**
 * Filter to only tasks that are ready to work on
 * A task is ready when:
 * 1. It has an actionable status (pending, in-progress, or review)
 * 2. All its dependencies are complete (done, completed, or cancelled)
 *
 * @param tasks - Array of tasks with blocks information
 * @returns Filtered array of tasks that are ready to work on
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { id: '1', status: 'done', dependencies: [], blocks: ['2'] },
 *   { id: '2', status: 'pending', dependencies: ['1'], blocks: [] },
 *   { id: '3', status: 'pending', dependencies: ['2'], blocks: [] }
 * ];
 * const readyTasks = filterReadyTasks(tasks);
 * // Returns only task 2: status is actionable and dependency '1' is done
 * // Task 3 is not ready because dependency '2' is still pending
 * ```
 */
export function filterReadyTasks(tasks: TaskWithBlocks[]): TaskWithBlocks[] {
	// Build set of completed task IDs for dependency checking
	const completedIds = new Set<string>(
		tasks.filter((t) => isTaskComplete(t.status)).map((t) => String(t.id))
	);

	return tasks.filter((task) => {
		// Validate status is a known value
		if (!TASK_STATUSES.includes(task.status)) {
			logger.warn(
				`Task ${task.id} has unexpected status "${task.status}". Valid statuses are: ${TASK_STATUSES.join(', ')}`
			);
		}

		// Must be in an actionable status (excludes deferred, blocked, done, cancelled)
		if (!ACTIONABLE_STATUSES.includes(task.status)) {
			return false;
		}

		// Ready if no dependencies or all dependencies are completed
		const deps = task.dependencies ?? [];
		return deps.every((depId) => completedIds.has(String(depId)));
	});
}

/**
 * Filter to only tasks that block other tasks
 * These are tasks that have at least one other task depending on them
 *
 * @param tasks - Array of tasks with blocks information
 * @returns Filtered array of tasks that have dependents (block other tasks)
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { id: '1', blocks: ['2', '3'] },  // Blocks tasks 2 and 3
 *   { id: '2', blocks: [] },          // Blocks nothing
 *   { id: '3', blocks: [] }           // Blocks nothing
 * ];
 * const blockingTasks = filterBlockingTasks(tasks);
 * // Returns only task 1 (the only task with non-empty blocks)
 * ```
 */
export function filterBlockingTasks(
	tasks: TaskWithBlocks[]
): TaskWithBlocks[] {
	return tasks.filter((task) => task.blocks.length > 0);
}
