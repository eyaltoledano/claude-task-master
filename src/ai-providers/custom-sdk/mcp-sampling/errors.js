/**
 * @fileoverview Error handling utilities for MCP Sampling provider
 */

import { APICallError } from '@ai-sdk/provider';

/**
 * @typedef {import('./types.js').McpSamplingErrorMetadata} McpSamplingErrorMetadata
 */

/**
 * Extract error message from various error types
 * @param {Error|Object|string} error - The error to extract message from
 * @returns {string} Error message
 */
function extractErrorMessage(error) {
	if (typeof error === 'string') return error;
	if (error?.message) return error.message;
	if (error?.error?.message) return error.error.message;
	if (error?.content?.text) return error.content.text;
	return 'Unknown error occurred';
}

/**
 * Create metadata for MCP Sampling errors
 * @param {Object} options - Metadata options
 * @returns {McpSamplingErrorMetadata}
 */
function createMetadata(options = {}) {
	const metadata = {};

	if (options.sessionId) metadata.sessionId = options.sessionId;
	if (options.modelId) metadata.modelId = options.modelId;
	if (options.operation) metadata.operation = options.operation;
	if (options.timeout) metadata.timeout = options.timeout;

	return metadata;
}

/**
 * Create an API call error
 * @param {Object} options - Error options
 * @param {string} options.message - Error message
 * @param {string} [options.url] - URL where error occurred
 * @param {number} [options.statusCode] - HTTP status code
 * @param {Object} [options.responseHeaders] - Response headers
 * @param {Object} [options.responseBody] - Response body
 * @param {Object} [options.request] - Request details
 * @param {boolean} [options.isRetryable] - Whether the error is retryable
 * @param {Object} [options.data] - Additional error data
 * @param {Error} [options.cause] - Original error cause
 * @returns {APICallError}
 */
export function createAPICallError(options) {
	const message = options.message || 'MCP Sampling API call failed';
	const metadata = createMetadata(options.data);

	return new APICallError({
		message,
		url: options.url || 'mcp://sampling',
		requestBodyValues: options.request,
		statusCode: options.statusCode,
		responseHeaders: options.responseHeaders,
		responseBody: options.responseBody,
		isRetryable: options.isRetryable ?? true,
		data: metadata,
		cause: options.cause
	});
}

/**
 * Create an authentication error
 * @param {Object} options - Error options
 * @param {string} [options.message] - Custom error message
 * @param {Error} [options.cause] - Original error
 * @param {Object} [options.data] - Additional metadata
 * @returns {APICallError}
 */
export function createAuthenticationError(options = {}) {
	return createAPICallError({
		message: options.message || 'MCP session authentication failed',
		statusCode: 401,
		isRetryable: false,
		data: {
			...options.data,
			errorType: 'authentication',
			operation: options.data?.operation || 'authenticate'
		},
		cause: options.cause
	});
}

/**
 * Create a timeout error
 * @param {Object} options - Error options
 * @param {number} [options.timeout] - Timeout duration in ms
 * @param {string} [options.operation] - Operation that timed out
 * @param {Error} [options.cause] - Original error
 * @param {Object} [options.data] - Additional metadata
 * @returns {APICallError}
 */
export function createTimeoutError(options = {}) {
	const timeout = options.timeout || 120000;
	const operation = options.operation || 'request';

	return createAPICallError({
		message: `MCP Sampling ${operation} timed out after ${timeout}ms`,
		statusCode: 408,
		isRetryable: true,
		data: {
			...options.data,
			errorType: 'timeout',
			timeout,
			operation
		},
		cause: options.cause
	});
}

/**
 * Check if an error is an authentication error
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
export function isAuthenticationError(error) {
	if (error instanceof APICallError) {
		return (
			error.statusCode === 401 ||
			error.data?.errorType === 'authentication' ||
			error.message?.toLowerCase().includes('authentication') ||
			error.message?.toLowerCase().includes('session')
		);
	}
	return false;
}

/**
 * Check if an error is a timeout error
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
export function isTimeoutError(error) {
	if (error instanceof APICallError) {
		return (
			error.statusCode === 408 ||
			error.data?.errorType === 'timeout' ||
			error.message?.toLowerCase().includes('timeout') ||
			error.message?.toLowerCase().includes('timed out')
		);
	}
	return false;
}

/**
 * Get error metadata
 * @param {Error} error - Error to extract metadata from
 * @returns {McpSamplingErrorMetadata|null}
 */
export function getErrorMetadata(error) {
	if (error instanceof APICallError && error.data) {
		return error.data;
	}
	return null;
}
