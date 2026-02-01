/**
 * @fileoverview Task ID normalization utilities for Task Master
 * Provides functions to normalize task IDs, subtask IDs, and dependencies
 * with proper validation to prevent NaN corruption.
 *
 * This consolidates the normalization logic previously duplicated in:
 * - file-storage.ts (normalizeTaskIds)
 * - format-handler.ts (normalizeTasks)
 * - scripts/modules/utils.js (normalizeTaskIds - legacy reference implementation)
 */

import type { Task, Subtask } from '../types/index.js';

/**
 * Safely parses a task ID to a positive integer.
 * Returns null if the ID is invalid (NaN, zero, or negative).
 *
 * @param id - The ID to parse (can be number, string, or unknown)
 * @returns The parsed positive integer, or null if invalid
 * @example
 * ```typescript
 * normalizeTaskId("5");        // 5
 * normalizeTaskId(5);          // 5
 * normalizeTaskId("abc");      // null (NaN)
 * normalizeTaskId(0);          // null (not positive)
 * normalizeTaskId(-1);         // null (negative)
 * normalizeTaskId("5.1");      // 5 (takes first part)
 * ```
 */
export function normalizeTaskId(id: unknown): number | null {
	if (id === undefined || id === null) {
		return null;
	}

	const idStr = String(id);

	// Handle subtask ID format (e.g., "5.1") - extract just the task part
	// This shouldn't normally happen, but provides a safety net
	if (idStr.includes('.')) {
		const parts = idStr.split('.');
		const parsedId = parseInt(parts[0], 10);
		return !isNaN(parsedId) && parsedId > 0 ? parsedId : null;
	}

	const parsedId = parseInt(idStr, 10);
	return !isNaN(parsedId) && parsedId > 0 ? parsedId : null;
}

/**
 * Safely parses a subtask ID to a positive integer.
 * Returns null if the ID is invalid.
 *
 * @param id - The subtask ID to parse
 * @returns The parsed positive integer, or null if invalid
 * @example
 * ```typescript
 * normalizeSubtaskId("1");     // 1
 * normalizeSubtaskId(2);       // 2
 * normalizeSubtaskId("abc");   // null
 * normalizeSubtaskId("5.1");   // 1 (extracts subtask portion)
 * ```
 */
export function normalizeSubtaskId(id: unknown): number | null {
	if (id === undefined || id === null) {
		return null;
	}

	const idStr = String(id);

	// Handle full subtask ID format (e.g., "5.1") - extract just the subtask part
	if (idStr.includes('.')) {
		const parts = idStr.split('.');
		const subtaskPart = parts[parts.length - 1];
		const parsedId = parseInt(subtaskPart, 10);
		return !isNaN(parsedId) && parsedId > 0 ? parsedId : null;
	}

	const parsedId = parseInt(idStr, 10);
	return !isNaN(parsedId) && parsedId > 0 ? parsedId : null;
}

/**
 * Normalizes a dependency value.
 * - If it's a subtask reference (contains "."), keep as string
 * - Otherwise, convert to a positive integer
 * - If parsing fails, return the original value as fallback
 *
 * @param dep - The dependency value to normalize
 * @returns Normalized dependency (number for task refs, string for subtask refs)
 * @example
 * ```typescript
 * normalizeDependency("5");      // 5 (number)
 * normalizeDependency(5);        // 5 (number)
 * normalizeDependency("7.1");    // "7.1" (string - subtask ref)
 * normalizeDependency("1.2.3");  // "1.2.3" (string - subtask ref)
 * normalizeDependency("abc");    // "abc" (string - fallback)
 * ```
 */
export function normalizeDependency(dep: unknown): number | string {
	if (dep === undefined || dep === null) {
		return '';
	}

	const depStr = String(dep);

	// Keep subtask references as strings (e.g., "7.1", "1.2")
	if (depStr.includes('.')) {
		return depStr;
	}

	// Try to convert task references to numbers
	const parsedDep = parseInt(depStr, 10);
	if (!isNaN(parsedDep) && parsedDep > 0) {
		return parsedDep;
	}

	// Fallback: return as string if parsing fails
	return depStr;
}

/**
 * Normalizes an array of dependencies.
 *
 * @param dependencies - Array of dependency values
 * @returns Normalized array of dependencies
 */
export function normalizeDependencies(
	dependencies: unknown[] | undefined | null
): (number | string)[] {
	if (!dependencies || !Array.isArray(dependencies)) {
		return [];
	}

	return dependencies
		.map(normalizeDependency)
		.filter((dep) => dep !== ''); // Remove empty values
}

/**
 * Normalizes a subtask object, ensuring proper ID types.
 *
 * @param subtask - The subtask to normalize
 * @param parentTaskId - The parent task's ID (for setting parentId)
 * @returns Normalized subtask with validated IDs
 */
export function normalizeSubtask(
	subtask: Partial<Subtask>,
	parentTaskId: number | string
): Subtask {
	const normalizedId = normalizeSubtaskId(subtask.id);

	// Determine the subtask ID with proper validation:
	// 1. Use normalized ID if successful (positive integer)
	// 2. Preserve non-empty string IDs (could be API IDs)
	// 3. Only accept positive numbers (reject negative/zero)
	// 4. Fall back to 0 only for truly undefined/null cases
	let subtaskIdValue: number | string;
	if (normalizedId !== null) {
		// Preserve string IDs in storage (even when numeric)
		subtaskIdValue = String(normalizedId);
	} else if (typeof subtask.id === 'string' && subtask.id.length > 0) {
		// Preserve non-empty string IDs
		subtaskIdValue = subtask.id;
	} else if (isValidPositiveInteger(subtask.id)) {
		// Only accept positive, finite integers
		subtaskIdValue = String(subtask.id);
	} else {
		// Fallback for truly undefined/null only
		subtaskIdValue = '0';
	}

	return {
		...subtask,
		id: subtaskIdValue,
		parentId: parentTaskId,
		dependencies: normalizeDependencies(subtask.dependencies)
	} as Subtask;
}

/**
 * Checks if a value is a valid positive, finite integer (not NaN, not ±Infinity, not zero, not negative).
 *
 * @param value - The value to check
 * @returns True if value is a positive, finite integer
 */
function isValidPositiveInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Number.isInteger(value) &&
		value > 0
	);
}

/**
 * Normalizes a single task, ensuring proper ID types for the task,
 * its subtasks, and all dependencies.
 *
 * @param task - The task to normalize
 * @returns Normalized task with validated IDs
 */
export function normalizeTask(task: Partial<Task>): Task {
	const normalizedId = normalizeTaskId(task.id);

	// Determine the task ID with proper validation:
	// 1. Use normalized ID if successful (positive integer)
	// 2. Preserve non-empty string IDs (could be API IDs like "HAM-1")
	// 3. Only accept positive numbers (reject negative/zero)
	// 4. Fall back to 0 only for truly undefined/null cases
	let taskIdValue: number | string;
	if (normalizedId !== null) {
		// Preserve string IDs in storage (even when numeric)
		taskIdValue = String(normalizedId);
	} else if (typeof task.id === 'string' && task.id.length > 0) {
		// Preserve non-empty string IDs (could be API IDs like "HAM-1")
		taskIdValue = task.id;
	} else if (isValidPositiveInteger(task.id)) {
		// Only accept positive, finite integers
		taskIdValue = String(task.id);
	} else {
		// Fallback for truly undefined/null only
		taskIdValue = '0';
	}

	return {
		...task,
		id: taskIdValue,
		dependencies: normalizeDependencies(task.dependencies),
		subtasks: (task.subtasks ?? []).map((subtask) =>
			normalizeSubtask(subtask, taskIdValue)
		)
	} as Task;
}

/**
 * Normalizes an array of tasks.
 * This is the main entry point for normalizing task data from file storage.
 *
 * Task IDs are converted to numbers.
 * Subtask IDs are converted to numbers.
 * ParentIds are set to the parent task's numeric ID.
 * Dependencies: task refs become numbers, subtask refs (with ".") stay as strings.
 *
 * @param tasks - Array of tasks to normalize
 * @returns Normalized array of tasks
 * @example
 * ```typescript
 * const tasks = [
 *   {
 *     id: "1",
 *     dependencies: ["2", "3.1"],
 *     subtasks: [{ id: "1", dependencies: ["1", "2.3"] }]
 *   }
 * ];
 * const normalized = normalizeTaskIds(tasks);
 * // Result:
 * // {
 * //   id: 1,  // number
 * //   dependencies: [2, "3.1"],  // number and string
 * //   subtasks: [{
 * //     id: 1,  // number
 * //     parentId: 1,  // number (set from parent)
 * //     dependencies: [1, "2.3"]  // number and string
 * //   }]
 * // }
 * ```
 */
export function normalizeTaskIds(tasks: Task[]): Task[] {
	if (!Array.isArray(tasks)) {
		return [];
	}

	return tasks.map(normalizeTask);
}
