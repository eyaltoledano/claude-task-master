/**
 * @fileoverview Error handling utilities for Grok CLI provider
 */

import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';

/**
 * @typedef {import('./types.js').GrokCliErrorMetadata} GrokCliErrorMetadata
 */

/**
 * Create an API call error with Grok CLI specific metadata
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @param {string} [params.code] - Error code
 * @param {number} [params.exitCode] - Process exit code
 * @param {string} [params.stderr] - Standard error output
 * @param {string} [params.stdout] - Standard output
 * @param {string} [params.promptExcerpt] - Excerpt of the prompt
 * @param {boolean} [params.isRetryable=false] - Whether the error is retryable
 * @returns {APICallError}
 */
export function createAPICallError({
	message,
	code,
	exitCode,
	stderr,
	stdout,
	promptExcerpt,
	isRetryable = false
}) {
	/** @type {GrokCliErrorMetadata} */
	const metadata = {
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
 * @param {Object} params - Error parameters
 * @param {string} params.message - Error message
 * @returns {LoadAPIKeyError}
 */
export function createAuthenticationError({ message }) {
	return new LoadAPIKeyError({
		message:
			message ||
			'Authentication failed. Please ensure Grok CLI is properly configured with API key.'
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
	/** @type {GrokCliErrorMetadata & { timeoutMs: number }} */
	const metadata = {
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
 * @param {Object} params - Error parameters
 * @param {string} [params.message] - Error message
 * @returns {APICallError}
 */
export function createInstallationError({ message }) {
	return new APICallError({
		message:
			message ||
			'Grok CLI is not installed or not found in PATH. Please install with: npm install -g @vibe-kit/grok-cli',
		isRetryable: false,
		url: 'grok-cli://installation'
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
		/** @type {GrokCliErrorMetadata} */ (error.data)?.exitCode === 401
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
		/** @type {GrokCliErrorMetadata} */ (error.data)?.code === 'TIMEOUT'
	)
		return true;
	return false;
}

/**
 * Check if an error is an installation error
 * @param {unknown} error - Error to check
 * @returns {boolean}
 */
export function isInstallationError(error) {
	if (error instanceof APICallError && error.url === 'grok-cli://installation')
		return true;
	return false;
}

/**
 * Get error metadata from an error
 * @param {unknown} error - Error to extract metadata from
 * @returns {GrokCliErrorMetadata|undefined}
 */
export function getErrorMetadata(error) {
	if (error instanceof APICallError && error.data) {
		return /** @type {GrokCliErrorMetadata} */ (error.data);
	}
	return undefined;
}