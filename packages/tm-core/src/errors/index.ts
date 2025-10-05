/**
 * @fileoverview Custom error classes for the tm-core package
 * This file exports all custom error types and error handling utilities
 */

// Export the main TaskMasterError class
export {
	TaskMasterError,
	ERROR_CODES,
	type ErrorCode,
	type ErrorContext,
	type SerializableError
} from './task-master-error.js';

// Error implementations will be defined here
// export * from './task-errors.js';
// export * from './storage-errors.js';
// export * from './provider-errors.js';
// export * from './validation-errors.js';

// Placeholder exports - these will be implemented in later tasks

/**
 * Base error class for all tm-core errors
 * @deprecated This is a placeholder class that will be properly implemented in later tasks
 */
export class TmCoreError extends Error {
	constructor(
		message: string,
		public code?: string
	) {
		super(message);
		this.name = 'TmCoreError';
	}
}

/**
 * Error thrown when a task is not found
 * @deprecated This is a placeholder class that will be properly implemented in later tasks
 */
export class TaskNotFoundError extends TmCoreError {
	constructor(taskId: string) {
		super(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
		this.name = 'TaskNotFoundError';
	}
}

/**
 * Error thrown when validation fails
 * @deprecated This is a placeholder class that will be properly implemented in later tasks
 */
export class ValidationError extends TmCoreError {
	constructor(message: string) {
		super(message, 'VALIDATION_ERROR');
		this.name = 'ValidationError';
	}
}

/**
 * Error thrown when storage operations fail
 * @deprecated This is a placeholder class that will be properly implemented in later tasks
 */
export class StorageError extends TmCoreError {
	constructor(message: string) {
		super(message, 'STORAGE_ERROR');
		this.name = 'StorageError';
	}
}
