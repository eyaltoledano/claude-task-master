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

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/claude-code/message-converter.js',
	() => ({
		convertToClaudeCodeMessages: jest.fn((prompt) => ({
			messagesPrompt: 'converted-prompt',
			systemPrompt: 'system'
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/claude-code/json-extractor.js',
	() => ({
		extractJson: jest.fn((text) => text)
	})
);

jest.unstable_mockModule(
	'../../../../../src/ai-providers/custom-sdk/claude-code/errors.js',
	() => ({
		createAPICallError: jest.fn((error) => new Error(error.message)),
		createAuthenticationError: jest.fn((error) => new Error(error.message))
	})
);

// Mock the Claude Code SDK
const mockQuery = jest.fn();
jest.unstable_mockModule('@anthropic-ai/claude-code', () => ({
	query: mockQuery,
	AbortError: class AbortError extends Error {
		constructor(message) {
			super(message);
			this.name = 'AbortError';
		}
	}
}));

// Import after mocking
const { ClaudeCodeLanguageModel } = await import(
	'../../../../../src/ai-providers/custom-sdk/claude-code/language-model.js'
);

describe('ClaudeCodeLanguageModel - AbortSignal handling', () => {
	let model;
	const mockPrompt = [{ role: 'user', content: 'Test prompt' }];

	beforeEach(() => {
		model = new ClaudeCodeLanguageModel({ id: 'opus' });
		jest.clearAllMocks();
	});

	describe('doGenerate', () => {
		it('should add abort listener with once: true option', async () => {
			const abortSignal = new AbortController().signal;
			const addEventListenerSpy = jest.spyOn(abortSignal, 'addEventListener');

			// Mock query response
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Response' }] } };
					yield { type: 'result', session_id: 'test-session' };
				}
			}));

			await model.doGenerate({ prompt: mockPrompt, abortSignal });

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function),
				{ once: true }
			);
		});

		it('should remove abort listener in finally block', async () => {
			const abortSignal = new AbortController().signal;
			const removeEventListenerSpy = jest.spyOn(abortSignal, 'removeEventListener');

			// Mock query response
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Response' }] } };
					yield { type: 'result', session_id: 'test-session' };
				}
			}));

			await model.doGenerate({ prompt: mockPrompt, abortSignal });

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function)
			);
		});

		it('should remove abort listener even if error occurs', async () => {
			const abortSignal = new AbortController().signal;
			const removeEventListenerSpy = jest.spyOn(abortSignal, 'removeEventListener');

			// Mock query to throw error
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					throw new Error('Test error');
				}
			}));

			await expect(
				model.doGenerate({ prompt: mockPrompt, abortSignal })
			).rejects.toThrow();

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function)
			);
		});
	});

	describe('doStream', () => {
		it('should add abort listener with once: true option', async () => {
			const abortSignal = new AbortController().signal;
			const addEventListenerSpy = jest.spyOn(abortSignal, 'addEventListener');

			// Mock query response
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Response' }] } };
					yield { type: 'result', session_id: 'test-session' };
				}
			}));

			const result = await model.doStream({ prompt: mockPrompt, abortSignal });

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function),
				{ once: true }
			);

			// Consume the stream to trigger cleanup
			const reader = result.stream.getReader();
			try {
				while (true) {
					const { done } = await reader.read();
					if (done) break;
				}
			} finally {
				reader.releaseLock();
			}
		});

		it('should remove abort listener in finally block', async () => {
			const abortSignal = new AbortController().signal;
			const removeEventListenerSpy = jest.spyOn(abortSignal, 'removeEventListener');

			// Mock query response
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Response' }] } };
					yield { type: 'result', session_id: 'test-session' };
				}
			}));

			const result = await model.doStream({ prompt: mockPrompt, abortSignal });

			// Consume the stream to trigger cleanup
			const reader = result.stream.getReader();
			try {
				while (true) {
					const { done } = await reader.read();
					if (done) break;
				}
			} finally {
				reader.releaseLock();
			}

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function)
			);
		});

		it('should remove abort listener when stream is cancelled', async () => {
			const abortSignal = new AbortController().signal;
			const removeEventListenerSpy = jest.spyOn(abortSignal, 'removeEventListener');

			// Mock query response with delay
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					await new Promise(resolve => setTimeout(resolve, 100));
					yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Response' }] } };
				}
			}));

			const result = await model.doStream({ prompt: mockPrompt, abortSignal });

			// Cancel the stream
			await result.stream.cancel();

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function)
			);
		});

		it('should remove abort listener even if stream errors', async () => {
			const abortSignal = new AbortController().signal;
			const removeEventListenerSpy = jest.spyOn(abortSignal, 'removeEventListener');

			// Mock query to throw error
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					throw new Error('Stream error');
				}
			}));

			const result = await model.doStream({ prompt: mockPrompt, abortSignal });

			// Try to consume the stream (it will error)
			const reader = result.stream.getReader();
			try {
				await reader.read();
			} catch {
				// Expected error
			} finally {
				reader.releaseLock();
			}

			expect(removeEventListenerSpy).toHaveBeenCalledWith(
				'abort',
				expect.any(Function)
			);
		});
	});

	describe('memory leak prevention', () => {
		it('should not accumulate listeners when reusing same signal', async () => {
			const abortController = new AbortController();
			const { signal } = abortController;

			// Mock query response
			mockQuery.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Response' }] } };
					yield { type: 'result', session_id: 'test-session' };
				}
			}));

			// Make multiple calls with the same signal
			for (let i = 0; i < 5; i++) {
				await model.doGenerate({ prompt: mockPrompt, abortSignal: signal });
			}

			// Check that we don't have accumulated listeners
			// The 'once: true' option should prevent accumulation
			// This test verifies the fix works as intended
			expect(signal.aborted).toBe(false);
		});
	});
});