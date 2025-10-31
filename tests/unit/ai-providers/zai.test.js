/**
 * Tests for ZAIProvider
 */

import { ZAIProvider } from '../../../src/ai-providers/zai.js';

describe('ZAIProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new ZAIProvider();
	});

	describe('constructor', () => {
		it('should initialize with correct name', () => {
			expect(provider.name).toBe('Z.ai');
		});

		it('should initialize with correct default baseURL', () => {
			expect(provider.defaultBaseURL).toBe('https://api.z.ai/api/paas/v4/');
		});

		it('should inherit from OpenAICompatibleProvider', () => {
			expect(provider).toHaveProperty('generateText');
			expect(provider).toHaveProperty('streamText');
			expect(provider).toHaveProperty('generateObject');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return correct environment variable name', () => {
			expect(provider.getRequiredApiKeyName()).toBe('ZAI_API_KEY');
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return true as API key is required', () => {
			expect(provider.isRequiredApiKey()).toBe(true);
		});
	});

	describe('getClient', () => {
		it('should create client with API key', () => {
			const params = { apiKey: 'test-key' };
			const client = provider.getClient(params);
			expect(client).toBeDefined();
		});

		it('should create client with custom baseURL', () => {
			const params = {
				apiKey: 'test-key',
				baseURL: 'https://custom.api.com/v1'
			};
			const client = provider.getClient(params);
			expect(client).toBeDefined();
		});

		it('should throw error when API key is missing', () => {
			expect(() => {
				provider.getClient({});
			}).toThrow('Z.ai API key is required.');
		});
	});

	describe('validateAuth', () => {
		it('should validate API key is present', () => {
			expect(() => {
				provider.validateAuth({});
			}).toThrow('Z.ai API key is required');
		});

		it('should pass with valid API key', () => {
			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).not.toThrow();
		});
	});
});
