/**
 * Tests for MiniMaxProvider
 */

import { MiniMaxProvider } from '../../../src/ai-providers/minimax.js';

describe('MiniMaxProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new MiniMaxProvider();
	});

	describe('constructor', () => {
		it('should initialize with correct name', () => {
			expect(provider.name).toBe('MiniMax');
		});

		it('should initialize with correct default baseURL', () => {
			expect(provider.defaultBaseURL).toBe('https://api.minimax.io/v1');
		});

		it('should inherit from OpenAICompatibleProvider', () => {
			expect(provider).toHaveProperty('generateText');
			expect(provider).toHaveProperty('streamText');
			expect(provider).toHaveProperty('generateObject');
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return correct environment variable name', () => {
			expect(provider.getRequiredApiKeyName()).toBe('MINIMAX_API_KEY');
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
	});
});
