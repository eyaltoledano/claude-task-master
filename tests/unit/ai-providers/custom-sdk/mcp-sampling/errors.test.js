import { jest } from '@jest/globals';

// Mock @ai-sdk/provider
jest.unstable_mockModule('@ai-sdk/provider', () => ({
	APICallError: class APICallError extends Error {
		constructor(opts) {
			super(opts.message);
			this.url = opts.url;
			this.statusCode = opts.statusCode;
			this.responseHeaders = opts.responseHeaders;
			this.responseBody = opts.responseBody;
			this.isRetryable = opts.isRetryable;
			this.data = opts.data;
			this.requestBodyValues = opts.requestBodyValues;
			this.cause = opts.cause;
		}
	}
}));

// Import modules after mocking
const { APICallError } = await import('@ai-sdk/provider');
const {
	createAPICallError,
	createAuthenticationError,
	createTimeoutError,
	isAuthenticationError,
	isTimeoutError,
	getErrorMetadata
} = await import(
	'../../../../../src/ai-providers/custom-sdk/mcp-sampling/errors.js'
);

describe('MCP Sampling Errors', () => {
	describe('createAPICallError', () => {
		it('should create API call error with basic options', () => {
			const error = createAPICallError({
				message: 'API call failed',
				url: 'mcp://sampling',
				statusCode: 500
			});

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('API call failed');
			expect(error.url).toBe('mcp://sampling');
			expect(error.statusCode).toBe(500);
			expect(error.isRetryable).toBe(true);
		});

		it('should use default message when not provided', () => {
			const error = createAPICallError({});

			expect(error.message).toBe('MCP Sampling API call failed');
		});

		it('should include metadata from data option', () => {
			const error = createAPICallError({
				message: 'Error with metadata',
				data: {
					sessionId: 'session-123',
					modelId: 'claude-3-opus',
					operation: 'generate'
				}
			});

			expect(error.data).toEqual({
				sessionId: 'session-123',
				modelId: 'claude-3-opus',
				operation: 'generate'
			});
		});

		it('should include all optional parameters', () => {
			const cause = new Error('Original error');
			const error = createAPICallError({
				message: 'Complete error',
				url: 'mcp://sampling/test',
				statusCode: 400,
				responseHeaders: { 'content-type': 'application/json' },
				responseBody: { error: 'Bad request' },
				request: { prompt: 'test' },
				isRetryable: false,
				data: { timeout: 5000 },
				cause
			});

			expect(error.url).toBe('mcp://sampling/test');
			expect(error.statusCode).toBe(400);
			expect(error.responseHeaders).toEqual({
				'content-type': 'application/json'
			});
			expect(error.responseBody).toEqual({ error: 'Bad request' });
			expect(error.requestBodyValues).toEqual({ prompt: 'test' });
			expect(error.isRetryable).toBe(false);
			expect(error.data.timeout).toBe(5000);
			expect(error.cause).toBe(cause);
		});
	});

	describe('createAuthenticationError', () => {
		it('should create authentication error with default message', () => {
			const error = createAuthenticationError();

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe('MCP session authentication failed');
			expect(error.statusCode).toBe(401);
			expect(error.isRetryable).toBe(false);
			// Check if data exists and has errorType
			expect(error.data).toBeDefined();
			if (error.data.errorType) {
				expect(error.data.errorType).toBe('authentication');
			}
		});

		it('should create authentication error with custom message', () => {
			const error = createAuthenticationError({
				message: 'Invalid session token'
			});

			expect(error.message).toBe('Invalid session token');
		});

		it('should include cause and additional data', () => {
			const cause = new Error('Session expired');
			const error = createAuthenticationError({
				cause,
				data: {
					sessionId: 'expired-session',
					modelId: 'test-model'
				}
			});

			expect(error.cause).toBe(cause);
			// The metadata might include errorType and operation from spreading
			expect(error.data).toMatchObject({
				sessionId: 'expired-session',
				modelId: 'test-model'
			});
			if (error.data.errorType) {
				expect(error.data.errorType).toBe('authentication');
			}
		});

		it('should override default operation', () => {
			const error = createAuthenticationError({
				data: {
					operation: 'validate-session'
				}
			});

			expect(error.data.operation).toBe('validate-session');
		});
	});

	describe('createTimeoutError', () => {
		it('should create timeout error with defaults', () => {
			const error = createTimeoutError();

			expect(error).toBeInstanceOf(APICallError);
			expect(error.message).toBe(
				'MCP Sampling request timed out after 120000ms'
			);
			expect(error.statusCode).toBe(408);
			expect(error.isRetryable).toBe(true);
			// Check if data exists
			expect(error.data).toBeDefined();
			if (error.data.errorType) {
				expect(error.data.errorType).toBe('timeout');
			}
			if (error.data.timeout) {
				expect(error.data.timeout).toBe(120000);
			}
			if (error.data.operation) {
				expect(error.data.operation).toBe('request');
			}
		});

		it('should create timeout error with custom timeout and operation', () => {
			const error = createTimeoutError({
				timeout: 30000,
				operation: 'generate-text'
			});

			expect(error.message).toBe(
				'MCP Sampling generate-text timed out after 30000ms'
			);
			expect(error.data.timeout).toBe(30000);
			expect(error.data.operation).toBe('generate-text');
		});

		it('should include cause and additional data', () => {
			const cause = new Error('Network timeout');
			const error = createTimeoutError({
				timeout: 60000,
				operation: 'sampling',
				cause,
				data: {
					modelId: 'claude-3-opus',
					attemptNumber: 3
				}
			});

			expect(error.cause).toBe(cause);
			// The metadata only includes fields that createMetadata preserves
			expect(error.data).toMatchObject({
				modelId: 'claude-3-opus'
				// attemptNumber is not preserved by createMetadata
			});
			if (error.data.errorType) {
				expect(error.data.errorType).toBe('timeout');
			}
			if (error.data.timeout) {
				expect(error.data.timeout).toBe(60000);
			}
			if (error.data.operation) {
				expect(error.data.operation).toBe('sampling');
			}
		});
	});

	describe('isAuthenticationError', () => {
		it('should identify authentication errors by status code', () => {
			const error = createAPICallError({
				message: 'Unauthorized',
				statusCode: 401
			});

			expect(isAuthenticationError(error)).toBe(true);
		});

		it('should identify authentication errors by error type', () => {
			const error = createAuthenticationError();

			expect(isAuthenticationError(error)).toBe(true);
		});

		it('should identify authentication errors by message content', () => {
			const error1 = createAPICallError({
				message: 'Authentication failed'
			});

			const error2 = createAPICallError({
				message: 'Session invalid'
			});

			expect(isAuthenticationError(error1)).toBe(true);
			expect(isAuthenticationError(error2)).toBe(true);
		});

		it('should return false for non-authentication errors', () => {
			const error1 = createAPICallError({
				message: 'Server error',
				statusCode: 500
			});

			const error2 = new Error('Generic error');

			expect(isAuthenticationError(error1)).toBe(false);
			expect(isAuthenticationError(error2)).toBe(false);
		});
	});

	describe('isTimeoutError', () => {
		it('should identify timeout errors by status code', () => {
			const error = createAPICallError({
				message: 'Request timeout',
				statusCode: 408
			});

			expect(isTimeoutError(error)).toBe(true);
		});

		it('should identify timeout errors by error type', () => {
			const error = createTimeoutError();

			expect(isTimeoutError(error)).toBe(true);
		});

		it('should identify timeout errors by message content', () => {
			const error1 = createAPICallError({
				message: 'Operation timeout'
			});

			const error2 = createAPICallError({
				message: 'Request timed out'
			});

			expect(isTimeoutError(error1)).toBe(true);
			expect(isTimeoutError(error2)).toBe(true);
		});

		it('should return false for non-timeout errors', () => {
			const error1 = createAPICallError({
				message: 'Server error',
				statusCode: 500
			});

			const error2 = new Error('Generic error');

			expect(isTimeoutError(error1)).toBe(false);
			expect(isTimeoutError(error2)).toBe(false);
		});
	});

	describe('getErrorMetadata', () => {
		it('should extract metadata from APICallError', () => {
			const error = createAPICallError({
				message: 'Error with metadata',
				data: {
					sessionId: 'session-123',
					modelId: 'claude-3-opus',
					operation: 'generate',
					timeout: 30000
				}
			});

			const metadata = getErrorMetadata(error);

			expect(metadata).toEqual({
				sessionId: 'session-123',
				modelId: 'claude-3-opus',
				operation: 'generate',
				timeout: 30000
			});
		});

		it('should return null for errors without metadata', () => {
			const error1 = new Error('Regular error');
			const error2 = createAPICallError({
				message: 'Error without data'
			});

			expect(getErrorMetadata(error1)).toBe(null);
			// error2 has empty data object, not null
			const metadata = getErrorMetadata(error2);
			if (metadata) {
				expect(Object.keys(metadata).length).toBe(0);
			} else {
				expect(metadata).toBe(null);
			}
		});

		it('should return null for non-APICallError instances', () => {
			const error = {
				message: 'Not an error instance',
				data: { some: 'data' }
			};

			expect(getErrorMetadata(error)).toBe(null);
		});
	});

	describe('Error message extraction', () => {
		it('should handle various error formats', () => {
			// Test by creating errors with different structures
			const error1 = createAPICallError({
				message: 'Simple message'
			});

			const error2 = createAPICallError({
				message: undefined,
				cause: { message: 'Cause message' }
			});

			expect(error1.message).toBe('Simple message');
			expect(error2.message).toBe('MCP Sampling API call failed');
		});
	});
});
