/**
 * Tests for AzureAIFoundryProvider
 *
 * Tests the Azure AI Foundry (Microsoft Foundry) provider implementation,
 * which provides access to various AI models through Azure's unified endpoint.
 */

import { AzureAIFoundryProvider } from '../../../src/ai-providers/azure-ai-foundry.js';

describe('AzureAIFoundryProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new AzureAIFoundryProvider();
	});

	describe('isAnthropicModel', () => {
		it('should return true for claude model names', () => {
			expect(provider.isAnthropicModel('claude-3-5-sonnet')).toBe(true);
			expect(provider.isAnthropicModel('claude-opus-4-5')).toBe(true);
			expect(provider.isAnthropicModel('Claude-3-Haiku')).toBe(true);
		});

		it('should return true for anthropic model names', () => {
			expect(provider.isAnthropicModel('anthropic-model')).toBe(true);
			expect(provider.isAnthropicModel('Anthropic-Claude')).toBe(true);
		});

		it('should return false for non-Anthropic models', () => {
			expect(provider.isAnthropicModel('gpt-4o')).toBe(false);
			expect(provider.isAnthropicModel('Phi-4')).toBe(false);
			expect(provider.isAnthropicModel('llama-3')).toBe(false);
			expect(provider.isAnthropicModel('mistral-large')).toBe(false);
		});

		it('should return false for null or undefined', () => {
			expect(provider.isAnthropicModel(null)).toBe(false);
			expect(provider.isAnthropicModel(undefined)).toBe(false);
		});

		it('should return false for empty string', () => {
			expect(provider.isAnthropicModel('')).toBe(false);
		});

		it('should be case insensitive', () => {
			expect(provider.isAnthropicModel('CLAUDE-3')).toBe(true);
			expect(provider.isAnthropicModel('ANTHROPIC')).toBe(true);
		});
	});

	describe('getBaseResourceURL', () => {
		it('should extract base URL from full endpoint', () => {
			const result = provider.getBaseResourceURL(
				'https://my-resource.services.ai.azure.com/models'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com');
		});

		it('should extract base URL from endpoint with path', () => {
			const result = provider.getBaseResourceURL(
				'https://my-resource.services.ai.azure.com/api/projects/my-project'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com');
		});

		it('should handle base URL without path', () => {
			const result = provider.getBaseResourceURL(
				'https://my-resource.services.ai.azure.com'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com');
		});

		it('should return null for null input', () => {
			expect(provider.getBaseResourceURL(null)).toBeNull();
		});

		it('should return undefined for undefined input', () => {
			expect(provider.getBaseResourceURL(undefined)).toBeUndefined();
		});

		it('should handle invalid URLs gracefully', () => {
			const result = provider.getBaseResourceURL('not-a-valid-url');
			expect(result).toBe('not-a-valid-url');
		});

		it('should extract base from URL with port', () => {
			const result = provider.getBaseResourceURL(
				'https://localhost:8080/some/path'
			);
			expect(result).toBe('https://localhost:8080');
		});
	});

	describe('normalizeAnthropicBaseURL', () => {
		it('should append /anthropic to base resource URL', () => {
			const result = provider.normalizeAnthropicBaseURL(
				'https://my-resource.services.ai.azure.com'
			);
			expect(result).toBe(
				'https://my-resource.services.ai.azure.com/anthropic'
			);
		});

		it('should extract base and append /anthropic from URL with path', () => {
			const result = provider.normalizeAnthropicBaseURL(
				'https://my-resource.services.ai.azure.com/models'
			);
			expect(result).toBe(
				'https://my-resource.services.ai.azure.com/anthropic'
			);
		});

		it('should extract base and append /anthropic from project URL', () => {
			const result = provider.normalizeAnthropicBaseURL(
				'https://my-resource.services.ai.azure.com/api/projects/my-project'
			);
			expect(result).toBe(
				'https://my-resource.services.ai.azure.com/anthropic'
			);
		});
	});

	describe('constructor', () => {
		it('should initialize with correct provider name', () => {
			expect(provider.name).toBe('Azure AI Foundry');
		});

		it('should inherit from BaseAIProvider', () => {
			expect(typeof provider.generateText).toBe('function');
			expect(typeof provider.streamText).toBe('function');
			expect(typeof provider.generateObject).toBe('function');
			expect(typeof provider.streamObject).toBe('function');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return correct environment variable name', () => {
			expect(provider.getRequiredApiKeyName()).toBe('AZURE_AI_FOUNDRY_API_KEY');
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return true as API key is always required', () => {
			expect(provider.isRequiredApiKey()).toBe(true);
		});
	});

	describe('validateAuth', () => {
		it('should throw error when API key is missing', () => {
			expect(() => {
				provider.validateAuth({
					baseURL: 'https://test.services.ai.azure.com'
				});
			}).toThrow('Azure AI Foundry API key is required');
		});

		it('should throw error when baseURL is missing', () => {
			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).toThrow('Azure AI Foundry endpoint URL is required');
		});

		it('should pass when both apiKey and baseURL are provided', () => {
			expect(() => {
				provider.validateAuth({
					apiKey: 'test-key',
					baseURL: 'https://test.services.ai.azure.com'
				});
			}).not.toThrow();
		});
	});

	describe('normalizeBaseURL', () => {
		it('should return null for null input', () => {
			expect(provider.normalizeBaseURL(null)).toBeNull();
		});

		it('should return undefined for undefined input', () => {
			expect(provider.normalizeBaseURL(undefined)).toBeUndefined();
		});

		it('should append /models to Azure AI Foundry services endpoints', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should not double-append /models if already present', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com/models'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should remove trailing slashes before appending', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com/'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should remove multiple trailing slashes', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com///'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should preserve Azure OpenAI endpoints without modification', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.openai.azure.com'
			);
			expect(result).toBe('https://my-resource.openai.azure.com');
		});

		it('should handle endpoints with existing path components', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com/v1'
			);
			// Non-api paths get /models appended
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should extract base URL from /api/projects/ path', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com/api/projects/my-project'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should handle /api/ paths by converting to /models', () => {
			const result = provider.normalizeBaseURL(
				'https://my-resource.services.ai.azure.com/api/something'
			);
			expect(result).toBe('https://my-resource.services.ai.azure.com/models');
		});

		it('should handle invalid URLs gracefully by returning cleaned input', () => {
			// Invalid URL that can't be parsed will return the input cleaned of trailing slashes
			const result = provider.normalizeBaseURL('not-a-valid-url///');
			expect(result).toBe('not-a-valid-url');
		});
	});

	describe('getClient', () => {
		it('should create client with valid parameters', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com'
			});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should create client with normalized baseURL', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com/'
			});
			expect(client).toBeDefined();
		});

		it('should create client without proxy when not configured', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com'
			});
			expect(client).toBeDefined();
		});

		it('should create OpenAI-compatible client for non-Claude models', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com',
				modelId: 'Phi-4'
			});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should create OpenAI-compatible client for GPT models', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com',
				modelId: 'gpt-4o'
			});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should create Anthropic client for Claude models', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com',
				modelId: 'claude-opus-4-5'
			});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should create Anthropic client for claude-3-5-sonnet', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com',
				modelId: 'claude-3-5-sonnet'
			});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should route to OpenAI-compatible when modelId is not provided', () => {
			const client = provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://test.services.ai.azure.com'
			});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});
	});

	describe('validateParams', () => {
		it('should validate required modelId', () => {
			expect(() => {
				provider.validateParams({
					apiKey: 'test-key',
					baseURL: 'https://test.services.ai.azure.com'
				});
			}).toThrow('Model ID is required');
		});

		it('should pass with all required params', () => {
			expect(() => {
				provider.validateParams({
					apiKey: 'test-key',
					baseURL: 'https://test.services.ai.azure.com',
					modelId: 'gpt-4o'
				});
			}).not.toThrow();
		});

		it('should validate temperature range', () => {
			expect(() => {
				provider.validateParams({
					apiKey: 'test-key',
					baseURL: 'https://test.services.ai.azure.com',
					modelId: 'gpt-4o',
					temperature: 1.5
				});
			}).toThrow('Temperature must be between 0 and 1');
		});

		it('should validate maxTokens is positive', () => {
			expect(() => {
				provider.validateParams({
					apiKey: 'test-key',
					baseURL: 'https://test.services.ai.azure.com',
					modelId: 'gpt-4o',
					maxTokens: -100
				});
			}).toThrow('maxTokens must be a finite number greater than 0');
		});
	});

	describe('validateMessages', () => {
		it('should throw for empty messages array', () => {
			expect(() => {
				provider.validateMessages([]);
			}).toThrow('Invalid or empty messages array provided');
		});

		it('should throw for null messages', () => {
			expect(() => {
				provider.validateMessages(null);
			}).toThrow('Invalid or empty messages array provided');
		});

		it('should throw for message without role', () => {
			expect(() => {
				provider.validateMessages([{ content: 'test' }]);
			}).toThrow('Invalid message format');
		});

		it('should throw for message without content', () => {
			expect(() => {
				provider.validateMessages([{ role: 'user' }]);
			}).toThrow('Invalid message format');
		});

		it('should pass for valid messages', () => {
			expect(() => {
				provider.validateMessages([{ role: 'user', content: 'Hello' }]);
			}).not.toThrow();
		});
	});

	describe('integration with MODEL_MAP', () => {
		it('should be recognized as a valid provider', () => {
			// The provider should be usable with any model since azure-ai-foundry
			// has an empty array in MODEL_MAP (accepts any model deployment)
			expect(provider.name).toBe('Azure AI Foundry');
		});
	});
});
