/**
 * @fileoverview Error handling utilities for Claude Code provider
 */

import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';

/**
 * @typedef {import('./types.js').ClaudeCodeErrorMetadata} ClaudeCodeErrorMetadata
 */

/**
 * Create an API call error with Claude Code specific metadata
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {string} [params.code] - Error code
 * @param {number} [params.exitCode] - Process exit code
 * @param {string} [params.stderr] - Standard error output
 * @param {string} [params.promptExcerpt] - Excerpt of the prompt
 * @param {boolean} [params.isRetryable=false] - Whether the error is retryable
 * @returns {APICallError}
 */
export function createAPICallError({
	message,
	code,
	exitCode,
	stderr,
	promptExcerpt,
	isRetryable = false
}) {
	/** @type {ClaudeCodeErrorMetadata} */
	const metadata = {
		code,
		exitCode,
		stderr,
		promptExcerpt
	};

	return new APICallError({
		message,
		isRetryable,
		url: 'claude-code-cli://command',
		requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : undefined,
		data: metadata
	});
}

/**
 * Create an authentication error
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @returns {LoadAPIKeyError}
 */
export function createAuthenticationError({ message }) {
	return new LoadAPIKeyError({
		message:
			message ||
			'Authentication failed. Please ensure Claude Code CLI is properly authenticated.'
	});
}

/**
 * Create a timeout error
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {string} [params.promptExcerpt] - Excerpt of the prompt
 * @param {number} params.timeoutMs - Timeout in milliseconds
 * @returns {APICallError}
 */
export function createTimeoutError({ message, promptExcerpt, timeoutMs }) {
	// Store timeoutMs in metadata for potential use by error handlers
	/** @type {ClaudeCodeErrorMetadata & { timeoutMs: number }} */
	const metadata = {
		code: 'TIMEOUT',
		promptExcerpt,
		timeoutMs
	};

	return new APICallError({
		message,
		isRetryable: true,
		url: 'claude-code-cli://command',
		requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : undefined,
		data: metadata
	});
}

/**
 * Check if an error is an authentication error
 * @param {unknown} error - Error to check
 * @returns {boolean}
 */
export function isAuthenticationError(error) {
	if (error instanceof LoadAPIKeyError) return true;
	if (
		error instanceof APICallError &&
		/** @type {ClaudeCodeErrorMetadata} */ (error.data)?.exitCode === 401
	)
		return true;
	return false;
}

/**
 * Check if an error is a timeout error
 * @param {unknown} error - Error to check
 * @returns {boolean}
 */
export function isTimeoutError(error) {
	if (
		error instanceof APICallError &&
		/** @type {ClaudeCodeErrorMetadata} */ (error.data)?.code === 'TIMEOUT'
	)
		return true;
	return false;
}

/**
 * Get error metadata from an error
 * @param {unknown} error - Error to extract metadata from
 * @returns {ClaudeCodeErrorMetadata|undefined}
 */
export function getErrorMetadata(error) {
	if (error instanceof APICallError && error.data) {
		return /** @type {ClaudeCodeErrorMetadata} */ (error.data);
	}
	return undefined;
}
