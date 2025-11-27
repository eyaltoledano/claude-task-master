/**
 * @fileoverview Task ID validation utilities and Zod schemas
 * Provides validation for task IDs used in MCP tools and CLI
 *
 * Supported formats:
 * - Simple numeric: "1", "2", "15" (local file storage)
 * - Numeric subtask: "1.2", "15.3" (local file storage, dot notation)
 * - Numeric sub-subtask: "1.2.3", "15.3.1" (local file storage, dot notation)
 * - Alphanumeric display IDs: "HAM-123", "PROJ-456" (remote API storage)
 *   Note: In remote mode, subtasks also use alphanumeric IDs (HAM-2, HAM-3),
 *   they don't use dot notation like local storage.
 *
 * NOT supported:
 * - Alphanumeric with dot notation: "HAM-123.2" (doesn't exist in any mode)
 */

import { z } from 'zod';

/**
 * Pattern for validating a single task ID
 * Supports:
 * - Numeric: "1", "15", "999"
 * - Numeric subtasks: "1.2", "15.3.1"
 * - Alphanumeric display IDs: "HAM-123", "PROJ-456" (main tasks only, no subtask notation)
 */
export const TASK_ID_PATTERN = /^(\d+(\.\d+)*|[A-Za-z]+-\d+)$/;

/**
 * Validates a single task ID string
 *
 * @param id - The task ID to validate
 * @returns True if the ID is valid
 *
 * @example
 * ```typescript
 * isValidTaskIdFormat("1");        // true
 * isValidTaskIdFormat("15.2");     // true
 * isValidTaskIdFormat("1.2.3");    // true
 * isValidTaskIdFormat("HAM-123");  // true
 * isValidTaskIdFormat("HAM-123.2"); // false (alphanumeric subtasks not supported)
 * isValidTaskIdFormat("abc");      // false
 * isValidTaskIdFormat("");         // false
 * ```
 */
export function isValidTaskIdFormat(id: string): boolean {
	return TASK_ID_PATTERN.test(id);
}

/**
 * Zod schema for a single task ID
 * Validates format: numeric, alphanumeric display ID, or numeric subtask
 */
export const taskIdSchema = z
	.string()
	.min(1, 'Task ID cannot be empty')
	.refine(isValidTaskIdFormat, {
		message:
			"Invalid task ID format. Expected numeric (e.g., '15'), subtask (e.g., '15.2'), or display ID (e.g., 'HAM-123')"
	});

/**
 * Zod schema for comma-separated task IDs
 * Validates that each ID in the comma-separated list is valid
 *
 * @example
 * ```typescript
 * taskIdsSchema.parse("1");        // valid
 * taskIdsSchema.parse("1,2,3");    // valid
 * taskIdsSchema.parse("1.2, 3.4"); // valid (spaces trimmed)
 * taskIdsSchema.parse("HAM-123");  // valid
 * taskIdsSchema.parse("abc");      // throws
 * taskIdsSchema.parse("HAM-123.2"); // throws (alphanumeric subtasks not supported)
 * ```
 */
export const taskIdsSchema = z
	.string()
	.min(1, 'Task ID(s) cannot be empty')
	.refine(
		(value) => {
			const ids = value
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id.length > 0);
			return ids.length > 0 && ids.every(isValidTaskIdFormat);
		},
		{
			message:
				"Invalid task ID format. Expected numeric (e.g., '15'), subtask (e.g., '15.2'), or display ID (e.g., 'HAM-123'). Multiple IDs should be comma-separated."
		}
	);

/**
 * Parse and validate comma-separated task IDs
 *
 * @param input - Comma-separated task ID string
 * @returns Array of validated task IDs
 * @throws Error if any ID is invalid
 *
 * @example
 * ```typescript
 * parseTaskIds("1, 2, 3");     // ["1", "2", "3"]
 * parseTaskIds("1.2,3.4");     // ["1.2", "3.4"]
 * parseTaskIds("HAM-123");     // ["HAM-123"]
 * parseTaskIds("invalid");     // throws Error
 * parseTaskIds("HAM-123.2");   // throws Error (alphanumeric subtasks not supported)
 * ```
 */
export function parseTaskIds(input: string): string[] {
	const ids = input
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);

	if (ids.length === 0) {
		throw new Error('No valid task IDs provided');
	}

	const invalidIds = ids.filter((id) => !isValidTaskIdFormat(id));
	if (invalidIds.length > 0) {
		throw new Error(
			`Invalid task ID format: ${invalidIds.join(', ')}. Expected numeric (e.g., '15'), subtask (e.g., '15.2'), or display ID (e.g., 'HAM-123')`
		);
	}

	return ids;
}

/**
 * Extract parent task ID from a subtask ID
 *
 * @param taskId - Task ID (e.g., "1.2.3")
 * @returns Parent ID (e.g., "1") or the original ID if not a subtask
 *
 * @example
 * ```typescript
 * extractParentId("1.2.3");  // "1"
 * extractParentId("1.2");    // "1"
 * extractParentId("1");      // "1"
 * ```
 */
export function extractParentId(taskId: string): string {
	const parts = taskId.split('.');
	return parts[0];
}

/**
 * Check if a task ID represents a subtask
 *
 * @param taskId - Task ID to check
 * @returns True if the ID contains a dot (subtask notation)
 *
 * @example
 * ```typescript
 * isSubtaskId("1.2");   // true
 * isSubtaskId("1.2.3"); // true
 * isSubtaskId("1");     // false
 * ```
 */
export function isSubtaskId(taskId: string): boolean {
	return taskId.includes('.');
}
