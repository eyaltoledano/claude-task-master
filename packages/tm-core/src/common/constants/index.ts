/**
 * @fileoverview Constants for Task Master Core
 * Single source of truth for all constant values
 */

import type {
	TaskComplexity,
	TaskPriority,
	TaskStatus
} from '../types/index.js';

// Import from root package.json (monorepo root) for version info
import packageJson from '../../../../../package.json' with { type: 'json' };

/**
 * Task Master version from root package.json
 * Centralized to avoid fragile relative paths throughout the codebase
 */
export const TASKMASTER_VERSION = packageJson.version || 'unknown';

/**
 * Package name from root package.json
 */
export const PACKAGE_NAME = packageJson.name || 'task-master-ai';

/**
 * Valid task status values
 */
export const TASK_STATUSES: readonly TaskStatus[] = [
	'pending',
	'in-progress',
	'done',
	'deferred',
	'cancelled',
	'blocked',
	'review'
] as const;

/**
 * Terminal complete statuses - tasks that are finished and satisfy dependencies
 * These statuses indicate a task is in a final state and:
 * - Should count toward completion percentage
 * - Should be considered satisfied for dependency resolution
 * - Should not be selected as "next task"
 *
 * Note: 'completed' is a workflow-specific alias for 'done' used in some contexts
 */
export const TERMINAL_COMPLETE_STATUSES: readonly TaskStatus[] = [
	'done',
	'completed',
	'cancelled'
] as const;

/**
 * Check if a task status represents a terminal complete state
 *
 * @param status - The task status to check
 * @returns true if the status represents a completed/terminal task
 *
 * @example
 * ```typescript
 * isTaskComplete('done')      // true
 * isTaskComplete('completed') // true
 * isTaskComplete('cancelled') // true
 * isTaskComplete('pending')   // false
 * ```
 */
export function isTaskComplete(status: TaskStatus): boolean {
	return TERMINAL_COMPLETE_STATUSES.includes(status);
}

/**
 * Valid task priority values
 */
export const TASK_PRIORITIES: readonly TaskPriority[] = [
	'low',
	'medium',
	'high',
	'critical'
] as const;

/**
 * Valid task complexity values
 */
export const TASK_COMPLEXITIES: readonly TaskComplexity[] = [
	'simple',
	'moderate',
	'complex',
	'very-complex'
] as const;

/**
 * Valid output formats for task display
 */
export const OUTPUT_FORMATS = ['text', 'json', 'compact'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/**
 * Status icons for display
 */
export const STATUS_ICONS: Record<TaskStatus, string> = {
	done: '✓',
	completed: '✓',
	'in-progress': '►',
	blocked: '⭕',
	pending: '○',
	deferred: '⏸',
	cancelled: '✗',
	review: '👁'
} as const;

/**
 * Status colors for display (using chalk color names)
 */
export const STATUS_COLORS: Record<TaskStatus, string> = {
	pending: 'yellow',
	'in-progress': 'blue',
	done: 'green',
	deferred: 'gray',
	cancelled: 'red',
	blocked: 'magenta',
	review: 'cyan',
	completed: 'green'
} as const;

/**
 * Provider constants - AI model providers
 */
export * from './providers.js';

/**
 * Path constants - file paths and directory structure
 */
export * from './paths.js';
