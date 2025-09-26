/**
 * Error handling utilities for Grok CLI provider
 */

import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';
import type { GrokCliErrorMetadata } from './types.js';

/**
 * Parameters for creating API call errors
 */
interface CreateAPICallErrorParams {
	/** Error message */
	message: string;
	/** Error code */
	code?: string;
	/** Process exit code */
	exitCode?: number;
	/** Standard error output */
	stderr?: string;
	/** Standard output */
	stdout?: string;
	/** Excerpt of the prompt */
	promptExcerpt?: string;
	/** Whether the error is retryable */
	isRetryable?: boolean;
}

/**
 * Parameters for creating authentication errors
 */
interface CreateAuthenticationErrorParams {
	/** Error message */
	message?: string;
}

/**
 * Parameters for creating timeout errors
 */
interface CreateTimeoutErrorParams {
	/** Error message */
	message: string;
	/** Excerpt of the prompt */
	promptExcerpt?: string;
	/** Timeout in milliseconds */
	timeoutMs: number;
}

/**
 * Parameters for creating installation errors
 */
interface CreateInstallationErrorParams {
	/** Error message */
	message?: string;
}

/**
 * Create an API call error with Grok CLI specific metadata
 */
export function createAPICallError({
	message,
	code,
	exitCode,
	stderr,
	stdout,
	promptExcerpt,
	isRetryable = false
}: CreateAPICallErrorParams): APICallError {
	const metadata: GrokCliErrorMetadata = {
		code,
		exitCode,
		stderr,
		stdout,
		promptExcerpt
	};

	return new APICallError({
		message,
		isRetryable,
		url: 'grok-cli://command',
		requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : undefined,
		data: metadata
	});
}

/**
 * Create an authentication error
 */
export function createAuthenticationError({
	message
}: CreateAuthenticationErrorParams): LoadAPIKeyError {
	return new LoadAPIKeyError({
		message:
			message ||
			'Authentication failed. Please ensure Grok CLI is properly configured with API key.'
	});
}

/**
 * Create a timeout error
 */
export function createTimeoutError({
	message,
	promptExcerpt,
	timeoutMs
}: CreateTimeoutErrorParams): APICallError {
	const metadata: GrokCliErrorMetadata & { timeoutMs: number } = {
		code: 'TIMEOUT',
		promptExcerpt,
		timeoutMs
	};

	return new APICallError({
		message,
		isRetryable: true,
		url: 'grok-cli://command',
		requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : undefined,
		data: metadata
	});
}

/**
 * Create a CLI installation error
 */
export function createInstallationError({
	message
}: CreateInstallationErrorParams): APICallError {
	return new APICallError({
		message:
			message ||
			'Grok CLI is not installed or not found in PATH. Please install with: npm install -g @vibe-kit/grok-cli',
		isRetryable: false,
		url: 'grok-cli://installation',
		requestBodyValues: undefined
	});
}

/**
 * Check if an error is an authentication error
 */
export function isAuthenticationError(
	error: unknown
): error is LoadAPIKeyError {
	if (error instanceof LoadAPIKeyError) return true;
	if (error instanceof APICallError) {
		const metadata = error.data as GrokCliErrorMetadata | undefined;
		if (!metadata) return false;
		return (
			metadata.exitCode === 401 ||
			metadata.code === 'AUTHENTICATION_ERROR' ||
			metadata.code === 'UNAUTHORIZED'
		);
	}
	return false;
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is APICallError {
	if (
		error instanceof APICallError &&
		(error.data as GrokCliErrorMetadata)?.code === 'TIMEOUT'
	)
		return true;
	return false;
}

/**
 * Check if an error is an installation error
 */
export function isInstallationError(error: unknown): error is APICallError {
	if (error instanceof APICallError && error.url === 'grok-cli://installation')
		return true;
	return false;
}

/**
 * Get error metadata from an error
 */
export function getErrorMetadata(
	error: unknown
): GrokCliErrorMetadata | undefined {
	if (error instanceof APICallError && error.data) {
		return error.data as GrokCliErrorMetadata;
	}
	return undefined;
}
