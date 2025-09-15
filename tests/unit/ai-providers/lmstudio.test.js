/**
 * Tests for LM Studio Provider
 *
 * This test suite covers:
 * 1. Authentication validation (no API key required)
 * 2. Client creation with base URL configuration
 * 3. Token parameter handling
 * 4. Provider name and configuration
 */

import { jest } from '@jest/globals';

// Mock the utils module to prevent logging during tests
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: jest.fn()
}));

// Import the provider
import { LMStudioAIProvider } from '../../../src/ai-providers/lmstudio.js';

describe('LMStudioAIProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new LMStudioAIProvider();
		jest.clearAllMocks();
	});

	describe('validateAuth', () => {
		it('should not require API key for local usage', () => {
			// Should not throw when no API key is provided
			expect(() => provider.validateAuth({})).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: undefined })).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: null })).not.toThrow();
		});

		it('should accept optional API key', () => {
			// Should not throw when API key is provided
			expect(() => provider.validateAuth({ apiKey: 'test-key' })).not.toThrow();
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return false (no API key required)', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return LMSTUDIO_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('LMSTUDIO_API_KEY');
		});
	});

	describe('getClient', () => {
		it('should create client with default base URL', () => {
			const params = {};

			// The getClient method should return a function
			const client = provider.getClient(params);
			expect(typeof client).toBe('function');

			// The client function should be callable and return a model object
			const model = client('llama-3.1-8b-instruct');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('llama-3.1-8b-instruct');
		});

		it('should create client with custom base URL', () => {
			const params = {
				baseURL: 'http://localhost:8080/v1'
			};

			const client = provider.getClient(params);
			expect(typeof client).toBe('function');

			const model = client('custom-model');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('custom-model');
		});

		it('should create client with API key and base URL', () => {
			const params = {
				apiKey: 'test-key',
				baseURL: 'http://192.168.1.100:1234/v1'
			};

			const client = provider.getClient(params);
			expect(typeof client).toBe('function');

			const model = client('qwen2.5-7b-instruct');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('qwen2.5-7b-instruct');
		});

		it('should handle different model IDs correctly', () => {
			const client = provider.getClient({});

			// Test with different models
			const llama = client('llama-3.1-8b-instruct');
			expect(llama.modelId).toBe('llama-3.1-8b-instruct');

			const qwen = client('qwen2.5-7b-instruct');
			expect(qwen.modelId).toBe('qwen2.5-7b-instruct');

			const mistral = client('mistral-7b-instruct');
			expect(mistral.modelId).toBe('mistral-7b-instruct');
		});

		it('should use default base URL when not specified', () => {
			const client = provider.getClient({});
			expect(typeof client).toBe('function');

			// Should work with default URL
			const model = client('test-model');
			expect(model).toBeDefined();
		});
	});

	describe('prepareTokenParam', () => {
		it('should return maxTokens for all models (default behavior)', () => {
			const result = provider.prepareTokenParam('llama-3.1-8b-instruct', 1000);
			expect(result).toEqual({ maxTokens: 1000 });
		});

		it('should coerce token value to integer', () => {
			// Float values
			const result1 = provider.prepareTokenParam('qwen2.5-7b-instruct', 1000.7);
			expect(result1).toEqual({ maxTokens: 1000 });

			// String float
			const result2 = provider.prepareTokenParam('mistral-7b-instruct', '1000.7');
			expect(result2).toEqual({ maxTokens: 1000 });

			// String integers
			const result3 = provider.prepareTokenParam('llama-3.1-8b-instruct', '1000');
			expect(result3).toEqual({ maxTokens: 1000 });
		});

		it('should return empty object for undefined maxTokens', () => {
			const result = provider.prepareTokenParam('custom-model', undefined);
			expect(result).toEqual({});
		});

		it('should handle edge cases', () => {
			// Test with 0
			const result1 = provider.prepareTokenParam('test-model', 0);
			expect(result1).toEqual({ maxTokens: 0 });

			// Test with negative number (will be floored, validation happens elsewhere)
			const result2 = provider.prepareTokenParam('test-model', -10.5);
			expect(result2).toEqual({ maxTokens: -11 });
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

	describe('name property', () => {
		it('should have LM Studio as the provider name', () => {
			expect(provider.name).toBe('LM Studio');
		});
	});

	describe('requiresMaxCompletionTokens', () => {
		it('should return false for all models (default behavior)', () => {
			expect(provider.requiresMaxCompletionTokens('llama-3.1-8b-instruct')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('qwen2.5-7b-instruct')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('mistral-7b-instruct')).toBe(false);
			expect(provider.requiresMaxCompletionTokens('custom-model')).toBe(false);
		});
	});

	describe('API Key Configuration', () => {
		it('should handle missing API key gracefully', () => {
			// LM Studio should work without API key for local usage
			expect(() => provider.validateAuth({})).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: undefined })).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: null })).not.toThrow();
		});

		it('should accept optional API key for remote usage', () => {
			expect(() => provider.validateAuth({ apiKey: 'test-key' })).not.toThrow();
			expect(() => provider.validateAuth({ apiKey: 'sk-1234567890' })).not.toThrow();
		});
	});

	describe('Model Support', () => {
		it('should support various model formats', () => {
			const client = provider.getClient({});
			
			// Test different model naming conventions
			const models = [
				'llama-3.1-8b-instruct',
				'qwen2.5-7b-instruct', 
				'mistral-7b-instruct',
				'gpt-oss:latest',
				'gpt-oss:20b',
				'devstral:latest',
				'qwen3:latest',
				'custom-model'
			];

			models.forEach(modelId => {
				const model = client(modelId);
				expect(model).toBeDefined();
				expect(model.modelId).toBe(modelId);
			});
		});
	});

	describe('Base URL Configuration', () => {
		it('should use default base URL when not specified', () => {
			const client = provider.getClient({});
			const model = client('test-model');
			expect(model).toBeDefined();
		});

		it('should accept custom base URL', () => {
			const customURL = 'http://192.168.1.100:8080/v1';
			const client = provider.getClient({ baseURL: customURL });
			const model = client('test-model');
			expect(model).toBeDefined();
		});

		it('should handle different port configurations', () => {
			const ports = ['11434', '8080', '1234', '3000'];
			
			ports.forEach(port => {
				const baseURL = `http://localhost:${port}/v1`;
				const client = provider.getClient({ baseURL });
				const model = client('test-model');
				expect(model).toBeDefined();
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid base URL gracefully', () => {
			// Should not throw during client creation, errors would occur during actual API calls
			expect(() => {
				const client = provider.getClient({ baseURL: 'invalid-url' });
				client('test-model');
			}).not.toThrow();
		});

		it('should handle empty model ID', () => {
			const client = provider.getClient({});
			const model = client('');
			expect(model).toBeDefined();
			expect(model.modelId).toBe('');
		});
	});

	describe('Token Parameter Edge Cases', () => {
		it('should handle very large token values', () => {
			const result = provider.prepareTokenParam('test-model', 1000000);
			expect(result).toEqual({ maxTokens: 1000000 });
		});

		it('should handle string token values', () => {
			const result = provider.prepareTokenParam('test-model', '5000');
			expect(result).toEqual({ maxTokens: 5000 });
		});

		it('should handle null token values', () => {
			const result = provider.prepareTokenParam('test-model', null);
			expect(result).toEqual({ maxTokens: 0 });
		});
	});

	describe('Provider Integration', () => {
		it('should be compatible with provider registry', () => {
			// Test that the provider can be instantiated and used
			expect(provider.name).toBe('LM Studio');
			expect(typeof provider.getClient).toBe('function');
			expect(typeof provider.validateAuth).toBe('function');
			expect(typeof provider.prepareTokenParam).toBe('function');
		});

		it('should support all required provider methods', () => {
			const requiredMethods = [
				'validateAuth',
				'getClient', 
				'prepareTokenParam',
				'validateOptionalParams',
				'isRequiredApiKey',
				'getRequiredApiKeyName',
				'requiresMaxCompletionTokens'
			];

			requiredMethods.forEach(method => {
				expect(typeof provider[method]).toBe('function');
			});
		});
	});
});
