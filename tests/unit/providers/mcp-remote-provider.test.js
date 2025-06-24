/**
 * Tests for MCPRemoteProvider - MCP provider implementation
 * 
 * This test suite covers:
 * 1. Constructor and initialization
 * 2. Session management and validation
 * 3. MCP-specific authentication (no API key required)
 * 4. Parameter validation for MCP operations
 * 5. MCP sampling capability validation
 * 6. generateText, streamText, generateObject implementations
 * 7. Error handling for MCP-specific errors
 * 8. Integration with MCP server context
 */

import { jest } from '@jest/globals';

// Mock the logger
const mockLogger = {
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn()
};

jest.unstable_mockModule('../../../mcp-server/src/logger.js', () => ({
	default: mockLogger
}));

// Mock the BaseAIProvider
const mockBaseAIProvider = {
	validateOptionalParams: jest.fn(),
	handleError: jest.fn()
};

jest.unstable_mockModule('../../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: class MockBaseAIProvider {
		constructor() {
			this.name = this.constructor.name;
		}
		
		validateOptionalParams(params) {
			return mockBaseAIProvider.validateOptionalParams(params);
		}
		
		handleError(operation, error) {
			return mockBaseAIProvider.handleError(operation, error);
		}
	}
}));

// Mock zod-to-json-schema
const mockZodToJsonSchema = jest.fn();
jest.unstable_mockModule('zod-to-json-schema', () => ({
	zodToJsonSchema: mockZodToJsonSchema
}));

// Import MCPRemoteProvider after mocking
const { MCPRemoteProvider } = await import('../../../mcp-server/src/providers/mcp-remote-provider.js');

describe('MCPRemoteProvider', () => {
	let provider;
	let mockServer;
	let mockSession;

	beforeEach(() => {
		jest.clearAllMocks();
		
		// Create mock session with MCP capabilities
		mockSession = {
			clientCapabilities: {
				sampling: {
					enabled: true
				}
			},
			requestSampling: jest.fn(),
			request: jest.fn(),
			notification: jest.fn()
		};

		// Create mock server
		mockServer = {
			setSession: jest.fn()
		};

		// Default successful response
		mockSession.requestSampling.mockResolvedValue({
			content: { text: 'Generated response' },
			stopReason: 'stop_sequence'
		});

		provider = new MCPRemoteProvider(mockServer, {});
		provider.setSession(mockSession);
	});

	describe('Constructor', () => {
		test('creates MCPRemoteProvider instance with correct name', () => {
			const newProvider = new MCPRemoteProvider(mockServer, {});
			expect(newProvider.name).toBe('mcp');
		});

		test('stores server reference and options', () => {
			const options = { maxRetries: 3, timeout: 5000 };
			const newProvider = new MCPRemoteProvider(mockServer, options);
			expect(newProvider.server).toBe(mockServer);
			expect(newProvider.options).toEqual(options);
		});

		test('initializes with server session or null', () => {
			const newProvider = new MCPRemoteProvider(mockServer, {});
			// Could be null or the first session from server
			expect(newProvider.session).toBeDefined();
		});
	});

	describe('Session Management', () => {
		test('setSession updates session and logs debug info', () => {
			const newSession = { id: 'new-session' };
			provider.setSession(newSession);
			
			expect(provider.session).toBe(newSession);
			expect(mockLogger.debug).toHaveBeenCalledWith('Updated MCP Remote Provider session');
		});

		test('warns when setting null session', () => {
			provider.setSession(null);
			
			expect(mockLogger.warn).toHaveBeenCalledWith('Attempted to set null session on MCP Remote Provider');
		});
	});

	describe('Authentication', () => {
		test('isRequiredApiKey returns false for MCP provider', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});

		test('getRequiredApiKeyName returns MCP_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('MCP_API_KEY');
		});

		test('validateAuth succeeds with valid session', () => {
			expect(() => {
				provider.validateAuth({});
			}).not.toThrow();
		});

		test('validateAuth throws error for missing session', () => {
			provider.session = null;
			expect(() => {
				provider.validateAuth({});
			}).toThrow('MCP provider requires session context');
		});

		test('validateAuth throws error for session without sampling capabilities', () => {
			provider.session = { clientCapabilities: {} };
			expect(() => {
				provider.validateAuth({});
			}).toThrow('MCP session must have client sampling capabilities');
		});
	});

	describe('Parameter Validation', () => {
		test('validateParams calls validateOptionalParams', () => {
			const params = { 
				messages: [{ role: 'user', content: 'Hello' }], 
				temperature: 0.7,
				modelId: 'claude-3-sonnet'
			};
			provider.validateParams(params);
			
			expect(mockBaseAIProvider.validateOptionalParams).toHaveBeenCalledWith(params);
		});

		test('throws error for missing model ID', () => {
			expect(() => {
				provider.validateParams({ messages: [{ role: 'user', content: 'Hello' }] });
			}).toThrow('Model ID is required for MCP Remote Provider');
		});

		test('throws error for empty messages array', () => {
			expect(() => {
				provider.validateParams({ 
					messages: [], 
					modelId: 'claude-3-sonnet'
				});
			}).toThrow('Messages array is required and must not be empty');
		});

		test('throws error for missing messages', () => {
			expect(() => {
				provider.validateParams({ 
					modelId: 'claude-3-sonnet'
				});
			}).toThrow('Messages array is required and must not be empty');
		});

		test('accepts valid params with messages and model ID', () => {
			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }],
				modelId: 'claude-3-sonnet'
			};
			
			expect(() => {
				provider.validateParams(validParams);
			}).not.toThrow();
		});

		test('accepts params with default model option', () => {
			provider.options.defaultModel = 'default-model';
			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }]
			};
			
			expect(() => {
				provider.validateParams(validParams);
			}).not.toThrow();
		});
	});

	describe('requestSampling', () => {
		test('converts messages to MCP format and calls session.requestSampling', async () => {
			const messages = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi there!' }
			];
			const systemPrompt = 'You are helpful';
			const temperature = 0.7;
			const maxTokens = 1000;

			await provider.requestSampling(messages, systemPrompt, temperature, maxTokens);

			expect(mockSession.requestSampling).toHaveBeenCalledWith({
				messages: [
					{ role: 'user', content: { type: 'text', text: 'Hello' } },
					{ role: 'assistant', content: { type: 'text', text: 'Hi there!' } }
				],
				systemPrompt: 'You are helpful',
				temperature: 0.7,
				maxTokens: 1000,
				includeContext: 'thisServer'
			}, {
				timeout: 2400000
			});
		});

		test('uses default maxTokens when not provided', async () => {
			const messages = [{ role: 'user', content: 'Hello' }];
			
			await provider.requestSampling(messages, undefined, undefined, undefined);

			expect(mockSession.requestSampling).toHaveBeenCalledWith(
				expect.objectContaining({
					maxTokens: 1000
				}),
				expect.any(Object)
			);
		});
	});

	describe('generateText', () => {
		const validParams = {
			messages: [{ role: 'user', content: 'Hello' }],
			temperature: 0.7,
			maxTokens: 1000,
			modelId: 'claude-3-sonnet'
		};

		test('validates parameters before processing', async () => {
			const validateParamsSpy = jest.spyOn(provider, 'validateParams');
			
			await provider.generateText(validParams);
			
			expect(validateParamsSpy).toHaveBeenCalledWith(validParams);
		});

		test('calls requestSampling with correct parameters', async () => {
			const requestSamplingSpy = jest.spyOn(provider, 'requestSampling');
			
			await provider.generateText(validParams);
			
			expect(requestSamplingSpy).toHaveBeenCalledWith(
				validParams.messages,
				undefined,
				validParams.temperature,
				validParams.maxTokens
			);
		});

		test('returns formatted response with zero token counts', async () => {
			const result = await provider.generateText(validParams);
			
			expect(result).toEqual({
				text: 'Generated response',
				usage: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0
				}
			});
		});

		test('logs debug information about completion', async () => {
			await provider.generateText(validParams);
			
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('mcp generateText completed successfully')
			);
		});

		test('handles error and calls handleError', async () => {
			const error = new Error('MCP sampling failed');
			mockSession.requestSampling.mockRejectedValue(error);
			
			mockBaseAIProvider.handleError.mockImplementation((operation, err) => {
				throw new Error(`MCP API error during ${operation}: ${err.message}`);
			});

			await expect(provider.generateText(validParams)).rejects.toThrow(
				'MCP API error during text generation: MCP sampling failed'
			);
			
			expect(mockBaseAIProvider.handleError).toHaveBeenCalledWith('text generation', error);
		});
	});

	describe('generateObject', () => {
		const validParams = {
			messages: [{ role: 'user', content: 'Generate data' }],
			schema: { type: 'object', properties: { name: { type: 'string' } } },
			objectName: 'TestObject',
			modelId: 'claude-3-sonnet'
		};

		beforeEach(() => {
			mockZodToJsonSchema.mockReturnValue(validParams.schema);
			mockSession.requestSampling.mockResolvedValue({
				content: { text: '{"name": "test"}' },
				stopReason: 'stop_sequence'
			});
		});

		test('converts schema using zodToJsonSchema', async () => {
			await provider.generateObject(validParams);
			
			expect(mockZodToJsonSchema).toHaveBeenCalledWith(validParams.schema, validParams.objectName);
		});

		test('adds schema instruction to system prompt', async () => {
			const requestSamplingSpy = jest.spyOn(provider, 'requestSampling');
			
			await provider.generateObject(validParams);
			
			expect(requestSamplingSpy).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						role: 'system',
						content: expect.stringContaining('IMPORTANT: Your response MUST be valid JSON')
					})
				]),
				'Generate data',
				0.7,
				1000
			);
		});

		test('parses JSON response', async () => {
			const result = await provider.generateObject(validParams);
			
			expect(result).toEqual({
				object: { name: 'test' },
				usage: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0
				},
				rawResponse: {
					content: { text: '{"name": "test"}' },
					stopReason: 'stop_sequence'
				}
			});
		});

		test('handles JSON parsing errors', async () => {
			mockSession.requestSampling.mockResolvedValue({
				content: { text: 'invalid json' },
				stopReason: 'stop_sequence'
			});
			
			mockBaseAIProvider.handleError.mockImplementation((operation, error) => {
				throw new Error(`Object generation failed: ${error.message}`);
			});

			await expect(provider.generateObject(validParams)).rejects.toThrow(
				/Object generation failed/
			);
		});
	});

	describe('streamText', () => {
		test('throws not implemented error', async () => {
			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }],
				modelId: 'claude-3-sonnet'
			};

			mockBaseAIProvider.handleError.mockImplementation((operation, error) => {
				throw new Error(error.message);
			});

			// streamText returns a generator, so we need to try to iterate it
			const generator = provider.streamText(validParams);
			await expect(generator.next()).rejects.toThrow(
				'MCP Remote Provider does not support streaming text, use generateText instead'
			);
		});
	});

	describe('Error Handling', () => {
		test('handles MCP request failures', async () => {
			const error = new Error('Network error');
			mockSession.requestSampling.mockRejectedValue(error);
			
			mockBaseAIProvider.handleError.mockImplementation((operation, err) => {
				throw new Error(`Handled: ${err.message}`);
			});

			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }],
				modelId: 'claude-3-sonnet'
			};

			await expect(provider.generateText(validParams)).rejects.toThrow('Handled: Network error');
			expect(mockBaseAIProvider.handleError).toHaveBeenCalledWith('text generation', error);
		});

		test('handles session not available error', async () => {
			provider.session = null;
			
			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }],
				modelId: 'claude-3-sonnet'
			};

			await expect(provider.generateText(validParams)).rejects.toThrow('MCP provider requires session context');
		});
	});

	describe('Edge Cases', () => {
		test('handles missing content in MCP response', async () => {
			mockSession.requestSampling.mockResolvedValue({
				stopReason: 'stop_sequence'
				// missing content
			});
			
			mockBaseAIProvider.handleError.mockImplementation((operation, error) => {
				throw new Error(`Content missing: ${error.message}`);
			});

			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }],
				modelId: 'claude-3-sonnet'
			};

			await expect(provider.generateText(validParams)).rejects.toThrow();
		});

		test('handles MCP response with null content text', async () => {
			mockSession.requestSampling.mockResolvedValue({
				content: { text: null },
				stopReason: 'stop_sequence'
			});

			const validParams = {
				messages: [{ role: 'user', content: 'Hello' }],
				modelId: 'claude-3-sonnet'
			};

			const result = await provider.generateText(validParams);
			
			expect(result.text).toBe(null);
			expect(result.usage).toEqual({
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			});
		});

		test('uses default model when modelId not provided', async () => {
			const paramsWithoutModel = {
				messages: [{ role: 'user', content: 'Hello' }]
			};

			// Mock options with default model
			provider.options.defaultModel = 'default-model';

			await provider.generateText(paramsWithoutModel);
			
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('using model: default-model')
			);
		});
	});
});
