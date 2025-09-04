/**
 * @fileoverview Utility functions for the tm-core package
 * This file exports all utility functions and helper classes
 */

// Export ID generation utilities
export {
	generateTaskId as generateId, // Alias for backward compatibility
	generateTaskId,
	generateSubtaskId,
	isValidTaskId,
	isValidSubtaskId,
	getParentTaskId
} from './id-generator';

// Additional utility exports

/**
 * Formats a date for task timestamps
 * @deprecated This is a placeholder function that will be properly implemented in later tasks
 */
export function formatDate(date: Date = new Date()): string {
	return date.toISOString();
}

/**
 * Deep clones an object
 * @deprecated This is a placeholder function that will be properly implemented in later tasks
 */
export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}
