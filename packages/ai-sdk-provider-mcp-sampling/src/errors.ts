/**
 * Error classes and utilities for MCP Sampling provider
 */

import {
	APICallError,
	LoadAPIKeyError,
	NoSuchModelError
} from '@ai-sdk/provider';

export interface MCPSamplingErrorOptions {
	message?: string;
	cause?: unknown;
	session?: unknown;
	responseData?: unknown;
	isRetryable?: boolean;
}

export class MCPSamplingError extends Error {
	constructor(message: string, public readonly options: MCPSamplingErrorOptions = {}) {
		super(message);
		this.name = 'MCPSamplingError';
	}
}

export function createMCPAPICallError(
	options: MCPSamplingErrorOptions & {
		statusCode?: number;
		responseHeaders?: Record<string, string>;
	}
): APICallError {
	return new APICallError({
		message: options.message || 'MCP API call failed',
		cause: options.cause,
		data: options.responseData,
		isRetryable: options.isRetryable ?? false,
		responseHeaders: options.responseHeaders,
		statusCode: options.statusCode
	});
}

export function createMCPAuthenticationError(
	options: MCPSamplingErrorOptions = {}
): LoadAPIKeyError {
	return new LoadAPIKeyError({
		message: options.message || 'MCP session authentication failed'
	});
}

export function createMCPSessionError(
	options: MCPSamplingErrorOptions = {}
): MCPSamplingError {
	return new MCPSamplingError(
		options.message || 'MCP session error',
		options
	);
}

export function mapMCPError(error: unknown): Error {
	if (error instanceof MCPSamplingError) {
		return error;
	}

	if (error instanceof Error) {
		// Map common MCP errors to appropriate AI SDK errors
		if (error.message.includes('unauthorized') || 
			error.message.includes('authentication')) {
			return createMCPAuthenticationError({
				message: `MCP authentication failed: ${error.message}`,
				cause: error
			});
		}

		if (error.message.includes('timeout') || 
			error.message.includes('timed out')) {
			return createMCPAPICallError({
				message: `MCP request timed out: ${error.message}`,
				cause: error,
				isRetryable: true
			});
		}

		if (error.message.includes('model') && 
			error.message.includes('not found')) {
			return new NoSuchModelError({
				modelId: 'unknown',
				modelType: 'languageModel'
			});
		}

		return createMCPAPICallError({
			message: `MCP API error: ${error.message}`,
			cause: error,
			isRetryable: false
		});
	}

	return createMCPAPICallError({
		message: 'Unknown MCP error occurred',
		cause: error,
		isRetryable: false
	});
}