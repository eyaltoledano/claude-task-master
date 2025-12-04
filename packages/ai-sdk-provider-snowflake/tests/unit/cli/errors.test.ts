/**
 * Unit tests for CLI error utilities
 * Target: 90%+ coverage for src/cli/errors.ts
 */

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
	parseErrorFromStderr,
	type CliErrorMetadata
} from '../../../src/cli/errors.js';

describe('CLI Error Utilities', () => {
	describe('createAPICallError', () => {
		it.concurrent('should create APICallError with message', async () => {
			const error = createAPICallError({
				message: 'Test error message'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('Test error message');
		});

		it.concurrent('should create APICallError with metadata', async () => {
			const metadata: CliErrorMetadata = {
				code: 'TEST_ERROR',
				exitCode: 1,
				stderr: 'Some error output',
				stdout: 'Some output',
				promptExcerpt: 'Test prompt...',
				timeoutMs: 30000,
				connection: 'default'
			};

			const error = createAPICallError({
				message: 'Test with metadata',
				metadata
			});

			expect(error.data).toEqual(metadata);
		});

		it.concurrent('should create APICallError with cause', async () => {
			const cause = new Error('Original error');
			const error = createAPICallError({
				message: 'Wrapped error',
				cause
			});

			expect(error.cause).toBe(cause);
		});

		it.concurrent('should set URL to cortex-cli://local', async () => {
			const error = createAPICallError({ message: 'Test' });
			expect(error.url).toBe('cortex-cli://local');
		});

		it.concurrent('should mark timeout errors as retryable', async () => {
			const error = createAPICallError({
				message: 'Timeout',
				metadata: { code: 'TIMEOUT_ERROR' }
			});

			expect(error.isRetryable).toBe(true);
		});

		it.concurrent('should mark connection errors as retryable', async () => {
			const error = createAPICallError({
				message: 'Connection failed',
				metadata: { code: 'CONNECTION_ERROR' }
			});

			expect(error.isRetryable).toBe(true);
		});

		it.concurrent('should mark auth errors as not retryable', async () => {
			const error = createAPICallError({
				message: 'Auth failed',
				metadata: { code: 'AUTHENTICATION_ERROR' }
			});

			expect(error.isRetryable).toBe(false);
		});

		it.concurrent('should mark installation errors as not retryable', async () => {
			const error = createAPICallError({
				message: 'Not installed',
				metadata: { code: 'INSTALLATION_ERROR' }
			});

			expect(error.isRetryable).toBe(false);
		});

		it.concurrent('should mark exit code 124 (timeout) as retryable', async () => {
			const error = createAPICallError({
				message: 'Process timed out',
				metadata: { exitCode: 124 }
			});

			expect(error.isRetryable).toBe(true);
		});

		it.concurrent('should mark exit code 137 (SIGKILL) as retryable', async () => {
			const error = createAPICallError({
				message: 'Process killed',
				metadata: { exitCode: 137 }
			});

			expect(error.isRetryable).toBe(true);
		});

		it.concurrent('should mark other exit codes as not retryable', async () => {
			const error = createAPICallError({
				message: 'Process failed',
				metadata: { exitCode: 1 }
			});

			expect(error.isRetryable).toBe(false);
		});

		it.concurrent('should mark errors without metadata as not retryable', async () => {
			const error = createAPICallError({ message: 'No metadata' });
			expect(error.isRetryable).toBe(false);
		});
	});

	describe('createAuthenticationError', () => {
		it.concurrent('should create error with AUTHENTICATION_ERROR code', async () => {
			const error = createAuthenticationError({
				message: 'Auth failed'
			});

			expect(error).toBeInstanceOf(APICallError);
			expect((error.data as CliErrorMetadata)?.code).toBe('AUTHENTICATION_ERROR');
		});

		it.concurrent('should include connection name in metadata', async () => {
			const error = createAuthenticationError({
				message: 'Auth failed',
				connection: 'myconn'
			});

			expect((error.data as CliErrorMetadata)?.connection).toBe('myconn');
		});

		it.concurrent('should include stderr in metadata', async () => {
			const error = createAuthenticationError({
				message: 'Auth failed',
				stderr: 'Invalid credentials'
			});

			expect((error.data as CliErrorMetadata)?.stderr).toBe('Invalid credentials');
		});

		it.concurrent('should not be retryable', async () => {
			const error = createAuthenticationError({ message: 'Auth failed' });
			expect(error.isRetryable).toBe(false);
		});
	});

	describe('createTimeoutError', () => {
		it.concurrent('should create error with TIMEOUT_ERROR code', async () => {
			const error = createTimeoutError({
				message: 'Request timed out',
				timeoutMs: 30000
			});

			expect((error.data as CliErrorMetadata)?.code).toBe('TIMEOUT_ERROR');
		});

		it.concurrent('should include timeout value in metadata', async () => {
			const error = createTimeoutError({
				message: 'Timeout',
				timeoutMs: 60000
			});

			expect((error.data as CliErrorMetadata)?.timeoutMs).toBe(60000);
		});

		it.concurrent('should include prompt excerpt in metadata', async () => {
			const error = createTimeoutError({
				message: 'Timeout',
				timeoutMs: 30000,
				promptExcerpt: 'Explain quantum...'
			});

			expect((error.data as CliErrorMetadata)?.promptExcerpt).toBe('Explain quantum...');
		});

		it.concurrent('should be retryable', async () => {
			const error = createTimeoutError({
				message: 'Timeout',
				timeoutMs: 30000
			});

			expect(error.isRetryable).toBe(true);
		});
	});

	describe('createInstallationError', () => {
		it.concurrent('should create error with INSTALLATION_ERROR code', async () => {
			const error = createInstallationError({
				message: 'Cortex Code not found'
			});

			expect((error.data as CliErrorMetadata)?.code).toBe('INSTALLATION_ERROR');
		});

		it.concurrent('should include stderr in metadata', async () => {
			const error = createInstallationError({
				message: 'Not installed',
				stderr: 'command not found: cortex'
			});

			expect((error.data as CliErrorMetadata)?.stderr).toBe('command not found: cortex');
		});

		it.concurrent('should not be retryable', async () => {
			const error = createInstallationError({ message: 'Not installed' });
			expect(error.isRetryable).toBe(false);
		});
	});

	describe('createConnectionError', () => {
		it.concurrent('should create error with CONNECTION_ERROR code', async () => {
			const error = createConnectionError({
				message: 'Could not connect'
			});

			expect((error.data as CliErrorMetadata)?.code).toBe('CONNECTION_ERROR');
		});

		it.concurrent('should include connection name in metadata', async () => {
			const error = createConnectionError({
				message: 'Connection failed',
				connection: 'prod'
			});

			expect((error.data as CliErrorMetadata)?.connection).toBe('prod');
		});

		it.concurrent('should include stderr in metadata', async () => {
			const error = createConnectionError({
				message: 'Connection failed',
				stderr: 'ECONNREFUSED'
			});

			expect((error.data as CliErrorMetadata)?.stderr).toBe('ECONNREFUSED');
		});

		it.concurrent('should be retryable', async () => {
			const error = createConnectionError({ message: 'Connection failed' });
			expect(error.isRetryable).toBe(true);
		});
	});

	describe('isAuthenticationError', () => {
		it.concurrent('should return true for authentication errors', async () => {
			const error = createAuthenticationError({ message: 'Auth failed' });
			expect(isAuthenticationError(error)).toBe(true);
		});

		it.concurrent('should return false for timeout errors', async () => {
			const error = createTimeoutError({ message: 'Timeout', timeoutMs: 30000 });
			expect(isAuthenticationError(error)).toBe(false);
		});

		it.concurrent('should return false for non-APICallError', async () => {
			const error = new Error('Regular error');
			expect(isAuthenticationError(error)).toBe(false);
		});

		it.concurrent('should return false for null/undefined', async () => {
			expect(isAuthenticationError(null)).toBe(false);
			expect(isAuthenticationError(undefined)).toBe(false);
		});
	});

	describe('isTimeoutError', () => {
		it.concurrent('should return true for timeout errors', async () => {
			const error = createTimeoutError({ message: 'Timeout', timeoutMs: 30000 });
			expect(isTimeoutError(error)).toBe(true);
		});

		it.concurrent('should return false for authentication errors', async () => {
			const error = createAuthenticationError({ message: 'Auth failed' });
			expect(isTimeoutError(error)).toBe(false);
		});

		it.concurrent('should return false for non-APICallError', async () => {
			expect(isTimeoutError(new Error('Error'))).toBe(false);
		});
	});

	describe('isInstallationError', () => {
		it.concurrent('should return true for installation errors', async () => {
			const error = createInstallationError({ message: 'Not installed' });
			expect(isInstallationError(error)).toBe(true);
		});

		it.concurrent('should return false for connection errors', async () => {
			const error = createConnectionError({ message: 'Connection failed' });
			expect(isInstallationError(error)).toBe(false);
		});

		it.concurrent('should return false for non-APICallError', async () => {
			expect(isInstallationError(new Error('Error'))).toBe(false);
		});
	});

	describe('isConnectionError', () => {
		it.concurrent('should return true for connection errors', async () => {
			const error = createConnectionError({ message: 'Connection failed' });
			expect(isConnectionError(error)).toBe(true);
		});

		it.concurrent('should return false for installation errors', async () => {
			const error = createInstallationError({ message: 'Not installed' });
			expect(isConnectionError(error)).toBe(false);
		});

		it.concurrent('should return false for non-APICallError', async () => {
			expect(isConnectionError(new Error('Error'))).toBe(false);
		});
	});

	describe('getErrorMetadata', () => {
		it.concurrent('should return metadata from APICallError', async () => {
			const metadata: CliErrorMetadata = { code: 'TEST', exitCode: 1 };
			const error = createAPICallError({ message: 'Test', metadata });

			expect(getErrorMetadata(error)).toEqual(metadata);
		});

		it.concurrent('should return null for non-APICallError', async () => {
			const error = new Error('Regular error');
			expect(getErrorMetadata(error)).toBeNull();
		});

		it.concurrent('should return null for null/undefined', async () => {
			expect(getErrorMetadata(null)).toBeNull();
			expect(getErrorMetadata(undefined)).toBeNull();
		});

		it.concurrent('should return null for APICallError without data', async () => {
			// Create a minimal APICallError without data
			const error = new APICallError({
				message: 'Test',
				url: 'test://url',
				requestBodyValues: {}
			});

			// Should return null when no metadata/data is present
			const metadata = getErrorMetadata(error);
			expect(metadata).toBeNull();
		});
	});

	describe('parseErrorFromStderr', () => {
		describe('authentication errors', () => {
			it.concurrent.each([
				['authentication failed', 'Authentication failed in the process'],
				['invalid credentials', 'Error: Invalid credentials provided'],
				['unauthorized', 'Access unauthorized'],
				['401', 'HTTP 401 Unauthorized'],
			])('should detect auth error from: %s', async (_, stderr) => {
				const result = parseErrorFromStderr(stderr);
				expect(result.type).toBe('authentication');
				expect(result.message).toContain('Authentication failed');
			});
		});

		describe('connection errors', () => {
			it.concurrent.each([
				['connection refused', 'Error: Connection refused'],
				['could not connect', 'Could not connect to server'],
				['network error', 'A network error occurred'],
				['econnrefused', 'ECONNREFUSED localhost:443'],
			])('should detect connection error from: %s', async (_, stderr) => {
				const result = parseErrorFromStderr(stderr);
				expect(result.type).toBe('connection');
				expect(result.message).toContain('Could not connect');
			});
		});

		describe('timeout errors', () => {
			it.concurrent.each([
				['timeout', 'Operation timeout'],
				['timed out', 'Request timed out'],
				['deadline exceeded', 'gRPC deadline exceeded'],
			])('should detect timeout error from: %s', async (_, stderr) => {
				const result = parseErrorFromStderr(stderr);
				expect(result.type).toBe('timeout');
				expect(result.message).toContain('timed out');
			});
		});

		describe('unknown errors', () => {
			it.concurrent('should return unknown type for unrecognized errors', async () => {
				const result = parseErrorFromStderr('Some random error occurred');
				expect(result.type).toBe('unknown');
				expect(result.message).toBe('Some random error occurred');
			});

			it.concurrent('should trim the message', async () => {
				const result = parseErrorFromStderr('  Error with whitespace  \n');
				expect(result.message).toBe('Error with whitespace');
			});

			it.concurrent('should handle empty string', async () => {
				const result = parseErrorFromStderr('');
				expect(result.type).toBe('unknown');
				expect(result.message).toBe('');
			});
		});
	});
});

