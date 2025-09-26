/**
 * Tests for error handling utilities
 */

import { APICallError, LoadAPIKeyError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import {
	createAPICallError,
	createAuthenticationError,
	createInstallationError,
	createTimeoutError,
	getErrorMetadata,
	isAuthenticationError,
	isInstallationError,
	isTimeoutError
} from './errors.js';

describe('createAPICallError', () => {
	it('should create APICallError with metadata', () => {
		const error = createAPICallError({
			message: 'Test error',
			code: 'TEST_ERROR',
			exitCode: 1,
			stderr: 'Error output',
			stdout: 'Success output',
			promptExcerpt: 'Test prompt',
			isRetryable: true
		});

		expect(error).toBeInstanceOf(APICallError);
		expect(error.message).toBe('Test error');
		expect(error.isRetryable).toBe(true);
		expect(error.url).toBe('grok-cli://command');
		expect(error.data).toEqual({
			code: 'TEST_ERROR',
			exitCode: 1,
			stderr: 'Error output',
			stdout: 'Success output',
			promptExcerpt: 'Test prompt'
		});
	});

	it('should create APICallError with minimal parameters', () => {
		const error = createAPICallError({
			message: 'Simple error'
		});

		expect(error).toBeInstanceOf(APICallError);
		expect(error.message).toBe('Simple error');
		expect(error.isRetryable).toBe(false);
	});
});

describe('createAuthenticationError', () => {
	it('should create LoadAPIKeyError with custom message', () => {
		const error = createAuthenticationError({
			message: 'Custom auth error'
		});

		expect(error).toBeInstanceOf(LoadAPIKeyError);
		expect(error.message).toBe('Custom auth error');
	});

	it('should create LoadAPIKeyError with default message', () => {
		const error = createAuthenticationError({});

		expect(error).toBeInstanceOf(LoadAPIKeyError);
		expect(error.message).toContain('Authentication failed');
	});
});

describe('createTimeoutError', () => {
	it('should create APICallError for timeout', () => {
		const error = createTimeoutError({
			message: 'Operation timed out',
			timeoutMs: 5000,
			promptExcerpt: 'Test prompt'
		});

		expect(error).toBeInstanceOf(APICallError);
		expect(error.message).toBe('Operation timed out');
		expect(error.isRetryable).toBe(true);
		expect(error.data).toEqual({
			code: 'TIMEOUT',
			promptExcerpt: 'Test prompt',
			timeoutMs: 5000
		});
	});
});

describe('createInstallationError', () => {
	it('should create APICallError for installation issues', () => {
		const error = createInstallationError({
			message: 'CLI not found'
		});

		expect(error).toBeInstanceOf(APICallError);
		expect(error.message).toBe('CLI not found');
		expect(error.isRetryable).toBe(false);
		expect(error.url).toBe('grok-cli://installation');
	});

	it('should create APICallError with default message', () => {
		const error = createInstallationError({});

		expect(error).toBeInstanceOf(APICallError);
		expect(error.message).toContain('Grok CLI is not installed');
	});
});

describe('isAuthenticationError', () => {
	it('should return true for LoadAPIKeyError', () => {
		const error = new LoadAPIKeyError({ message: 'Auth failed' });
		expect(isAuthenticationError(error)).toBe(true);
	});

	it('should return true for APICallError with 401 exit code', () => {
		const error = new APICallError({
			message: 'Unauthorized',
			data: { exitCode: 401 }
		});
		expect(isAuthenticationError(error)).toBe(true);
	});

	it('should return false for other errors', () => {
		const error = new Error('Generic error');
		expect(isAuthenticationError(error)).toBe(false);
	});
});

describe('isTimeoutError', () => {
	it('should return true for timeout APICallError', () => {
		const error = new APICallError({
			message: 'Timeout',
			data: { code: 'TIMEOUT' }
		});
		expect(isTimeoutError(error)).toBe(true);
	});

	it('should return false for other errors', () => {
		const error = new APICallError({ message: 'Other error' });
		expect(isTimeoutError(error)).toBe(false);
	});
});

describe('isInstallationError', () => {
	it('should return true for installation APICallError', () => {
		const error = new APICallError({
			message: 'Not installed',
			url: 'grok-cli://installation'
		});
		expect(isInstallationError(error)).toBe(true);
	});

	it('should return false for other errors', () => {
		const error = new APICallError({ message: 'Other error' });
		expect(isInstallationError(error)).toBe(false);
	});
});

describe('getErrorMetadata', () => {
	it('should return metadata from APICallError', () => {
		const metadata = {
			code: 'TEST_ERROR',
			exitCode: 1,
			stderr: 'Error output'
		};
		const error = new APICallError({
			message: 'Test error',
			data: metadata
		});

		const result = getErrorMetadata(error);
		expect(result).toEqual(metadata);
	});

	it('should return undefined for errors without metadata', () => {
		const error = new Error('Generic error');
		const result = getErrorMetadata(error);
		expect(result).toBeUndefined();
	});

	it('should return undefined for APICallError without data', () => {
		const error = new APICallError({ message: 'Test error' });
		const result = getErrorMetadata(error);
		expect(result).toBeUndefined();
	});
});
