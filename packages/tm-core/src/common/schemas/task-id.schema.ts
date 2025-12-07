/**
 * @fileoverview Zod schemas for task ID validation
 * Provides type-safe validation and normalization of task IDs
 *
 * Task ID Formats:
 *
 * FILE STORAGE (local):
 * - Main tasks: "1", "2", "3" (numeric only)
 * - Subtasks: "1.1", "1.2" (one level only, no "1.2.3")
 *
 * API STORAGE (Hamster):
 * - Main tasks only: "HAM-1", "HAM-2" (3 letters + hyphen + number)
 * - Input accepts: "ham-1", "HAM-1", "ham1", "HAM1" (permissive input)
 * - Output always: "HAM-1" format (uppercase with hyphen)
 * - No subtasks: Never "HAM-1.2"
 */

import { z } from 'zod';

/**
 * Normalizes a display ID to the standard format
 *
 * API Storage IDs: Always uppercase with hyphen (HAM-1)
 * - "ham1" → "HAM-1"
 * - "HAM1" → "HAM-1"
 * - "ham-1" → "HAM-1"
 * - "HAM-1" → "HAM-1"
 *
 * File Storage IDs: Unchanged
 * - "1" → "1"
 * - "1.1" → "1.1"
 *
 * @param id - The display ID to normalize
 * @returns The normalized display ID
 */
export function normalizeDisplayId(id: string): string {
	if (!id) return id;

	const trimmed = id.trim();

	// File storage: numeric (main or subtask) - return as-is
	if (/^\d+(\.\d+)?$/.test(trimmed)) {
		return trimmed;
	}

	// API storage: 3 letters + optional hyphen + number
	// e.g., "ham1", "HAM1", "ham-1", "HAM-1"
	const apiPattern = /^([a-zA-Z]{3})-?(\d+)$/;
	const apiMatch = trimmed.match(apiPattern);
	if (apiMatch) {
		const prefix = apiMatch[1].toUpperCase();
		const number = apiMatch[2];
		return `${prefix}-${number}`;
	}

	// No pattern matched, return as-is
	return trimmed;
}

/**
 * Pattern for file storage main task: "1", "2", "123"
 */
const FILE_MAIN_PATTERN = /^\d+$/;

/**
 * Pattern for file storage subtask: "1.1", "2.3" (exactly one dot, one level)
 */
const FILE_SUBTASK_PATTERN = /^\d+\.\d+$/;

/**
 * Pattern for API storage main task: "HAM-1", "ham-1", "HAM1", "ham1"
 * Accepts with or without hyphen, normalizes to "HAM-1" format
 */
const API_MAIN_PATTERN = /^[a-zA-Z]{3}-?\d+$/;

/**
 * Check if a task ID format is valid
 * Accepts: "1", "1.1", "HAM-1", "ham-1", "HAM1", "ham1"
 * Rejects: "1.2.3", "HAM-1.2"
 * Note: All API IDs normalize to "HAM-1" format (uppercase with hyphen)
 */
function isValidTaskIdFormat(id: string): boolean {
	if (!id) return false;
	const trimmed = id.trim();

	// File storage: numeric main or subtask (one level only)
	if (FILE_MAIN_PATTERN.test(trimmed) || FILE_SUBTASK_PATTERN.test(trimmed)) {
		return true;
	}

	// API storage: prefixed main task only (no subtasks in API storage)
	if (API_MAIN_PATTERN.test(trimmed)) {
		return true;
	}

	return false;
}

/**
 * Check if a task ID is a main task (not a subtask)
 * Main tasks: "1", "2", "HAM-1"
 * Subtasks: "1.1", "2.3" (file storage only)
 */
function isMainTask(taskId: string): boolean {
	if (!taskId) return false;
	const trimmed = taskId.trim();

	// File storage main task
	if (FILE_MAIN_PATTERN.test(trimmed)) {
		return true;
	}

	// API storage main task (always main, no subtasks in API)
	if (API_MAIN_PATTERN.test(trimmed)) {
		return true;
	}

	return false;
}

/**
 * Base schema for any task ID (main task or subtask) - validation only
 * Use this for MCP tool schemas (JSON Schema can't represent transforms)
 * Call normalizeDisplayId() manually after validation if needed
 */
const taskIdBaseSchema = z.string().trim().refine(isValidTaskIdFormat, {
	message:
		'Invalid task ID format. Expected: numeric ("1", "1.2") or prefixed with hyphen ("HAM-1")'
});

/**
 * Base schema for main task IDs only - validation only
 * Use this for MCP tool schemas (JSON Schema can't represent transforms)
 * Call normalizeDisplayId() manually after validation if needed
 */
const mainTaskIdBaseSchema = z
	.string()
	.trim()
	.refine(isValidTaskIdFormat, {
		message:
			'Invalid task ID format. Expected: numeric ("1") or prefixed with hyphen ("HAM-1")'
	})
	.refine(isMainTask, {
		message:
			'Subtask IDs are not allowed. Please provide a main task ID (e.g., "1", "HAM-1")'
	});

/**
 * Zod schema for any task ID (main task or subtask)
 * Validates format and transforms to normalized form
 *
 * NOTE: For MCP tools, use TaskIdSchemaForMcp instead (no transform)
 *
 * @example
 * ```typescript
 * // File storage
 * TaskIdSchema.safeParse('1');     // { success: true, data: '1' }
 * TaskIdSchema.safeParse('1.2');   // { success: true, data: '1.2' }
 *
 * // API storage
 * TaskIdSchema.safeParse('ham-1'); // { success: true, data: 'HAM-1' }
 * TaskIdSchema.safeParse('HAM-1'); // { success: true, data: 'HAM-1' }
 *
 * // Permissive input, normalized output
 * TaskIdSchema.safeParse('ham1');  // { success: true, data: 'HAM-1' }
 * TaskIdSchema.safeParse('HAM1');  // { success: true, data: 'HAM-1' }
 *
 * // Invalid
 * TaskIdSchema.safeParse('1.2.3'); // { success: false } - too deep
 * TaskIdSchema.safeParse('HAM-1.2'); // { success: false } - no API subtasks
 * ```
 */
export const TaskIdSchema = taskIdBaseSchema.transform(normalizeDisplayId);

/**
 * Zod schema for main task IDs only (no subtasks)
 * Validates format, ensures no subtask part, and transforms to normalized form
 *
 * NOTE: For MCP tools, use MainTaskIdSchemaForMcp instead (no transform)
 *
 * @example
 * ```typescript
 * // Valid main tasks
 * MainTaskIdSchema.safeParse('1');     // { success: true, data: '1' }
 * MainTaskIdSchema.safeParse('ham-1'); // { success: true, data: 'HAM-1' }
 * MainTaskIdSchema.safeParse('ham1');  // { success: true, data: 'HAM-1' }
 *
 * // Invalid (subtasks)
 * MainTaskIdSchema.safeParse('1.2');   // { success: false }
 * ```
 */
export const MainTaskIdSchema =
	mainTaskIdBaseSchema.transform(normalizeDisplayId);

/**
 * Zod schema for any task ID - validation only, no transform
 * Use this for MCP tool parameter schemas (JSON Schema can't represent transforms)
 * Call normalizeDisplayId() manually after validation
 */
export const TaskIdSchemaForMcp = taskIdBaseSchema;

/**
 * Zod schema for main task IDs - validation only, no transform
 * Use this for MCP tool parameter schemas (JSON Schema can't represent transforms)
 * Call normalizeDisplayId() manually after validation
 */
export const MainTaskIdSchemaForMcp = mainTaskIdBaseSchema;

/**
 * Type for a validated and normalized task ID
 */
export type TaskId = z.output<typeof TaskIdSchema>;

/**
 * Type for a validated and normalized main task ID
 */
export type MainTaskId = z.output<typeof MainTaskIdSchema>;
