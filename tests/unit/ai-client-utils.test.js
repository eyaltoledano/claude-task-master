/**
 * ai-client-utils.test.js
 * Tests for AI client utility functions
 */

import { jest } from '@jest/globals';
import {
	getAnthropicClientForMCP,
	getPerplexityClientForMCP,
	getModelConfig,
	getBestAvailableAIModel,
	handleClaudeError
} from '../../mcp-server/src/core/utils/ai-client-utils.js';

// Mock the Anthropic constructor
jest.mock('@anthropic-ai/sdk', () => {
	return {
		Anthropic: jest.fn().mockImplementation(() => {
			return {
				messages: {
					create: jest.fn().mockResolvedValue({})
				}
			};
		})
	};
});

// Mock the OpenAI dynamic import
jest.mock('openai', () => {
	return {
		default: jest.fn().mockImplementation(() => {
			return {
				chat: {
					completions: {
						create: jest.fn().mockResolvedValue({})
					}
				}
			};
		})
	};
});

describe('AI Client Utilities', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Reset process.env before each test
		process.env = { ...originalEnv };

		// Clear all mocks
		jest.clearAllMocks();
	});

	afterAll(() => {
		// Restore process.env
		process.env = originalEnv;
	});

	describe('getAnthropicClientForMCP', () => {
		it('should initialize client with API key from session', () => {
			// Setup
			const session = {
				env: {
					ANTHROPIC_API_KEY: 'test-key-from-session'
				}
			};
			const mockLog = { error: jest.fn() };

			// Execute
			const client = getAnthropicClientForMCP(session, mockLog);

			// Verify
			expect(client).toBeDefined();
			expect(client.messages.create).toBeDefined();
			expect(mockLog.error).not.toHaveBeenCalled();
		});

		it('should fall back to process.env when session key is missing', () => {
			// Setup
			process.env.ANTHROPIC_API_KEY = 'test-key-from-env';
			const session = { env: {} };
			const mockLog = { error: jest.fn() };

			// Execute
			const client = getAnthropicClientForMCP(session, mockLog);

			// Verify
			expect(client).toBeDefined();
			expect(mockLog.error).not.toHaveBeenCalled();
		});

		it('should throw error when API key is missing', () => {
			// Setup
			delete process.env.ANTHROPIC_API_KEY;
			const session = { env: {} };
			const mockLog = { error: jest.fn() };

			// Execute & Verify
			expect(() => getAnthropicClientForMCP(session, mockLog)).toThrow();
			expect(mockLog.error).toHaveBeenCalled();
		});
	});

	describe('getPerplexityClientForMCP', () => {
		it('should initialize client with API key from session', async () => {
			// Setup
			const session = {
				env: {
					PERPLEXITY_API_KEY: 'test-perplexity-key'
				}
			};
			const mockLog = { error: jest.fn() };

			// Execute
			const client = await getPerplexityClientForMCP(session, mockLog);

			// Verify
			expect(client).toBeDefined();
			expect(client.chat.completions.create).toBeDefined();
			expect(mockLog.error).not.toHaveBeenCalled();
		});

		it('should throw error when API key is missing', async () => {
			// Setup
			delete process.env.PERPLEXITY_API_KEY;
			const session = { env: {} };
			const mockLog = { error: jest.fn() };

			// Execute & Verify
			await expect(
				getPerplexityClientForMCP(session, mockLog)
			).rejects.toThrow();
			expect(mockLog.error).toHaveBeenCalled();
		});
	});

	describe('getModelConfig', () => {
		it('should get model config from session', () => {
			// Setup
			const session = {
				env: {
					MODEL: 'claude-3-opus',
					MAX_TOKENS: '8000',
					TEMPERATURE: '0.5'
				}
			};

			// Execute
			const config = getModelConfig(session);

			// Verify
			expect(config).toEqual({
				model: 'claude-3-opus',
				maxTokens: 8000,
				temperature: 0.5
			});
		});

		it('should use default values when session values are missing', () => {
			// Setup
			const session = {
				env: {
					// No values
				}
			};

			// Execute
			const config = getModelConfig(session);

			// Verify
			expect(config).toEqual({
				model: 'claude-3-7-sonnet-20250219',
				maxTokens: 64000,
				temperature: 0.2
			});
		});

		it('should allow custom defaults', () => {
			// Setup
			const session = { env: {} };
			const customDefaults = {
				model: 'custom-model',
				maxTokens: 2000,
				temperature: 0.3
			};

			// Execute
			const config = getModelConfig(session, customDefaults);

			// Verify
			expect(config).toEqual(customDefaults);
		});
	});

	describe('getBestAvailableAIModel', () => {
		it('should return Perplexity for research when available', async () => {
			// Setup
			const session = {
				env: {
					PERPLEXITY_API_KEY: 'test-perplexity-key',
					ANTHROPIC_API_KEY: 'test-anthropic-key'
				}
			};
			const mockLog = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };

			// Execute
			const result = await getBestAvailableAIModel(
				session,
				{ requiresResearch: true },
				mockLog
			);

			// Verify
			expect(result.type).toBe('perplexity');
			expect(result.client).toBeDefined();
		});

		it('should return Claude when Perplexity is not available and Claude is not overloaded', async () => {
			// Setup
			const originalPerplexityKey = process.env.PERPLEXITY_API_KEY;
			delete process.env.PERPLEXITY_API_KEY; // Make sure Perplexity is not available in process.env

			const session = {
				env: {
					ANTHROPIC_API_KEY: 'test-anthropic-key'
					// Purposely not including PERPLEXITY_API_KEY
				}
			};
			const mockLog = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };

			try {
				// Execute
				const result = await getBestAvailableAIModel(
					session,
					{ requiresResearch: true },
					mockLog
				);

				// Verify
				// In our implementation, we prioritize research capability through Perplexity
				// so if we're testing research but Perplexity isn't available, Claude is used
				expect(result.type).toBe('claude');
				expect(result.client).toBeDefined();
				expect(mockLog.warn).toHaveBeenCalled(); // Warning about using Claude instead of Perplexity
			} finally {
				// Restore original env variables
				if (originalPerplexityKey) {
					process.env.PERPLEXITY_API_KEY = originalPerplexityKey;
				}
			}
		});

		it('should fall back to Claude as last resort when overloaded', async () => {
			// Setup
			const session = {
				env: {
					ANTHROPIC_API_KEY: 'test-anthropic-key'
				}
			};
			const mockLog = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };

			// Execute
			const result = await getBestAvailableAIModel(
				session,
				{ claudeOverloaded: true },
				mockLog
			);

			// Verify
			expect(result.type).toBe('claude');
			expect(result.client).toBeDefined();
			expect(mockLog.warn).toHaveBeenCalled(); // Warning about Claude overloaded
		});

		it('should throw error when no models are available', async () => {
			// Setup
			delete process.env.ANTHROPIC_API_KEY;
			delete process.env.PERPLEXITY_API_KEY;
			const session = { env: {} };
			const mockLog = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };

			// Execute & Verify
			await expect(
				getBestAvailableAIModel(session, {}, mockLog)
			).rejects.toThrow();
		});
	});

	describe('handleClaudeError', () => {
		it('should handle overloaded error', () => {
			// Setup
			const error = {
				type: 'error',
				error: {
					type: 'overloaded_error',
					message: 'Claude is overloaded'
				}
			};

			// Execute
			const message = handleClaudeError(error);

			// Verify
			expect(message).toContain('overloaded');
		});

		it('should handle rate limit error', () => {
			// Setup
			const error = {
				type: 'error',
				error: {
					type: 'rate_limit_error',
					message: 'Rate limit exceeded'
				}
			};

			// Execute
			const message = handleClaudeError(error);

			// Verify
			expect(message).toContain('rate limit');
		});

		it('should handle timeout error', () => {
			// Setup
			const error = {
				message: 'Request timed out after 60 seconds'
			};

			// Execute
			const message = handleClaudeError(error);

			// Verify
			expect(message).toContain('timed out');
		});

		it('should handle generic errors', () => {
			// Setup
			const error = {
				message: 'Something went wrong'
			};

			// Execute
			const message = handleClaudeError(error);

			// Verify
			expect(message).toContain('Error communicating with Claude');
		});
	});
});
