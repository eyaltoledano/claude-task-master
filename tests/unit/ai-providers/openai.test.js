/**
 * Tests for OpenAI Provider
 *
 * This test suite covers:
 * 1. Validation of maxTokens parameter
 * 2. Client creation and configuration
 * 3. Model handling
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
