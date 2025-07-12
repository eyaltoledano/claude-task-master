/**
 * src/ai-providers/custom-sdk/mcp/errors.js
 *
 * Error handling utilities for MCP AI SDK provider.
 * Maps MCP errors to AI SDK compatible error types.
 */

/**
 * MCP-specific error class
 */
export class MCPError extends Error {
	constructor(message, options = {}) {
		super(message);
		this.name = 'MCPError';
		this.code = options.code;
		this.cause = options.cause;
		this.mcpResponse = options.mcpResponse;
	}
}

/**
 * Session-related error
 */
export class MCPSessionError extends MCPError {
	constructor(message, options = {}) {
		super(message, options);
		this.name = 'MCPSessionError';
	}
}

/**
 * Sampling-related error
 */
export class MCPSamplingError extends MCPError {
	constructor(message, options = {}) {
		super(message, options);
		this.name = 'MCPSamplingError';
	}
}

/**
 * Map MCP errors to AI SDK compatible error types
 * @param {Error} error - Original error
 * @returns {Error} Mapped error
 */
export function mapMCPError(error) {
	// If already an MCP error, return as-is
	if (error instanceof MCPError) {
		return error;
	}

	const message = error.message || 'Unknown MCP error';
	const originalError = error;

	// Map common error patterns
	if (message.includes('session') || message.includes('connection')) {
		return new MCPSessionError(message, {
			cause: originalError,
			code: 'SESSION_ERROR'
		});
	}

	if (message.includes('sampling') || message.includes('timeout')) {
		return new MCPSamplingError(message, {
			cause: originalError,
			code: 'SAMPLING_ERROR'
		});
	}

	if (message.includes('capabilities') || message.includes('not supported')) {
		return new MCPSessionError(message, {
			cause: originalError,
			code: 'CAPABILITY_ERROR'
		});
	}

	// Default to generic MCP error
	return new MCPError(message, {
		cause: originalError,
		code: 'UNKNOWN_ERROR'
	});
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error might be retryable
 */
export function isRetryableError(error) {
	if (error instanceof MCPSamplingError && error.code === 'SAMPLING_ERROR') {
		return true;
	}

	if (error instanceof MCPSessionError && error.code === 'SESSION_ERROR') {
		// Session errors are generally not retryable
		return false;
	}

	// Check for common retryable patterns
	const message = error.message?.toLowerCase() || '';
	return (
		message.includes('timeout') ||
		message.includes('network') ||
		message.includes('temporary')
	);
}
