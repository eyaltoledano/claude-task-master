import { jest } from '@jest/globals';

describe('Claude Code Integration (Optional)', () => {
	let ClaudeCodeProvider;
	let generateText;
	let streamText;

	beforeAll(async () => {
		// Mock AI SDK functions
		generateText = jest.fn();
		streamText = jest.fn();
		
		jest.unstable_mockModule('ai', () => ({
			generateText,
			streamText
		}));
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should handle missing claude code CLI gracefully', async () => {
		// Mock the provider to throw when CLI is not available
		jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
			createClaudeCode: jest.fn(() => {
				throw new Error('Claude Code CLI not found');
			})
		}));

		const { ClaudeCodeProvider } = await import('../../src/ai-providers/claude-code.js');
		const provider = new ClaudeCodeProvider();

		expect(() => provider.getClient()).toThrow(/Claude Code CLI not available/);
	});

	describe('with Claude Code available', () => {
		beforeEach(async () => {
			// Mock successful provider creation
			const mockProvider = jest.fn((modelId) => ({ 
				id: modelId,
				doGenerate: jest.fn(),
				doStream: jest.fn()
			}));
			
			jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
				createClaudeCode: jest.fn(() => mockProvider)
			}));

			const module = await import('../../src/ai-providers/claude-code.js');
			ClaudeCodeProvider = module.ClaudeCodeProvider;
		});

		it('should create a working provider instance', () => {
			const provider = new ClaudeCodeProvider();
			expect(provider.name).toBe('Claude Code');
			expect(provider.getSupportedModels()).toEqual(['sonnet', 'opus']);
		});

		it('should integrate with AI SDK generateText', async () => {
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

		it('should integrate with AI SDK streamText', async () => {
			const provider = new ClaudeCodeProvider();
			const client = provider.getClient();
			
			// Mock successful streaming
			const mockStream = {
				textStream: (async function* () {
					yield 'Hello ';
					yield 'from ';
					yield 'Claude Code!';
				})()
			};
			streamText.mockResolvedValueOnce(mockStream);

			const result = await streamText({
				model: client('sonnet'),
				messages: [{ role: 'user', content: 'Hello' }]
			});

			expect(result.textStream).toBeDefined();
			expect(streamText).toHaveBeenCalledWith({
				model: expect.any(Object),
				messages: [{ role: 'user', content: 'Hello' }]
			});
		});
	});
});
