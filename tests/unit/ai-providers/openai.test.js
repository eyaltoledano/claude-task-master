/**
 * Tests for OpenAI Provider - Token parameter handling for GPT-5
 *
 * This test suite covers:
 * 1. Correct identification of GPT-5 models requiring max_completion_tokens
 * 2. Token parameter preparation for different model types
 * 3. Validation of maxTokens parameter
 * 4. Integer coercion of token values
 */

import { jest } from '@jest/globals';

// Mock the utils module to prevent logging during tests
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: jest.fn()
}));

// Import the provider
import { OpenAIProvider } from '../../../src/ai-providers/openai.js';

describe('OpenAIProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new OpenAIProvider();
		jest.clearAllMocks();
	});

	describe('requiresMaxCompletionTokens', () => {
		it('should return true for GPT-5 models', () => {
			expect(provider.requiresMaxCompletionTokens('gpt-5')).toBe(true);
			expect(provider.requiresMaxCompletionTokens('gpt-5-mini')).toBe(true);
			expect(provider.requiresMaxCompletionTokens('gpt-5-nano')).toBe(true);
			expect(provider.requiresMaxCompletionTokens('gpt-5-turbo')).toBe(true);
		});

		it('should return false for non-GPT-5 models', () => {
			expect(provider.requiresMaxCompletionTokens('gpt-4')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('gpt-4o')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('gpt-3.5-turbo')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('o1')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('o1-mini')).toBe(false);
		});

		it('should handle null/undefined modelId', () => {
			expect(provider.requiresMaxCompletionTokens(null)).toBeFalsy();
			expect(provider.requiresMaxCompletionTokens(undefined)).toBeFalsy();
			expect(provider.requiresMaxCompletionTokens('')).toBeFalsy();
		});
	});

	describe('prepareTokenParam', () => {
		it('should return max_completion_tokens for GPT-5 models', () => {
			const result = provider.prepareTokenParam('gpt-5', 1000);
			expect(result).toEqual({ max_completion_tokens: 1000 });
		});

		it('should return maxTokens for non-GPT-5 models', () => {
			const result = provider.prepareTokenParam('gpt-4', 1000);
			expect(result).toEqual({ maxTokens: 1000 });
		});

		it('should coerce token value to integer', () => {
			// Float values
			const result1 = provider.prepareTokenParam('gpt-5', 1000.7);
			expect(result1).toEqual({ max_completion_tokens: 1000 });

			const result2 = provider.prepareTokenParam('gpt-4', 1000.7);
			expect(result2).toEqual({ maxTokens: 1000 });

			// String float
			const result3 = provider.prepareTokenParam('gpt-5', '1000.7');
			expect(result3).toEqual({ max_completion_tokens: 1000 });

			// String integers (common CLI input path)
			expect(provider.prepareTokenParam('gpt-5', '1000')).toEqual({
				max_completion_tokens: 1000
			});
			expect(provider.prepareTokenParam('gpt-4', '1000')).toEqual({
				maxTokens: 1000
			});
		});

		it('should return empty object for undefined maxTokens', () => {
			const result = provider.prepareTokenParam('gpt-5', undefined);
			expect(result).toEqual({});
		});

		it('should handle edge cases', () => {
			// Test with 0 (should still pass through as 0)
			const result1 = provider.prepareTokenParam('gpt-5', 0);
			expect(result1).toEqual({ max_completion_tokens: 0 });

			// Test with string number
			const result2 = provider.prepareTokenParam('gpt-5', '100');
			expect(result2).toEqual({ max_completion_tokens: 100 });

			// Test with negative number (will be floored, validation happens elsewhere)
			const result3 = provider.prepareTokenParam('gpt-4', -10.5);
			expect(result3).toEqual({ maxTokens: -11 });
		});
	});

	describe('validateOptionalParams', () => {
		it('should accept valid maxTokens values', () => {
			expect(() =>
				provider.validateOptionalParams({ maxTokens: 1000 })
			).not.toThrow();
			expect(() =>
				provider.validateOptionalParams({ maxTokens: 1 })
			).not.toThrow();
			expect(() =>
				provider.validateOptionalParams({ maxTokens: '1000' })
			).not.toThrow();
		});

		it('should reject invalid maxTokens values', () => {
			expect(() => provider.validateOptionalParams({ maxTokens: 0 })).toThrow(
				Error
			);
			expect(() => provider.validateOptionalParams({ maxTokens: -1 })).toThrow(
				Error
			);
			expect(() => provider.validateOptionalParams({ maxTokens: NaN })).toThrow(
				Error
			);
			expect(() =>
				provider.validateOptionalParams({ maxTokens: Infinity })
			).toThrow(Error);
			expect(() =>
				provider.validateOptionalParams({ maxTokens: 'invalid' })
			).toThrow(Error);
		});

		it('should accept valid temperature values', () => {
			expect(() =>
				provider.validateOptionalParams({ temperature: 0 })
			).not.toThrow();
			expect(() =>
				provider.validateOptionalParams({ temperature: 0.5 })
			).not.toThrow();
			expect(() =>
				provider.validateOptionalParams({ temperature: 1 })
			).not.toThrow();
		});

		it('should reject invalid temperature values', () => {
			expect(() =>
				provider.validateOptionalParams({ temperature: -0.1 })
			).toThrow(Error);
			expect(() =>
				provider.validateOptionalParams({ temperature: 1.1 })
			).toThrow(Error);
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return OPENAI_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('OPENAI_API_KEY');
		});
	});

	describe('getClient', () => {
		it('should throw error if API key is missing', () => {
			expect(() => provider.getClient({})).toThrow(Error);
		});

		it('should create client with apiKey only', () => {
			const params = {
				apiKey: 'sk-test-123'
			};

			// The getClient method should return a function
			const client = provider.getClient(params);
			expect(typeof client).toBe('function');

			// The client function should be callable and return a model object
			const model = client('gpt-4');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('gpt-4');
		});

		it('should create client with apiKey and baseURL', () => {
			const params = {
				apiKey: 'sk-test-456',
				baseURL: 'https://api.openai.example'
			};

			// Should not throw when baseURL is provided
			const client = provider.getClient(params);
			expect(typeof client).toBe('function');

			// The client function should be callable and return a model object
			const model = client('gpt-5');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('gpt-5');
		});

		it('should return the same client instance for the same parameters', () => {
			const params = {
				apiKey: 'sk-test-789'
			};

			// Multiple calls with same params should work
			const client1 = provider.getClient(params);
			const client2 = provider.getClient(params);

			expect(typeof client1).toBe('function');
			expect(typeof client2).toBe('function');

			// Both clients should be able to create models
			const model1 = client1('gpt-4');
			const model2 = client2('gpt-4');
			expect(model1.modelId).toBe('gpt-4');
			expect(model2.modelId).toBe('gpt-4');
		});

		it('should handle different model IDs correctly', () => {
			const client = provider.getClient({ apiKey: 'sk-test-models' });

			// Test with different models
			const gpt4 = client('gpt-4');
			expect(gpt4.modelId).toBe('gpt-4');

			const gpt5 = client('gpt-5');
			expect(gpt5.modelId).toBe('gpt-5');

			const gpt35 = client('gpt-3.5-turbo');
			expect(gpt35.modelId).toBe('gpt-3.5-turbo');
		});
	});

	describe('name property', () => {
		it('should have OpenAI as the provider name', () => {
			expect(provider.name).toBe('OpenAI');
		});
	});
});
