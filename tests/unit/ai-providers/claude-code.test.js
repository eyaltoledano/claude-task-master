import { jest } from '@jest/globals';

// Mock the base provider to avoid circular dependency issues
jest.unstable_mockModule('../../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: class MockBaseAIProvider {
		constructor() {
			this.name = this.constructor.name;
		}
		validateParams() {}
		prepareMessages() {
			return [];
		}
	}
}));

// Import after mocking base provider
const { ClaudeCodeProvider } = await import(
	'../../../src/ai-providers/claude-code.js'
);

describe('ClaudeCodeProvider', () => {
	let provider;
	let mockQuery;

	beforeEach(() => {
		// Create a fresh mock for each test
		mockQuery = jest.fn();

		// Create provider instance
		provider = new ClaudeCodeProvider();

		// Mock the loadSDK method to return our mocked module
		provider.loadSDK = jest.fn().mockResolvedValue({
			query: mockQuery
		});

		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			expect(provider.providerName).toBe('claude-code');
			expect(provider.requiresApiKey).toBe(false);
			expect(provider.supportsStreaming).toBe(true);
			expect(provider.supportsTools).toBe(true);
		});
	});

	describe('checkAuthentication', () => {
		it('should always return true (relies on SDK auth)', async () => {
			const result = await provider.checkAuthentication();
			expect(result).toBe(true);
		});
	});

	describe('generateText', () => {
		it('should generate text from assistant messages', async () => {
			// Mock the async iterator response
			const mockMessages = [
				{
					type: 'system',
					message: { content: 'System message' }
				},
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Hello, this is a test response' }]
					}
				},
				{
					type: 'result',
					result: 'Completed'
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test prompt' }],
				temperature: 0.7,
				maxTokens: 1000
			};

			const result = await provider.generateText(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'Test prompt',
				options: expect.objectContaining({
					maxTurns: 1,
					allowedTools: [],
					permissionMode: 'default'
				})
			});

			expect(result.text).toBe('Hello, this is a test response');
			expect(result.usage).toBeDefined();
			expect(result.usage.promptTokens).toBeGreaterThan(0);
		});

		it('should handle system prompts correctly', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Response with system prompt' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [
					{ role: 'system', content: 'You are a helpful assistant' },
					{ role: 'user', content: 'Test prompt' }
				],
				systemPrompt: 'Additional system context'
			};

			await provider.generateText(params);

			expect(mockQuery).toHaveBeenCalledWith({
				prompt: 'Test prompt',
				options: expect.objectContaining({
					systemPrompt: expect.stringContaining('You are a helpful assistant')
				})
			});
		});
	});

	describe('generateObject', () => {
		it('should parse JSON response correctly', async () => {
			const expectedObject = {
				tasks: [{ id: 1, title: 'Test Task', description: 'Test description' }],
				metadata: { totalTasks: 1 }
			};

			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: JSON.stringify(expectedObject) }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Generate tasks' }],
				schema: { type: 'object' }
			};

			const result = await provider.generateObject(params);

			expect(result.object).toEqual(expectedObject);
			expect(result.usage).toBeDefined();
		});

		it('should handle JSON with markdown code blocks', async () => {
			const expectedObject = { test: 'value' };

			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: '```json\n{"test": "value"}\n```' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				schema: {}
			};

			const result = await provider.generateObject(params);
			expect(result.object).toEqual(expectedObject);
		});

		it('should throw error for invalid JSON', async () => {
			const mockMessages = [
				{
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'This is not valid JSON' }]
					}
				}
			];

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				schema: {}
			};

			await expect(provider.generateObject(params)).rejects.toThrow(
				'Failed to parse JSON response'
			);
		});
	});

	describe('streamText', () => {
		it('should stream text chunks correctly', async () => {
			const chunks = ['Hello', ' ', 'world'];
			const mockMessages = chunks.map((chunk) => ({
				type: 'assistant',
				message: {
					content: [{ type: 'text', text: chunk }]
				}
			}));

			mockQuery.mockImplementation(async function* () {
				for (const msg of mockMessages) {
					yield msg;
				}
			});

			const receivedChunks = [];
			const params = {
				messages: [{ role: 'user', content: 'Test' }],
				onChunk: (chunk) => receivedChunks.push(chunk)
			};

			const result = await provider.streamText(params);

			expect(receivedChunks).toEqual(chunks);
			expect(result.text).toBe('Hello world');
			expect(result.usage).toBeDefined();
		});
	});

	describe('error handling', () => {
		it('should handle SDK not installed error', async () => {
			// Override the mock to simulate SDK not found
			provider.loadSDK = jest
				.fn()
				.mockRejectedValue(
					new Error(
						'Claude Code SDK not installed. Please install it with: npm install @anthropic-ai/claude-code'
					)
				);

			await expect(provider.generateText({ messages: [] })).rejects.toThrow(
				'Claude Code SDK not installed. Please install it with: npm install @anthropic-ai/claude-code'
			);
		});

		it('should handle authentication errors', async () => {
			mockQuery.mockImplementation(() => {
				throw new Error('unauthorized: credentials not found');
			});

			await expect(
				provider.generateText({ messages: [{ role: 'user', content: 'test' }] })
			).rejects.toThrow(
				'Claude Code authentication failed. Please ensure you are logged in by running: claude auth login'
			);
		});
	});
});
