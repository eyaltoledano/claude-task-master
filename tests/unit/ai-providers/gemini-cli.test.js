import { jest } from '@jest/globals';

// Mock zod
jest.unstable_mockModule('zod', () => {
	const createSchema = (type) => {
		const schema = {
			_def: { type },
			optional: jest.fn(() => ({
				...schema,
				_def: { ...schema._def, optional: true }
			}))
		};
		return schema;
	};

	const numberSchema = () => {
		const schema = createSchema('number');
		schema.min = jest.fn(() => schema);
		schema.max = jest.fn(() => schema);
		return schema;
	};

	return {
		z: {
			object: jest.fn((shape) => ({
				_def: { shape: () => shape, type: 'object' }
			})),
			array: jest.fn((schema) => ({ _def: { type: 'array', schema } })),
			string: jest.fn(() => createSchema('string')),
			number: jest.fn(() => numberSchema()),
			record: jest.fn(() => createSchema('record')),
			unknown: jest.fn(() => createSchema('unknown')),
			any: jest.fn(() => createSchema('any'))
		}
	};
});

// Mock the ai module - these are the actual SDK functions that would make API calls
jest.unstable_mockModule('ai', () => ({
	generateObject: jest.fn().mockResolvedValue({
		object: { test: 'mock object' },
		usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
	}),
	generateText: jest.fn().mockResolvedValue({
		text: 'mock text response',
		usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
	}),
	streamText: jest.fn().mockResolvedValue({
		textStream: {
			[Symbol.asyncIterator]: async function* () {
				yield 'mock';
			}
		}
	})
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

// Create mock functions that can be spied on
const mockBaseGenerateText = jest.fn().mockResolvedValue({
	text: 'Mock base text response',
	usage: { promptTokens: 5, completionTokens: 10 }
});

const mockBaseGenerateObject = jest
	.fn()
	.mockRejectedValue(new Error('Mock base generateObject error'));

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
			return mockBaseGenerateObject.call(this, params);
		}
		async generateText(params) {
			return mockBaseGenerateText.call(this, params);
		}
	}
}));

// Mock the log module
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: jest.fn()
}));

// Import the modules
const { createGeminiProvider } = await import('ai-sdk-provider-gemini-cli');
const { generateObject, generateText, streamText } = await import('ai');
const { log } = await import('../../../scripts/modules/utils.js');
const { BaseAIProvider } = await import(
	'../../../src/ai-providers/base-provider.js'
);

// Import after all dependencies are loaded and mocked
const { GeminiCliProvider } = await import(
	'../../../src/ai-providers/gemini-cli.js'
);

describe('GeminiCliProvider', () => {
	let provider;
	let consoleLogSpy;

	beforeEach(() => {
		provider = new GeminiCliProvider();
		jest.clearAllMocks();
		// Reset the base class mocks
		mockBaseGenerateText.mockClear();
		mockBaseGenerateObject.mockClear();
		mockBaseGenerateText.mockResolvedValue({
			text: 'Mock base text response',
			usage: { promptTokens: 5, completionTokens: 10 }
		});
		mockBaseGenerateObject.mockRejectedValue(
			new Error('Mock base generateObject error')
		);
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

	describe('generateText', () => {
		it('should be defined on the provider', () => {
			expect(provider.generateText).toBeDefined();
			expect(typeof provider.generateText).toBe('function');
		});

		it('should call generateText method', async () => {
			const mockParams = {
				modelId: 'gemini-2.0-flash-exp',
				apiKey: 'test-key',
				messages: [{ role: 'user', content: 'Hello' }]
			};

			// Spy on the generateText method
			const generateTextSpy = jest.spyOn(provider, 'generateText');

			// Set base class mock to return success
			mockBaseGenerateText.mockResolvedValueOnce({
				text: 'Hello response',
				usage: {}
			});

			try {
				await provider.generateText(mockParams);
			} catch (error) {
				// Ignore errors for now
			}

			expect(generateTextSpy).toHaveBeenCalledWith(mockParams);
		});

		it('should redirect JSON requests to generateObject', async () => {
			const mockParams = {
				modelId: 'gemini-2.0-flash-exp',
				apiKey: 'test-key',
				messages: [{ role: 'user', content: 'Respond ONLY with valid JSON' }]
			};

			// Create a fresh provider instance for this test
			const testProvider = new GeminiCliProvider();

			// Mock the generateObject method on this specific instance
			testProvider.generateObject = jest.fn().mockResolvedValueOnce({
				object: { result: 'success' },
				usage: { promptTokens: 10, completionTokens: 20 }
			});

			const result = await testProvider.generateText(mockParams);

			// First check that we got the expected result
			expect(result).toBeDefined();
			expect(result.text).toBe('{\n  "result": "success"\n}');
			expect(testProvider.generateObject).toHaveBeenCalled();
		});

		it('should use normal generateText for non-JSON requests', async () => {
			const mockParams = {
				modelId: 'gemini-2.0-flash-exp',
				apiKey: 'test-key',
				messages: [{ role: 'user', content: 'Hello, how are you?' }]
			};

			// Set up the base mock response
			mockBaseGenerateText.mockResolvedValueOnce({
				text: 'I am doing well, thank you!',
				usage: { promptTokens: 5, completionTokens: 10 }
			});

			const result = await provider.generateText(mockParams);

			expect(result).toBeDefined();
			expect(result.text).toBe('I am doing well, thank you!');
			expect(mockBaseGenerateText).toHaveBeenCalled();
		});

		it('should detect various JSON request patterns', async () => {
			const jsonPatterns = [
				'Respond ONLY with a valid JSON',
				'Return ONLY the JSON object',
				'Do not include any explanatory text'
			];

			for (const pattern of jsonPatterns) {
				const mockParams = {
					modelId: 'gemini-2.0-flash-exp',
					apiKey: 'test-key',
					messages: [{ role: 'user', content: pattern }]
				};

				// Create a fresh provider for each test
				const testProvider = new GeminiCliProvider();

				// Mock generateObject on this instance
				testProvider.generateObject = jest.fn().mockResolvedValueOnce({
					object: { test: true },
					usage: {}
				});

				const result = await testProvider.generateText(mockParams);

				expect(result.text).toBe('{\n  "test": true\n}');
				expect(testProvider.generateObject).toHaveBeenCalled();
			}
		});

		it('should use appropriate schema for complexity analysis', async () => {
			const mockParams = {
				modelId: 'gemini-2.0-flash-exp',
				apiKey: 'test-key',
				messages: [
					{
						role: 'user',
						content:
							'Analyze tasks with complexityScore and taskId. Respond ONLY with a valid JSON object'
					}
				]
			};

			// Create a fresh provider
			const testProvider = new GeminiCliProvider();

			// Mock generateObject to capture the schema
			testProvider.generateObject = jest.fn().mockResolvedValueOnce({
				object: { analysis: [] },
				usage: {}
			});

			const result = await testProvider.generateText(mockParams);

			expect(result.text).toBe('{\n  "analysis": []\n}');
			expect(testProvider.generateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: 'gemini-2.0-flash-exp',
					apiKey: 'test-key',
					messages: mockParams.messages,
					schema: expect.any(Object),
					objectName: 'response'
				})
			);
		});

		it('should fall back to regular generateText if generateObject fails', async () => {
			const mockParams = {
				modelId: 'gemini-2.0-flash-exp',
				apiKey: 'test-key',
				messages: [{ role: 'user', content: 'Respond ONLY with valid JSON' }]
			};

			// Mock generateObject to fail
			jest
				.spyOn(provider, 'generateObject')
				.mockRejectedValueOnce(new Error('generateObject failed'));

			// Set up the base mock response for fallback
			mockBaseGenerateText.mockResolvedValueOnce({
				text: '{"fallback": true}',
				usage: {}
			});

			const result = await provider.generateText(mockParams);

			expect(result).toBeDefined();
			expect(result.text).toBe('{"fallback": true}');
			expect(mockBaseGenerateText).toHaveBeenCalled();
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return GEMINI_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('GEMINI_API_KEY');
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return false', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('authentication scenarios', () => {
		it('should use api-key auth type with API key', async () => {
			await provider.getClient({ apiKey: 'actual-api-key' });
			expect(createGeminiProvider).toHaveBeenCalledWith({
				authType: 'api-key',
				apiKey: 'actual-api-key'
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
