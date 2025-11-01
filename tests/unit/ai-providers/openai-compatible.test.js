/**
 * Tests for OpenAICompatibleProvider base class
 */

import { OpenAICompatibleProvider } from '../../../src/ai-providers/openai-compatible.js';

describe('OpenAICompatibleProvider', () => {
	describe('constructor', () => {
		it('should initialize with required config', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY'
			});

			expect(provider.name).toBe('Test Provider');
			expect(provider.apiKeyEnvVar).toBe('TEST_API_KEY');
			expect(provider.requiresApiKey).toBe(true);
		});

		it('should initialize with requiresApiKey set to false', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: false
			});

			expect(provider.requiresApiKey).toBe(false);
		});

		it('should throw error if name is missing', () => {
			expect(() => {
				new OpenAICompatibleProvider({
					apiKeyEnvVar: 'TEST_API_KEY'
				});
			}).toThrow('Provider name is required');
		});

		it('should throw error if apiKeyEnvVar is missing', () => {
			expect(() => {
				new OpenAICompatibleProvider({
					name: 'Test Provider'
				});
			}).toThrow('API key environment variable name is required');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return correct environment variable name', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY'
			});

			expect(provider.getRequiredApiKeyName()).toBe('TEST_API_KEY');
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return true by default', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY'
			});

			expect(provider.isRequiredApiKey()).toBe(true);
		});

		it('should return false when explicitly set', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: false
			});

			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('validateAuth', () => {
		it('should validate API key is present when required', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: true
			});

			expect(() => {
				provider.validateAuth({});
			}).toThrow('Test Provider API key is required');
		});

		it('should not validate API key when not required', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: false
			});

			expect(() => {
				provider.validateAuth({});
			}).not.toThrow();
		});

		it('should pass with valid API key', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY'
			});

			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).not.toThrow();
		});
	});

	describe('getBaseURL', () => {
		it('should return custom baseURL from params', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				defaultBaseURL: 'https://default.api.com'
			});

			const baseURL = provider.getBaseURL({
				baseURL: 'https://custom.api.com'
			});
			expect(baseURL).toBe('https://custom.api.com');
		});

		it('should return default baseURL if no custom provided', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				defaultBaseURL: 'https://default.api.com'
			});

			const baseURL = provider.getBaseURL({});
			expect(baseURL).toBe('https://default.api.com');
		});

		it('should use custom getBaseURL function', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				getBaseURL: (params) => `https://api.example.com/${params.route}`
			});

			const baseURL = provider.getBaseURL({ route: 'v2' });
			expect(baseURL).toBe('https://api.example.com/v2');
		});
	});

	describe('getClient', () => {
		it('should create client with API key when required', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: true,
				defaultBaseURL: 'https://api.example.com'
			});

			const client = provider.getClient({ apiKey: 'test-key' });
			expect(client).toBeDefined();
		});

		it('should create client without API key when not required', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: false,
				defaultBaseURL: 'https://api.example.com'
			});

			const client = provider.getClient({});
			expect(client).toBeDefined();
		});

		it('should throw error when API key is required but missing', () => {
			const provider = new OpenAICompatibleProvider({
				name: 'Test Provider',
				apiKeyEnvVar: 'TEST_API_KEY',
				requiresApiKey: true
			});

			expect(() => {
				provider.getClient({});
			}).toThrow('Test Provider API key is required.');
		});
	});
});
