import { jest } from '@jest/globals';

// Mock the gemini-cli SDK module
jest.unstable_mockModule('ai-sdk-provider-gemini-cli', () => ({
	createGeminiProvider: jest.fn((options) => {
		const provider = (modelId, settings) => ({
			// Mock language model
			id: modelId,
			settings,
			authOptions: options
		});
		provider.languageModel = jest.fn((id, settings) => ({ id, settings }));
		provider.chat = provider.languageModel;
		return provider;
	})
}));

// Mock the base provider
jest.unstable_mockModule('../../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: class {
		constructor() {
			this.name = 'Base Provider';
			this.needsExplicitJsonSchema = false;
			this.supportsTemperature = true;
		}
		handleError(context, error) {
			throw error;
		}
		validateParams(params) {
			if (!params.modelId) {
				throw new Error('Model ID is required');
			}
		}
		validateMessages(messages) {
			if (!messages || !Array.isArray(messages)) {
				throw new Error('Invalid messages array');
			}
		}
	}
}));

// Import after mocking
const { GeminiCliProvider } = await import(
	'../../../src/ai-providers/gemini-cli.js'
);
const { createGeminiProvider } = await import('ai-sdk-provider-gemini-cli');

describe('GeminiCliProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new GeminiCliProvider();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should set the provider name to Gemini CLI', () => {
			expect(provider.name).toBe('Gemini CLI');
		});

		it('should set supportsTemperature to false', () => {
			expect(provider.supportsTemperature).toBe(false);
		});

		it('should not set needsExplicitJsonSchema (rely on SDK defaults)', () => {
			// The SDK has defaultObjectGenerationMode = 'json' and supportsStructuredOutputs = true
			// so we don't need to override this in the provider
			expect(provider.needsExplicitJsonSchema).toBe(false);
		});
	});

	describe('validateAuth', () => {
		it('should not throw an error when API key is provided', () => {
			expect(() => provider.validateAuth({ apiKey: 'test-key' })).not.toThrow();
		});

		it('should not throw an error when no API key is provided', () => {
			expect(() => provider.validateAuth({})).not.toThrow();
		});

		it('should not throw an error when called with no parameters', () => {
			expect(() => provider.validateAuth()).not.toThrow();
		});

		it('should not throw an error when called with undefined', () => {
			expect(() => provider.validateAuth(undefined)).not.toThrow();
		});
	});

	describe('getClient', () => {
		it('should return a gemini client with API key auth when apiKey is provided', async () => {
			const client = await provider.getClient({ apiKey: 'test-api-key' });

			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'api-key',
				apiKey: 'test-api-key'
			});
		});

		it('should return a gemini client with OAuth auth when no apiKey is provided', async () => {
			const client = await provider.getClient({});

			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal'
			});
		});

		it('should use OAuth when apiKey is the special no-key-required value', async () => {
			const client = await provider.getClient({
				apiKey: 'gemini-cli-no-key-required'
			});

			expect(client).toBeDefined();
			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal'
			});
		});

		it('should include baseURL when provided with API key', async () => {
			const client = await provider.getClient({
				apiKey: 'test-key',
				baseURL: 'https://custom-endpoint.com'
			});

			expect(client).toBeDefined();
			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'api-key',
				apiKey: 'test-key',
				baseURL: 'https://custom-endpoint.com'
			});
		});

		it('should include baseURL when provided with OAuth', async () => {
			const client = await provider.getClient({
				baseURL: 'https://custom-endpoint.com'
			});

			expect(client).toBeDefined();
			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal',
				baseURL: 'https://custom-endpoint.com'
			});
		});

		it('should have languageModel and chat methods', async () => {
			const client = await provider.getClient({ apiKey: 'test-key' });
			expect(client.languageModel).toBeDefined();
			expect(client.chat).toBeDefined();
			expect(client.chat).toBe(client.languageModel);
		});

		it('should use OAuth with empty string API key', async () => {
			await provider.getClient({ apiKey: '' });

			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal'
			});
		});

		it('should throw error when createGeminiProvider fails', async () => {
			createGeminiProvider.mockImplementationOnce(() => {
				throw new Error('Auth initialization failed');
			});

			await expect(provider.getClient({})).rejects.toThrow(
				'Auth initialization failed'
			);
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return GEMINI_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('GEMINI_API_KEY');
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return false (API key is optional for gemini-cli)', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('base class delegation', () => {
		it('should not override generateText (uses base class)', () => {
			// Verify that generateText is not defined on the provider prototype
			// (it inherits from base class)
			expect(
				Object.prototype.hasOwnProperty.call(
					GeminiCliProvider.prototype,
					'generateText'
				)
			).toBe(false);
		});

		it('should not override streamText (uses base class)', () => {
			expect(
				Object.prototype.hasOwnProperty.call(
					GeminiCliProvider.prototype,
					'streamText'
				)
			).toBe(false);
		});

		it('should not override generateObject (uses base class)', () => {
			expect(
				Object.prototype.hasOwnProperty.call(
					GeminiCliProvider.prototype,
					'generateObject'
				)
			).toBe(false);
		});

		it('should not override streamObject (uses base class)', () => {
			expect(
				Object.prototype.hasOwnProperty.call(
					GeminiCliProvider.prototype,
					'streamObject'
				)
			).toBe(false);
		});

		it('should not have JSON extraction methods (removed)', () => {
			expect(provider._extractSystemMessage).toBeUndefined();
			expect(provider._detectJsonRequest).toBeUndefined();
			expect(provider._getJsonEnforcementPrompt).toBeUndefined();
			expect(provider._isValidJson).toBeUndefined();
			expect(provider.extractJson).toBeUndefined();
			expect(provider._simplifyJsonPrompts).toBeUndefined();
		});
	});

	describe('authentication scenarios', () => {
		it('should use api-key auth type with valid API key', async () => {
			await provider.getClient({ apiKey: 'gemini-test-key' });

			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'api-key',
				apiKey: 'gemini-test-key'
			});
		});

		it('should use oauth-personal auth type without API key', async () => {
			await provider.getClient({});

			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal'
			});
		});

		it('should prioritize OAuth over special marker API key', async () => {
			await provider.getClient({ apiKey: 'gemini-cli-no-key-required' });

			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal'
			});
		});
	});
});
