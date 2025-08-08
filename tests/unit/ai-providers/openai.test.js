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

// Import the OpenAI provider and BaseAIProvider to test
const { OpenAIProvider } = await import('../../../src/ai-providers/openai.js');
const { BaseAIProvider } = await import(
	'../../../src/ai-providers/base-provider.js'
);

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
			const result1 = provider.prepareTokenParam('gpt-5', 1000.7);
			expect(result1).toEqual({ max_completion_tokens: 1000 });

			const result2 = provider.prepareTokenParam('gpt-4', 1000.7);
			expect(result2).toEqual({ maxTokens: 1000 });

			const result3 = provider.prepareTokenParam('gpt-5', '1000.7');
			expect(result3).toEqual({ max_completion_tokens: 1000 });
		});

		it('should return empty object for undefined maxTokens', () => {
			const result = provider.prepareTokenParam('gpt-5', undefined);
			expect(result).toEqual({});
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
				'maxTokens must be a finite number greater than 0'
			);
			expect(() => provider.validateOptionalParams({ maxTokens: -1 })).toThrow(
				'maxTokens must be a finite number greater than 0'
			);
			expect(() => provider.validateOptionalParams({ maxTokens: NaN })).toThrow(
				'maxTokens must be a finite number greater than 0'
			);
			expect(() =>
				provider.validateOptionalParams({ maxTokens: Infinity })
			).toThrow('maxTokens must be a finite number greater than 0');
			expect(() =>
				provider.validateOptionalParams({ maxTokens: 'invalid' })
			).toThrow('maxTokens must be a finite number greater than 0');
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
			).toThrow('Temperature must be between 0 and 1');
			expect(() =>
				provider.validateOptionalParams({ temperature: 1.1 })
			).toThrow('Temperature must be between 0 and 1');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return OPENAI_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('OPENAI_API_KEY');
		});
	});

	describe('getClient', () => {
		it('should throw error if API key is missing', () => {
			expect(() => provider.getClient({})).toThrow(
				'OpenAI API key is required.'
			);
		});
	});
});
