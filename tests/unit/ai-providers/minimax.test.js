/**
 * Tests for MiniMaxProvider
 */

import { MiniMaxProvider } from '../../../src/ai-providers/minimax.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supportedModels = JSON.parse(
	readFileSync(resolve(__dirname, '../../../scripts/modules/supported-models.json'), 'utf-8')
);

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

		it('should create client even without API key (validation deferred to SDK)', () => {
			const client = provider.getClient({});
			expect(typeof client).toBe('function');
		});
	});

	describe('validateAuth', () => {
		it('should throw when API key is missing', () => {
			expect(() => {
				provider.validateAuth({});
			}).toThrow('MiniMax API key is required');
		});

		it('should pass with valid API key', () => {
			expect(() => {
				provider.validateAuth({ apiKey: 'test-key' });
			}).not.toThrow();
		});
	});

	describe('supported-models.json', () => {
		const minimaxModels = supportedModels.minimax;

		it('should include MiniMax-M2.7 in model list', () => {
			const m27 = minimaxModels.find((m) => m.id === 'MiniMax-M2.7');
			expect(m27).toBeDefined();
			expect(m27.supported).toBe(true);
		});

		it('should include MiniMax-M2.7-highspeed in model list', () => {
			const m27hs = minimaxModels.find((m) => m.id === 'MiniMax-M2.7-highspeed');
			expect(m27hs).toBeDefined();
			expect(m27hs.supported).toBe(true);
		});

		it('should have MiniMax-M2.7 as the first model', () => {
			expect(minimaxModels[0].id).toBe('MiniMax-M2.7');
		});

		it('should have MiniMax-M2.7-highspeed as the second model', () => {
			expect(minimaxModels[1].id).toBe('MiniMax-M2.7-highspeed');
		});

		it('should retain previous MiniMax-M2.5 models', () => {
			const m25 = minimaxModels.find((m) => m.id === 'MiniMax-M2.5');
			const m25hs = minimaxModels.find((m) => m.id === 'MiniMax-M2.5-highspeed');
			expect(m25).toBeDefined();
			expect(m25hs).toBeDefined();
		});
	});
});
