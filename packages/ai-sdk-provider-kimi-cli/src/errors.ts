/**
 * Error handling utilities for Kimi CLI provider
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
import type { KimiCliErrorMetadata } from './types.js';

export type { KimiCliErrorMetadata };

/**
 * Create a general Kimi CLI error
 */
export function createKimiCliError({
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
 * Create an API call error with Kimi CLI specific metadata
 */
export function createKimiCliAPIError({
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
  const metadata: KimiCliErrorMetadata = {
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
 * Create a timeout error for Kimi CLI operations
 */
export function createKimiCliTimeoutError({
  message,
  timeout,
  cause
}: {
  message: string;
  timeout: number;
  cause?: unknown;
}): APICallError {
  const metadata: KimiCliErrorMetadata & { timeoutMs: number } = {
    code: 'TIMEOUT',
    message,
    details: `Operation timed out after ${timeout}ms`,
    timeoutMs: timeout
  };

  return new APICallError({
    message,
    statusCode: 408,
    url: 'kimi-cli://command',
    cause,
    data: metadata
  });
}

/**
 * Create a CLI installation error
 */
export function createKimiCliInstallationError({
  message,
  cause
}: {
  message?: string;
  cause?: unknown;
}): APICallError {
  return new APICallError({
    message:
      message ??
      'Kimi CLI is not installed or not found in PATH. Please install with: npm install -g @moonshot/kimi-cli',
    statusCode: 500,
    url: 'kimi-cli://installation',
    requestBodyValues: {},
    cause,
    data: {
      code: 'INSTALLATION_ERROR',
      message: message ?? 'Kimi CLI not found in PATH'
    } satisfies KimiCliErrorMetadata
  });
}

/**
 * Check if an error is a Kimi CLI installation error
 */
export function isKimiCliInstallationError(error: unknown): boolean {
  if (error instanceof APICallError && error.url === 'kimi-cli://installation') {
    return true;
  }
  return false;
}

/**
 * Get Kimi CLI error metadata from an error
 */
export function getKimiCliErrorMetadata(
  error: unknown
): KimiCliErrorMetadata | undefined {
  if (error instanceof APICallError) {
    return error.data as KimiCliErrorMetadata | undefined;
  }
  return undefined;
}

/**
 * Check if an error is a timeout error
 */
export function isKimiCliTimeoutError(
  error: unknown
): error is APICallError & { data: KimiCliErrorMetadata & { timeoutMs: number } } {
  if (error instanceof APICallError && error.url === 'kimi-cli://command') {
    return (error.data as KimiCliErrorMetadata)?.code === 'TIMEOUT';
  }
  return false;
}

// Re-export standard error types with Kimi CLI-specific context
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