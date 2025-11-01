/**
 * Tests for ZAICodingProvider
 */

import { ZAICodingProvider } from '../../../src/ai-providers/zai-coding.js';

describe('ZAICodingProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new ZAICodingProvider();
	});

	describe('constructor', () => {
		it('should initialize with correct name', () => {
			expect(provider.name).toBe('Z.ai (Coding Plan)');
		});

		it('should initialize with correct coding endpoint baseURL', () => {
			expect(provider.defaultBaseURL).toBe(
				'https://api.z.ai/api/coding/paas/v4/'
			);
		});

		it('should inherit from OpenAICompatibleProvider', () => {
			expect(provider).toHaveProperty('generateText');
			expect(provider).toHaveProperty('streamText');
			expect(provider).toHaveProperty('generateObject');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return ZAI_API_KEY environment variable name', () => {
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

		it('should use coding endpoint by default', () => {
			const params = {
				apiKey: 'test-key'
			};
			const client = provider.getClient(params);
			expect(client).toBeDefined();
			// The provider should use the coding endpoint
		});

		it('should throw error when API key is missing', () => {
			expect(() => {
				provider.getClient({});
			}).toThrow('Z.ai (Coding Plan) API key is required.');
		});
	});

	describe('validateAuth', () => {
		it('should validate API key is present', () => {
			expect(() => {
				provider.validateAuth({});
			}).toThrow('Z.ai (Coding Plan) API key is required');
		});

		it('should pass with valid API key', () => {
			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).not.toThrow();
		});
	});
});
