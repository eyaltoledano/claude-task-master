import { jest } from '@jest/globals';

// Mock the ai module
jest.unstable_mockModule('ai', () => ({
	generateObject: jest.fn(),
	generateText: jest.fn(),
	streamText: jest.fn()
}));

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
		validateParams(params) {
			// Basic validation
			if (!params.modelId) {
				throw new Error('Model ID is required');
			}
		}
		validateMessages(messages) {
			if (!messages || !Array.isArray(messages)) {
				throw new Error('Invalid messages array');
			}
		}
		async generateObject(params) {
			// Mock implementation that can be overridden
			throw new Error('Mock base generateObject error');
		}
	}
}));

// Mock the log module
jest.unstable_mockModule('../../../scripts/modules/index.js', () => ({
	log: jest.fn()
}));

// Import after mocking
const { GeminiCliProvider } = await import(
	'../../../src/ai-providers/gemini-cli.js'
);
const { createGeminiProvider } = await import('ai-sdk-provider-gemini-cli');
const { generateObject } = await import('ai');
const { log } = await import('../../../scripts/modules/index.js');

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

	describe('extractJson', () => {
		it('should extract JSON from markdown code blocks', () => {
			const input = '```json\n{"subtasks": [{"id": 1}]}\n```';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ subtasks: [{ id: 1 }] });
		});

		it('should extract JSON with explanatory text', () => {
			const input = 'Here\'s the JSON response:\n{"subtasks": [{"id": 1}]}';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ subtasks: [{ id: 1 }] });
		});

		it('should handle variable declarations', () => {
			const input = 'const result = {"subtasks": [{"id": 1}]};';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ subtasks: [{ id: 1 }] });
		});

		it('should handle trailing commas with jsonc-parser', () => {
			const input = '{"subtasks": [{"id": 1,}],}';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ subtasks: [{ id: 1 }] });
		});

		it('should handle arrays', () => {
			const input = 'The result is: [1, 2, 3]';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual([1, 2, 3]);
		});

		it('should handle nested objects with proper bracket matching', () => {
			const input = 'Response: {"outer": {"inner": {"value": "test"}}} extra text';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ outer: { inner: { value: "test" } } });
		});

		it('should handle escaped quotes in strings', () => {
			const input = '{"message": "He said \\"hello\\" to me"}';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ message: 'He said "hello" to me' });
		});

		it('should return original text if no JSON found', () => {
			const input = 'No JSON here';
			expect(provider.extractJson(input)).toBe(input);
		});

		it('should handle null or non-string input', () => {
			expect(provider.extractJson(null)).toBe(null);
			expect(provider.extractJson(undefined)).toBe(undefined);
			expect(provider.extractJson(123)).toBe(123);
		});

		it('should handle partial JSON by finding valid boundaries', () => {
			const input = '{"valid": true, "partial": "incomplete';
			// Should return original text since no valid JSON can be extracted
			expect(provider.extractJson(input)).toBe(input);
		});

		it('should handle performance edge cases with large text', () => {
			// Test with large text that has JSON at the end
			const largePrefix = 'This is a very long explanation. '.repeat(1000);
			const json = '{"result": "success"}';
			const input = largePrefix + json;
			
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ result: "success" });
		});

		it('should handle early termination for very large invalid content', () => {
			// Test that it doesn't hang on very large content without JSON
			const largeText = 'No JSON here. '.repeat(2000);
			const result = provider.extractJson(largeText);
			expect(result).toBe(largeText);
		});
	});

	describe('generateObject', () => {
		const mockParams = {
			modelId: 'gemini-2.0-flash-exp',
			apiKey: 'test-key',
			messages: [{ role: 'user', content: 'Test message' }],
			schema: { type: 'object', properties: {} },
			objectName: 'testObject'
		};

		beforeEach(() => {
			jest.clearAllMocks();
		});

		it('should handle JSON parsing errors by attempting manual extraction', async () => {
			// Mock the parent generateObject to throw a JSON parsing error
			jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(provider)), 'generateObject')
				.mockRejectedValueOnce(new Error('Failed to parse JSON response'));

			// Mock generateObject from ai module to return text with JSON
			generateObject.mockResolvedValueOnce({
				rawResponse: {
					text: 'Here is the JSON:\n```json\n{"subtasks": [{"id": 1}]}\n```'
				},
				object: null,
				usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
			});

			const result = await provider.generateObject(mockParams);

			expect(log).toHaveBeenCalledWith(
				'debug',
				expect.stringContaining('attempting manual extraction')
			);
			expect(generateObject).toHaveBeenCalledWith({
				model: expect.objectContaining({
					id: 'gemini-2.0-flash-exp',
					authOptions: expect.objectContaining({
						authType: 'api-key',
						apiKey: 'test-key'
					})
				}),
				messages: mockParams.messages,
				schema: mockParams.schema,
				mode: 'json', // Should use json mode for Gemini
				maxTokens: undefined,
				temperature: undefined
			});
			expect(result.object).toEqual({ subtasks: [{ id: 1 }] });
		});

		it('should throw error if manual extraction also fails', async () => {
			// Mock parent to throw JSON error
			jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(provider)), 'generateObject')
				.mockRejectedValueOnce(new Error('Failed to parse JSON'));

			// Mock generateObject to return unparseable text
			generateObject.mockResolvedValueOnce({
				rawResponse: { text: 'Not valid JSON at all' },
				object: null
			});

			await expect(provider.generateObject(mockParams)).rejects.toThrow(
				'Gemini CLI failed to generate valid JSON object: Failed to parse JSON'
			);
		});

		it('should pass through non-JSON errors unchanged', async () => {
			const otherError = new Error('Network error');
			jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(provider)), 'generateObject')
				.mockRejectedValueOnce(otherError);

			await expect(provider.generateObject(mockParams)).rejects.toThrow('Network error');
			expect(generateObject).not.toHaveBeenCalled();
		});

		it('should handle successful response from parent', async () => {
			const mockResult = {
				object: { test: 'data' },
				usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }
			};
			jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(provider)), 'generateObject')
				.mockResolvedValueOnce(mockResult);

			const result = await provider.generateObject(mockParams);
			expect(result).toEqual(mockResult);
			expect(generateObject).not.toHaveBeenCalled();
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
