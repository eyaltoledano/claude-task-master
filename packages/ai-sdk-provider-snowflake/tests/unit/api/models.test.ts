/**
 * Unit tests for Model Validation API
 * Target: 90%+ coverage for src/api/models.ts
 */

import {
	fetchAvailableModels,
	isModelAvailable,
	getAvailableModelNames,
	validateModelAvailability,
	clearModelCache,
	getModelInfo,
	suggestAlternativeModels,
	type CortexModelInfo
} from '../../../src/api/models.js';

// Mock the authenticate function
jest.mock('../../../src/auth/index.js', () => ({
	authenticate: jest.fn()
}));

// Get the mocked authenticate
import { authenticate } from '../../../src/auth/index.js';
const mockAuthenticate = authenticate as jest.MockedFunction<
	typeof authenticate
>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Model Validation API', () => {
	// Clear mocks and cache before each test
	beforeEach(() => {
		jest.clearAllMocks();
		clearModelCache();

		// Default authenticate mock
		mockAuthenticate.mockResolvedValue({
			accessToken: 'test-token',
			baseURL: 'https://test-account.snowflakecomputing.com'
		});
	});

	describe('fetchAvailableModels', () => {
		it('should fetch models from the API', async () => {
			const mockModels: CortexModelInfo[] = [
				{ name: 'claude-haiku-4-5', provider: 'anthropic' },
				{ name: 'llama3.1-8b', provider: 'meta' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ models: mockModels })
			});

			const models = await fetchAvailableModels();

			expect(models).toEqual(mockModels);
			expect(mockAuthenticate).toHaveBeenCalled();
			expect(mockFetch).toHaveBeenCalledWith(
				'https://test-account.snowflakecomputing.com/api/v2/cortex/inference/models',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						Authorization: 'Bearer test-token',
						Accept: 'application/json'
					})
				})
			);
		});

		it('should use cached models when cache is valid', async () => {
			const mockModels: CortexModelInfo[] = [
				{ name: 'claude-sonnet-4-5' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ models: mockModels })
			});

			// First call - fetches from API
			const models1 = await fetchAvailableModels();
			expect(models1).toEqual(mockModels);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			const models2 = await fetchAvailableModels();
			expect(models2).toEqual(mockModels);
			expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
		});

		it('should handle string model names in response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ models: ['model1', 'model2'] })
			});

			const models = await fetchAvailableModels();

			expect(models).toEqual([{ name: 'model1' }, { name: 'model2' }]);
		});

		it('should handle mixed array of objects and invalid items', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					models: [
						{ name: 'model1' },
						'string-model',
						null,
						undefined,
						{ name: 'model2' }
					]
				})
			});

			const models = await fetchAvailableModels();

			expect(models).toEqual([
				{ name: 'model1' },
				{ name: 'string-model' },
				{ name: 'model2' }
			]);
		});

		it('should handle empty models array', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ models: [] })
			});

			const models = await fetchAvailableModels();

			expect(models).toEqual([]);
		});

		it('should handle missing models field in response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({})
			});

			const models = await fetchAvailableModels();

			expect(models).toEqual([]);
		});

		it('should throw error on API failure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: async () => 'Unauthorized'
			});

			await expect(fetchAvailableModels()).rejects.toThrow(
				'Failed to fetch available models: 401 - Unauthorized'
			);
		});

		it('should throw error on network failure', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(fetchAvailableModels()).rejects.toThrow('Network error');
		});

		it('should include debug logging when DEBUG env is set', async () => {
			const originalDebug = process.env.DEBUG;
			process.env.DEBUG = 'snowflake:api';

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					models: [{ name: 'model1' }, { name: 'model2' }]
				})
			});

			await fetchAvailableModels();

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[DEBUG snowflake:api] Fetched 2 available models')
			);

			consoleSpy.mockRestore();
			process.env.DEBUG = originalDebug;
		});
	});

	describe('isModelAvailable', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					models: [
						{ name: 'claude-haiku-4-5' },
						{ name: 'cortex/llama3.1-8b' },
						{ name: 'openai-gpt-5' }
					]
				})
			});
		});

		it('should return true for available model (exact match)', async () => {
			const result = await isModelAvailable('claude-haiku-4-5');
			expect(result).toBe(true);
		});

		it('should return true for model with cortex/ prefix', async () => {
			const result = await isModelAvailable('cortex/claude-haiku-4-5');
			expect(result).toBe(true);
		});

		it('should return true for model in list with cortex/ prefix', async () => {
			const result = await isModelAvailable('llama3.1-8b');
			expect(result).toBe(true);
		});

		it('should handle case-insensitive comparison', async () => {
			const result = await isModelAvailable('CLAUDE-HAIKU-4-5');
			expect(result).toBe(true);
		});

		it('should return false for unavailable model', async () => {
			const result = await isModelAvailable('unknown-model');
			expect(result).toBe(false);
		});

		it('should return true when fetch fails (fallback behavior)', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await isModelAvailable('any-model');
			expect(result).toBe(true);
		});

		it('should log debug info when fetch fails and DEBUG is set', async () => {
			const originalDebug = process.env.DEBUG;
			process.env.DEBUG = 'snowflake:api';

			const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await isModelAvailable('any-model');

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[DEBUG snowflake:api] Could not check model availability')
			);

			consoleSpy.mockRestore();
			process.env.DEBUG = originalDebug;
		});
	});

	describe('getAvailableModelNames', () => {
		it('should return array of model names', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					models: [
						{ name: 'model1', provider: 'test' },
						{ name: 'model2' }
					]
				})
			});

			const names = await getAvailableModelNames();

			expect(names).toEqual(['model1', 'model2']);
		});

		it('should pass settings to fetchAvailableModels', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ models: [] })
			});

			await getAvailableModelNames({ connection: 'test-conn' });

			expect(mockAuthenticate).toHaveBeenCalledWith({ connection: 'test-conn' });
		});
	});

	describe('validateModelAvailability', () => {
		it('should not throw for available model', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					models: [{ name: 'claude-haiku-4-5' }]
				})
			});

			await expect(
				validateModelAvailability('claude-haiku-4-5')
			).resolves.not.toThrow();
		});

		it('should throw for unavailable model with helpful message', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					models: [{ name: 'model1' }, { name: 'model2' }]
				})
			});

			await expect(
				validateModelAvailability('unknown-model')
			).rejects.toThrow(
				"Model 'unknown-model' is not available in your Snowflake account or region. Available models: model1, model2"
			);
		});

		it('should show empty available models in error when none exist', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ models: [] })
			});

			await expect(
				validateModelAvailability('unknown-model')
			).rejects.toThrow('Available models: none');
		});
	});

	describe('clearModelCache', () => {
		it('should clear the cache forcing new API calls', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ models: [{ name: 'model1' }] })
			});

			// First fetch
			await fetchAvailableModels();
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Should use cache
			await fetchAvailableModels();
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Clear cache
			clearModelCache();

			// Should fetch again
			await fetchAvailableModels();
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('getModelInfo', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					models: [
						{
							name: 'claude-haiku-4-5',
							provider: 'anthropic',
							capabilities: { structured_output: true }
						},
						{ name: 'cortex/llama3.1-8b', provider: 'meta' }
					]
				})
			});
		});

		it('should return model info for exact match', async () => {
			const info = await getModelInfo('claude-haiku-4-5');

			expect(info).toEqual({
				name: 'claude-haiku-4-5',
				provider: 'anthropic',
				capabilities: { structured_output: true }
			});
		});

		it('should return model info with cortex/ prefix in query', async () => {
			const info = await getModelInfo('cortex/claude-haiku-4-5');

			expect(info?.name).toBe('claude-haiku-4-5');
		});

		it('should return model info when model has cortex/ prefix', async () => {
			const info = await getModelInfo('llama3.1-8b');

			expect(info?.name).toBe('cortex/llama3.1-8b');
		});

		it('should return undefined for unknown model', async () => {
			const info = await getModelInfo('unknown-model');

			expect(info).toBeUndefined();
		});

		it('should handle case-insensitive lookup', async () => {
			const info = await getModelInfo('CLAUDE-HAIKU-4-5');

			expect(info?.name).toBe('claude-haiku-4-5');
		});
	});

	describe('suggestAlternativeModels', () => {
		beforeEach(() => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					models: [
						{ name: 'claude-haiku-4-5' },
						{ name: 'claude-sonnet-4-5' },
						{ name: 'claude-opus-4' },
						{ name: 'llama3.1-8b' },
						{ name: 'llama3.1-70b' },
						{ name: 'openai-gpt-5' }
					]
				})
			});
		});

		it('should suggest models of the same type', async () => {
			const suggestions = await suggestAlternativeModels('claude-haiku-3');

			expect(suggestions).toContain('claude-haiku-4-5');
			expect(suggestions).toContain('claude-sonnet-4-5');
			expect(suggestions).not.toContain('llama3.1-8b');
		});

		it('should limit suggestions to 5', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({
					models: [
						{ name: 'claude-1' },
						{ name: 'claude-2' },
						{ name: 'claude-3' },
						{ name: 'claude-4' },
						{ name: 'claude-5' },
						{ name: 'claude-6' },
						{ name: 'claude-7' }
					]
				})
			});

			const suggestions = await suggestAlternativeModels('claude-old');

			expect(suggestions.length).toBe(5);
		});

		it('should return any available models when no type match', async () => {
			const suggestions = await suggestAlternativeModels('xyz-unknown');

			expect(suggestions.length).toBeGreaterThan(0);
			expect(suggestions.length).toBeLessThanOrEqual(5);
		});

		it('should handle cortex/ prefix in model ID', async () => {
			const suggestions = await suggestAlternativeModels('cortex/claude-old');

			expect(suggestions).toContain('claude-haiku-4-5');
		});

		it('should return empty when no models available and no type match', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ models: [] })
			});

			const suggestions = await suggestAlternativeModels('xyz-unknown');

			expect(suggestions).toEqual([]);
		});
	});
});

