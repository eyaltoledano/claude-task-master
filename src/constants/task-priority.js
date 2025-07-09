/**
 * @typedef {'high' | 'medium' | 'low'} TaskPriority
 */

/**
 * Task priority options
 * @type {TaskPriority[]}
 * @description Defines possible task priorities:
 * - high: Critical tasks that need immediate attention
 * - medium: Standard priority tasks (default)
 * - low: Tasks that can be deferred or are nice-to-have
 */
export const TASK_PRIORITY_OPTIONS = ['high', 'medium', 'low'];

/**
 * Default task priority
 * @type {TaskPriority}
 */
export const DEFAULT_TASK_PRIORITY = 'medium';

/**
 * Check if a given priority is valid
 * @param {string} priority - The priority to check
 * @returns {boolean} True if the priority is valid, false otherwise
 */
export function isValidTaskPriority(priority) {
	return TASK_PRIORITY_OPTIONS.includes(priority?.toLowerCase());
}

/**
 * Normalize a priority value to lowercase
 * @param {string} priority - The priority to normalize
 * @returns {TaskPriority|null} The normalized priority or null if invalid
 */
export function normalizeTaskPriority(priority) {
	if (!priority) return null;
	const normalized = priority.toLowerCase();
	return isValidTaskPriority(normalized) ? normalized : null;
}
