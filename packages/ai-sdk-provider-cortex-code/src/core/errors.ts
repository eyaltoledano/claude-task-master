/**
 * Error handling utilities for Cortex Code CLI provider
 */

import { APICallError } from '@ai-sdk/provider';
import type { CortexCodeErrorMetadata } from './types.js';

/**
 * Creates an API call error with Cortex Code CLI metadata
 */
export function createAPICallError(params: {
	message: string;
	cause?: unknown;
	metadata?: CortexCodeErrorMetadata;
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
 * Creates an authentication error for Cortex Code CLI
 */
export function createAuthenticationError(params: {
	message: string;
	connection?: string;
	stderr?: string;
}): APICallError {
	const metadata: CortexCodeErrorMetadata = {
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
 * Creates a timeout error for Cortex Code CLI operations
 */
export function createTimeoutError(params: {
	message: string;
	timeoutMs: number;
	promptExcerpt?: string;
}): APICallError {
	const metadata: CortexCodeErrorMetadata = {
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
	const metadata: CortexCodeErrorMetadata = {
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
	const metadata: CortexCodeErrorMetadata = {
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
		(error.data as CortexCodeErrorMetadata)?.code === 'AUTHENTICATION_ERROR'
	);
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CortexCodeErrorMetadata)?.code === 'TIMEOUT_ERROR'
	);
}

/**
 * Check if an error is an installation error
 */
export function isInstallationError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CortexCodeErrorMetadata)?.code === 'INSTALLATION_ERROR'
	);
}

/**
 * Check if an error is a connection error
 */
export function isConnectionError(error: unknown): boolean {
	return (
		error instanceof APICallError &&
		(error.data as CortexCodeErrorMetadata)?.code === 'CONNECTION_ERROR'
	);
}

/**
 * Get error metadata from an API call error
 */
export function getErrorMetadata(
	error: unknown
): CortexCodeErrorMetadata | null {
	if (error instanceof APICallError) {
		return (error.data as CortexCodeErrorMetadata) || null;
	}
	return null;
}

/**
 * Determine if an error is retryable based on metadata
 */
function isRetryableError(metadata?: CortexCodeErrorMetadata): boolean {
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

