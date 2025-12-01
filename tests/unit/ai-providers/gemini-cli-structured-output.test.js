import { jest } from '@jest/globals';
import { z } from 'zod';

// Mock the AI SDK module
const mockGenerateObject = jest.fn();
const mockStreamObject = jest.fn();
const mockZodSchema = jest.fn((schema) => ({ _zodSchema: schema }));

jest.unstable_mockModule('ai', () => ({
	generateObject: mockGenerateObject,
	streamObject: mockStreamObject,
	zodSchema: mockZodSchema,
	generateText: jest.fn(),
	streamText: jest.fn(),
	JSONParseError: class JSONParseError extends Error {},
	NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
		static isInstance(error) {
			return error instanceof NoObjectGeneratedError;
		}
	}
}));

// Mock the gemini-cli SDK module
const mockModel = jest.fn((modelId) => ({ modelId, type: 'gemini-cli-model' }));
mockModel.languageModel = mockModel;
mockModel.chat = mockModel;

jest.unstable_mockModule('ai-sdk-provider-gemini-cli', () => ({
	createGeminiProvider: jest.fn(() => mockModel)
}));

// Mock utilities
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	findProjectRoot: jest.fn(() => '/mock/project'),
	resolveEnvVariable: jest.fn((key) => process.env[key])
}));

jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	isProxyEnabled: jest.fn(() => false),
	getAnonymousTelemetryEnabled: jest.fn(() => true)
}));

// Import after mocking
const { GeminiCliProvider } = await import(
	'../../../src/ai-providers/gemini-cli.js'
);

describe('GeminiCliProvider Structured Output Integration', () => {
	let provider;

	// Sample Zod schema for testing
	const testSchema = z.object({
		title: z.string(),
		description: z.string(),
		priority: z.enum(['low', 'medium', 'high'])
	});

	beforeEach(() => {
		provider = new GeminiCliProvider();
		jest.clearAllMocks();

		// Reset mock implementations
		mockGenerateObject.mockReset();
		mockStreamObject.mockReset();
	});

	describe('generateObject', () => {
		it('should forward schema to AI SDK generateObject', async () => {
			// Setup mock response
			mockGenerateObject.mockResolvedValue({
				object: {
					title: 'Test Task',
					description: 'A test task description',
					priority: 'high'
				},
				usage: {
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150
				}
			});

			const params = {
				modelId: 'gemini-2.5-pro',
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: 'Create a task for testing.' }
				],
				schema: testSchema,
				objectName: 'task',
				maxTokens: 1000
			};

			const result = await provider.generateObject(params);

			// Verify generateObject was called
			expect(mockGenerateObject).toHaveBeenCalledTimes(1);

			// Verify schema was passed through
			const callArgs = mockGenerateObject.mock.calls[0][0];
			expect(callArgs.schema).toBe(testSchema);

			// Verify result is returned correctly
			expect(result.object).toEqual({
				title: 'Test Task',
				description: 'A test task description',
				priority: 'high'
			});
		});

		it('should use mode "auto" since needsExplicitJsonSchema is false', async () => {
			mockGenerateObject.mockResolvedValue({
				object: { title: 'Test', description: 'Test', priority: 'low' },
				usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
			});

			await provider.generateObject({
				modelId: 'gemini-2.5-flash',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				objectName: 'task',
				maxTokens: 500
			});

			const callArgs = mockGenerateObject.mock.calls[0][0];

			// Mode should be 'auto' because needsExplicitJsonSchema is false
			expect(callArgs.mode).toBe('auto');

			// Verify the provider flag is correctly set
			expect(provider.needsExplicitJsonSchema).toBe(false);
		});

		it('should pass schemaName and schemaDescription', async () => {
			mockGenerateObject.mockResolvedValue({
				object: { title: 'Test', description: 'Test', priority: 'medium' },
				usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
			});

			await provider.generateObject({
				modelId: 'gemini-2.5-pro',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				objectName: 'myCustomObject',
				maxTokens: 500
			});

			const callArgs = mockGenerateObject.mock.calls[0][0];
			expect(callArgs.schemaName).toBe('myCustomObject');
			expect(callArgs.schemaDescription).toBe(
				'Generate a valid JSON object for myCustomObject'
			);
		});

		it('should return usage statistics from SDK response', async () => {
			mockGenerateObject.mockResolvedValue({
				object: { title: 'Test', description: 'Test', priority: 'high' },
				usage: {
					promptTokens: 250,
					completionTokens: 100,
					totalTokens: 350
				}
			});

			const result = await provider.generateObject({
				modelId: 'gemini-2.5-pro',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				objectName: 'task',
				maxTokens: 1000
			});

			expect(result.usage).toEqual({
				inputTokens: 250,
				outputTokens: 100,
				totalTokens: 350
			});
		});

		it('should not include temperature when supportsTemperature is false', async () => {
			mockGenerateObject.mockResolvedValue({
				object: { title: 'Test', description: 'Test', priority: 'low' },
				usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
			});

			// GeminiCliProvider sets supportsTemperature = false
			expect(provider.supportsTemperature).toBe(false);

			await provider.generateObject({
				modelId: 'gemini-2.5-pro',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				objectName: 'task',
				maxTokens: 500,
				temperature: 0.7 // This should be ignored
			});

			const callArgs = mockGenerateObject.mock.calls[0][0];
			expect(callArgs.temperature).toBeUndefined();
		});
	});

	describe('streamObject', () => {
		it('should forward schema to AI SDK streamObject with zodSchema wrapper', async () => {
			const mockStreamResult = {
				partialObjectStream: {
					[Symbol.asyncIterator]: async function* () {
						yield { title: 'Test' };
						yield { title: 'Test', description: 'Description' };
						yield {
							title: 'Test',
							description: 'Description',
							priority: 'high'
						};
					}
				}
			};
			mockStreamObject.mockResolvedValue(mockStreamResult);

			const params = {
				modelId: 'gemini-2.5-pro',
				messages: [{ role: 'user', content: 'Stream a task' }],
				schema: testSchema,
				maxTokens: 1000
			};

			const result = await provider.streamObject(params);

			// Verify streamObject was called
			expect(mockStreamObject).toHaveBeenCalledTimes(1);

			// Verify zodSchema wrapper was used
			expect(mockZodSchema).toHaveBeenCalledWith(testSchema);

			// Verify the wrapped schema was passed
			const callArgs = mockStreamObject.mock.calls[0][0];
			expect(callArgs.schema).toEqual({ _zodSchema: testSchema });

			// Verify stream result is returned
			expect(result).toBe(mockStreamResult);
		});

		it('should use default mode "auto" for streamObject', async () => {
			mockStreamObject.mockResolvedValue({ partialObjectStream: {} });

			await provider.streamObject({
				modelId: 'gemini-2.5-flash',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				maxTokens: 500
			});

			const callArgs = mockStreamObject.mock.calls[0][0];
			expect(callArgs.mode).toBe('auto');
		});

		it('should pass maxOutputTokens to streamObject', async () => {
			mockStreamObject.mockResolvedValue({ partialObjectStream: {} });

			await provider.streamObject({
				modelId: 'gemini-2.5-pro',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				maxTokens: 2000
			});

			const callArgs = mockStreamObject.mock.calls[0][0];
			expect(callArgs.maxOutputTokens).toBe(2000);
		});
	});

	describe('SDK integration', () => {
		it('should create model with correct modelId', async () => {
			mockGenerateObject.mockResolvedValue({
				object: { title: 'Test', description: 'Test', priority: 'low' },
				usage: { totalTokens: 10 }
			});

			await provider.generateObject({
				modelId: 'gemini-2.5-pro',
				messages: [{ role: 'user', content: 'Test' }],
				schema: testSchema,
				objectName: 'task'
			});

			const callArgs = mockGenerateObject.mock.calls[0][0];
			// The model should be the result of calling mockModel with the modelId
			expect(callArgs.model).toEqual({
				modelId: 'gemini-2.5-pro',
				type: 'gemini-cli-model'
			});
		});

		it('should work with gemini-2.5-flash model', async () => {
			mockGenerateObject.mockResolvedValue({
				object: {
					title: 'Fast',
					description: 'Quick response',
					priority: 'medium'
				},
				usage: { totalTokens: 20 }
			});

			const result = await provider.generateObject({
				modelId: 'gemini-2.5-flash',
				messages: [{ role: 'user', content: 'Quick task' }],
				schema: testSchema,
				objectName: 'task'
			});

			expect(result.object.title).toBe('Fast');

			const callArgs = mockGenerateObject.mock.calls[0][0];
			expect(callArgs.model.modelId).toBe('gemini-2.5-flash');
		});

		it('should work with gemini-3-pro-preview model', async () => {
			mockGenerateObject.mockResolvedValue({
				object: {
					title: 'Preview',
					description: 'Latest model',
					priority: 'high'
				},
				usage: { totalTokens: 30 }
			});

			const result = await provider.generateObject({
				modelId: 'gemini-3-pro-preview',
				messages: [{ role: 'user', content: 'Test preview' }],
				schema: testSchema,
				objectName: 'task'
			});

			expect(result.object.title).toBe('Preview');

			const callArgs = mockGenerateObject.mock.calls[0][0];
			expect(callArgs.model.modelId).toBe('gemini-3-pro-preview');
		});
	});
});
