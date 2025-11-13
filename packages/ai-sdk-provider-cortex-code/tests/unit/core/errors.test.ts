/**
 * Unit tests for error handling utilities
 */

import { describe, it, expect } from '@jest/globals';
import { APICallError } from '@ai-sdk/provider';
import {
	createAPICallError,
	createAuthenticationError,
	createTimeoutError,
	createInstallationError,
	createConnectionError,
	isAuthenticationError,
	isTimeoutError,
	isInstallationError,
	isConnectionError,
	getErrorMetadata,
	parseErrorFromStderr
} from '../../../src/core/errors.js';

describe('Error Creation Functions', () => {
	describe('createAPICallError', () => {
		it('should create an API call error with basic message', () => {
			const error = createAPICallError({
				message: 'Test error'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('Test error');
			expect(error.url).toBe('cortex-cli://local');
		});

		it('should include metadata in error', () => {
			const metadata = {
				code: 'TEST_ERROR' as const,
				exitCode: 1,
				stderr: 'Error output'
			};

			const error = createAPICallError({
				message: 'Test error',
				metadata
			});

			expect(error.data).toEqual(metadata);
		});

		it('should set isRetryable based on metadata', () => {
			const timeoutError = createAPICallError({
				message: 'Timeout',
				metadata: { code: 'TIMEOUT_ERROR', timeoutMs: 5000 }
			});

			const authError = createAPICallError({
				message: 'Auth failed',
				metadata: { code: 'AUTHENTICATION_ERROR' }
			});

			expect(timeoutError.isRetryable).toBe(true);
			expect(authError.isRetryable).toBe(false);
		});
	});

	describe('createAuthenticationError', () => {
		it('should create authentication error with correct metadata', () => {
			const error = createAuthenticationError({
				message: 'Auth failed',
				connection: 'my_connection',
				stderr: 'Invalid credentials'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('Auth failed');
			expect(error.isRetryable).toBe(false);
			expect(error.data).toEqual({
				code: 'AUTHENTICATION_ERROR',
				connection: 'my_connection',
				stderr: 'Invalid credentials'
			});
		});

		it('should work without optional parameters', () => {
			const error = createAuthenticationError({
				message: 'Auth failed'
			});

			expect(error.data).toEqual({
				code: 'AUTHENTICATION_ERROR',
				connection: undefined,
				stderr: undefined
			});
		});
	});

	describe('createTimeoutError', () => {
		it('should create timeout error with correct metadata', () => {
			const error = createTimeoutError({
				message: 'Operation timed out',
				timeoutMs: 30000,
				promptExcerpt: 'Generate a story...'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('Operation timed out');
			expect(error.isRetryable).toBe(true);
			expect(error.data).toEqual({
				code: 'TIMEOUT_ERROR',
				timeoutMs: 30000,
				promptExcerpt: 'Generate a story...'
			});
		});
	});

	describe('createInstallationError', () => {
		it('should create installation error with correct metadata', () => {
			const error = createInstallationError({
				message: 'CLI not found',
				stderr: 'cortex: command not found'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('CLI not found');
			expect(error.isRetryable).toBe(false);
			expect(error.data).toEqual({
				code: 'INSTALLATION_ERROR',
				stderr: 'cortex: command not found'
			});
		});
	});

	describe('createConnectionError', () => {
		it('should create connection error with correct metadata', () => {
			const error = createConnectionError({
				message: 'Connection refused',
				connection: 'my_connection',
				stderr: 'ECONNREFUSED'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('Connection refused');
			expect(error.isRetryable).toBe(true);
			expect(error.data).toEqual({
				code: 'CONNECTION_ERROR',
				connection: 'my_connection',
				stderr: 'ECONNREFUSED'
			});
		});
	});
});

describe('Error Type Guards', () => {
	describe('isAuthenticationError', () => {
		it('should return true for authentication errors', () => {
			const error = createAuthenticationError({
				message: 'Auth failed'
			});

			expect(isAuthenticationError(error)).toBe(true);
		});

		it('should return false for other error types', () => {
			const timeoutError = createTimeoutError({
				message: 'Timeout',
				timeoutMs: 5000
			});

			expect(isAuthenticationError(timeoutError)).toBe(false);
			expect(isAuthenticationError(new Error('Regular error'))).toBe(false);
			expect(isAuthenticationError(null)).toBe(false);
		});
	});

	describe('isTimeoutError', () => {
		it('should return true for timeout errors', () => {
			const error = createTimeoutError({
				message: 'Timeout',
				timeoutMs: 5000
			});

			expect(isTimeoutError(error)).toBe(true);
		});

		it('should return false for other error types', () => {
			const authError = createAuthenticationError({
				message: 'Auth failed'
			});

			expect(isTimeoutError(authError)).toBe(false);
		});
	});

	describe('isInstallationError', () => {
		it('should return true for installation errors', () => {
			const error = createInstallationError({
				message: 'CLI not found'
			});

			expect(isInstallationError(error)).toBe(true);
		});

		it('should return false for other error types', () => {
			const authError = createAuthenticationError({
				message: 'Auth failed'
			});

			expect(isInstallationError(authError)).toBe(false);
		});
	});

	describe('isConnectionError', () => {
		it('should return true for connection errors', () => {
			const error = createConnectionError({
				message: 'Connection refused'
			});

			expect(isConnectionError(error)).toBe(true);
		});

		it('should return false for other error types', () => {
			const authError = createAuthenticationError({
				message: 'Auth failed'
			});

			expect(isConnectionError(authError)).toBe(false);
		});
	});
});

describe('getErrorMetadata', () => {
	it('should extract metadata from API call errors', () => {
		const error = createAuthenticationError({
			message: 'Auth failed',
			connection: 'my_connection'
		});

		const metadata = getErrorMetadata(error);

		expect(metadata).toEqual({
			code: 'AUTHENTICATION_ERROR',
			connection: 'my_connection',
			stderr: undefined
		});
	});

	it('should return null for non-API call errors', () => {
		expect(getErrorMetadata(new Error('Regular error'))).toBeNull();
		expect(getErrorMetadata(null)).toBeNull();
		expect(getErrorMetadata(undefined)).toBeNull();
	});
});

describe('parseErrorFromStderr', () => {
	describe('Authentication errors', () => {
		it('should detect authentication failed', () => {
			const result = parseErrorFromStderr('Authentication failed: invalid password');

			expect(result.type).toBe('authentication');
			expect(result.message).toContain('Authentication failed');
		});

		it('should detect invalid credentials', () => {
			const result = parseErrorFromStderr('Error: Invalid credentials provided');

			expect(result.type).toBe('authentication');
		});

		it('should detect unauthorized', () => {
			const result = parseErrorFromStderr('Unauthorized access');

			expect(result.type).toBe('authentication');
		});

		it('should detect 401 status', () => {
			const result = parseErrorFromStderr('HTTP 401 error');

			expect(result.type).toBe('authentication');
		});
	});

	describe('Connection errors', () => {
		it('should detect connection refused', () => {
			const result = parseErrorFromStderr('Connection refused by server');

			expect(result.type).toBe('connection');
			expect(result.message).toContain('Could not connect');
		});

		it('should detect could not connect', () => {
			const result = parseErrorFromStderr('Could not connect to database');

			expect(result.type).toBe('connection');
		});

		it('should detect network error', () => {
			const result = parseErrorFromStderr('Network error occurred');

			expect(result.type).toBe('connection');
		});

		it('should detect ECONNREFUSED', () => {
			const result = parseErrorFromStderr('Error: ECONNREFUSED');

			expect(result.type).toBe('connection');
		});
	});

	describe('Timeout errors', () => {
		it('should detect timeout', () => {
			const result = parseErrorFromStderr('Operation timeout');

			expect(result.type).toBe('timeout');
			expect(result.message).toContain('timed out');
		});

		it('should detect timed out', () => {
			const result = parseErrorFromStderr('Request timed out after 30s');

			expect(result.type).toBe('timeout');
		});

		it('should detect deadline exceeded', () => {
			const result = parseErrorFromStderr('Deadline exceeded');

			expect(result.type).toBe('timeout');
		});
	});

	describe('Unknown errors', () => {
		it('should return unknown type for unrecognized errors', () => {
			const stderr = 'Some random error message';
			const result = parseErrorFromStderr(stderr);

			expect(result.type).toBe('unknown');
			expect(result.message).toBe(stderr);
		});

		it('should trim whitespace from unknown error messages', () => {
			const result = parseErrorFromStderr('  Error message  \n');

			expect(result.type).toBe('unknown');
			expect(result.message).toBe('Error message');
		});
	});

	describe('Case insensitivity', () => {
		it('should detect errors regardless of case', () => {
			expect(parseErrorFromStderr('AUTHENTICATION FAILED').type).toBe('authentication');
			expect(parseErrorFromStderr('Connection Refused').type).toBe('connection');
			expect(parseErrorFromStderr('TIMEOUT').type).toBe('timeout');
		});
	});
});

describe('Error Retryability', () => {
	it('should mark timeout errors as retryable', () => {
		const error = createTimeoutError({
			message: 'Timeout',
			timeoutMs: 5000
		});

		expect(error.isRetryable).toBe(true);
	});

	it('should mark connection errors as retryable', () => {
		const error = createConnectionError({
			message: 'Connection refused'
		});

		expect(error.isRetryable).toBe(true);
	});

	it('should mark authentication errors as non-retryable', () => {
		const error = createAuthenticationError({
			message: 'Auth failed'
		});

		expect(error.isRetryable).toBe(false);
	});

	it('should mark installation errors as non-retryable', () => {
		const error = createInstallationError({
			message: 'CLI not found'
		});

		expect(error.isRetryable).toBe(false);
	});

	it('should handle exit code 124 (timeout) as retryable', () => {
		const error = createAPICallError({
			message: 'Process timeout',
			metadata: { exitCode: 124 }
		});

		expect(error.isRetryable).toBe(true);
	});

	it('should handle exit code 137 (SIGKILL) as retryable', () => {
		const error = createAPICallError({
			message: 'Process killed',
			metadata: { exitCode: 137 }
		});

		expect(error.isRetryable).toBe(true);
	});

	it('should handle other exit codes as non-retryable', () => {
		const error = createAPICallError({
			message: 'Process failed',
			metadata: { exitCode: 1 }
		});

		expect(error.isRetryable).toBe(false);
	});
});

