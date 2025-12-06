/**
 * Unit tests for Shared Fetch Wrapper
 * Target: 90%+ coverage for src/shared/fetch-wrapper.ts
 */

import {
	createSnowflakeFetch,
	createSnowflakeAnthropicFetch,
	getSnowflakeBaseURL
} from '../../../src/shared/fetch-wrapper.js';

// Mock the authenticate function
jest.mock('../../../src/auth/index.js', () => ({
	authenticate: jest.fn()
}));

// Mock the schema transform function
jest.mock('../../../src/schema/index.js', () => ({
	removeUnsupportedFeatures: jest.fn((schema) => ({
		...schema,
		transformed: true
	}))
}));

import { authenticate } from '../../../src/auth/index.js';
import { removeUnsupportedFeatures } from '../../../src/schema/index.js';

const mockAuthenticate = authenticate as jest.MockedFunction<
	typeof authenticate
>;
const mockRemoveUnsupported = removeUnsupportedFeatures as jest.MockedFunction<
	typeof removeUnsupportedFeatures
>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Shared Fetch Wrapper', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		mockAuthenticate.mockResolvedValue({
			accessToken: 'test-token-123',
			baseURL: 'https://test-account.snowflakecomputing.com'
		});

		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({})
		});
	});

	describe('createSnowflakeFetch', () => {
		it('should add authorization header to requests', async () => {
			const snowflakeFetch = createSnowflakeFetch({});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.test.com/endpoint',
				expect.objectContaining({
					method: 'POST',
					headers: expect.any(Headers)
				})
			);

			const calledHeaders = mockFetch.mock.calls[0][1].headers;
			expect(calledHeaders.get('Authorization')).toBe('Bearer test-token-123');
		});

		it('should add Content-Type header when not already set', async () => {
			const snowflakeFetch = createSnowflakeFetch({});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST'
			});

			const calledHeaders = mockFetch.mock.calls[0][1].headers;
			expect(calledHeaders.get('Content-Type')).toBe('application/json');
		});

		it('should not override existing Content-Type header', async () => {
			const snowflakeFetch = createSnowflakeFetch({});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain' }
			});

			const calledHeaders = mockFetch.mock.calls[0][1].headers;
			expect(calledHeaders.get('Content-Type')).toBe('text/plain');
		});

		it('should cache authentication result', async () => {
			const snowflakeFetch = createSnowflakeFetch({});

			// Make multiple requests
			await snowflakeFetch('https://api.test.com/1');
			await snowflakeFetch('https://api.test.com/2');
			await snowflakeFetch('https://api.test.com/3');

			// Authenticate should only be called once
			expect(mockAuthenticate).toHaveBeenCalledTimes(1);
		});

		it('should pass through request body for non-OpenAI models', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'claude-haiku-4-5');
			const body = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] });

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.test.com/endpoint',
				expect.objectContaining({
					body // Same body, not transformed
				})
			);

			// removeUnsupportedFeatures should not be called for Claude
			expect(mockRemoveUnsupported).not.toHaveBeenCalled();
		});

		it('should transform response_format schema for OpenAI models', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'openai-gpt-5');
			const body = JSON.stringify({
				messages: [],
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'test',
						schema: { type: 'object', properties: {} }
					}
				}
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockRemoveUnsupported).toHaveBeenCalledWith({
				type: 'object',
				properties: {}
			});
		});

		it('should transform native Cortex format response_format for OpenAI', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'openai-gpt-5');
			const body = JSON.stringify({
				messages: [],
				response_format: {
					type: 'json',
					schema: { type: 'object', properties: {} }
				}
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockRemoveUnsupported).toHaveBeenCalledWith({
				type: 'object',
				properties: {}
			});
		});

		it('should transform tools schemas for OpenAI models', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'openai-gpt-5');
			const body = JSON.stringify({
				messages: [],
				tools: [
					{
						type: 'function',
						function: {
							name: 'get_weather',
							parameters: { type: 'object', properties: { city: { type: 'string' } } }
						}
					}
				]
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockRemoveUnsupported).toHaveBeenCalledWith({
				type: 'object',
				properties: { city: { type: 'string' } }
			});
		});

		it('should handle tools array with non-object items', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'openai-gpt-5');
			const body = JSON.stringify({
				messages: [],
				tools: [null, undefined, 'invalid', { type: 'function' }]
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			// Should not throw
			expect(mockFetch).toHaveBeenCalled();
		});

		it('should handle invalid JSON body gracefully', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'openai-gpt-5');

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body: 'not-valid-json'
			});

			// Should pass through unchanged
			expect(mockFetch).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					body: 'not-valid-json'
				})
			);
		});

		it('should handle gpt- prefix models as OpenAI', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'gpt-4o');
			const body = JSON.stringify({
				messages: [],
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'test',
						schema: { type: 'object' }
					}
				}
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockRemoveUnsupported).toHaveBeenCalled();
		});

		it('should handle cortex/ prefix for OpenAI models', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'cortex/openai-gpt-5');
			const body = JSON.stringify({
				messages: [],
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'test',
						schema: { type: 'object' }
					}
				}
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockRemoveUnsupported).toHaveBeenCalled();
		});

		it('should not transform when body is null or undefined', async () => {
			const snowflakeFetch = createSnowflakeFetch({}, 'openai-gpt-5');

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'GET',
				body: undefined
			});

			expect(mockRemoveUnsupported).not.toHaveBeenCalled();
		});

		it('should not transform when modelId is not provided', async () => {
			const snowflakeFetch = createSnowflakeFetch({});
			const body = JSON.stringify({
				messages: [],
				response_format: {
					type: 'json_schema',
					json_schema: { schema: {} }
				}
			});

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				body
			});

			expect(mockRemoveUnsupported).not.toHaveBeenCalled();
		});

		it('should preserve other init options', async () => {
			const snowflakeFetch = createSnowflakeFetch({});
			const signal = new AbortController().signal;

			await snowflakeFetch('https://api.test.com/endpoint', {
				method: 'POST',
				signal,
				credentials: 'include'
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					method: 'POST',
					signal,
					credentials: 'include'
				})
			);
		});
	});

	describe('createSnowflakeAnthropicFetch', () => {
		it('should add authorization header', async () => {
			const anthropicFetch = createSnowflakeAnthropicFetch({});

			await anthropicFetch('https://api.test.com/anthropic', {
				method: 'POST'
			});

			const calledHeaders = mockFetch.mock.calls[0][1].headers;
			expect(calledHeaders.get('Authorization')).toBe('Bearer test-token-123');
		});

		it('should add Content-Type header when not set', async () => {
			const anthropicFetch = createSnowflakeAnthropicFetch({});

			await anthropicFetch('https://api.test.com/anthropic', {
				method: 'POST'
			});

			const calledHeaders = mockFetch.mock.calls[0][1].headers;
			expect(calledHeaders.get('Content-Type')).toBe('application/json');
		});

		it('should not override existing Content-Type header', async () => {
			const anthropicFetch = createSnowflakeAnthropicFetch({});

			await anthropicFetch('https://api.test.com/anthropic', {
				method: 'POST',
				headers: { 'Content-Type': 'multipart/form-data' }
			});

			const calledHeaders = mockFetch.mock.calls[0][1].headers;
			expect(calledHeaders.get('Content-Type')).toBe('multipart/form-data');
		});

		it('should cache authentication result', async () => {
			const anthropicFetch = createSnowflakeAnthropicFetch({});

			await anthropicFetch('https://api.test.com/1');
			await anthropicFetch('https://api.test.com/2');

			expect(mockAuthenticate).toHaveBeenCalledTimes(1);
		});

		it('should NOT transform body (no schema transformation for Anthropic)', async () => {
			const anthropicFetch = createSnowflakeAnthropicFetch({});
			const body = JSON.stringify({
				messages: [],
				tools: [{ function: { parameters: {} } }]
			});

			await anthropicFetch('https://api.test.com/anthropic', {
				method: 'POST',
				body
			});

			// removeUnsupportedFeatures should not be called for Anthropic
			expect(mockRemoveUnsupported).not.toHaveBeenCalled();
		});
	});

	describe('getSnowflakeBaseURL', () => {
		it('should return base URL from authentication', async () => {
			const baseURL = await getSnowflakeBaseURL({});

			expect(baseURL).toBe('https://test-account.snowflakecomputing.com');
		});

		it('should pass settings to authenticate', async () => {
			await getSnowflakeBaseURL({ connection: 'my-conn', timeout: 5000 });

			expect(mockAuthenticate).toHaveBeenCalledWith({
				connection: 'my-conn',
				timeout: 5000
			});
		});
	});
});

