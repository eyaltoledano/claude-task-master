import { jest } from '@jest/globals';

// Mock config-manager
const mockGetMainProvider = jest.fn();
const mockGetMainModelId = jest.fn();
const mockGetResearchProvider = jest.fn();
const mockGetResearchModelId = jest.fn();
const mockGetFallbackProvider = jest.fn();
const mockGetFallbackModelId = jest.fn();
const mockGetParametersForRole = jest.fn();
const mockGetUserId = jest.fn();
const mockGetDebugFlag = jest.fn();

// --- Mock MODEL_MAP Data ---
// Provide a simplified structure sufficient for cost calculation tests
const mockModelMap = {
	anthropic: [
		{
			id: 'test-main-model',
			cost_per_1m_tokens: { input: 3, output: 15, currency: 'USD' }
		},
		{
			id: 'test-fallback-model',
			cost_per_1m_tokens: { input: 3, output: 15, currency: 'USD' }
		}
	],
	perplexity: [
		{
			id: 'test-research-model',
			cost_per_1m_tokens: { input: 1, output: 1, currency: 'USD' }
		}
	]
	// Add other providers/models if needed for specific tests
};
const mockGetBaseUrlForRole = jest.fn();

jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	getMainProvider: mockGetMainProvider,
	getMainModelId: mockGetMainModelId,
	getResearchProvider: mockGetResearchProvider,
	getResearchModelId: mockGetResearchModelId,
	getFallbackProvider: mockGetFallbackProvider,
	getFallbackModelId: mockGetFallbackModelId,
	getParametersForRole: mockGetParametersForRole,
	getUserId: mockGetUserId,
	getDebugFlag: mockGetDebugFlag,
	MODEL_MAP: mockModelMap,
	getBaseUrlForRole: mockGetBaseUrlForRole
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

// Mock utils logger, API key resolver, AND findProjectRoot
const mockLog = jest.fn();
const mockResolveEnvVariable = jest.fn();
const mockFindProjectRoot = jest.fn();
const mockIsSilentMode = jest.fn();
const mockLogAiUsage = jest.fn();

jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	log: mockLog,
	resolveEnvVariable: mockResolveEnvVariable,
	findProjectRoot: mockFindProjectRoot,
	isSilentMode: mockIsSilentMode,
	logAiUsage: mockLogAiUsage
}));

// Import the module to test (AFTER mocks)
const { generateTextService } = await import(
	'../../scripts/modules/ai-services-unified.js'
);

describe('Unified AI Services', () => {
	const fakeProjectRoot = '/fake/project/root'; // Define for reuse

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

		// Set a default behavior for the new mock
		mockFindProjectRoot.mockReturnValue(fakeProjectRoot);
		mockGetDebugFlag.mockReturnValue(false);
		mockGetUserId.mockReturnValue('test-user-id'); // Add default mock for getUserId
	});

	describe('generateTextService', () => {
		test('should use main provider/model and succeed', async () => {
			mockGenerateAnthropicText.mockResolvedValue({
				text: 'Main provider response',
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
			});

			const params = {
				role: 'main',
				session: { env: {} },
				systemPrompt: 'System',
				prompt: 'Test'
			};
			const result = await generateTextService(params);

			expect(result.mainResult).toBe('Main provider response');
			expect(result).toHaveProperty('telemetryData');
			expect(mockGetMainProvider).toHaveBeenCalledWith(fakeProjectRoot);
			expect(mockGetMainModelId).toHaveBeenCalledWith(fakeProjectRoot);
			expect(mockGetParametersForRole).toHaveBeenCalledWith(
				'main',
				fakeProjectRoot
			);
			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'ANTHROPIC_API_KEY',
				params.session,
				fakeProjectRoot
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
			expect(mockGeneratePerplexityText).not.toHaveBeenCalled();
		});

		test('should fall back to fallback provider if main fails', async () => {
			const mainError = new Error('Main provider failed');
			mockGenerateAnthropicText
				.mockRejectedValueOnce(mainError)
				.mockResolvedValueOnce({
					text: 'Fallback provider response',
					usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 }
				});

			const explicitRoot = '/explicit/test/root';
			const params = {
				role: 'main',
				prompt: 'Fallback test',
				projectRoot: explicitRoot
			};
			const result = await generateTextService(params);

			expect(result.mainResult).toBe('Fallback provider response');
			expect(result).toHaveProperty('telemetryData');
			expect(mockGetMainProvider).toHaveBeenCalledWith(explicitRoot);
			expect(mockGetFallbackProvider).toHaveBeenCalledWith(explicitRoot);
			expect(mockGetParametersForRole).toHaveBeenCalledWith(
				'main',
				explicitRoot
			);
			expect(mockGetParametersForRole).toHaveBeenCalledWith(
				'fallback',
				explicitRoot
			);

			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'ANTHROPIC_API_KEY',
				undefined,
				explicitRoot
			);

			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2);
			expect(mockGeneratePerplexityText).not.toHaveBeenCalled();
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
			mockGeneratePerplexityText.mockResolvedValue({
				text: 'Research provider response',
				usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }
			});

			const params = { role: 'main', prompt: 'Research fallback test' };
			const result = await generateTextService(params);

			expect(result.mainResult).toBe('Research provider response');
			expect(result).toHaveProperty('telemetryData');
			expect(mockGetMainProvider).toHaveBeenCalledWith(fakeProjectRoot);
			expect(mockGetFallbackProvider).toHaveBeenCalledWith(fakeProjectRoot);
			expect(mockGetResearchProvider).toHaveBeenCalledWith(fakeProjectRoot);
			expect(mockGetParametersForRole).toHaveBeenCalledWith(
				'main',
				fakeProjectRoot
			);
			expect(mockGetParametersForRole).toHaveBeenCalledWith(
				'fallback',
				fakeProjectRoot
			);
			expect(mockGetParametersForRole).toHaveBeenCalledWith(
				'research',
				fakeProjectRoot
			);

			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'ANTHROPIC_API_KEY',
				undefined,
				fakeProjectRoot
			);
			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'ANTHROPIC_API_KEY',
				undefined,
				fakeProjectRoot
			);
			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'PERPLEXITY_API_KEY',
				undefined,
				fakeProjectRoot
			);

			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2);
			expect(mockGeneratePerplexityText).toHaveBeenCalledTimes(1);
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
				.mockResolvedValueOnce({
					// Succeeds on retry
					text: 'Success after retry',
					usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }
				});

			const params = { role: 'main', prompt: 'Retry success test' };
			const result = await generateTextService(params);

			expect(result.mainResult).toBe('Success after retry');
			expect(result).toHaveProperty('telemetryData');
			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(2); // Initial + 1 retry
			expect(mockLog).toHaveBeenCalledWith(
				'info',
				expect.stringContaining(
					'Something went wrong on the provider side. Retrying'
				)
			);
		});

		test('should use default project root or handle null if findProjectRoot returns null', async () => {
			mockFindProjectRoot.mockReturnValue(null); // Simulate not finding root
			mockGenerateAnthropicText.mockResolvedValue({
				text: 'Response with no root',
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
			});

			const params = { role: 'main', prompt: 'No root test' }; // No explicit root passed
			await generateTextService(params);

			expect(mockGetMainProvider).toHaveBeenCalledWith(null);
			expect(mockGetParametersForRole).toHaveBeenCalledWith('main', null);
			expect(mockResolveEnvVariable).toHaveBeenCalledWith(
				'ANTHROPIC_API_KEY',
				undefined,
				null
			);
			expect(mockGenerateAnthropicText).toHaveBeenCalledTimes(1);
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
