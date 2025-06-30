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
		}
		handleError(context, error) {
			throw error;
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
	let consoleLogSpy;

	beforeEach(() => {
		provider = new GeminiCliProvider();
		jest.clearAllMocks();
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
	});

	describe('constructor', () => {
		it('should set the provider name to Gemini CLI', () => {
			expect(provider.name).toBe('Gemini CLI');
		});
	});

	describe('validateAuth', () => {
		it('should not throw an error when API key is provided', () => {
			expect(() => provider.validateAuth({ apiKey: 'test-key' })).not.toThrow();
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it('should not require API key and should not log messages', () => {
			expect(() => provider.validateAuth({})).not.toThrow();
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it('should not require any parameters', () => {
			expect(() => provider.validateAuth()).not.toThrow();
			expect(consoleLogSpy).not.toHaveBeenCalled();
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

		it('should include baseURL when provided', async () => {
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

		it('should have languageModel and chat methods', async () => {
			const client = await provider.getClient({ apiKey: 'test-key' });
			expect(client.languageModel).toBeDefined();
			expect(client.chat).toBeDefined();
			expect(client.chat).toBe(client.languageModel);
		});
	});

	// Note: Error handling for module loading is tested in integration tests
	// since dynamic imports are difficult to mock properly in unit tests

	describe('authentication scenarios', () => {
		it('should use api-key auth type with API key', async () => {
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

		it('should handle empty string API key as no API key', async () => {
			await provider.getClient({ apiKey: '' });

			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'oauth-personal'
			});
		});
	});
});
