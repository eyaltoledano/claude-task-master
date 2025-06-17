import { jest } from '@jest/globals';

// Mock modules before importing
jest.unstable_mockModule('@ai-sdk/provider', () => ({
	NoSuchModelError: class NoSuchModelError extends Error {
		constructor({ modelId, modelType }) {
			super(`No such model: ${modelId}`);
			this.modelId = modelId;
			this.modelType = modelType;
		}
	}
}));

jest.unstable_mockModule('@ai-sdk/provider-utils', () => ({
	generateId: jest.fn(() => 'test-id-123')
}));

jest.unstable_mockModule('../../../../../src/ai-providers/custom-sdk/claude-code/message-converter.js', () => ({
	convertToClaudeCodeMessages: jest.fn((prompt) => ({
		messagesPrompt: 'converted-prompt',
		systemPrompt: 'system'
	}))
}));

jest.unstable_mockModule('../../../../../src/ai-providers/custom-sdk/claude-code/json-extractor.js', () => ({
	extractJson: jest.fn((text) => text)
}));

jest.unstable_mockModule('../../../../../src/ai-providers/custom-sdk/claude-code/errors.js', () => ({
	createAPICallError: jest.fn((opts) => new Error(opts.message)),
	createAuthenticationError: jest.fn((opts) => new Error(opts.message))
}));

// This mock will be controlled by tests
let mockClaudeCodeModule = null;
jest.unstable_mockModule('@anthropic-ai/claude-code', () => {
	if (mockClaudeCodeModule) {
		return mockClaudeCodeModule;
	}
	throw new Error("Cannot find module '@anthropic-ai/claude-code'");
});

// Import the module under test
const { ClaudeCodeLanguageModel } = await import('../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js');

describe('ClaudeCodeLanguageModel', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Reset the module mock
		mockClaudeCodeModule = null;
		// Clear module cache to ensure fresh imports
		jest.resetModules();
	});

	describe('constructor', () => {
		it('should initialize with valid model ID', () => {
			const model = new ClaudeCodeLanguageModel({
				id: 'opus',
				settings: { maxTurns: 5 }
			});

			expect(model.modelId).toBe('opus');
			expect(model.settings).toEqual({ maxTurns: 5 });
			expect(model.provider).toBe('claude-code');
		});

		it('should throw NoSuchModelError for invalid model ID', async () => {
			expect(() => new ClaudeCodeLanguageModel({
				id: '',
				settings: {}
			})).toThrow('No such model: ');

			expect(() => new ClaudeCodeLanguageModel({
				id: null,
				settings: {}
			})).toThrow('No such model: null');
		});
	});

	describe('lazy loading of @anthropic-ai/claude-code', () => {
		it('should throw error when package is not installed', async () => {
			// Keep mockClaudeCodeModule as null to simulate missing package
			const model = new ClaudeCodeLanguageModel({
				id: 'opus',
				settings: {}
			});

			await expect(model.doGenerate({
				prompt: [{ role: 'user', content: 'test' }],
				mode: { type: 'regular' }
			})).rejects.toThrow("Claude Code SDK is not installed. Please install '@anthropic-ai/claude-code' to use the claude-code provider.");
		});

		it('should load package successfully when available', async () => {
			// Mock successful package load
			const mockQuery = jest.fn(async function* () {
				yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } };
				yield { type: 'result', subtype: 'done', usage: { output_tokens: 10, input_tokens: 5 } };
			});
			
			mockClaudeCodeModule = {
				query: mockQuery,
				AbortError: class AbortError extends Error {}
			};

			// Need to re-import to get fresh module with mocks
			jest.resetModules();
			const { ClaudeCodeLanguageModel: FreshModel } = await import('../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js');
			
			const model = new FreshModel({
				id: 'opus',
				settings: {}
			});

			const result = await model.doGenerate({
				prompt: [{ role: 'user', content: 'test' }],
				mode: { type: 'regular' }
			});

			expect(result.text).toBe('Hello');
			expect(mockQuery).toHaveBeenCalled();
		});

		it('should only attempt to load package once', async () => {
			// Get a fresh import to ensure clean state
			jest.resetModules();
			const { ClaudeCodeLanguageModel: TestModel } = await import('../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js');
			
			const model = new TestModel({
				id: 'opus',
				settings: {}
			});

			// First call should throw
			await expect(model.doGenerate({
				prompt: [{ role: 'user', content: 'test' }],
				mode: { type: 'regular' }
			})).rejects.toThrow("Claude Code SDK is not installed");

			// Second call should also throw without trying to load again
			await expect(model.doGenerate({
				prompt: [{ role: 'user', content: 'test' }],
				mode: { type: 'regular' }
			})).rejects.toThrow("Claude Code SDK is not installed");
		});
	});

	describe('generateUnsupportedWarnings', () => {
		it('should generate warnings for unsupported parameters', () => {
			const model = new ClaudeCodeLanguageModel({
				id: 'opus',
				settings: {}
			});

			const warnings = model.generateUnsupportedWarnings({
				temperature: 0.7,
				maxTokens: 1000,
				topP: 0.9,
				seed: 42
			});

			expect(warnings).toHaveLength(4);
			expect(warnings[0]).toEqual({
				type: 'unsupported-setting',
				setting: 'temperature',
				details: 'Claude Code CLI does not support the temperature parameter. It will be ignored.'
			});
		});

		it('should return empty array when no unsupported parameters', () => {
			const model = new ClaudeCodeLanguageModel({
				id: 'opus',
				settings: {}
			});

			const warnings = model.generateUnsupportedWarnings({});
			expect(warnings).toEqual([]);
		});
	});

	describe('getModel', () => {
		it('should map model IDs correctly', () => {
			const model = new ClaudeCodeLanguageModel({
				id: 'opus',
				settings: {}
			});

			expect(model.getModel()).toBe('opus');
		});

		it('should return unmapped model IDs as-is', () => {
			const model = new ClaudeCodeLanguageModel({
				id: 'custom-model',
				settings: {}
			});

			expect(model.getModel()).toBe('custom-model');
		});
	});
});