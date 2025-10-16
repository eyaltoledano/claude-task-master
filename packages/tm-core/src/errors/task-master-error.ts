/**
 * @fileoverview Base error class for Task Master operations
 * Provides comprehensive error handling with metadata, context, and serialization support
 */

/**
 * Error codes used throughout the Task Master system
 */
export const ERROR_CODES = {
	// File system errors
	FILE_NOT_FOUND: 'FILE_NOT_FOUND',
	FILE_READ_ERROR: 'FILE_READ_ERROR',
	FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',

	// Parsing errors
	PARSE_ERROR: 'PARSE_ERROR',
	JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
	YAML_PARSE_ERROR: 'YAML_PARSE_ERROR',

	// Validation errors
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
	TYPE_VALIDATION_ERROR: 'TYPE_VALIDATION_ERROR',

	// API and network errors
	API_ERROR: 'API_ERROR',
	NETWORK_ERROR: 'NETWORK_ERROR',
	AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
	AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',

	// Task management errors
	TASK_NOT_FOUND: 'TASK_NOT_FOUND',
	TASK_DEPENDENCY_ERROR: 'TASK_DEPENDENCY_ERROR',
	TASK_STATUS_ERROR: 'TASK_STATUS_ERROR',

	// Storage errors
	STORAGE_ERROR: 'STORAGE_ERROR',
	DATABASE_ERROR: 'DATABASE_ERROR',

	// Configuration errors
	CONFIG_ERROR: 'CONFIG_ERROR',
	MISSING_CONFIGURATION: 'MISSING_CONFIGURATION',
	INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',

	// Provider errors
	PROVIDER_ERROR: 'PROVIDER_ERROR',
	PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
	PROVIDER_INITIALIZATION_ERROR: 'PROVIDER_INITIALIZATION_ERROR',

	// Generic errors
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	INVALID_INPUT: 'INVALID_INPUT',
	NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
	UNKNOWN_ERROR: 'UNKNOWN_ERROR',
	NOT_FOUND: 'NOT_FOUND',

	// Context errors
	NO_BRIEF_SELECTED: 'NO_BRIEF_SELECTED'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Error context interface for additional error metadata
 */
export interface ErrorContext {
	/** Additional details about the error */
	details?: any;
	/** Error timestamp */
	timestamp?: Date;
	/** Operation that failed */
	operation?: string;
	/** Resource identifier related to the error */
	resource?: string;
	/** Stack of operations leading to the error */
	operationStack?: string[];
	/** User-safe message for display */
	userMessage?: string;
	/** Internal error identifier for debugging */
	errorId?: string;
	/** Additional metadata */
	metadata?: Record<string, any>;
	/** Allow additional properties for flexibility */
	[key: string]: any;
}

/**
 * Serializable error representation
 */
export interface SerializableError {
	name: string;
	message: string;
	code: string;
	context: ErrorContext;
	stack?: string;
	cause?: SerializableError;
}

/**
 * Base error class for all Task Master operations
 *
 * Provides comprehensive error handling with:
 * - Error codes for programmatic handling
 * - Rich context and metadata support
 * - Error chaining with cause property
 * - Serialization for logging and transport
 * - Sanitization for user-facing messages
 *
 * @example
 * ```typescript
 * try {
 *   // Some operation that might fail
 *   throw new TaskMasterError(
 *     'Failed to parse task file',
 *     ERROR_CODES.PARSE_ERROR,
 *     {
 *       details: { filename: 'tasks.json', line: 42 },
 *       operation: 'parseTaskFile',
 *       userMessage: 'There was an error reading your task file'
 *     }
 *   );
 * } catch (error) {
 *   console.error(error.toJSON());
 *   throw new TaskMasterError(
 *     'Operation failed',
 *     ERROR_CODES.INTERNAL_ERROR,
 *     { operation: 'processTask' },
 *     error
 *   );
 * }
 * ```
 */
export class TaskMasterError extends Error {
	/** Error code for programmatic handling */
	public readonly code: string;

	/** Rich context and metadata */
	public readonly context: ErrorContext;

	/** Original error that caused this error (for error chaining) */
	public readonly cause?: Error;

	/** Timestamp when error was created */
	public readonly timestamp: Date;

	/**
	 * Create a new TaskMasterError
	 *
	 * @param message - Human-readable error message
	 * @param code - Error code from ERROR_CODES
	 * @param context - Additional error context and metadata
	 * @param cause - Original error that caused this error (for chaining)
	 */
	constructor(
		message: string,
		code: string = ERROR_CODES.UNKNOWN_ERROR,
		context: ErrorContext = {},
		cause?: Error
	) {
		super(message);

		// Set error name
		this.name = 'TaskMasterError';

		// Set properties
		this.code = code;
		this.cause = cause;
		this.timestamp = new Date();

		// Merge context with defaults
		this.context = {
			timestamp: this.timestamp,
			...context
		};

		// Fix prototype chain for proper instanceof checks
		Object.setPrototypeOf(this, TaskMasterError.prototype);

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, TaskMasterError);
		}

		// If we have a cause error, append its stack trace
		if (cause?.stack) {
			this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
		}
	}

	/**
	 * Get a user-friendly error message
	 * Falls back to the main message if no user message is provided
	 */
	public getUserMessage(): string {
		return this.context.userMessage || this.message;
	}

	/**
	 * Get sanitized error details safe for user display
	 * Removes sensitive information and internal details
	 */
	public getSanitizedDetails(): Record<string, any> {
		const { details, resource, operation } = this.context;

		return {
			code: this.code,
			message: this.getUserMessage(),
			...(resource && { resource }),
			...(operation && { operation }),
			...(details &&
				typeof details === 'object' &&
				!this.containsSensitiveInfo(details) && { details })
		};
	}

	/**
	 * Check if error details contain potentially sensitive information
	 */
	private containsSensitiveInfo(obj: any): boolean {
		if (typeof obj !== 'object' || obj === null) return false;

		const sensitiveKeys = [
			'password',
			'token',
			'key',
			'secret',
			'auth',
			'credential'
		];
		const objString = JSON.stringify(obj).toLowerCase();

		return sensitiveKeys.some((key) => objString.includes(key));
	}

	/**
	 * Convert error to JSON for serialization
	 * Includes all error information for logging and debugging
	 */
	public toJSON(): SerializableError {
		const result: SerializableError = {
			name: this.name,
			message: this.message,
			code: this.code,
			context: this.context,
			stack: this.stack
		};

		// Include serialized cause if present
		if (this.cause) {
			if (this.cause instanceof TaskMasterError) {
				result.cause = this.cause.toJSON();
			} else {
				result.cause = {
					name: this.cause.name,
					message: this.cause.message,
					code: ERROR_CODES.UNKNOWN_ERROR,
					context: {},
					stack: this.cause.stack
				};
			}
		}

		return result;
	}

	/**
	 * Convert error to string representation
	 * Provides formatted output for logging and debugging
	 */
	public toString(): string {
		let result = `${this.name}[${this.code}]: ${this.message}`;

		if (this.context.operation) {
			result += ` (operation: ${this.context.operation})`;
		}

		if (this.context.resource) {
			result += ` (resource: ${this.context.resource})`;
		}

		if (this.cause) {
			result += `\nCaused by: ${this.cause.toString()}`;
		}

		return result;
	}

	/**
	 * Check if this error is of a specific code
	 */
	public is(code: string): boolean {
		return this.code === code;
	}

	/**
	 * Check if this error or any error in its cause chain is of a specific code
	 */
	public hasCode(code: string): boolean {
		if (this.is(code)) return true;

		if (this.cause instanceof TaskMasterError) {
			return this.cause.hasCode(code);
		}

		return false;
	}

	/**
	 * Create a new error with additional context
	 */
	public withContext(
		additionalContext: Partial<ErrorContext>
	): TaskMasterError {
		return new TaskMasterError(
			this.message,
			this.code,
			{ ...this.context, ...additionalContext },
			this.cause
		);
	}

	/**
	 * Create a new error wrapping this one as the cause
	 */
	public wrap(
		message: string,
		code: string = ERROR_CODES.INTERNAL_ERROR,
		context: ErrorContext = {}
	): TaskMasterError {
		return new TaskMasterError(message, code, context, this);
	}
}
