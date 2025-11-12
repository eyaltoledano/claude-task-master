import { jest } from '@jest/globals';

// Mock the ai-sdk-provider-claude-code package
jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
	createClaudeCode: jest.fn(() => {
		const provider = (modelId, settings) => ({
			// Minimal mock language model surface
			id: modelId,
			settings,
			doGenerate: jest.fn(() => ({ text: 'ok', usage: {} })),
			doStream: jest.fn(() => ({ stream: true }))
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

// Mock config getters
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getClaudeCodeSettingsForCommand: jest.fn(() => ({})),
	getSupportedModelsForProvider: jest.fn(() => ['opus', 'sonnet', 'haiku']),
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info')
}));

// Import after mocking
const { ClaudeCodeProvider } = await import(
	'../../../src/ai-providers/claude-code.js'
);

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
			expect(() =>
				provider.validateAuth({
					apiKey: 'some-key',
					baseURL: 'https://example.com'
				})
			).not.toThrow();
		});
	});

	describe('getClient', () => {
		it('should return a claude code client', () => {
			const client = provider.getClient({});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});

		it('should create client without parameters', () => {
			const client = provider.getClient();
			expect(client).toBeDefined();
		});

		it('should handle commandName parameter', () => {
			const client = provider.getClient({
				commandName: 'test-command'
			});
			expect(client).toBeDefined();
		});

		it('should have languageModel and chat methods', () => {
			const client = provider.getClient({});
			expect(client.languageModel).toBeDefined();
			expect(client.chat).toBeDefined();
			expect(client.chat).toBe(client.languageModel);
		});

		it('should pass systemPrompt configuration to createClaudeCode', async () => {
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');

			provider.getClient({});

			expect(createClaudeCode).toHaveBeenCalledWith(
				expect.objectContaining({
					defaultSettings: expect.objectContaining({
						systemPrompt: {
							type: 'preset',
							preset: 'claude_code'
						}
					})
				})
			);
		});

		it('should pass settingSources configuration to createClaudeCode', async () => {
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');

			provider.getClient({});

			expect(createClaudeCode).toHaveBeenCalledWith(
				expect.objectContaining({
					defaultSettings: expect.objectContaining({
						settingSources: ['user', 'project', 'local']
					})
				})
			);
		});

		it('should pass defaultSettings from config to createClaudeCode', async () => {
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
			const { getClaudeCodeSettingsForCommand } = await import(
				'../../../scripts/modules/config-manager.js'
			);

			const mockSettings = { maxTokens: 4096, temperature: 0.7 };
			getClaudeCodeSettingsForCommand.mockReturnValueOnce(mockSettings);

			provider.getClient({ commandName: 'test-command' });

			expect(createClaudeCode).toHaveBeenCalledWith(
				expect.objectContaining({
					defaultSettings: expect.objectContaining({
						...mockSettings,
						systemPrompt: {
							type: 'preset',
							preset: 'claude_code'
						},
						settingSources: ['user', 'project', 'local']
					})
				})
			);
		});

		it('should pass complete configuration object to createClaudeCode', async () => {
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
			const { getClaudeCodeSettingsForCommand } = await import(
				'../../../scripts/modules/config-manager.js'
			);

			const mockSettings = { maxTokens: 2048 };
			getClaudeCodeSettingsForCommand.mockReturnValueOnce(mockSettings);

			provider.getClient({ commandName: 'analyze' });

			// Verify the complete configuration structure matches v2.0 migration requirements
			expect(createClaudeCode).toHaveBeenCalledWith({
				defaultSettings: {
					...mockSettings,
					// Restores pre-2.0 behavior: explicit system prompt preset
					systemPrompt: {
						type: 'preset',
						preset: 'claude_code'
					},
					// Restores pre-2.0 behavior: enables loading of CLAUDE.md and settings.json
					settingSources: ['user', 'project', 'local']
				}
			});
		});

		it('should pass empty defaultSettings when config returns null', async () => {
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
			const { getClaudeCodeSettingsForCommand } = await import(
				'../../../scripts/modules/config-manager.js'
			);

			getClaudeCodeSettingsForCommand.mockReturnValueOnce(null);

			provider.getClient({});

			expect(createClaudeCode).toHaveBeenCalledWith(
				expect.objectContaining({
					defaultSettings: expect.objectContaining({
						systemPrompt: {
							type: 'preset',
							preset: 'claude_code'
						},
						settingSources: ['user', 'project', 'local']
					})
				})
			);
		});
	});

	describe('model support', () => {
		it('should return supported models', () => {
			const models = provider.getSupportedModels();
			expect(models).toEqual(['opus', 'sonnet', 'haiku']);
		});

		it('should check if model is supported', () => {
			expect(provider.isModelSupported('sonnet')).toBe(true);
			expect(provider.isModelSupported('opus')).toBe(true);
			expect(provider.isModelSupported('haiku')).toBe(true);
			expect(provider.isModelSupported('unknown')).toBe(false);
		});
	});

	describe('error handling', () => {
		it('should handle client initialization errors', async () => {
			// Force an error by making createClaudeCode throw
			const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
			createClaudeCode.mockImplementationOnce(() => {
				throw new Error('Mock initialization error');
			});

			// Create a new provider instance to use the mocked createClaudeCode
			const errorProvider = new ClaudeCodeProvider();
			expect(() => errorProvider.getClient({})).toThrow(
				'Mock initialization error'
			);
		});
	});
});
