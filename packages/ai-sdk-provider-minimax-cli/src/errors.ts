/**
 * Error handling utilities for Minimax CLI provider
 */
import {
  InvalidDataError,
  InvalidInputError,
  InvalidResponseDataError,
  NoSuchModelError,
  ParameterConfigurationError,
  UnexpectedStatusError,
  UnsupportedFunctionalityError,
  APICallError,
  TypeValidationError
} from '@ai-sdk/provider-utils';
import type { MinimaxCliErrorMetadata } from './types.js';

export type { MinimaxCliErrorMetadata };

/**
 * Create a general Minimax CLI error
 */
export function createMinimaxCliError({
  message,
  cause,
  code,
  data
}: {
  message: string;
  cause?: unknown;
  code?: string;
  data?: unknown;
}): Error {
  return new Error(message);
}

/**
 * Create an API call error with Minimax CLI specific metadata
 */
export function createMinimaxCliAPIError({
  message,
  statusCode,
  responseHeaders,
  url,
  requestBodyValues,
  cause
}: {
  message: string;
  statusCode: number;
  responseHeaders?: Record<string, string>;
  url: string;
  requestBodyValues?: Record<string, unknown>;
  cause?: unknown;
}): APICallError {
  const metadata: MinimaxCliErrorMetadata = {
    code: 'API_ERROR',
    message,
    details: `Status code: ${statusCode}`
  };

  return new APICallError({
    message,
    statusCode,
    url,
    responseHeaders,
    requestBodyValues,
    cause,
    data: metadata
  });
}

/**
 * Create a timeout error for Minimax CLI operations
 */
export function createMinimaxCliTimeoutError({
  message,
  timeout,
  cause
}: {
  message: string;
  timeout: number;
  cause?: unknown;
}): APICallError {
  const metadata: MinimaxCliErrorMetadata & { timeoutMs: number } = {
    code: 'TIMEOUT',
    message,
    details: `Operation timed out after ${timeout}ms`,
    timeoutMs: timeout
  };

  return new APICallError({
    message,
    statusCode: 408,
    url: 'minimax-cli://command',
    cause,
    data: metadata
  });
}

/**
 * Create a CLI installation error
 */
export function createMinimaxCliInstallationError({
  message,
  cause
}: {
  message?: string;
  cause?: unknown;
}): APICallError {
  return new APICallError({
    message:
      message ??
      'Mini-agent CLI is not installed or not found in PATH. Please install with: npm install -g @minimaxi/mini-agent',
    statusCode: 500,
    url: 'minimax-cli://installation',
    requestBodyValues: {},
    cause,
    data: {
      code: 'INSTALLATION_ERROR',
      message: message ?? 'Mini-agent CLI not found in PATH'
    } satisfies MinimaxCliErrorMetadata
  });
}

/**
 * Check if an error is a Minimax CLI installation error
 */
export function isMinimaxCliInstallationError(error: unknown): boolean {
  if (error instanceof APICallError && error.url === 'minimax-cli://installation') {
    return true;
  }
  return false;
}

/**
 * Get Minimax CLI error metadata from an error
 */
export function getMinimaxCliErrorMetadata(
  error: unknown
): MinimaxCliErrorMetadata | undefined {
  if (error instanceof APICallError) {
    return error.data as MinimaxCliErrorMetadata | undefined;
  }
  return undefined;
}

/**
 * Check if an error is a timeout error
 */
export function isMinimaxCliTimeoutError(
  error: unknown
): error is APICallError & { data: MinimaxCliErrorMetadata & { timeoutMs: number } } {
  if (error instanceof APICallError && error.url === 'minimax-cli://command') {
    return (error.data as MinimaxCliErrorMetadata)?.code === 'TIMEOUT';
  }
  return false;
}

// Re-export standard error types with Minimax CLI-specific context
export {
  InvalidDataError,
  InvalidInputError,
  InvalidResponseDataError,
  NoSuchModelError,
  ParameterConfigurationError,
  UnexpectedStatusError,
  UnsupportedFunctionalityError,
  APICallError,
  TypeValidationError
};