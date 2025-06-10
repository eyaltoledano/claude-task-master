/**
 * @typedef {'high' | 'medium' | 'low'} TaskPriority
 */

/**
 * Task priority options list
 * @type {TaskPriority[]}
 * @description Defines possible task priorities:
 * - high: High priority task (urgent/critical)
 * - medium: Medium priority task (standard)
 * - low: Low priority task (can be deferred)
 */
export const TASK_PRIORITY_OPTIONS = ['high', 'medium', 'low'];

/**
 * Default task priority
 * @type {TaskPriority}
 */
export const DEFAULT_TASK_PRIORITY = 'medium';

/**
 * Priority values for sorting (higher number = higher priority)
 * @type {Record<TaskPriority, number>}
 */
export const PRIORITY_VALUES = {
	high: 3,
	medium: 2,
	low: 1
};

/**
 * Check if a given priority is a valid task priority
 * @param {string} priority - The priority to check
 * @returns {boolean} True if the priority is valid, false otherwise
 */
export function isValidTaskPriority(priority) {
	return TASK_PRIORITY_OPTIONS.includes(priority);
}

/**
 * Get priority value for sorting
 * @param {string} priority - The priority to get value for
 * @returns {number} Priority value (defaults to medium if invalid)
 */
export function getPriorityValue(priority) {
	return PRIORITY_VALUES[priority] ?? PRIORITY_VALUES[DEFAULT_TASK_PRIORITY];
}
