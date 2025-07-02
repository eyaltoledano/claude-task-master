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
const { generateObject, generateText, streamText } = await import('ai');
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

	describe('_extractSystemMessage', () => {
		it('should extract single system message', () => {
			const messages = [
				{ role: 'system', content: 'You are a helpful assistant' },
				{ role: 'user', content: 'Hello' }
			];
			const result = provider._extractSystemMessage(messages);
			expect(result.systemPrompt).toBe('You are a helpful assistant');
			expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
		});

		it('should combine multiple system messages', () => {
			const messages = [
				{ role: 'system', content: 'You are helpful' },
				{ role: 'system', content: 'Be concise' },
				{ role: 'user', content: 'Hello' }
			];
			const result = provider._extractSystemMessage(messages);
			expect(result.systemPrompt).toBe('You are helpful\n\nBe concise');
			expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
		});

		it('should handle messages without system prompts', () => {
			const messages = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there' }
			];
			const result = provider._extractSystemMessage(messages);
			expect(result.systemPrompt).toBeUndefined();
			expect(result.messages).toEqual(messages);
		});

		it('should handle empty or invalid input', () => {
			expect(provider._extractSystemMessage([])).toEqual({
				systemPrompt: undefined,
				messages: []
			});
			expect(provider._extractSystemMessage(null)).toEqual({
				systemPrompt: undefined,
				messages: []
			});
			expect(provider._extractSystemMessage(undefined)).toEqual({
				systemPrompt: undefined,
				messages: []
			});
		});

		it('should add JSON enforcement when enforceJsonOutput is true', () => {
			const messages = [
				{ role: 'system', content: 'You are a helpful assistant' },
				{ role: 'user', content: 'Hello' }
			];
			const result = provider._extractSystemMessage(messages, {
				enforceJsonOutput: true
			});
			expect(result.systemPrompt).toContain('You are a helpful assistant');
			expect(result.systemPrompt).toContain(
				'CRITICAL: You MUST respond with ONLY valid JSON'
			);
			expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
		});

		it('should add JSON enforcement with no existing system message', () => {
			const messages = [{ role: 'user', content: 'Return JSON format' }];
			const result = provider._extractSystemMessage(messages, {
				enforceJsonOutput: true
			});
			expect(result.systemPrompt).toBe(
				'CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, markdown formatting, code block markers, or conversational phrases like "Here is" or "Of course". Your entire response must be parseable JSON that starts with { or [ and ends with } or ]. No exceptions.'
			);
			expect(result.messages).toEqual([
				{ role: 'user', content: 'Return JSON format' }
			]);
		});
	});

	describe('_detectJsonRequest', () => {
		it('should detect JSON requests from user messages', () => {
			const messages = [
				{
					role: 'user',
					content: 'Please return JSON format with subtasks array'
				}
			];
			expect(provider._detectJsonRequest(messages)).toBe(true);
		});

		it('should detect various JSON indicators', () => {
			const testCases = [
				'respond only with valid JSON',
				'return JSON format',
				'output schema: {"test": true}',
				'format: [{"id": 1}]',
				'Please return subtasks in array format',
				'Return an object with properties'
			];

			testCases.forEach((content) => {
				const messages = [{ role: 'user', content }];
				expect(provider._detectJsonRequest(messages)).toBe(true);
			});
		});

		it('should not detect JSON requests for regular conversation', () => {
			const messages = [{ role: 'user', content: 'Hello, how are you today?' }];
			expect(provider._detectJsonRequest(messages)).toBe(false);
		});

		it('should handle multiple user messages', () => {
			const messages = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there' },
				{ role: 'user', content: 'Now please return JSON format' }
			];
			expect(provider._detectJsonRequest(messages)).toBe(true);
		});
	});

	describe('_getJsonEnforcementPrompt', () => {
		it('should return strict JSON enforcement prompt', () => {
			const prompt = provider._getJsonEnforcementPrompt();
			expect(prompt).toContain('CRITICAL');
			expect(prompt).toContain('ONLY valid JSON');
			expect(prompt).toContain('No exceptions');
		});
	});

	describe('_isValidJson', () => {
		it('should return true for valid JSON objects', () => {
			expect(provider._isValidJson('{"test": true}')).toBe(true);
			expect(provider._isValidJson('{"subtasks": [{"id": 1}]}')).toBe(true);
		});

		it('should return true for valid JSON arrays', () => {
			expect(provider._isValidJson('[1, 2, 3]')).toBe(true);
			expect(provider._isValidJson('[{"id": 1}, {"id": 2}]')).toBe(true);
		});

		it('should return false for invalid JSON', () => {
			expect(provider._isValidJson('Of course. Here is...')).toBe(false);
			expect(provider._isValidJson('{"invalid": json}')).toBe(false);
			expect(provider._isValidJson('not json at all')).toBe(false);
		});

		it('should handle edge cases', () => {
			expect(provider._isValidJson('')).toBe(false);
			expect(provider._isValidJson(null)).toBe(false);
			expect(provider._isValidJson(undefined)).toBe(false);
			expect(provider._isValidJson('   {"test": true}   ')).toBe(true); // with whitespace
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
			const input =
				'Response: {"outer": {"inner": {"value": "test"}}} extra text';
			const result = provider.extractJson(input);
			const parsed = JSON.parse(result);
			expect(parsed).toEqual({ outer: { inner: { value: 'test' } } });
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
			expect(parsed).toEqual({ result: 'success' });
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
			jest
				.spyOn(
					Object.getPrototypeOf(Object.getPrototypeOf(provider)),
					'generateObject'
				)
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
				system: expect.stringContaining(
					'CRITICAL: You MUST respond with ONLY valid JSON'
				),
				maxTokens: undefined,
				temperature: undefined
			});
			expect(result.object).toEqual({ subtasks: [{ id: 1 }] });
		});

		it('should throw error if manual extraction also fails', async () => {
			// Mock parent to throw JSON error
			jest
				.spyOn(
					Object.getPrototypeOf(Object.getPrototypeOf(provider)),
					'generateObject'
				)
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
			jest
				.spyOn(
					Object.getPrototypeOf(Object.getPrototypeOf(provider)),
					'generateObject'
				)
				.mockRejectedValueOnce(otherError);

			await expect(provider.generateObject(mockParams)).rejects.toThrow(
				'Network error'
			);
			expect(generateObject).not.toHaveBeenCalled();
		});

		it('should handle successful response from parent', async () => {
			const mockResult = {
				object: { test: 'data' },
				usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }
			};
			jest
				.spyOn(
					Object.getPrototypeOf(Object.getPrototypeOf(provider)),
					'generateObject'
				)
				.mockResolvedValueOnce(mockResult);

			const result = await provider.generateObject(mockParams);
			expect(result).toEqual(mockResult);
			expect(generateObject).not.toHaveBeenCalled();
		});
	});

	describe('system message support', () => {
		const mockParams = {
			modelId: 'gemini-2.0-flash-exp',
			apiKey: 'test-key',
			messages: [
				{ role: 'system', content: 'You are a helpful assistant' },
				{ role: 'user', content: 'Hello' }
			],
			maxTokens: 100,
			temperature: 0.7
		};

		describe('generateText with system messages', () => {
			beforeEach(() => {
				jest.clearAllMocks();
			});

			it('should pass system prompt separately to AI SDK', async () => {
				const { generateText } = await import('ai');
				generateText.mockResolvedValueOnce({
					text: 'Hello! How can I help you?',
					usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 }
				});

				const result = await provider.generateText(mockParams);

				expect(generateText).toHaveBeenCalledWith({
					model: expect.objectContaining({
						id: 'gemini-2.0-flash-exp'
					}),
					system: 'You are a helpful assistant',
					messages: [{ role: 'user', content: 'Hello' }],
					maxTokens: 100,
					temperature: 0.7
				});
				expect(result.text).toBe('Hello! How can I help you?');
			});

			it('should handle messages without system prompt', async () => {
				const { generateText } = await import('ai');
				const paramsNoSystem = {
					...mockParams,
					messages: [{ role: 'user', content: 'Hello' }]
				};

				generateText.mockResolvedValueOnce({
					text: 'Hi there!',
					usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 }
				});

				await provider.generateText(paramsNoSystem);

				expect(generateText).toHaveBeenCalledWith({
					model: expect.objectContaining({
						id: 'gemini-2.0-flash-exp'
					}),
					system: undefined,
					messages: [{ role: 'user', content: 'Hello' }],
					maxTokens: 100,
					temperature: 0.7
				});
			});
		});

		describe('streamText with system messages', () => {
			it('should pass system prompt separately to AI SDK', async () => {
				const { streamText } = await import('ai');
				const mockStream = { stream: 'mock-stream' };
				streamText.mockResolvedValueOnce(mockStream);

				const result = await provider.streamText(mockParams);

				expect(streamText).toHaveBeenCalledWith({
					model: expect.objectContaining({
						id: 'gemini-2.0-flash-exp'
					}),
					system: 'You are a helpful assistant',
					messages: [{ role: 'user', content: 'Hello' }],
					maxTokens: 100,
					temperature: 0.7
				});
				expect(result).toBe(mockStream);
			});
		});

		describe('generateObject with system messages', () => {
			const mockObjectParams = {
				...mockParams,
				schema: { type: 'object', properties: {} },
				objectName: 'testObject'
			};

			it('should include system prompt in fallback generateObject call', async () => {
				// Mock parent to throw JSON error
				jest
					.spyOn(
						Object.getPrototypeOf(Object.getPrototypeOf(provider)),
						'generateObject'
					)
					.mockRejectedValueOnce(new Error('Failed to parse JSON'));

				// Mock direct generateObject call
				generateObject.mockResolvedValueOnce({
					object: { result: 'success' },
					usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 }
				});

				const result = await provider.generateObject(mockObjectParams);

				expect(generateObject).toHaveBeenCalledWith({
					model: expect.objectContaining({
						id: 'gemini-2.0-flash-exp'
					}),
					system: expect.stringContaining('You are a helpful assistant'),
					messages: [{ role: 'user', content: 'Hello' }],
					schema: mockObjectParams.schema,
					mode: 'json',
					maxTokens: 100,
					temperature: 0.7
				});
				expect(result.object).toEqual({ result: 'success' });
			});
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
