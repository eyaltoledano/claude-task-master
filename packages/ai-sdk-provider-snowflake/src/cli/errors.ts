/**
 * Error handling utilities for Cortex Code CLI provider
 */

import { APICallError } from '@ai-sdk/provider';

/**
 * Error metadata for CLI operations
 */
export interface CliErrorMetadata {
	/** Error code */
	code?: string;
	/** Process exit code */
	exitCode?: number;
	/** Standard error output */
	stderr?: string;
	/** Standard output */
	stdout?: string;
	/** Excerpt of the prompt that caused the error */
	promptExcerpt?: string;
	/** Timeout value in milliseconds */
	timeoutMs?: number;
	/** Connection name that was used */
	connection?: string;
	/** The exact CLI command that was executed */
	command?: string;
	/** The full prompt/request body that was sent */
	fullPrompt?: string;
	/** The error response content from the API */
	errorResponse?: string;
}

/**
 * Creates an API call error with CLI metadata
 */
export function createAPICallError(params: {
	message: string;
	cause?: unknown;
	metadata?: CliErrorMetadata;
}): APICallError {
	return new APICallError({
		message: params.message,
		url: 'cortex-cli://local', // CLI-based, not HTTP
		requestBodyValues: params.metadata || {}, // Use metadata as request context
		cause: params.cause,
		data: params.metadata,
		isRetryable: isRetryableError(params.metadata)
	});
}

/**
 * Creates an authentication error for CLI operations
 */
export function createAuthenticationError(params: {
	message: string;
	connection?: string;
	stderr?: string;
}): APICallError {
	const metadata: CliErrorMetadata = {
		code: 'AUTHENTICATION_ERROR',
		connection: params.connection,
		stderr: params.stderr
	};

	return new APICallError({
		message: params.message,
		url: 'cortex-cli://local',
		requestBodyValues: metadata,
		data: metadata,
		isRetryable: false
	});
}

/**
 * Creates a timeout error for CLI operations
 */
export function createTimeoutError(params: {
	message: string;
	timeoutMs: number;
	promptExcerpt?: string;
}): APICallError {
	const metadata: CliErrorMetadata = {
		code: 'TIMEOUT_ERROR',
		timeoutMs: params.timeoutMs,
		promptExcerpt: params.promptExcerpt
	};

	return new APICallError({
		message: params.message,
		url: 'cortex-cli://local',
		requestBodyValues: metadata,
		data: metadata,
		isRetryable: true
	});
}

/**
 * Creates an installation error when Cortex Code is not found
 */
export function createInstallationError(params: {
	message: string;
	stderr?: string;
}): APICallError {
	const metadata: CliErrorMetadata = {
		code: 'INSTALLATION_ERROR',
		stderr: params.stderr
	};

	return new APICallError({
		message: params.message,
		url: 'cortex-cli://local',
		requestBodyValues: metadata,
		data: metadata,
		isRetryable: false
	});
}

/**
 * Creates a connection error for Snowflake connection issues
 */
export function createConnectionError(params: {
	message: string;
	connection?: string;
	stderr?: string;
}): APICallError {
	const metadata: CliErrorMetadata = {
		code: 'CONNECTION_ERROR',
		connection: params.connection,
		stderr: params.stderr
	};

	return new APICallError({
		message: params.message,
		url: 'cortex-cli://local',
		requestBodyValues: metadata,
		data: metadata,
		isRetryable: true
	});
}

/**
 * Check if an error is an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CliErrorMetadata)?.code === 'AUTHENTICATION_ERROR'
	);
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CliErrorMetadata)?.code === 'TIMEOUT_ERROR'
	);
}

/**
 * Check if an error is an installation error
 */
export function isInstallationError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CliErrorMetadata)?.code === 'INSTALLATION_ERROR'
	);
}

/**
 * Check if an error is a connection error
 */
export function isConnectionError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CliErrorMetadata)?.code === 'CONNECTION_ERROR'
	);
}

/**
 * Get error metadata from an API call error
 */
export function getErrorMetadata(error: unknown): CliErrorMetadata | null {
	if (error instanceof APICallError) {
		return (error.data as CliErrorMetadata) || null;
	}
	return null;
}

/**
 * Determine if an error is retryable based on metadata
 */
function isRetryableError(metadata?: CliErrorMetadata): boolean {
	if (!metadata) return false;

	// Network and timeout errors are retryable
	if (
		metadata.code === 'TIMEOUT_ERROR' ||
		metadata.code === 'CONNECTION_ERROR'
	) {
		return true;
	}

	// Authentication and installation errors are not retryable
	if (
		metadata.code === 'AUTHENTICATION_ERROR' ||
		metadata.code === 'INSTALLATION_ERROR'
	) {
		return false;
	}

	// Check exit codes - some are retryable
	if (metadata.exitCode !== undefined) {
		// Exit codes 124 (timeout), 137 (SIGKILL) are retryable
		return metadata.exitCode === 124 || metadata.exitCode === 137;
	}

	return false;
}

/**
 * Parse stderr output to identify specific error types
 */
export function parseErrorFromStderr(stderr: string): {
	type: 'authentication' | 'connection' | 'timeout' | 'unknown';
	message: string;
} {
	const lowerStderr = stderr.toLowerCase();

	// Authentication errors
	if (
		lowerStderr.includes('authentication failed') ||
		lowerStderr.includes('invalid credentials') ||
		lowerStderr.includes('unauthorized') ||
		lowerStderr.includes('401')
	) {
		return {
			type: 'authentication',
			message: 'Authentication failed. Check your Snowflake connection credentials.'
		};
	}

	// Connection errors
	if (
		lowerStderr.includes('connection refused') ||
		lowerStderr.includes('could not connect') ||
		lowerStderr.includes('network error') ||
		lowerStderr.includes('econnrefused')
	) {
		return {
			type: 'connection',
			message: 'Could not connect to Snowflake. Check your network and connection settings.'
		};
	}

	// Timeout errors
	if (
		lowerStderr.includes('timeout') ||
		lowerStderr.includes('timed out') ||
		lowerStderr.includes('deadline exceeded')
	) {
		return {
			type: 'timeout',
			message: 'Operation timed out. Consider increasing the timeout setting.'
		};
	}

	return {
		type: 'unknown',
		message: stderr.trim()
	};
}

