import { jest } from '@jest/globals';

// Mock the mcp-sampling SDK module
jest.unstable_mockModule(
	'../../../src/ai-providers/custom-sdk/mcp-sampling/index.js',
	() => ({
		createMcpSampling: jest.fn(() => {
			const provider = (modelId, settings) => ({
				// Mock language model
				id: modelId,
				settings
			});
			provider.languageModel = jest.fn((id, settings) => ({ id, settings }));
			provider.chat = provider.languageModel;
			provider.textEmbeddingModel = jest.fn(() => {
				throw new Error('MCP Sampling does not support text embeddings');
			});
			return provider;
		})
	})
);

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
const { McpSamplingProvider } = await import(
	'../../../src/ai-providers/mcp-sampling.js'
);
const { createMcpSampling } = await import(
	'../../../src/ai-providers/custom-sdk/mcp-sampling/index.js'
);

describe('McpSamplingProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new McpSamplingProvider();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should set the provider name to MCP Sampling', () => {
			expect(provider.name).toBe('MCP Sampling');
		});
	});

	describe('validateAuth', () => {
		it('should not throw any errors when called', () => {
			expect(() => {
				provider.validateAuth({});
			}).not.toThrow();
		});

		it('should not require an API key', () => {
			expect(() => {
				provider.validateAuth({ apiKey: undefined });
			}).not.toThrow();
		});

		it('should work with any params including session', () => {
			const mockSession = {
				requestSampling: jest.fn(),
				clientCapabilities: { sampling: true }
			};

			expect(() => {
				provider.validateAuth({ session: mockSession });
			}).not.toThrow();
		});
	});

	describe('getClient', () => {
		it('should return a client from createMcpSampling factory', () => {
			const mockSession = {
				requestSampling: jest.fn(),
				clientCapabilities: { sampling: true }
			};

			const params = {
				session: mockSession,
				timeout: 60000,
				includeContext: 'all'
			};

			const client = provider.getClient(params);

			expect(createMcpSampling).toHaveBeenCalledWith({
				defaultSettings: {
					session: mockSession,
					timeout: 60000,
					includeContext: 'all'
				}
			});

			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should use default values when not provided', () => {
			const mockSession = {
				requestSampling: jest.fn(),
				clientCapabilities: { sampling: true }
			};

			const params = {
				session: mockSession
			};

			provider.getClient(params);

			expect(createMcpSampling).toHaveBeenCalledWith({
				defaultSettings: {
					session: mockSession,
					timeout: 120000,
					includeContext: 'thisServer'
				}
			});
		});

		it('should pass through additional settings', () => {
			const mockSession = {
				requestSampling: jest.fn(),
				clientCapabilities: { sampling: true }
			};

			const params = {
				session: mockSession,
				settings: {
					costPriority: 0.7,
					speedPriority: 0.3,
					intelligencePriority: 0.9
				}
			};

			provider.getClient(params);

			expect(createMcpSampling).toHaveBeenCalledWith({
				defaultSettings: {
					session: mockSession,
					timeout: 120000,
					includeContext: 'thisServer',
					costPriority: 0.7,
					speedPriority: 0.3,
					intelligencePriority: 0.9
				}
			});
		});

		it('should handle errors during client initialization', () => {
			// Make createMcpSampling throw an error
			createMcpSampling.mockImplementationOnce(() => {
				throw new Error('Failed to create client');
			});

			expect(() => {
				provider.getClient({});
			}).toThrow('Failed to create client');
		});

		it('should support language model creation', () => {
			const client = provider.getClient({ session: {} });

			// Verify the client has expected methods
			expect(client.languageModel).toBeDefined();
			expect(client.chat).toBeDefined();
			expect(client.textEmbeddingModel).toBeDefined();

			// Test that language model can be created
			const model = client.languageModel('claude-3-opus', { maxTokens: 1000 });
			expect(model).toEqual({
				id: 'claude-3-opus',
				settings: { maxTokens: 1000 }
			});
		});

		it('should throw error for text embedding models', () => {
			const client = provider.getClient({ session: {} });

			expect(() => {
				client.textEmbeddingModel('text-embedding-ada-002');
			}).toThrow('MCP Sampling does not support text embeddings');
		});
	});
});