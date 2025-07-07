/**
 * @fileoverview E2B Provider Error Types
 *
 * Defines structured error types specific to E2B sandbox operations,
 * extending the Flow error handling system.
 */

import { FlowError } from '../../errors/flow-errors.js';

/**
 * Base E2B error class
 */
export class E2BError extends FlowError {
	constructor(options = {}) {
		super(options.message, {
			code: options.code || 'E2B_ERROR',
			isRetryable: options.isRetryable ?? false,
			severity: options.severity || 'error',
			category: options.category || 'e2b',
			details: {
				provider: 'e2b',
				...options.details
			}
		});
		this.name = 'E2BError';
	}
}

/**
 * E2B connection/network error
 */
export class E2BConnectionError extends E2BError {
	constructor(options = {}) {
		super({
			...options,
			code: options.code || 'E2B_CONNECTION_ERROR',
			isRetryable: true,
			category: 'connection',
			severity: 'error'
		});
		this.name = 'E2BConnectionError';
	}
}

/**
 * E2B execution error
 */
export class E2BExecutionError extends E2BError {
	constructor(options = {}) {
		super({
			...options,
			code: options.code || 'E2B_EXECUTION_ERROR',
			isRetryable: false,
			category: 'execution',
			severity: 'error'
		});
		this.name = 'E2BExecutionError';
	}
}

/**
 * E2B API error
 */
export class E2BApiError extends E2BError {
	constructor(options = {}) {
		super({
			...options,
			code: options.code || 'E2B_API_ERROR',
			isRetryable: options.status >= 500, // Retry server errors
			category: 'api',
			severity: 'error',
			details: {
				status: options.status,
				statusText: options.statusText,
				endpoint: options.endpoint,
				...options.details
			}
		});
		this.name = 'E2BApiError';
	}
}

/**
 * E2B resource error
 */
export class E2BResourceError extends E2BError {
	constructor(options = {}) {
		super({
			...options,
			code: options.code || 'E2B_RESOURCE_ERROR',
			isRetryable: false,
			category: 'resource',
			severity: 'error'
		});
		this.name = 'E2BResourceError';
	}
}

/**
 * E2B timeout error
 */
export class E2BTimeoutError extends E2BConnectionError {
	constructor(options = {}) {
		super({
			...options,
			code: 'E2B_TIMEOUT',
			message:
				options.message || `E2B operation timed out after ${options.timeout}ms`,
			isRetryable: true,
			category: 'connection',
			severity: 'warn',
			details: {
				timeout: options.timeout,
				operation: options.operation,
				...options.details
			}
		});
		this.name = 'E2BTimeoutError';
	}
}

/**
 * E2B quota exceeded error
 */
export class E2BQuotaError extends E2BError {
	constructor(options = {}) {
		super({
			...options,
			code: 'E2B_QUOTA_EXCEEDED',
			message: options.message || 'E2B quota exceeded',
			isRetryable: false,
			category: 'quota',
			severity: 'error',
			details: {
				quotaType: options.quotaType,
				current: options.current,
				limit: options.limit,
				...options.details
			}
		});
		this.name = 'E2BQuotaError';
	}
}

/**
 * E2B authentication error
 */
export class E2BAuthError extends E2BError {
	constructor(options = {}) {
		super({
			...options,
			code: 'E2B_AUTH_ERROR',
			message: options.message || 'E2B authentication failed',
			isRetryable: false,
			category: 'authentication',
			severity: 'error'
		});
		this.name = 'E2BAuthError';
	}
}

/**
 * Create E2B error from HTTP response
 */
export function createE2BErrorFromResponse(response, endpoint) {
	const status = response.status;
	const statusText = response.statusText;

	if (status === 401 || status === 403) {
		return new E2BAuthError({
			message: `E2B authentication failed: ${status} ${statusText}`,
			details: { status, statusText, endpoint }
		});
	}

	if (status === 429) {
		return new E2BQuotaError({
			message: `E2B rate limit exceeded: ${status} ${statusText}`,
			quotaType: 'rate_limit',
			details: { status, statusText, endpoint }
		});
	}

	if (status >= 500) {
		return new E2BApiError({
			message: `E2B server error: ${status} ${statusText}`,
			status,
			statusText,
			endpoint,
			isRetryable: true
		});
	}

	return new E2BApiError({
		message: `E2B API error: ${status} ${statusText}`,
		status,
		statusText,
		endpoint,
		isRetryable: false
	});
}

/**
 * Check if error is retryable E2B error
 */
export function isRetryableE2BError(error) {
	return error instanceof E2BError && error.isRetryable;
}

/**
 * Error code mapping for E2B-specific errors
 */
export const E2B_ERROR_CODES = {
	// Connection errors
	CONNECTION_FAILED: 'E2B_CONNECTION_FAILED',
	TIMEOUT: 'E2B_TIMEOUT',
	NETWORK_ERROR: 'E2B_NETWORK_ERROR',

	// API errors
	API_ERROR: 'E2B_API_ERROR',
	INVALID_RESPONSE: 'E2B_INVALID_RESPONSE',
	RATE_LIMITED: 'E2B_RATE_LIMITED',

	// Authentication errors
	AUTH_ERROR: 'E2B_AUTH_ERROR',
	INVALID_API_KEY: 'E2B_INVALID_API_KEY',
	MISSING_API_KEY: 'E2B_MISSING_API_KEY',

	// Resource errors
	RESOURCE_NOT_FOUND: 'E2B_RESOURCE_NOT_FOUND',
	RESOURCE_CREATION_FAILED: 'E2B_RESOURCE_CREATION_FAILED',
	RESOURCE_DELETION_FAILED: 'E2B_RESOURCE_DELETION_FAILED',

	// Execution errors
	EXECUTION_FAILED: 'E2B_EXECUTION_FAILED',
	EXECUTION_TIMEOUT: 'E2B_EXECUTION_TIMEOUT',
	SANDBOX_INACTIVE: 'E2B_SANDBOX_INACTIVE',

	// Quota errors
	QUOTA_EXCEEDED: 'E2B_QUOTA_EXCEEDED',
	CONCURRENT_LIMIT: 'E2B_CONCURRENT_LIMIT'
};

/**
 * Get error severity based on error type
 */
export function getE2BErrorSeverity(error) {
	if (error instanceof E2BTimeoutError) return 'warn';
	if (error instanceof E2BConnectionError) return 'warn';
	if (error instanceof E2BQuotaError) return 'error';
	if (error instanceof E2BAuthError) return 'error';
	if (error instanceof E2BExecutionError) return 'error';
	return 'error';
}
