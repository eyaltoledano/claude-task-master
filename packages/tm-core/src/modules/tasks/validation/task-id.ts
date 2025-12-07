/**
 * @fileoverview Task ID validation utilities and Zod schemas
 * Provides validation for task IDs used in MCP tools and CLI
 *
 * Supported formats:
 *
 * FILE STORAGE (local):
 * - Main tasks: "1", "2", "15"
 * - Subtasks: "1.2", "15.3" (one level only)
 *
 * API STORAGE (Hamster):
 * - Main tasks: "HAM-1", "ham-1", "HAM1", "ham1" (all normalized to "HAM-1")
 * - No subtasks (API doesn't use dot notation)
 *
 * NOT supported:
 * - Deep nesting: "1.2.3" (file storage only has one subtask level)
 * - API subtasks: "HAM-1.2" (doesn't exist)
 */

import { z } from 'zod';
import { normalizeDisplayId } from '../../../common/schemas/task-id.schema.js';

/**
 * Pattern for validating a single task ID
 * Permissive input - accepts with or without hyphen for API IDs
 * - Numeric: "1", "15", "999"
 * - Numeric subtasks: "1.2" (one level only)
 * - API display IDs: "HAM-1", "ham-1", "HAM1", "ham1"
 */
export const TASK_ID_PATTERN = /^(\d+(\.\d+)?|[A-Za-z]{3}-?\d+)$/;

/**
 * Validates a single task ID string
 *
 * @param id - The task ID to validate
 * @returns True if the ID is valid
 *
 * @example
 * ```typescript
 * isValidTaskIdFormat("1");        // true
 * isValidTaskIdFormat("1.2");      // true
 * isValidTaskIdFormat("HAM-1");    // true
 * isValidTaskIdFormat("ham1");     // true (permissive input)
 * isValidTaskIdFormat("1.2.3");    // false (too deep)
 * isValidTaskIdFormat("HAM-1.2");  // false (no API subtasks)
 * isValidTaskIdFormat("abc");      // false
 * ```
 */
export function isValidTaskIdFormat(id: string): boolean {
	return TASK_ID_PATTERN.test(id);
}

/**
 * Zod schema for a single task ID
 * Validates format: numeric, alphanumeric display ID, or numeric subtask
 * Note: Use parseTaskIds() for normalization (e.g., "ham1" → "HAM-1")
 * This schema is used in MCP tool definitions which can't have transforms.
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
 * Permissive input - accepts "ham1", "HAM1", "ham-1" etc.
 *
 * @example
 * ```typescript
 * taskIdsSchema.parse("1");        // valid
 * taskIdsSchema.parse("1,2,3");    // valid
 * taskIdsSchema.parse("1.2, 3.4"); // valid (spaces trimmed)
 * taskIdsSchema.parse("HAM-123");  // valid
 * taskIdsSchema.parse("ham1");     // valid (permissive input)
 * taskIdsSchema.parse("abc");      // throws
 * taskIdsSchema.parse("HAM-1.2");  // throws (API subtasks not supported)
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
 * Returns normalized IDs (e.g., "ham1" → "HAM-1")
 *
 * @param input - Comma-separated task ID string
 * @returns Array of validated and normalized task IDs
 * @throws Error if any ID is invalid
 *
 * @example
 * ```typescript
 * parseTaskIds("1, 2, 3");     // ["1", "2", "3"]
 * parseTaskIds("1.2,3.4");     // ["1.2", "3.4"]
 * parseTaskIds("HAM-123");     // ["HAM-123"]
 * parseTaskIds("ham1,ham2");   // ["HAM-1", "HAM-2"] (normalized)
 * parseTaskIds("invalid");     // throws Error
 * parseTaskIds("HAM-1.2");     // throws Error (API subtasks not supported)
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

	// Normalize all IDs (e.g., "ham1" → "HAM-1")
	return ids.map(normalizeDisplayId);
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
