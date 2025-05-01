import { jest } from '@jest/globals';

// Mock config-manager
const mockGetMainProvider = jest.fn();
const mockGetMainModelId = jest.fn();
const mockGetResearchProvider = jest.fn();
const mockGetResearchModelId = jest.fn();
const mockGetFallbackProvider = jest.fn();
const mockGetFallbackModelId = jest.fn();
const mockGetParametersForRole = jest.fn();

jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	getMainProvider: mockGetMainProvider,
	getMainModelId: mockGetMainModelId,
	getResearchProvider: mockGetResearchProvider,
	getResearchModelId: mockGetResearchModelId,
	getFallbackProvider: mockGetFallbackProvider,
	getFallbackModelId: mockGetFallbackModelId,
	getParametersForRole: mockGetParametersForRole
}));

// Mock AI Provider Modules
const mockGenerateAnthropicText = jest.fn();
const mockStreamAnthropicText = jest.fn();
const mockGenerateAnthropicObject = jest.fn();
jest.unstable_mockModule('../../src/ai-providers/anthropic.js', () => ({
	generateAnthropicText: mockGenerateAnthropicText,
	streamAnthropicText: mockStreamAnthropicText,
	generateAnthropicObject: mockGenerateAnthropicObject
}));

const mockGeneratePerplexityText = jest.fn();
const mockStreamPerplexityText = jest.fn();
const mockGeneratePerplexityObject = jest.fn();
jest.unstable_mockModule('../../src/ai-providers/perplexity.js', () => ({
	generatePerplexityText: mockGeneratePerplexityText,
	streamPerplexityText: mockStreamPerplexityText,
	generatePerplexityObject: mockGeneratePerplexityObject
}));

// ... Mock other providers (google, openai, etc.) similarly ...

// Mock utils logger and API key resolver
const mockLog = jest.fn();
const mockResolveEnvVariable = jest.fn();
jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	log: mockLog,
	resolveEnvVariable: mockResolveEnvVariable
}));

// Import the module to test (AFTER mocks)
const { generateTextService } = await import(
	'../../scripts/modules/ai-services-unified.js'
);

describe('Unified AI Services', () => {
	beforeEach(() => {
		// Clear mocks before each test
		jest.clearAllMocks(); // Clears all mocks

		// Set default mock behaviors
		mockGetMainProvider.mockReturnValue('anthropic');
		mockGetMainModelId.mockReturnValue('test-main-model');
		mockGetResearchProvider.mockReturnValue('perplexity');
		mockGetResearchModelId.mockReturnValue('test-research-model');
		mockGetFallbackProvider.mockReturnValue('anthropic');
		mockGetFallbackModelId.mockReturnValue('test-fallback-model');
		mockGetParametersForRole.mockImplementation((role) => {
			if (role === 'main') return { maxTokens: 100, temperature: 0.5 };
			if (role === 'research') return { maxTokens: 200, temperature: 0.3 };
			if (role === 'fallback') return { maxTokens: 150, temperature: 0.6 };
			return { maxTokens: 100, temperature: 0.5 }; // Default
		});
		mockResolveEnvVariable.mockImplementation((key) => {
			if (key === 'ANTHROPIC_API_KEY') return 'mock-anthropic-key';
			if (key === 'PERPLEXITY_API_KEY') return 'mock-perplexity-key';
			return null;
		});
	});

	describe('generateTextService', () => {
		test('should use main provider/model and succeed', async () => {
			mockGenerateAnthropicText.mockResolvedValue('Main provider response');

			const params = {
				role: 'main',
				session: { env: {} },
				systemPrompt: 'System',
				prompt: 'Test'
			};
			const result = await generateTextService(params);

			expect(result).toBe('Main provider response');
			expect(mockGetMainProvider).toHaveBeenCalled();
			expect(mockGetMainModelId).toHaveBeenCalled();
			expect(mockGetParametersForRole).toHaveBeenCalledWith('main');
			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'ANTHROPIC_API_KEY',
				params.session
			);
			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(1);
			expect(mockGenerateAnthropicText).toHaveBeenCalledWith({
				apiKey: 'mock-anthropic-key',
				modelId: 'test-main-model',
				maxTokens: 100,
				temperature: 0.5,
				messages: [
					{ role: 'system', content: 'System' },
					{ role: 'user', content: 'Test' }
				]
			});
			// Verify other providers NOT called
			expect(mockGeneratePerplexityText).not.toHaveBeenCalled();
		});

		test('should fall back to fallback provider if main fails', async () => {
			const mainError = new Error('Main provider failed');
			mockGenerateAnthropicText
				.mockRejectedValueOnce(mainError) // Main fails first
				.mockResolvedValueOnce('Fallback provider response'); // Fallback succeeds

			const params = { role: 'main', prompt: 'Fallback test' };
			const result = await generateTextService(params);

			expect(result).toBe('Fallback provider response');
			expect(mockGetMainProvider).toHaveBeenCalled();
			expect(mockGetFallbackProvider).toHaveBeenCalled(); // Fallback was tried
			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2); // Called for main (fail) and fallback (success)
			expect(mockGeneratePerplexityText).not.toHaveBeenCalled(); // Research not called

			// Check log messages for fallback attempt
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining('Service call failed for role main')
			);
			expect(mockLog).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('New AI service call with role: fallback')
			);
		});

		test('should fall back to research provider if main and fallback fail', async () => {
			const mainError = new Error('Main failed');
			const fallbackError = new Error('Fallback failed');
			mockGenerateAnthropicText
				.mockRejectedValueOnce(mainError)
				.mockRejectedValueOnce(fallbackError);
			mockGeneratePerplexityText.mockResolvedValue(
				'Research provider response'
			);

			const params = { role: 'main', prompt: 'Research fallback test' };
			const result = await generateTextService(params);

			expect(result).toBe('Research provider response');
			expect(mockGetMainProvider).toHaveBeenCalled();
			expect(mockGetFallbackProvider).toHaveBeenCalled();
			expect(mockGetResearchProvider).toHaveBeenCalled(); // Research was tried
			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2); // main, fallback
			expect(mockGeneratePerplexityText).toHaveBeenCalledTimes(1); // research

			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining('Service call failed for role fallback')
			);
			expect(mockLog).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('New AI service call with role: research')
			);
		});

		test('should throw error if all providers in sequence fail', async () => {
			mockGenerateAnthropicText.mockRejectedValue(
				new Error('Anthropic failed')
			);
			mockGeneratePerplexityText.mockRejectedValue(
				new Error('Perplexity failed')
			);

			const params = { role: 'main', prompt: 'All fail test' };

			await expect(generateTextService(params)).rejects.toThrow(
				'Perplexity failed' // Error from the last attempt (research)
			);

			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2); // main, fallback
			expect(mockGeneratePerplexityText).toHaveBeenCalledTimes(1); // research
		});

		test('should handle retryable errors correctly', async () => {
			const retryableError = new Error('Rate limit');
			mockGenerateAnthropicText
				.mockRejectedValueOnce(retryableError) // Fails once
				.mockResolvedValue('Success after retry'); // Succeeds on retry

			const params = { role: 'main', prompt: 'Retry success test' };
			const result = await generateTextService(params);

			expect(result).toBe('Success after retry');
			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2); // Initial + 1 retry
			expect(mockLog).toHaveBeenCalledWith(
				'info',
				expect.stringContaining('Retryable error detected. Retrying')
			);
		});

		// Add more tests for edge cases:
		// - Missing API keys (should throw from _resolveApiKey)
		// - Unsupported provider configured (should skip and log)
		// - Missing provider/model config for a role (should skip and log)
		// - Missing prompt
		// - Different initial roles (research, fallback)
		// - generateObjectService (mock schema, check object result)
		// - streamTextService (more complex to test, might need stream helpers)
	});
});
