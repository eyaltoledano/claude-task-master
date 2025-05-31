import { jest } from '@jest/globals';

// Mock the @ai-sdk/amazon-bedrock and ai packages
const mockCreateAmazonBedrock = jest.fn();
const mockGenerateText = jest.fn();
const mockStreamText = jest.fn();
const mockGenerateObject = jest.fn();

jest.unstable_mockModule('@ai-sdk/amazon-bedrock', () => ({
	createAmazonBedrock: mockCreateAmazonBedrock
}));

jest.unstable_mockModule('ai', () => ({
	generateText: mockGenerateText,
	streamText: mockStreamText,
	generateObject: mockGenerateObject
}));

// Mock logger
const mockLog = jest.fn();
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: mockLog
}));

// Import the module to test AFTER mocks are set up
const {
	generateBedrockText,
	streamBedrockText,
	generateBedrockObject,
	createBedrockClient
} = await import('../../../src/ai-providers/bedrock.js');

describe('AWS Bedrock Provider', () => {
	let mockClient, mockModel;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock client and model
		mockModel = jest.fn();
		mockClient = jest.fn().mockReturnValue(mockModel);
		mockCreateAmazonBedrock.mockReturnValue(mockClient);
	});

	describe('generateBedrockText', () => {
		test('should generate text successfully with static credentials', async () => {
			const mockResult = {
				text: 'Generated text response',
				usage: {
					promptTokens: 10,
					completionTokens: 20
				}
			};

			mockGenerateText.mockResolvedValue(mockResult);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Test prompt' }],
				maxTokens: 1000,
				temperature: 0.7
			};

			const result = await generateBedrockText(params);

			// Verify client creation
			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith({
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key'
			});

			// Verify model selection
			expect(mockClient).toHaveBeenCalledWith('anthropic.claude-3-sonnet-20240229-v1:0');

			// Verify generateText call
			expect(mockGenerateText).toHaveBeenCalledWith({
				model: mockModel,
				messages: [{ role: 'user', content: 'Test prompt' }],
				maxTokens: 1000,
				temperature: 0.7
			});

			// Verify result format
			expect(result).toEqual({
				text: 'Generated text response',
				usage: {
					inputTokens: 10,
					outputTokens: 20
				}
			});

			// Verify logging
			expect(mockLog).toHaveBeenCalledWith(
				'debug',
				'Generating Bedrock text with model: anthropic.claude-3-sonnet-20240229-v1:0'
			);
		});

		test('should generate text with session token', async () => {
			const mockResult = {
				text: 'Generated text with session token',
				usage: { promptTokens: 15, completionTokens: 25 }
			};

			mockGenerateText.mockResolvedValue(mockResult);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-west-2',
				sessionToken: 'test-session-token',
				modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
				messages: [{ role: 'user', content: 'Test with session token' }]
			};

			await generateBedrockText(params);

			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith({
				region: 'us-west-2',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				sessionToken: 'test-session-token'
			});
		});

		test('should generate text with credential provider', async () => {
			const mockCredentialProvider = jest.fn();
			const mockResult = {
				text: 'Generated text with credential provider',
				usage: { promptTokens: 12, completionTokens: 18 }
			};

			mockGenerateText.mockResolvedValue(mockResult);

			const params = {
				credentialProvider: mockCredentialProvider,
				region: 'eu-west-1',
				modelId: 'anthropic.claude-3-opus-20240229-v1:0',
				messages: [{ role: 'user', content: 'Test with credential provider' }]
			};

			await generateBedrockText(params);

			expect(mockCreateAmazonBedrock).toHaveBeenCalledWith({
				region: 'eu-west-1',
				credentialProvider: mockCredentialProvider
			});
		});

		test('should generate text with additional model request fields', async () => {
			const mockResult = {
				text: 'Generated text with additional fields',
				usage: { promptTokens: 8, completionTokens: 16 }
			};

			mockGenerateText.mockResolvedValue(mockResult);

			const additionalFields = {
				inferenceConfig: {
					stopSequences: ['Human:', 'Assistant:']
				}
			};

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Test with additional fields' }],
				additionalModelRequestFields: additionalFields
			};

			await generateBedrockText(params);

			expect(mockClient).toHaveBeenCalledWith(
				'anthropic.claude-3-sonnet-20240229-v1:0',
				{ additionalModelRequestFields: additionalFields }
			);
		});

		test('should handle missing required credentials', async () => {
			// Mock createAmazonBedrock to throw an error when AWS credentials aren't available
			mockCreateAmazonBedrock.mockImplementationOnce(() => {
				throw new Error('Unable to load AWS credentials from any provider');
			});

			const params = {
				// Missing accessKeyId, secretAccessKey, and region
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Test' }]
			};

			await expect(generateBedrockText(params)).rejects.toThrow(
				'AWS Bedrock requires accessKeyId, secretAccessKey, and region when not using credentialProvider, or valid AWS credentials in the environment'
			);
		});

		test('should handle API errors', async () => {
			const apiError = new Error('Bedrock API error');
			mockGenerateText.mockRejectedValue(apiError);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Test error handling' }]
			};

			await expect(generateBedrockText(params)).rejects.toThrow('Bedrock API error');

			expect(mockLog).toHaveBeenCalledWith(
				'error',
				'Bedrock generateText failed: Bedrock API error'
			);
		});
	});

	describe('streamBedrockText', () => {
		test('should stream text successfully', async () => {
			const mockStreamResult = {
				textStream: ['chunk1', 'chunk2', 'chunk3'],
				usage: { promptTokens: 10, completionTokens: 15 }
			};

			mockStreamText.mockResolvedValue(mockStreamResult);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Stream test' }],
				maxTokens: 500,
				temperature: 0.5
			};

			const result = await streamBedrockText(params);

			expect(mockStreamText).toHaveBeenCalledWith({
				model: mockModel,
				messages: [{ role: 'user', content: 'Stream test' }],
				maxTokens: 500,
				temperature: 0.5
			});

			expect(result).toBe(mockStreamResult);

			expect(mockLog).toHaveBeenCalledWith(
				'debug',
				'Streaming Bedrock text with model: anthropic.claude-3-sonnet-20240229-v1:0'
			);
		});

		test('should handle streaming errors', async () => {
			const streamError = new Error('Streaming failed');
			mockStreamText.mockRejectedValue(streamError);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Stream error test' }]
			};

			await expect(streamBedrockText(params)).rejects.toThrow('Streaming failed');

			expect(mockLog).toHaveBeenCalledWith(
				'error',
				'Bedrock streamText failed: Streaming failed',
				expect.any(String)
			);
		});
	});

	describe('generateBedrockObject', () => {
		test('should generate object successfully', async () => {
			const mockSchema = {
				parse: jest.fn().mockReturnValue({ name: 'test', value: 42 })
			};

			const mockResult = {
				object: { name: 'test', value: 42 },
				usage: { promptTokens: 20, completionTokens: 30 }
			};

			mockGenerateObject.mockResolvedValue(mockResult);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Generate an object' }],
				schema: mockSchema,
				objectName: 'test_object',
				maxTokens: 1000,
				temperature: 0.3,
				maxRetries: 2
			};

			const result = await generateBedrockObject(params);

			expect(mockGenerateObject).toHaveBeenCalledWith({
				model: mockModel,
				mode: 'tool',
				schema: mockSchema,
				messages: [{ role: 'user', content: 'Generate an object' }],
				tool: {
					name: 'test_object',
					description: 'Generate a test_object based on the prompt.'
				},
				maxTokens: 1000,
				temperature: 0.3,
				maxRetries: 2
			});

			expect(result).toEqual({
				object: { name: 'test', value: 42 },
				usage: {
					inputTokens: 20,
					outputTokens: 30
				}
			});

			expect(mockLog).toHaveBeenCalledWith(
				'debug',
				"Generating Bedrock object ('test_object') with model: anthropic.claude-3-sonnet-20240229-v1:0"
			);
		});

		test('should use default object name when not provided', async () => {
			const mockSchema = { parse: jest.fn() };
			const mockResult = {
				object: {},
				usage: { promptTokens: 10, completionTokens: 15 }
			};

			mockGenerateObject.mockResolvedValue(mockResult);

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Generate object' }],
				schema: mockSchema
			};

			await generateBedrockObject(params);

			expect(mockGenerateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					tool: {
						name: 'generated_object',
						description: 'Generate a generated_object based on the prompt.'
					}
				})
			);
		});

		test('should handle object generation errors', async () => {
			const objectError = new Error('Object generation failed');
			mockGenerateObject.mockRejectedValue(objectError);

			const mockSchema = { parse: jest.fn() };

			const params = {
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				region: 'us-east-1',
				modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [{ role: 'user', content: 'Generate object' }],
				schema: mockSchema,
				objectName: 'error_test'
			};

			await expect(generateBedrockObject(params)).rejects.toThrow('Object generation failed');

			expect(mockLog).toHaveBeenCalledWith(
				'error',
				"Bedrock generateObject ('error_test') failed: Object generation failed"
			);
		});
	});

	describe('createBedrockClient export', () => {
		test('should export createBedrockClient as alias for createAmazonBedrock', () => {
			expect(createBedrockClient).toBe(mockCreateAmazonBedrock);
		});
	});
}); 