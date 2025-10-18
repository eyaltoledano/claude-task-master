import { jest } from '@jest/globals';

// Mock AI SDK functions at the top level
jest.unstable_mockModule('ai', () => ({
	generateObject: jest.fn(),
	generateText: jest.fn(),
	streamText: jest.fn(),
	streamObject: jest.fn(),
	zodSchema: jest.fn(),
	JSONParseError: class JSONParseError extends Error {},
	NoObjectGeneratedError: class NoObjectGeneratedError extends Error {}
}));

// Mock CLI failure scenario
jest.unstable_mockModule('ai-sdk-provider-claude-code', () => ({
	createClaudeCode: jest.fn(() => {
		throw new Error('Claude Code CLI not found');
	})
}));

// Import the provider after mocking
const { ClaudeCodeProvider } = await import(
	'../../src/ai-providers/claude-code.js'
);

describe('Claude Code Error Handling', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should throw a CLI-not-available error (with or without commandName)', () => {
		const provider = new ClaudeCodeProvider();
		expect(() => provider.getClient()).toThrow(
			/Claude Code CLI not available/i
		);
		expect(() => provider.getClient({ commandName: 'test' })).toThrow(
			/Claude Code CLI not available/i
		);
	});

	it('should still support basic provider functionality', () => {
		const provider = new ClaudeCodeProvider();

		// These should work even if CLI is not available
		expect(provider.name).toBe('Claude Code');
		expect(provider.getSupportedModels()).toEqual(['opus', 'sonnet', 'haiku']);
		expect(provider.isModelSupported('sonnet')).toBe(true);
		expect(provider.isModelSupported('haiku')).toBe(true);
		expect(provider.isRequiredApiKey()).toBe(false);
		expect(() => provider.validateAuth()).not.toThrow();
	});
});
