import { jest } from '@jest/globals';

// Mock AI SDK functions at the top level
const generateText = jest.fn();
const streamText = jest.fn();

jest.unstable_mockModule('ai', () => ({
	generateObject: jest.fn(),
	generateText,
	streamText,
	streamObject: jest.fn(),
	zodSchema: jest.fn(),
	JSONParseError: class JSONParseError extends Error {},
	NoObjectGeneratedError: class NoObjectGeneratedError extends Error {}
}));

// Mock successful provider creation for all tests
const mockProvider = jest.fn((modelId) => ({
	id: modelId,
	doGenerate: jest.fn(),
	doStream: jest.fn()
}));
mockProvider.languageModel = jest.fn((id, settings) => ({ id, settings }));
mockProvider.chat = mockProvider.languageModel;

jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
	createClaudeCode: jest.fn(() => mockProvider)
}));

// Import the provider after mocking
const { ClaudeCodeProvider } = await import(
	'../../src/ai-providers/claude-code.js'
);

describe('Claude Code Integration (Optional)', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should create a working provider instance', () => {
		const provider = new ClaudeCodeProvider();
		expect(provider.name).toBe('Claude Code');
		expect(provider.getSupportedModels()).toEqual(['opus', 'sonnet', 'haiku']);
	});

	it('should support model validation', () => {
		const provider = new ClaudeCodeProvider();
		expect(provider.isModelSupported('sonnet')).toBe(true);
		expect(provider.isModelSupported('opus')).toBe(true);
		expect(provider.isModelSupported('haiku')).toBe(true);
		expect(provider.isModelSupported('unknown')).toBe(false);
	});

	it('should create a client successfully', () => {
		const provider = new ClaudeCodeProvider();
		const client = provider.getClient();

		expect(client).toBeDefined();
		expect(typeof client).toBe('function');
		expect(client.languageModel).toBeDefined();
		expect(client.chat).toBeDefined();
		expect(client.chat).toBe(client.languageModel);
	});

	it('should pass command-specific settings to client', async () => {
		const provider = new ClaudeCodeProvider();
		const client = provider.getClient({ commandName: 'test-command' });

		expect(client).toBeDefined();
		expect(typeof client).toBe('function');
		const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
		expect(createClaudeCode).toHaveBeenCalledTimes(1);
	});

	it('should handle AI SDK generateText integration', async () => {
		const provider = new ClaudeCodeProvider();
		const client = provider.getClient();

		// Mock successful generation
		generateText.mockResolvedValueOnce({
			text: 'Hello from Claude Code!',
			usage: { totalTokens: 10 }
		});

		const result = await generateText({
			model: client('sonnet'),
			messages: [{ role: 'user', content: 'Hello' }]
		});

		expect(result.text).toBe('Hello from Claude Code!');
		expect(generateText).toHaveBeenCalledWith({
			model: expect.any(Object),
			messages: [{ role: 'user', content: 'Hello' }]
		});
	});

	it('should handle AI SDK streamText integration', async () => {
		const provider = new ClaudeCodeProvider();
		const client = provider.getClient();

		// Mock successful streaming
		const mockStream = {
			textStream: (async function* () {
				yield 'Streamed response';
			})()
		};
		streamText.mockResolvedValueOnce(mockStream);

		const streamResult = await streamText({
			model: client('sonnet'),
			messages: [{ role: 'user', content: 'Stream test' }]
		});

		expect(streamResult.textStream).toBeDefined();
		expect(streamText).toHaveBeenCalledWith({
			model: expect.any(Object),
			messages: [{ role: 'user', content: 'Stream test' }]
		});
	});

	it('should not require authentication validation', () => {
		const provider = new ClaudeCodeProvider();
		expect(provider.isRequiredApiKey()).toBe(false);
		expect(() => provider.validateAuth()).not.toThrow();
		expect(() => provider.validateAuth({})).not.toThrow();
		expect(() => provider.validateAuth({ commandName: 'test' })).not.toThrow();
	});
});
