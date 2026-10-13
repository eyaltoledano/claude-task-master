/**
 * Tests for CheaperInferenceProvider
 */

import { CheaperInferenceProvider } from '../../../src/ai-providers/cheaperinference.js';

describe('CheaperInferenceProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new CheaperInferenceProvider();
	});

	describe('constructor', () => {
		it('should initialize with correct name', () => {
			expect(provider.name).toBe('Cheaper Inference');
		});

		it('should initialize with correct default baseURL', () => {
			expect(provider.defaultBaseURL).toBe(
				'https://api.cheaperinference.com/v1'
			);
		});

		it('should require an API key', () => {
			expect(provider.requiresApiKey).toBe(true);
		});

		it('should enable structured outputs', () => {
			expect(provider.supportsStructuredOutputs).toBe(true);
		});

		it('should inherit from OpenAICompatibleProvider', () => {
			expect(provider).toHaveProperty('generateText');
			expect(provider).toHaveProperty('streamText');
			expect(provider).toHaveProperty('generateObject');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return correct environment variable name', () => {
			expect(provider.getRequiredApiKeyName()).toBe(
				'CHEAPER_INFERENCE_API_KEY'
			);
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

		it('should create client even without API key (validation deferred to SDK)', () => {
			const client = provider.getClient({});
			expect(typeof client).toBe('function');
		});
	});

	describe('validateAuth', () => {
		it('should throw when API key is missing', () => {
			expect(() => {
				provider.validateAuth({});
			}).toThrow('Cheaper Inference API key is required');
		});

		it('should pass with valid API key', () => {
			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).not.toThrow();
		});
	});
});
