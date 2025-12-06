/**
 * @fileoverview Error Handling Utilities
 * Provides error classification, user-friendly messages, and recovery mechanisms
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	/** Informational message */
	INFO = 'info',
	/** Warning that doesn't prevent operation */
	WARNING = 'warning',
	/** Error that prevents feature but app continues */
	ERROR = 'error',
	/** Critical error that may crash the app */
	CRITICAL = 'critical'
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
	/** File system related errors */
	FILE_SYSTEM = 'file_system',
	/** Task data validation errors */
	DATA_VALIDATION = 'data_validation',
	/** Terminal rendering errors */
	RENDERING = 'rendering',
	/** Network/API errors */
	NETWORK = 'network',
	/** Configuration errors */
	CONFIGURATION = 'configuration',
	/** Unknown errors */
	UNKNOWN = 'unknown'
}

/**
 * Classified error information
 */
export interface ClassifiedError {
	/** Original error object */
	error: Error;
	/** Error category */
	category: ErrorCategory;
	/** Severity level */
	severity: ErrorSeverity;
	/** User-friendly message */
	message: string;
	/** Technical details for debugging */
	technicalDetails?: string;
	/** Suggested recovery actions */
	recoveryActions?: string[];
	/** Timestamp */
	timestamp: Date;
}

/**
 * Classify an error and provide user-friendly information
 */
export function classifyError(error: unknown): ClassifiedError {
	const err = error instanceof Error ? error : new Error(String(error));
	const message = err.message.toLowerCase();

	// File system errors
	if (
		message.includes('enoent') ||
		message.includes('no such file') ||
		message.includes('eacces') ||
		message.includes('permission denied') ||
		message.includes('eisdir') ||
		message.includes('enotdir')
	) {
		return {
			error: err,
			category: ErrorCategory.FILE_SYSTEM,
			severity: ErrorSeverity.ERROR,
			message: getFileSystemErrorMessage(err),
			technicalDetails: err.stack,
			recoveryActions: getFileSystemRecoveryActions(err),
			timestamp: new Date()
		};
	}

	// Data validation errors
	if (
		message.includes('parse') ||
		message.includes('json') ||
		message.includes('invalid') ||
		message.includes('malformed')
	) {
		return {
			error: err,
			category: ErrorCategory.DATA_VALIDATION,
			severity: ErrorSeverity.ERROR,
			message: 'Invalid task data detected. The tasks file may be corrupted.',
			technicalDetails: err.stack,
			recoveryActions: [
				'Check .taskmaster/tasks/tasks.json for syntax errors',
				'Run: task-master validate-dependencies',
				'Restore from backup if available'
			],
			timestamp: new Date()
		};
	}

	// Terminal rendering errors
	if (
		message.includes('render') ||
		message.includes('terminal') ||
		message.includes('tty')
	) {
		return {
			error: err,
			category: ErrorCategory.RENDERING,
			severity: ErrorSeverity.WARNING,
			message: 'Terminal rendering issue detected. Display may be affected.',
			technicalDetails: err.stack,
			recoveryActions: [
				'Try resizing your terminal window',
				'Ensure your terminal supports ANSI colors',
				'Update your terminal emulator'
			],
			timestamp: new Date()
		};
	}

	// Network/API errors
	if (
		message.includes('network') ||
		message.includes('fetch') ||
		message.includes('timeout') ||
		message.includes('connection')
	) {
		return {
			error: err,
			category: ErrorCategory.NETWORK,
			severity: ErrorSeverity.ERROR,
			message: 'Network error occurred. Some features may be unavailable.',
			technicalDetails: err.stack,
			recoveryActions: [
				'Check your internet connection',
				'Verify API endpoints are accessible',
				'Try again in a few moments'
			],
			timestamp: new Date()
		};
	}

	// Configuration errors
	if (
		message.includes('config') ||
		message.includes('settings') ||
		message.includes('initialization')
	) {
		return {
			error: err,
			category: ErrorCategory.CONFIGURATION,
			severity: ErrorSeverity.CRITICAL,
			message: 'Configuration error. The application may not work correctly.',
			technicalDetails: err.stack,
			recoveryActions: [
				'Run: task-master init',
				'Check .taskmaster/config.json for errors',
				'Delete .taskmaster and reinitialize if needed'
			],
			timestamp: new Date()
		};
	}

	// Unknown errors
	return {
		error: err,
		category: ErrorCategory.UNKNOWN,
		severity: ErrorSeverity.ERROR,
		message: err.message || 'An unexpected error occurred',
		technicalDetails: err.stack,
		recoveryActions: ['Report this issue to the Task Master team'],
		timestamp: new Date()
	};
}

/**
 * Get user-friendly message for file system errors
 */
function getFileSystemErrorMessage(error: Error): string {
	const message = error.message.toLowerCase();

	if (message.includes('enoent') || message.includes('no such file')) {
		return 'Required file or directory not found';
	}

	if (message.includes('eacces') || message.includes('permission denied')) {
		return 'Permission denied. Check file permissions';
	}

	if (message.includes('eisdir')) {
		return 'Expected a file but found a directory';
	}

	if (message.includes('enotdir')) {
		return 'Expected a directory but found a file';
	}

	return 'File system error occurred';
}

/**
 * Get recovery actions for file system errors
 */
function getFileSystemRecoveryActions(error: Error): string[] {
	const message = error.message.toLowerCase();

	if (message.includes('enoent') || message.includes('no such file')) {
		return [
			'Run: task-master init',
			'Verify project directory structure',
			'Check if .taskmaster directory exists'
		];
	}

	if (message.includes('eacces') || message.includes('permission denied')) {
		return [
			'Check file permissions',
			'Run with appropriate privileges',
			'Verify directory ownership'
		];
	}

	return ['Check file system integrity', 'Verify project structure'];
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(
	classified: ClassifiedError,
	includeDetails = false
): string {
	let output = `[${classified.severity.toUpperCase()}] ${classified.message}`;

	if (includeDetails && classified.technicalDetails) {
		output += `\n\nTechnical Details:\n${classified.technicalDetails}`;
	}

	if (classified.recoveryActions && classified.recoveryActions.length > 0) {
		output += '\n\nSuggested Actions:';
		for (const action of classified.recoveryActions) {
			output += `\n  - ${action}`;
		}
	}

	return output;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(classified: ClassifiedError): boolean {
	// Critical errors are not recoverable
	if (classified.severity === ErrorSeverity.CRITICAL) {
		return false;
	}

	// Info and warnings are always recoverable
	if (
		classified.severity === ErrorSeverity.INFO ||
		classified.severity === ErrorSeverity.WARNING
	) {
		return true;
	}

	// Errors are recoverable if they have recovery actions
	return (
		classified.recoveryActions !== undefined &&
		classified.recoveryActions.length > 0
	);
}

/**
 * Safe async function wrapper with error handling
 */
export async function safeAsync<T>(
	fn: () => Promise<T>,
	fallback: T,
	onError?: (error: ClassifiedError) => void
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		const classified = classifyError(error);
		if (onError) {
			onError(classified);
		}
		return fallback;
	}
}

/**
 * Safe sync function wrapper with error handling
 */
export function safeSync<T>(
	fn: () => T,
	fallback: T,
	onError?: (error: ClassifiedError) => void
): T {
	try {
		return fn();
	} catch (error) {
		const classified = classifyError(error);
		if (onError) {
			onError(classified);
		}
		return fallback;
	}
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	options: {
		maxRetries?: number;
		initialDelay?: number;
		maxDelay?: number;
		onRetry?: (attempt: number, error: Error) => void;
	} = {}
): Promise<T> {
	const {
		maxRetries = 3,
		initialDelay = 100,
		maxDelay = 5000,
		onRetry
	} = options;

	let lastError: Error;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === maxRetries) {
				throw lastError;
			}

			if (onRetry) {
				onRetry(attempt + 1, lastError);
			}

			// Exponential backoff with max delay
			const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}

/**
 * Create a safe version of a function that catches and handles errors
 */
export function makeSafe<TArgs extends any[], TReturn>(
	fn: (...args: TArgs) => TReturn,
	fallback: TReturn,
	onError?: (error: ClassifiedError) => void
): (...args: TArgs) => TReturn {
	return (...args: TArgs): TReturn => {
		return safeSync(() => fn(...args), fallback, onError);
	};
}

/**
 * Create a safe async version of a function
 */
export function makeSafeAsync<TArgs extends any[], TReturn>(
	fn: (...args: TArgs) => Promise<TReturn>,
	fallback: TReturn,
	onError?: (error: ClassifiedError) => void
): (...args: TArgs) => Promise<TReturn> {
	return async (...args: TArgs): Promise<TReturn> => {
		return safeAsync(() => fn(...args), fallback, onError);
	};
}
