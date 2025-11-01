/**
 * Tests for LMStudioProvider
 */

import { LMStudioProvider } from '../../../src/ai-providers/lmstudio.js';

describe('LMStudioProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new LMStudioProvider();
	});

	describe('constructor', () => {
		it('should initialize with correct name', () => {
			expect(provider.name).toBe('LM Studio');
		});

		it('should not require API key', () => {
			expect(provider.requiresApiKey).toBe(false);
		});

		it('should have default localhost baseURL', () => {
			expect(provider.defaultBaseURL).toBe('http://localhost:1234/v1');
		});

		it('should disable structured outputs (LM Studio only supports json_schema mode)', () => {
			expect(provider.supportsStructuredOutputs).toBe(true);
		});

		it('should inherit from OpenAICompatibleProvider', () => {
			expect(provider).toHaveProperty('generateText');
			expect(provider).toHaveProperty('streamText');
			expect(provider).toHaveProperty('generateObject');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return environment variable name', () => {
			expect(provider.getRequiredApiKeyName()).toBe('LMSTUDIO_API_KEY');
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return false as local server does not require API key', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('getClient', () => {
		it('should create client without API key', () => {
			const client = provider.getClient({});
			expect(client).toBeDefined();
		});

		it('should create client with custom baseURL', () => {
			const params = {
				baseURL: 'http://custom-host:8080/v1'
			};
			const client = provider.getClient(params);
			expect(client).toBeDefined();
		});

		it('should not throw error when API key is missing', () => {
			expect(() => {
				provider.getClient({});
			}).not.toThrow();
		});
	});

	describe('validateAuth', () => {
		it('should not require API key validation', () => {
			expect(() => {
				provider.validateAuth({});
			}).not.toThrow();
		});

		it('should pass with or without API key', () => {
			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).not.toThrow();

			expect(() => {
				provider.validateAuth({});
			}).not.toThrow();
		});
	});

	describe('getBaseURL', () => {
		it('should return default localhost URL', () => {
			const baseURL = provider.getBaseURL({});
			expect(baseURL).toBe('http://localhost:1234/v1');
		});

		it('should return custom baseURL when provided', () => {
			const baseURL = provider.getBaseURL({
				baseURL: 'http://192.168.1.100:1234/v1'
			});
			expect(baseURL).toBe('http://192.168.1.100:1234/v1');
		});
	});
});
