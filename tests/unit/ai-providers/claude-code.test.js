import { jest } from '@jest/globals';

// Mock the claude-code SDK module
jest.unstable_mockModule('../../../src/ai-providers/custom-sdk/claude-code/index.js', () => ({
	createClaudeCode: jest.fn(() => {
		const provider = (modelId, settings) => ({
			// Mock language model
			id: modelId,
			settings
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
const { ClaudeCodeProvider } = await import('../../../src/ai-providers/claude-code.js');

describe('ClaudeCodeProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new ClaudeCodeProvider();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should set the provider name to Claude Code', () => {
			expect(provider.name).toBe('Claude Code');
		});
	});

	describe('validateAuth', () => {
		it('should not throw an error (no API key required)', () => {
			expect(() => provider.validateAuth({})).not.toThrow();
		});

		it('should not require any parameters', () => {
			expect(() => provider.validateAuth()).not.toThrow();
		});

		it('should work with any params passed', () => {
			expect(() => provider.validateAuth({
				apiKey: 'some-key',
				baseURL: 'https://example.com'
			})).not.toThrow();
		});
	});

	describe('getClient', () => {
		it('should return a claude code client', () => {
			const client = provider.getClient({});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should create client without API key or base URL', () => {
			const client = provider.getClient({});
			expect(client).toBeDefined();
		});

		it('should handle params even though they are not used', () => {
			const client = provider.getClient({
				baseURL: 'https://example.com',
				apiKey: 'unused-key'
			});
			expect(client).toBeDefined();
		});

		it('should have languageModel and chat methods', () => {
			const client = provider.getClient({});
			expect(client.languageModel).toBeDefined();
			expect(client.chat).toBeDefined();
			expect(client.chat).toBe(client.languageModel);
		});
	});

	describe('error handling', () => {
		it('should handle client initialization errors', async () => {
			// Force an error by making createClaudeCode throw
			const { createClaudeCode } = await import('../../../src/ai-providers/custom-sdk/claude-code/index.js');
			createClaudeCode.mockImplementationOnce(() => {
				throw new Error('Mock initialization error');
			});

			// Create a new provider instance to use the mocked createClaudeCode
			const errorProvider = new ClaudeCodeProvider();
			expect(() => errorProvider.getClient({})).toThrow('Mock initialization error');
		});
	});
});