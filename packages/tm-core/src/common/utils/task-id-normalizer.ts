/**
 * @fileoverview Task ID normalization utilities for Task Master
 * Provides functions to normalize task IDs, subtask IDs, and dependencies
 * with proper validation to prevent NaN corruption.
 *
 * All IDs are canonicalized as STRINGS in the TypeScript domain model.
 * When reading from JSON (where IDs might be numbers like 5), they are
 * converted to strings ("5"). The normalizer ensures consistency across
 * all task data.
 *
 * This consolidates the normalization logic previously duplicated in:
 * - file-storage.ts (normalizeTaskIds)
 * - format-handler.ts (normalizeTasks)
 * - scripts/modules/utils.js (normalizeTaskIds - legacy reference implementation)
 */

import type { Task, Subtask } from '../types/index.js';

/**
 * Checks if a value is a valid positive, finite integer (not NaN, not Infinity, not zero, not negative).
 *
 * @param value - The value to check
 * @returns True if value is a positive, finite integer
 */
export function isValidPositiveInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Number.isInteger(value) &&
		value > 0
	);
}

/**
 * Safely normalizes a task ID to a string.
 * Returns null if the ID is invalid (null, undefined, NaN, empty string).
 *
 * @param id - The ID to normalize (can be number, string, or unknown)
 * @returns The string representation of the ID, or null if invalid
 * @example
 * ```typescript
 * normalizeTaskId("5");        // "5"
 * normalizeTaskId(5);          // "5"
 * normalizeTaskId("abc");      // "abc" (preserved as-is)
 * normalizeTaskId("5.1");      // "5" (extracts task portion)
 * normalizeTaskId(0);          // null (not positive)
 * normalizeTaskId(-1);         // null (negative)
 * normalizeTaskId(NaN);        // null
 * normalizeTaskId(null);       // null
 * normalizeTaskId(undefined);  // null
 * normalizeTaskId("");         // null (empty string)
 * ```
 */
export function normalizeTaskId(id: unknown): string | null {
	if (id === undefined || id === null) {
		return null;
	}

	// Handle numeric inputs: convert valid positive integers to string
	if (typeof id === 'number') {
		if (!Number.isFinite(id) || Number.isNaN(id)) {
			return null;
		}
		if (id <= 0) {
			return null;
		}
		return String(Math.floor(id));
	}

	const idStr = String(id).trim();

	if (idStr.length === 0) {
		return null;
	}

	// Handle subtask ID format (e.g., "5.1") - extract just the task part
	// This shouldn't normally happen, but provides a safety net
	if (idStr.includes('.')) {
		const parts = idStr.split('.');
		const taskPart = parts[0];
		const parsed = parseInt(taskPart, 10);
		if (!isNaN(parsed) && parsed > 0) {
			return String(parsed);
		}
		// Non-numeric dotted ID (e.g., "HAM-1.2") - return the first part
		return taskPart.length > 0 ? taskPart : null;
	}

	// Try to parse as integer for normalization (e.g., "05" -> "5")
	const parsed = parseInt(idStr, 10);
	if (!isNaN(parsed) && parsed > 0 && String(parsed) === idStr) {
		return idStr;
	}

	// Non-numeric string ID (e.g., "HAM-1") - return as-is
	if (idStr.length > 0) {
		return idStr;
	}

	return null;
}

/**
 * Safely normalizes a subtask ID to a string.
 * Returns null if the ID is invalid.
 *
 * @param id - The subtask ID to normalize
 * @returns The string representation of the ID, or null if invalid
 * @example
 * ```typescript
 * normalizeSubtaskId("1");     // "1"
 * normalizeSubtaskId(2);       // "2"
 * normalizeSubtaskId("abc");   // "abc"
 * normalizeSubtaskId("5.1");   // "1" (extracts subtask portion)
 * normalizeSubtaskId(null);    // null
 * normalizeSubtaskId("");      // null
 * ```
 */
export function normalizeSubtaskId(id: unknown): string | null {
	if (id === undefined || id === null) {
		return null;
	}

	// Handle numeric inputs
	if (typeof id === 'number') {
		if (!Number.isFinite(id) || Number.isNaN(id)) {
			return null;
		}
		if (id <= 0) {
			return null;
		}
		return String(Math.floor(id));
	}

	const idStr = String(id).trim();

	if (idStr.length === 0) {
		return null;
	}

	// Handle full subtask ID format (e.g., "5.1") - extract just the subtask part
	if (idStr.includes('.')) {
		const parts = idStr.split('.');
		const subtaskPart = parts[parts.length - 1];
		const parsed = parseInt(subtaskPart, 10);
		if (!isNaN(parsed) && parsed > 0) {
			return String(parsed);
		}
		// Non-numeric subtask part - return as-is if non-empty
		return subtaskPart.length > 0 ? subtaskPart : null;
	}

	// Non-dotted ID - return as string
	return idStr;
}

/**
 * Normalizes a dependency value to a string.
 * - Numbers are converted to strings
 * - Dotted strings like "3.1" are kept as-is
 * - Returns empty string for null/undefined (to be filtered by normalizeDependencies)
 *
 * @param dep - The dependency value to normalize
 * @returns Normalized dependency as a string, or empty string if invalid
 * @example
 * ```typescript
 * normalizeDependency("5");      // "5"
 * normalizeDependency(5);        // "5"
 * normalizeDependency("7.1");    // "7.1"
 * normalizeDependency("1.2.3");  // "1.2.3"
 * normalizeDependency(null);     // ""
 * normalizeDependency(undefined);// ""
 * ```
 */
export function normalizeDependency(dep: unknown): string {
	if (dep === undefined || dep === null) {
		return '';
	}

	if (typeof dep === 'number') {
		if (!Number.isFinite(dep) || Number.isNaN(dep)) {
			return '';
		}
		return String(dep);
	}

	const depStr = String(dep).trim();
	return depStr;
}

/**
 * Normalizes an array of dependencies to string[].
 *
 * @param dependencies - Array of dependency values
 * @returns Normalized array of string dependencies
 */
export function normalizeDependencies(
	dependencies: unknown[] | undefined | null
): string[] {
	if (!dependencies || !Array.isArray(dependencies)) {
		return [];
	}

	return dependencies
		.map(normalizeDependency)
		.filter((dep): dep is string => dep !== '');
}

/**
 * Normalizes a subtask object, ensuring proper string ID types.
 *
 * @param subtask - The subtask to normalize
 * @param parentId - The parent task's ID (string)
 * @returns Normalized subtask with validated string IDs
 */
export function normalizeSubtask(
	subtask: Subtask,
	parentId: string
): Subtask {
	const normalizedId = normalizeSubtaskId(subtask.id);

	let subtaskIdValue: number | string;
	if (normalizedId !== null) {
		subtaskIdValue = normalizedId;
	} else if (typeof subtask.id === 'string' && subtask.id.trim().length > 0) {
		// Preserve non-empty string IDs that didn't normalize (edge case)
		subtaskIdValue = subtask.id;
	} else {
		// Truly invalid ID - log warning and use parentId-based fallback
		console.warn(
			`[task-id-normalizer] Subtask has invalid ID: ${JSON.stringify(subtask.id)}, using fallback "${parentId}.0"`
		);
		subtaskIdValue = `${parentId}.0`;
	}

	return {
		...subtask,
		id: subtaskIdValue,
		parentId,
		dependencies: normalizeDependencies(subtask.dependencies)
	};
}

/**
 * Normalizes a single task, ensuring all IDs are strings.
 *
 * @param task - The task to normalize
 * @returns Normalized task with validated string IDs
 */
export function normalizeTask(task: Task): Task {
	const normalizedId = normalizeTaskId(task.id);

	let taskIdValue: string;
	if (normalizedId !== null) {
		taskIdValue = normalizedId;
	} else if (typeof task.id === 'string' && task.id.trim().length > 0) {
		// Preserve non-empty string IDs that didn't normalize (e.g., unusual formats)
		taskIdValue = task.id;
	} else {
		// Truly invalid ID (null, undefined, empty) - log warning and use emergency fallback
		console.warn(
			`[task-id-normalizer] Task has invalid ID: ${JSON.stringify(task.id)}, using fallback "0"`
		);
		taskIdValue = '0';
	}

	return {
		...task,
		id: taskIdValue,
		dependencies: normalizeDependencies(task.dependencies),
		subtasks: (task.subtasks ?? []).map((subtask) =>
			normalizeSubtask(subtask, taskIdValue)
		)
	};
}

/**
 * Normalizes an array of tasks, ensuring all IDs are strings.
 * This is the main entry point for normalizing task data from file storage.
 *
 * Task IDs are normalized to strings.
 * Subtask IDs are normalized to strings.
 * ParentIds are set to the parent task's string ID.
 * Dependencies are normalized to string[].
 *
 * @param tasks - Array of tasks to normalize
 * @returns New array of normalized tasks (immutable - original array is not modified)
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
 * //   id: "1",
 * //   dependencies: ["2", "3.1"],
 * //   subtasks: [{
 * //     id: "1",
 * //     parentId: "1",
 * //     dependencies: ["1", "2.3"]
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
