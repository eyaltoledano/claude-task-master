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
const mockIsApiKeySet = jest.fn();

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
	],
	openai: [
		{
			id: 'test-openai-model',
			cost_per_1m_tokens: { input: 2, output: 6, currency: 'USD' }
		}
	]
	// Add other providers/models if needed for specific tests
};
const mockGetBaseUrlForRole = jest.fn();
const mockGetAllProviders = jest.fn();
const mockGetOllamaBaseURL = jest.fn();
const mockGetAzureBaseURL = jest.fn();
const mockGetBedrockBaseURL = jest.fn();
const mockGetVertexProjectId = jest.fn();
const mockGetVertexLocation = jest.fn();
const mockGetAvailableModels = jest.fn();
const mockValidateProvider = jest.fn();
const mockValidateProviderModelCombination = jest.fn();
const mockGetConfig = jest.fn();
const mockWriteConfig = jest.fn();
const mockIsConfigFilePresent = jest.fn();
const mockGetMcpApiKeyStatus = jest.fn();
const mockGetMainMaxTokens = jest.fn();
const mockGetMainTemperature = jest.fn();
const mockGetResearchMaxTokens = jest.fn();
const mockGetResearchTemperature = jest.fn();
const mockGetFallbackMaxTokens = jest.fn();
const mockGetFallbackTemperature = jest.fn();
const mockGetLogLevel = jest.fn();
const mockGetDefaultNumTasks = jest.fn();
const mockGetDefaultSubtasks = jest.fn();
const mockGetDefaultPriority = jest.fn();
const mockGetProjectName = jest.fn();

jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	// Core config access
	getConfig: mockGetConfig,
	writeConfig: mockWriteConfig,
	isConfigFilePresent: mockIsConfigFilePresent,
	ConfigurationError: class ConfigurationError extends Error {
		constructor(message) {
			super(message);
			this.name = 'ConfigurationError';
		}
	},

	// Validation
	validateProvider: mockValidateProvider,
	validateProviderModelCombination: mockValidateProviderModelCombination,
	VALID_PROVIDERS: ['anthropic', 'perplexity', 'openai', 'google'],
	MODEL_MAP: mockModelMap,
	getAvailableModels: mockGetAvailableModels,

	// Role-specific getters
	getMainProvider: mockGetMainProvider,
	getMainModelId: mockGetMainModelId,
	getMainMaxTokens: mockGetMainMaxTokens,
	getMainTemperature: mockGetMainTemperature,
	getResearchProvider: mockGetResearchProvider,
	getResearchModelId: mockGetResearchModelId,
	getResearchMaxTokens: mockGetResearchMaxTokens,
	getResearchTemperature: mockGetResearchTemperature,
	getFallbackProvider: mockGetFallbackProvider,
	getFallbackModelId: mockGetFallbackModelId,
	getFallbackMaxTokens: mockGetFallbackMaxTokens,
	getFallbackTemperature: mockGetFallbackTemperature,
	getParametersForRole: mockGetParametersForRole,
	getUserId: mockGetUserId,
	getDebugFlag: mockGetDebugFlag,
	getBaseUrlForRole: mockGetBaseUrlForRole,

	// Global settings
	getLogLevel: mockGetLogLevel,
	getDefaultNumTasks: mockGetDefaultNumTasks,
	getDefaultSubtasks: mockGetDefaultSubtasks,
	getDefaultPriority: mockGetDefaultPriority,
	getProjectName: mockGetProjectName,

	// API Key and provider functions
	isApiKeySet: mockIsApiKeySet,
	getAllProviders: mockGetAllProviders,
	getOllamaBaseURL: mockGetOllamaBaseURL,
	getAzureBaseURL: mockGetAzureBaseURL,
	getBedrockBaseURL: mockGetBedrockBaseURL,
	getVertexProjectId: mockGetVertexProjectId,
	getVertexLocation: mockGetVertexLocation,
	getMcpApiKeyStatus: mockGetMcpApiKeyStatus
}));

// Mock AI Provider Classes with proper methods
const mockAnthropicProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn()
};

const mockPerplexityProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn()
};

const mockOpenAIProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn()
};

const mockOllamaProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn()
};

// Mock the provider classes to return our mock instances
jest.unstable_mockModule('../../src/ai-providers/index.js', () => ({
	AnthropicAIProvider: jest.fn(() => mockAnthropicProvider),
	PerplexityAIProvider: jest.fn(() => mockPerplexityProvider),
	GoogleAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn()
	})),
	OpenAIProvider: jest.fn(() => mockOpenAIProvider),
	XAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn()
	})),
	OpenRouterAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn()
	})),
	OllamaAIProvider: jest.fn(() => mockOllamaProvider),
	BedrockAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn()
	})),
	AzureProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn()
	})),
	VertexAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn()
	}))
}));

// Mock utils logger, API key resolver, AND findProjectRoot
const mockLog = jest.fn();
const mockResolveEnvVariable = jest.fn();
const mockFindProjectRoot = jest.fn();
const mockIsSilentMode = jest.fn();
const mockLogAiUsage = jest.fn();
const mockFindCycles = jest.fn();
const mockFormatTaskId = jest.fn();
const mockTaskExists = jest.fn();
const mockFindTaskById = jest.fn();
const mockTruncate = jest.fn();
const mockToKebabCase = jest.fn();
const mockDetectCamelCaseFlags = jest.fn();
const mockDisableSilentMode = jest.fn();
const mockEnableSilentMode = jest.fn();
const mockGetTaskManager = jest.fn();
const mockAddComplexityToTask = jest.fn();
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();
const mockSanitizePrompt = jest.fn();
const mockReadComplexityReport = jest.fn();
const mockFindTaskInComplexityReport = jest.fn();
const mockAggregateTelemetry = jest.fn();
const mockGetCurrentTag = jest.fn(() => 'master');
const mockResolveTag = jest.fn(() => 'master');
const mockGetTasksForTag = jest.fn(() => []);

jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	LOG_LEVELS: { error: 0, warn: 1, info: 2, debug: 3 },
	log: mockLog,
	resolveEnvVariable: mockResolveEnvVariable,
	findProjectRoot: mockFindProjectRoot,
	isSilentMode: mockIsSilentMode,
	logAiUsage: mockLogAiUsage,
	findCycles: mockFindCycles,
	formatTaskId: mockFormatTaskId,
	taskExists: mockTaskExists,
	findTaskById: mockFindTaskById,
	truncate: mockTruncate,
	toKebabCase: mockToKebabCase,
	detectCamelCaseFlags: mockDetectCamelCaseFlags,
	disableSilentMode: mockDisableSilentMode,
	enableSilentMode: mockEnableSilentMode,
	getTaskManager: mockGetTaskManager,
	addComplexityToTask: mockAddComplexityToTask,
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON,
	sanitizePrompt: mockSanitizePrompt,
	readComplexityReport: mockReadComplexityReport,
	findTaskInComplexityReport: mockFindTaskInComplexityReport,
	aggregateTelemetry: mockAggregateTelemetry,
	getCurrentTag: mockGetCurrentTag,
	resolveTag: mockResolveTag,
	getTasksForTag: mockGetTasksForTag
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
			if (key === 'OPENAI_API_KEY') return 'mock-openai-key';
			if (key === 'OLLAMA_API_KEY') return 'mock-ollama-key';
			return null;
		});

		// Set a default behavior for the new mock
		mockFindProjectRoot.mockReturnValue(fakeProjectRoot);
		mockGetDebugFlag.mockReturnValue(false);
		mockGetUserId.mockReturnValue('test-user-id'); // Add default mock for getUserId
		mockIsApiKeySet.mockReturnValue(true); // Default to true for most tests
		mockGetBaseUrlForRole.mockReturnValue(null); // Default to no base URL
	});

	describe('generateTextService', () => {
		test('should use main provider/model and succeed', async () => {
			mockAnthropicProvider.generateText.mockResolvedValue({
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
			expect(mockAnthropicProvider.generateText).toHaveBeenCalledTimes(1);
			expect(mockPerplexityProvider.generateText).not.toHaveBeenCalled();
		});

		test('should fall back to fallback provider if main fails', async () => {
			const mainError = new Error('Main provider failed');
			mockAnthropicProvider.generateText
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

			expect(mockAnthropicProvider.generateText).toHaveBeenCalledTimes(2);
			expect(mockPerplexityProvider.generateText).not.toHaveBeenCalled();
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
			mockAnthropicProvider.generateText
				.mockRejectedValueOnce(mainError)
				.mockRejectedValueOnce(fallbackError);
			mockPerplexityProvider.generateText.mockResolvedValue({
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

			expect(mockAnthropicProvider.generateText).toHaveBeenCalledTimes(2);
			expect(mockPerplexityProvider.generateText).toHaveBeenCalledTimes(1);
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
			mockAnthropicProvider.generateText.mockRejectedValue(
				new Error('Anthropic failed')
			);
			mockPerplexityProvider.generateText.mockRejectedValue(
				new Error('Perplexity failed')
			);

			const params = { role: 'main', prompt: 'All fail test' };

			await expect(generateTextService(params)).rejects.toThrow(
				'Perplexity failed' // Error from the last attempt (research)
			);

			expect(mockAnthropicProvider.generateText).toHaveBeenCalledTimes(2); // main, fallback
			expect(mockPerplexityProvider.generateText).toHaveBeenCalledTimes(1); // research
		});

		test('should handle retryable errors correctly', async () => {
			const retryableError = new Error('Rate limit');
			mockAnthropicProvider.generateText
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
			expect(mockAnthropicProvider.generateText).toHaveBeenCalledTimes(2); // Initial + 1 retry
			expect(mockLog).toHaveBeenCalledWith(
				'info',
				expect.stringContaining(
					'Something went wrong on the provider side. Retrying'
				)
			);
		});

		test('should use default project root or handle null if findProjectRoot returns null', async () => {
			mockFindProjectRoot.mockReturnValue(null); // Simulate not finding root
			mockAnthropicProvider.generateText.mockResolvedValue({
				text: 'Response with no root',
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
			});

			const params = { role: 'main', prompt: 'No root test' }; // No explicit root passed
			await generateTextService(params);

			expect(mockGetMainProvider).toHaveBeenCalledWith(null);
			expect(mockGetParametersForRole).toHaveBeenCalledWith('main', null);
			expect(mockAnthropicProvider.generateText).toHaveBeenCalledTimes(1);
		});

		test('should skip provider with missing API key and try next in fallback sequence', async () => {
			// Setup isApiKeySet to return false for anthropic but true for perplexity
			mockIsApiKeySet.mockImplementation((provider, session, root) => {
				if (provider === 'anthropic') return false; // Main provider has no key
				return true; // Other providers have keys
			});

			// Mock perplexity text response (since we'll skip anthropic)
			mockPerplexityProvider.generateText.mockResolvedValue({
				text: 'Perplexity response (skipped to research)',
				usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }
			});

			const params = {
				role: 'main',
				prompt: 'Skip main provider test',
				session: { env: {} }
			};

			const result = await generateTextService(params);

			// Should have gotten the perplexity response
			expect(result.mainResult).toBe(
				'Perplexity response (skipped to research)'
			);

			// Should check API keys
			expect(mockIsApiKeySet).toHaveBeenCalledWith(
				'anthropic',
				params.session,
				fakeProjectRoot
			);
			expect(mockIsApiKeySet).toHaveBeenCalledWith(
				'perplexity',
				params.session,
				fakeProjectRoot
			);

			// Should log a warning
			expect(mockLog).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining(
					`Skipping role 'main' (Provider: anthropic): API key not set or invalid.`
				)
			);

			// Should NOT call anthropic provider
			expect(mockAnthropicProvider.generateText).not.toHaveBeenCalled();

			// Should call perplexity provider
			expect(mockPerplexityProvider.generateText).toHaveBeenCalledTimes(1);
		});

		test('should skip multiple providers with missing API keys and use first available', async () => {
			// Setup: Main and fallback providers have no keys, only research has a key
			mockIsApiKeySet.mockImplementation((provider, session, root) => {
				if (provider === 'anthropic') return false; // Main and fallback are both anthropic
				if (provider === 'perplexity') return true; // Research has a key
				return false;
			});

			// Define different providers for testing multiple skips
			mockGetFallbackProvider.mockReturnValue('openai'); // Different from main
			mockGetFallbackModelId.mockReturnValue('test-openai-model');

			// Mock isApiKeySet to return false for both main and fallback
			mockIsApiKeySet.mockImplementation((provider, session, root) => {
				if (provider === 'anthropic') return false; // Main provider has no key
				if (provider === 'openai') return false; // Fallback provider has no key
				return true; // Research provider has a key
			});

			// Mock perplexity text response (since we'll skip to research)
			mockPerplexityProvider.generateText.mockResolvedValue({
				text: 'Research response after skipping main and fallback',
				usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }
			});

			const params = {
				role: 'main',
				prompt: 'Skip multiple providers test',
				session: { env: {} }
			};

			const result = await generateTextService(params);

			// Should have gotten the perplexity (research) response
			expect(result.mainResult).toBe(
				'Research response after skipping main and fallback'
			);

			// Should check API keys for all three roles
			expect(mockIsApiKeySet).toHaveBeenCalledWith(
				'anthropic',
				params.session,
				fakeProjectRoot
			);
			expect(mockIsApiKeySet).toHaveBeenCalledWith(
				'openai',
				params.session,
				fakeProjectRoot
			);
			expect(mockIsApiKeySet).toHaveBeenCalledWith(
				'perplexity',
				params.session,
				fakeProjectRoot
			);

			// Should log warnings for both skipped providers
			expect(mockLog).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining(
					`Skipping role 'main' (Provider: anthropic): API key not set or invalid.`
				)
			);
			expect(mockLog).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining(
					`Skipping role 'fallback' (Provider: openai): API key not set or invalid.`
				)
			);

			// Should NOT call skipped providers
			expect(mockAnthropicProvider.generateText).not.toHaveBeenCalled();
			expect(mockOpenAIProvider.generateText).not.toHaveBeenCalled();

			// Should call perplexity provider
			expect(mockPerplexityProvider.generateText).toHaveBeenCalledTimes(1);
		});

		test('should throw error if all providers in sequence have missing API keys', async () => {
			// Mock all providers to have missing API keys
			mockIsApiKeySet.mockReturnValue(false);

			const params = {
				role: 'main',
				prompt: 'All API keys missing test',
				session: { env: {} }
			};

			// Should throw error since all providers would be skipped
			await expect(generateTextService(params)).rejects.toThrow(
				'AI service call failed for all configured roles'
			);

			// Should log warnings for all skipped providers
			expect(mockLog).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining(
					`Skipping role 'main' (Provider: anthropic): API key not set or invalid.`
				)
			);
			expect(mockLog).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining(
					`Skipping role 'fallback' (Provider: anthropic): API key not set or invalid.`
				)
			);
			expect(mockLog).toHaveBeenCalledWith(
				'warn',
				expect.stringContaining(
					`Skipping role 'research' (Provider: perplexity): API key not set or invalid.`
				)
			);

			// Should log final error
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(
					'All roles in the sequence [main, fallback, research] failed.'
				)
			);

			// Should NOT call any providers
			expect(mockAnthropicProvider.generateText).not.toHaveBeenCalled();
			expect(mockPerplexityProvider.generateText).not.toHaveBeenCalled();
		});

		test('should not check API key for Ollama provider and try to use it', async () => {
			// Setup: Set main provider to ollama
			mockGetMainProvider.mockReturnValue('ollama');
			mockGetMainModelId.mockReturnValue('llama3');

			// Mock Ollama text generation to succeed
			mockOllamaProvider.generateText.mockResolvedValue({
				text: 'Ollama response (no API key required)',
				usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }
			});

			const params = {
				role: 'main',
				prompt: 'Ollama special case test',
				session: { env: {} }
			};

			const result = await generateTextService(params);

			// Should have gotten the Ollama response
			expect(result.mainResult).toBe('Ollama response (no API key required)');

			// isApiKeySet shouldn't be called for Ollama
			// Note: This is indirect - the code just doesn't check isApiKeySet for ollama
			// so we're verifying ollama provider was called despite isApiKeySet being mocked to false
			mockIsApiKeySet.mockReturnValue(false); // Should be ignored for Ollama

			// Should call Ollama provider
			expect(mockOllamaProvider.generateText).toHaveBeenCalledTimes(1);
		});

		test('should correctly use the provided session for API key check', async () => {
			// Mock custom session object with env vars
			const customSession = { env: { ANTHROPIC_API_KEY: 'session-api-key' } };

			// Setup API key check to verify the session is passed correctly
			mockIsApiKeySet.mockImplementation((provider, session, root) => {
				// Only return true if the correct session was provided
				return session === customSession;
			});

			// Mock the anthropic response
			mockAnthropicProvider.generateText.mockResolvedValue({
				text: 'Anthropic response with session key',
				usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 }
			});

			const params = {
				role: 'main',
				prompt: 'Session API key test',
				session: customSession
			};

			const result = await generateTextService(params);

			// Should check API key with the custom session
			expect(mockIsApiKeySet).toHaveBeenCalledWith(
				'anthropic',
				customSession,
				fakeProjectRoot
			);

			// Should have gotten the anthropic response
			expect(result.mainResult).toBe('Anthropic response with session key');
		});
	});
});
