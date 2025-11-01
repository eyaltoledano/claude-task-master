import { jest } from '@jest/globals';

// Mock config-manager
const mockGetMainProvider = jest.fn();
const mockGetMainModelId = jest.fn();
const mockGetResearchProvider = jest.fn();
const mockGetResearchModelId = jest.fn();
const mockGetFallbackProvider = jest.fn();
const mockGetFallbackModelId = jest.fn();
const mockGetParametersForRole = jest.fn();
const mockGetResponseLanguage = jest.fn();
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
	getResponseLanguage: mockGetResponseLanguage,
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
	getMcpApiKeyStatus: mockGetMcpApiKeyStatus,

	// Providers without API keys
	providersWithoutApiKeys: ['ollama', 'bedrock', 'gemini-cli', 'codex-cli']
}));

// Mock AI Provider Classes with proper methods
const mockAnthropicProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn(),
	getRequiredApiKeyName: jest.fn(() => 'ANTHROPIC_API_KEY'),
	isRequiredApiKey: jest.fn(() => true)
};

const mockPerplexityProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn(),
	getRequiredApiKeyName: jest.fn(() => 'PERPLEXITY_API_KEY'),
	isRequiredApiKey: jest.fn(() => true)
};

const mockOpenAIProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn(),
	getRequiredApiKeyName: jest.fn(() => 'OPENAI_API_KEY'),
	isRequiredApiKey: jest.fn(() => true)
};

const mockOllamaProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn(),
	getRequiredApiKeyName: jest.fn(() => null),
	isRequiredApiKey: jest.fn(() => false)
};

// Codex CLI mock provider instance
const mockCodexProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn(),
	getRequiredApiKeyName: jest.fn(() => 'OPENAI_API_KEY'),
	isRequiredApiKey: jest.fn(() => false)
};

// Claude Code mock provider instance
const mockClaudeProvider = {
	generateText: jest.fn(),
	streamText: jest.fn(),
	generateObject: jest.fn(),
	getRequiredApiKeyName: jest.fn(() => 'CLAUDE_CODE_API_KEY'),
	isRequiredApiKey: jest.fn(() => false)
};

// Mock the provider classes to return our mock instances
jest.unstable_mockModule('../../src/ai-providers/index.js', () => ({
	AnthropicAIProvider: jest.fn(() => mockAnthropicProvider),
	PerplexityAIProvider: jest.fn(() => mockPerplexityProvider),
	GoogleAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'GOOGLE_GENERATIVE_AI_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	OpenAIProvider: jest.fn(() => mockOpenAIProvider),
	XAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'XAI_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	GroqProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'GROQ_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	OpenRouterAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'OPENROUTER_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	OllamaAIProvider: jest.fn(() => mockOllamaProvider),
	BedrockAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'AWS_ACCESS_KEY_ID'),
		isRequiredApiKey: jest.fn(() => false)
	})),
	AzureProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'AZURE_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	VertexAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => null),
		isRequiredApiKey: jest.fn(() => false)
	})),
	ClaudeCodeProvider: jest.fn(() => mockClaudeProvider),
	GeminiCliProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'GEMINI_API_KEY'),
		isRequiredApiKey: jest.fn(() => false)
	})),
	CodexCliProvider: jest.fn(() => mockCodexProvider),
	GrokCliProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'XAI_API_KEY'),
		isRequiredApiKey: jest.fn(() => false)
	})),
	OpenAICompatibleProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'OPENAI_COMPATIBLE_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	ZAIProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'ZAI_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	ZAICodingProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'ZAI_API_KEY'),
		isRequiredApiKey: jest.fn(() => true)
	})),
	LMStudioProvider: jest.fn(() => ({
		generateText: jest.fn(),
		streamText: jest.fn(),
		generateObject: jest.fn(),
		getRequiredApiKeyName: jest.fn(() => 'LMSTUDIO_API_KEY'),
		isRequiredApiKey: jest.fn(() => false)
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
		mockGetResponseLanguage.mockReturnValue('English');
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
				'debug',
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
				'debug',
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

		test('should use configured responseLanguage in system prompt', async () => {
			mockGetResponseLanguage.mockReturnValue('中文');
			mockAnthropicProvider.generateText.mockResolvedValue('中文回复');

			const params = {
				role: 'main',
				systemPrompt: 'You are an assistant',
				prompt: 'Hello'
			};
			await generateTextService(params);

			expect(mockAnthropicProvider.generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: [
						{
							role: 'system',
							content: expect.stringContaining('Always respond in 中文')
						},
						{ role: 'user', content: 'Hello' }
					]
				})
			);
			expect(mockGetResponseLanguage).toHaveBeenCalledWith(fakeProjectRoot);
		});

		test('should pass custom projectRoot to getResponseLanguage', async () => {
			const customRoot = '/custom/project/root';
			mockGetResponseLanguage.mockReturnValue('Español');
			mockAnthropicProvider.generateText.mockResolvedValue(
				'Respuesta en Español'
			);

			const params = {
				role: 'main',
				systemPrompt: 'You are an assistant',
				prompt: 'Hello',
				projectRoot: customRoot
			};
			await generateTextService(params);

			expect(mockGetResponseLanguage).toHaveBeenCalledWith(customRoot);
			expect(mockAnthropicProvider.generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: [
						{
							role: 'system',
							content: expect.stringContaining('Always respond in Español')
						},
						{ role: 'user', content: 'Hello' }
					]
				})
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
		test('should skip provider with missing API key and try next in fallback sequence', async () => {
			// Mock anthropic to throw API key error
			mockAnthropicProvider.generateText.mockRejectedValue(
				new Error(
					"Required API key ANTHROPIC_API_KEY for provider 'anthropic' is not set in environment, session, or .env file."
				)
			);

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

			// Should log an error for the failed provider
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(`Service call failed for role main`)
			);

			// Should attempt to call anthropic provider first
			expect(mockAnthropicProvider.generateText).toHaveBeenCalled();

			// Should call perplexity provider after anthropic fails
			expect(mockPerplexityProvider.generateText).toHaveBeenCalledTimes(1);
		});

		test('should skip multiple providers with missing API keys and use first available', async () => {
			// Define different providers for testing multiple skips
			mockGetFallbackProvider.mockReturnValue('openai'); // Different from main
			mockGetFallbackModelId.mockReturnValue('test-openai-model');

			// Mock providers to throw API key errors (simulating _resolveApiKey behavior)
			mockAnthropicProvider.generateText.mockRejectedValue(
				new Error(
					"Required API key ANTHROPIC_API_KEY for provider 'anthropic' is not set in environment, session, or .env file."
				)
			);
			mockOpenAIProvider.generateText.mockRejectedValue(
				new Error(
					"Required API key OPENAI_API_KEY for provider 'openai' is not set in environment, session, or .env file."
				)
			);

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

			// Should log errors for both skipped providers
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(`Service call failed for role main`)
			);
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(`Service call failed for role fallback`)
			);

			// Should call all providers in sequence until one succeeds
			expect(mockAnthropicProvider.generateText).toHaveBeenCalled();
			expect(mockOpenAIProvider.generateText).toHaveBeenCalled();

			// Should call perplexity provider which succeeds
			expect(mockPerplexityProvider.generateText).toHaveBeenCalledTimes(1);
		});

		test('should throw error if all providers in sequence have missing API keys', async () => {
			// Mock all providers to throw API key errors
			mockAnthropicProvider.generateText.mockRejectedValue(
				new Error(
					"Required API key ANTHROPIC_API_KEY for provider 'anthropic' is not set in environment, session, or .env file."
				)
			);
			mockPerplexityProvider.generateText.mockRejectedValue(
				new Error(
					"Required API key PERPLEXITY_API_KEY for provider 'perplexity' is not set in environment, session, or .env file."
				)
			);

			const params = {
				role: 'main',
				prompt: 'All API keys missing test',
				session: { env: {} }
			};

			// Should throw error since all providers would fail
			await expect(generateTextService(params)).rejects.toThrow(
				"Required API key PERPLEXITY_API_KEY for provider 'perplexity' is not set"
			);

			// Should log errors for all failed providers
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(`Service call failed for role main`)
			);
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(`Service call failed for role fallback`)
			);
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(`Service call failed for role research`)
			);

			// Should log final error
			expect(mockLog).toHaveBeenCalledWith(
				'error',
				expect.stringContaining(
					'All roles in the sequence [main, fallback, research] failed.'
				)
			);

			// Should attempt to call all providers in sequence
			expect(mockAnthropicProvider.generateText).toHaveBeenCalled();
			expect(mockPerplexityProvider.generateText).toHaveBeenCalled();
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

		test('should correctly use the provided session for API key resolution', async () => {
			// Mock custom session object with env vars
			const customSession = { env: { ANTHROPIC_API_KEY: 'session-api-key' } };

			// Mock the anthropic response - if API key resolution works, this will be called
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

			// Should have successfully resolved API key from session and called provider
			expect(mockAnthropicProvider.generateText).toHaveBeenCalled();

			// Should have gotten the anthropic response
			expect(result.mainResult).toBe('Anthropic response with session key');
		});

		// --- Codex CLI specific tests ---
		test('should use codex-cli provider without API key (OAuth)', async () => {
			// Arrange codex-cli as main provider
			mockGetMainProvider.mockReturnValue('codex-cli');
			mockGetMainModelId.mockReturnValue('gpt-5-codex');
			mockGetParametersForRole.mockReturnValue({
				maxTokens: 128000,
				temperature: 1
			});
			mockGetResponseLanguage.mockReturnValue('English');
			// No API key in env
			mockResolveEnvVariable.mockReturnValue(null);
			// Mock codex generateText response
			mockCodexProvider.generateText.mockResolvedValueOnce({
				text: 'ok',
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
			});

			const { generateTextService } = await import(
				'../../scripts/modules/ai-services-unified.js'
			);

			const result = await generateTextService({
				role: 'main',
				prompt: 'Hello Codex',
				projectRoot: fakeProjectRoot
			});

			expect(result.mainResult).toBe('ok');
			expect(mockCodexProvider.generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: 'gpt-5-codex',
					apiKey: null,
					maxTokens: 128000
				})
			);
		});

		test('should pass apiKey to codex-cli when provided', async () => {
			// Arrange codex-cli as main provider
			mockGetMainProvider.mockReturnValue('codex-cli');
			mockGetMainModelId.mockReturnValue('gpt-5-codex');
			mockGetParametersForRole.mockReturnValue({
				maxTokens: 128000,
				temperature: 1
			});
			mockGetResponseLanguage.mockReturnValue('English');
			// Provide API key via env resolver
			mockResolveEnvVariable.mockReturnValue('sk-test');
			// Mock codex generateText response
			mockCodexProvider.generateText.mockResolvedValueOnce({
				text: 'ok-with-key',
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
			});

			const { generateTextService } = await import(
				'../../scripts/modules/ai-services-unified.js'
			);

			const result = await generateTextService({
				role: 'main',
				prompt: 'Hello Codex',
				projectRoot: fakeProjectRoot
			});

			expect(result.mainResult).toBe('ok-with-key');
			expect(mockCodexProvider.generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					modelId: 'gpt-5-codex',
					apiKey: 'sk-test'
				})
			);
		});

		// --- Claude Code specific test ---
		test('should pass temperature to claude-code provider (provider handles filtering)', async () => {
			mockGetMainProvider.mockReturnValue('claude-code');
			mockGetMainModelId.mockReturnValue('sonnet');
			mockGetParametersForRole.mockReturnValue({
				maxTokens: 64000,
				temperature: 0.7
			});
			mockGetResponseLanguage.mockReturnValue('English');
			mockResolveEnvVariable.mockReturnValue(null);

			mockClaudeProvider.generateText.mockResolvedValueOnce({
				text: 'ok-claude',
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
			});

			const { generateTextService } = await import(
				'../../scripts/modules/ai-services-unified.js'
			);

			const result = await generateTextService({
				role: 'main',
				prompt: 'Hello Claude',
				projectRoot: fakeProjectRoot
			});

			expect(result.mainResult).toBe('ok-claude');
			// The provider (BaseAIProvider) is responsible for filtering it based on supportsTemperature
			const callArgs = mockClaudeProvider.generateText.mock.calls[0][0];
			expect(callArgs).toHaveProperty('temperature', 0.7);
			expect(callArgs.maxTokens).toBe(64000);
		});
	});
});
