/**
 * @fileoverview ID generation utilities for Task Master
 * Provides functions to generate unique identifiers for tasks and subtasks
 */

import { randomBytes } from 'node:crypto';

/**
 * Generates a unique task ID using the format: TASK-{timestamp}-{random}
 *
 * @returns A unique task ID string
 * @example
 * ```typescript
 * const taskId = generateTaskId();
 * // Returns something like: "TASK-1704067200000-A7B3"
 * ```
 */
export function generateTaskId(): string {
	const timestamp = Date.now();
	const random = generateRandomString(4);
	return `TASK-${timestamp}-${random}`;
}

/**
 * Generates a subtask ID using the format: {parentId}.{sequential}
 *
 * @param parentId - The ID of the parent task
 * @param existingSubtasks - Array of existing subtask IDs to determine the next sequential number
 * @returns A unique subtask ID string
 * @example
 * ```typescript
 * const subtaskId = generateSubtaskId("TASK-123-A7B3", ["TASK-123-A7B3.1"]);
 * // Returns: "TASK-123-A7B3.2"
 * ```
 */
export function generateSubtaskId(
	parentId: string,
	existingSubtasks: string[] = []
): string {
	// Find existing subtasks for this parent
	const parentSubtasks = existingSubtasks.filter((id) =>
		id.startsWith(`${parentId}.`)
	);

	// Extract sequential numbers and find the highest
	const sequentialNumbers = parentSubtasks
		.map((id) => {
			const parts = id.split('.');
			const lastPart = parts[parts.length - 1];
			return Number.parseInt(lastPart, 10);
		})
		.filter((num) => !Number.isNaN(num))
		.sort((a, b) => a - b);

	// Determine the next sequential number
	const nextSequential =
		sequentialNumbers.length > 0 ? Math.max(...sequentialNumbers) + 1 : 1;

	return `${parentId}.${nextSequential}`;
}

/**
 * Generates a random alphanumeric string of specified length
 * Uses crypto.randomBytes for cryptographically secure randomness
 *
 * @param length - The desired length of the random string
 * @returns A random alphanumeric string
 * @internal
 */
function generateRandomString(length: number): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const bytes = randomBytes(length);
	let result = '';

	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length];
	}

	return result;
}

/**
 * Validates a task ID format
 *
 * @param id - The ID to validate
 * @returns True if the ID matches the expected task ID format
 * @example
 * ```typescript
 * isValidTaskId("TASK-1704067200000-A7B3"); // true
 * isValidTaskId("invalid-id"); // false
 * ```
 */
export function isValidTaskId(id: string): boolean {
	const taskIdRegex = /^TASK-\d{13}-[A-Z0-9]{4}$/;
	return taskIdRegex.test(id);
}

/**
 * Validates a subtask ID format
 *
 * @param id - The ID to validate
 * @returns True if the ID matches the expected subtask ID format
 * @example
 * ```typescript
 * isValidSubtaskId("TASK-1704067200000-A7B3.1"); // true
 * isValidSubtaskId("TASK-1704067200000-A7B3.1.2"); // true (nested subtask)
 * isValidSubtaskId("invalid.id"); // false
 * ```
 */
export function isValidSubtaskId(id: string): boolean {
	const parts = id.split('.');
	if (parts.length < 2) return false;

	// First part should be a valid task ID
	const taskIdPart = parts[0];
	if (!isValidTaskId(taskIdPart)) return false;

	// Remaining parts should be positive integers
	const sequentialParts = parts.slice(1);
	return sequentialParts.every((part) => {
		const num = Number.parseInt(part, 10);
		return !Number.isNaN(num) && num > 0 && part === num.toString();
	});
}

/**
 * Extracts the parent task ID from a subtask ID
 *
 * @param subtaskId - The subtask ID
 * @returns The parent task ID, or null if the input is not a valid subtask ID
 * @example
 * ```typescript
 * getParentTaskId("TASK-1704067200000-A7B3.1.2"); // "TASK-1704067200000-A7B3"
 * getParentTaskId("TASK-1704067200000-A7B3"); // null (not a subtask)
 * ```
 */
export function getParentTaskId(subtaskId: string): string | null {
	if (!isValidSubtaskId(subtaskId)) return null;

	const parts = subtaskId.split('.');
	return parts[0];
}
