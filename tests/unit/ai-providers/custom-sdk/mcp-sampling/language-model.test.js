import { jest } from '@jest/globals';

// Mock modules before importing
jest.unstable_mockModule('@ai-sdk/provider', () => ({
	NoSuchModelError: class NoSuchModelError extends Error {
		constructor({ modelId, modelType, message }) {
			super(message || `No such model: ${modelId}`);
			this.modelId = modelId;
			this.modelType = modelType;
		}
	}
}));

jest.unstable_mockModule('@ai-sdk/provider-utils', () => ({
	generateId: jest.fn(() => 'test-id-123')
}));

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/mcp-sampling/message-converter.js',
	() => ({
		convertToMcpSamplingMessages: jest.fn((prompt, mode) => ({
			messages: [
				{ role: 'user', content: { type: 'text', text: 'converted message' } }
			],
			systemPrompt: 'system prompt'
		})),
		extractTextFromResponse: jest.fn((response) => response.content?.text || '')
	})
);

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/mcp-sampling/errors.js',
	() => ({
		createAPICallError: jest.fn((opts) => {
			const error = new Error(opts.message);
			error.data = opts.data;
			return error;
		}),
		createAuthenticationError: jest.fn((opts) => {
			const error = new Error(opts.message);
			error.data = opts.data;
			return error;
		}),
		createTimeoutError: jest.fn((opts) => {
			const error = new Error(opts.message);
			error.data = opts.data;
			return error;
		})
	})
);

// Import the module under test
const { McpSamplingLanguageModel } = await import(
	'../../../../../src/ai-providers/custom-sdk/mcp-sampling/language-model.js'
);
const { NoSuchModelError } = await import('@ai-sdk/provider');
const { generateId } = await import('@ai-sdk/provider-utils');
const { convertToMcpSamplingMessages, extractTextFromResponse } = await import(
	'../../../../../src/ai-providers/custom-sdk/mcp-sampling/message-converter.js'
);
const { createAPICallError, createAuthenticationError, createTimeoutError } =
	await import(
		'../../../../../src/ai-providers/custom-sdk/mcp-sampling/errors.js'
	);

describe('McpSamplingLanguageModel', () => {
	let mockSession;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a valid mock session
		mockSession = {
			requestSampling: jest.fn(),
			clientCapabilities: {
				sampling: true
			}
		};

		// Default successful response
		mockSession.requestSampling.mockResolvedValue({
			content: { text: 'Generated response' },
			stopReason: 'stop'
		});
	});

	describe('constructor', () => {
		it('should initialize with valid model ID', () => {
			const model = new McpSamplingLanguageModel({
				id: 'claude-3-opus',
				settings: {
					session: mockSession,
					maxTokens: 2048
				}
			});

			expect(model.modelId).toBe('claude-3-opus');
			expect(model.settings).toEqual({
				session: mockSession,
				maxTokens: 2048
			});
			expect(model.provider).toBe('mcp-sampling');
		});

		it('should throw NoSuchModelError for invalid model ID', () => {
			expect(
				() =>
					new McpSamplingLanguageModel({
						id: '',
						settings: {}
					})
			).toThrow(NoSuchModelError);

			expect(
				() =>
					new McpSamplingLanguageModel({
						id: null,
						settings: {}
					})
			).toThrow(NoSuchModelError);
		});

		it('should have correct default properties', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {}
			});

			expect(model.specificationVersion).toBe('v1');
			expect(model.defaultObjectGenerationMode).toBe('json');
			expect(model.supportsImageUrls).toBe(false);
			expect(model.supportsStructuredOutputs).toBe(false);
		});
	});

	describe('validateSession', () => {
		it('should return valid session', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			const session = model.validateSession();
			expect(session).toBe(mockSession);
		});

		it('should throw error when session is missing', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {}
			});

			expect(() => model.validateSession()).toThrow();
			expect(createAuthenticationError).toHaveBeenCalledWith({
				message: 'MCP session is required but not provided',
				data: { modelId: 'test-model' }
			});
		});

		it('should throw error when session lacks requestSampling', () => {
			const invalidSession = {
				clientCapabilities: { sampling: true }
			};

			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: invalidSession }
			});

			expect(() => model.validateSession()).toThrow();
			expect(createAuthenticationError).toHaveBeenCalledWith({
				message: 'MCP session does not have requestSampling capability',
				data: { modelId: 'test-model' }
			});
		});

		it('should throw error when session lacks sampling capabilities', () => {
			const invalidSession = {
				requestSampling: jest.fn(),
				clientCapabilities: {}
			};

			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: invalidSession }
			});

			expect(() => model.validateSession()).toThrow();
			expect(createAuthenticationError).toHaveBeenCalledWith({
				message: 'MCP session does not have client sampling capabilities',
				data: { modelId: 'test-model' }
			});
		});
	});

	describe('generateWarnings', () => {
		it('should generate warning for tools', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {}
			});

			const warnings = model.generateWarnings({
				tools: [{ name: 'test-tool' }]
			});

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toEqual({
				type: 'unsupported-setting',
				setting: 'tools',
				details: 'MCP Sampling does not support tool calling'
			});
		});

		it('should generate warning for toolChoice', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {}
			});

			const warnings = model.generateWarnings({
				toolChoice: 'auto'
			});

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toEqual({
				type: 'unsupported-setting',
				setting: 'toolChoice',
				details: 'MCP Sampling does not support tool choice'
			});
		});

		it('should generate warning for json_schema response format', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {}
			});

			const warnings = model.generateWarnings({
				responseFormat: { type: 'json_schema' }
			});

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toEqual({
				type: 'unsupported-setting',
				setting: 'responseFormat.json_schema',
				details: 'MCP Sampling does not support JSON schema response format'
			});
		});

		it('should return empty array when no unsupported features', () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {}
			});

			const warnings = model.generateWarnings({
				temperature: 0.7,
				maxTokens: 1000
			});

			expect(warnings).toEqual([]);
		});
	});

	describe('doGenerate', () => {
		it('should successfully generate text', async () => {
			const model = new McpSamplingLanguageModel({
				id: 'claude-3-opus',
				settings: { session: mockSession }
			});

			extractTextFromResponse.mockReturnValue('Generated text response');

			const result = await model.doGenerate({
				prompt: 'Test prompt',
				temperature: 0.7,
				maxTokens: 1000
			});

			expect(mockSession.requestSampling).toHaveBeenCalledWith(
				{
					messages: [
						{
							role: 'user',
							content: { type: 'text', text: 'converted message' }
						}
					],
					systemPrompt: 'system prompt',
					temperature: 0.7,
					maxTokens: 1000,
					includeContext: 'thisServer',
					modelPreferences: {
						hints: [{ name: 'claude-3-opus' }],
						costPriority: 0.5,
						speedPriority: 0.5,
						intelligencePriority: 0.5
					}
				},
				{ timeout: 120000 }
			);

			expect(result).toMatchObject({
				text: 'Generated text response',
				finishReason: 'stop',
				toolCalls: [],
				usage: {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				}
			});
		});

		it('should use settings defaults when options not provided', async () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: {
					session: mockSession,
					temperature: 0.5,
					maxTokens: 2048,
					systemPrompt: 'Default system prompt',
					costPriority: 0.3,
					speedPriority: 0.7,
					intelligencePriority: 0.8
				}
			});

			await model.doGenerate({
				prompt: 'Test prompt'
			});

			expect(mockSession.requestSampling).toHaveBeenCalledWith(
				expect.objectContaining({
					systemPrompt: 'system prompt', // From mock converter
					temperature: 0.5,
					maxTokens: 2048,
					modelPreferences: {
						hints: [{ name: 'test-model' }],
						costPriority: 0.3,
						speedPriority: 0.7,
						intelligencePriority: 0.8
					}
				}),
				expect.any(Object)
			);
		});

		it('should parse JSON in object mode', async () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			const jsonResponse = { test: 'object' };
			extractTextFromResponse.mockReturnValue(JSON.stringify(jsonResponse));

			const result = await model.doGenerate({
				prompt: 'Generate object',
				mode: { type: 'object-json' }
			});

			expect(result.object).toEqual(jsonResponse);
			expect(result.text).toBe(JSON.stringify(jsonResponse));
		});

		it('should handle JSON parse errors in object mode', async () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			extractTextFromResponse.mockReturnValue('invalid json');

			await expect(
				model.doGenerate({
					prompt: 'Generate object',
					mode: { type: 'object-json' }
				})
			).rejects.toThrow();

			expect(createAPICallError).toHaveBeenCalledWith({
				message: 'Failed to parse JSON response from MCP Sampling',
				cause: expect.any(Error),
				data: {
					modelId: 'test-model',
					operation: 'json-parse',
					response: 'invalid json'
				}
			});
		});

		it('should handle timeout errors', async () => {
			const timeoutError = new Error('Request timed out');
			timeoutError.name = 'TimeoutError';
			mockSession.requestSampling.mockRejectedValue(timeoutError);

			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			await expect(model.doGenerate({ prompt: 'Test' })).rejects.toThrow();

			expect(createTimeoutError).toHaveBeenCalledWith({
				timeout: 120000,
				operation: 'requestSampling',
				cause: timeoutError,
				data: { modelId: 'test-model' }
			});
		});

		it('should handle authentication errors', async () => {
			const authError = new Error('Invalid session');
			mockSession.requestSampling.mockRejectedValue(authError);

			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			await expect(model.doGenerate({ prompt: 'Test' })).rejects.toThrow();

			expect(createAuthenticationError).toHaveBeenCalledWith({
				message: 'Invalid session',
				cause: authError,
				data: { modelId: 'test-model' }
			});
		});

		it('should include warnings in response', async () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			const result = await model.doGenerate({
				prompt: 'Test',
				tools: [{ name: 'tool1' }]
			});

			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0].setting).toBe('tools');
		});
	});

	describe('doStream', () => {
		it('should throw NoSuchModelError', async () => {
			const model = new McpSamplingLanguageModel({
				id: 'test-model',
				settings: { session: mockSession }
			});

			await expect(model.doStream({ prompt: 'Test' })).rejects.toThrow(
				NoSuchModelError
			);

			await expect(model.doStream({ prompt: 'Test' })).rejects.toThrow(
				'MCP Sampling does not support streaming'
			);
		});
	});
});
