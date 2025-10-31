/**
 * @fileoverview Constants for Task Master Core
 * Single source of truth for all constant values
 */

import type {
	TaskStatus,
	TaskPriority,
	TaskComplexity
} from '../types/index.js';

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
