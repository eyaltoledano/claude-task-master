import { jest } from '@jest/globals';

// Mock the ai-sdk-provider-cortex-code package
jest.unstable_mockModule('@tm/ai-sdk-provider-cortex-code', () => ({
	createCortexCode: jest.fn(() => {
		const provider = (modelId, settings) => ({
			// Minimal mock language model surface
			id: modelId,
			settings,
			doGenerate: jest.fn(() => ({ 
				content: [{ type: 'text', text: 'ok' }], 
				usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } 
			})),
			doStream: jest.fn(() => ({ stream: true }))
		});
		provider.languageModel = jest.fn((id, settings) => ({ id, settings }));
		provider.chat = provider.languageModel;
		return provider;
	}),
	normalizeModelId: jest.fn((id) => String(id || '').replace(/^cortex\//, '')),
	validateCortexCodeAuth: jest.fn(() => 
		Promise.resolve({ 
			valid: true, 
			cliAvailable: true, 
			hasConnection: true 
		})
	),
	generateObjectWithPromptEngineering: jest.fn(() => 
		Promise.resolve({
			object: { test: 'data' },
			finishReason: 'stop',
			usage: { promptTokens: 10, completionTokens: 20 }
		})
	),
	normalizeTokenParams: jest.fn((params, modelId, providerPrefix, supportedModels) => {
		// Mock implementation that enforces minimum 8192 tokens
		const MIN_TOKENS = 8192;
		const modelInfo = supportedModels.find(m => m.id === modelId || m.id === `${providerPrefix}/${modelId}`);
		const modelMaxTokens = modelInfo?.max_tokens || 8192;
		
		if (!params.maxTokens) {
			params.maxTokens = modelMaxTokens;
		} else if (params.maxTokens < MIN_TOKENS) {
			params.maxTokens = MIN_TOKENS;
		} else if (params.maxTokens > modelMaxTokens) {
			params.maxTokens = modelMaxTokens;
		}
		
		return params;
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
		validateMessages(messages) {
			if (!Array.isArray(messages) || messages.length === 0) {
				throw new Error('Invalid or empty messages array provided');
			}
		}
	}
}));

// Mock config getters
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getCortexCodeSettingsForCommand: jest.fn(() => ({
		connection: 'default',
		timeout: 60000
	})),
	getSupportedModelsForProvider: jest.fn(() => [
		{ id: 'cortex/claude-sonnet-4-5', max_tokens: 64000, allowed_roles: ['main', 'fallback', 'research'], supported: true },
		{ id: 'cortex/claude-haiku-4-5', max_tokens: 64000, allowed_roles: ['main', 'fallback', 'research'], supported: true },
		{ id: 'cortex/openai-gpt-5', max_tokens: 8192, allowed_roles: ['main', 'fallback', 'research'], supported: true },
		{ id: 'cortex/llama3-70b', max_tokens: 8192, allowed_roles: ['main', 'fallback'], supported: true },
		{ id: 'cortex/mistral-large', max_tokens: 8192, allowed_roles: ['main', 'fallback'], supported: true }
	]),
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info')
}));

// Mock utils
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: jest.fn()
}));

// Import after mocking
const { CortexCodeProvider } = await import(
	'../../../src/ai-providers/cortex-code.js'
);

describe('CortexCodeProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new CortexCodeProvider();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should set the provider name to Cortex Code', () => {
			expect(provider.name).toBe('Cortex Code');
		});

		it('should load supported models', () => {
			expect(provider.supportedModels).toEqual([
				{ id: 'cortex/claude-sonnet-4-5', max_tokens: 64000, allowed_roles: ['main', 'fallback', 'research'], supported: true },
				{ id: 'cortex/claude-haiku-4-5', max_tokens: 64000, allowed_roles: ['main', 'fallback', 'research'], supported: true },
				{ id: 'cortex/openai-gpt-5', max_tokens: 8192, allowed_roles: ['main', 'fallback', 'research'], supported: true },
				{ id: 'cortex/llama3-70b', max_tokens: 8192, allowed_roles: ['main', 'fallback'], supported: true },
				{ id: 'cortex/mistral-large', max_tokens: 8192, allowed_roles: ['main', 'fallback'], supported: true }
			]);
		});

		it('should set capability flags', () => {
			expect(provider.supportsStructuredOutputs).toBe(true);
			expect(provider.supportsTemperature).toBe(true);
			expect(provider.needsExplicitJsonSchema).toBe(false);
		});
	});

	describe('validateAuth', () => {
		it('should delegate to package validation', async () => {
			const { validateCortexCodeAuth } = await import(
				'@tm/ai-sdk-provider-cortex-code'
			);

			await provider.validateAuth({ connection: 'test' });

			expect(validateCortexCodeAuth).toHaveBeenCalledWith(
				expect.objectContaining({
					connection: 'test',
					skipValidation: true // NODE_ENV=test
				})
			);
		});

		it('should not throw on successful validation', async () => {
			await expect(
				provider.validateAuth({ connection: 'test' })
			).resolves.not.toThrow();
		});

		it('should throw if validation fails', async () => {
			const { validateCortexCodeAuth } = await import(
				'@tm/ai-sdk-provider-cortex-code'
			);

			validateCortexCodeAuth.mockResolvedValueOnce({
				valid: false,
				error: 'CLI not found'
			});

			await expect(
				provider.validateAuth({ connection: 'test' })
			).rejects.toThrow('CLI not found');
		});
	});

	describe('getClient', () => {
		it('should return a cortex code client', () => {
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
	});

	describe('model support', () => {
		it('should return supported models', () => {
			const models = provider.getSupportedModels();
			expect(models).toEqual([
				'cortex/claude-sonnet-4-5',
				'cortex/claude-haiku-4-5',
				'cortex/openai-gpt-5',
				'cortex/llama3-70b',
				'cortex/mistral-large'
			]);
		});

		it('should check if model is supported (case insensitive)', () => {
			expect(provider.isModelSupported('cortex/claude-sonnet-4-5')).toBe(true);
			expect(provider.isModelSupported('CORTEX/CLAUDE-HAIKU-4-5')).toBe(true);
			expect(provider.isModelSupported('cortex/llama3-70b')).toBe(true);
			expect(provider.isModelSupported('cortex/unknown')).toBe(false);
		});

		it('should return false for null/undefined', () => {
			expect(provider.isModelSupported(null)).toBe(false);
			expect(provider.isModelSupported(undefined)).toBe(false);
		});
	});

	describe('normalizeModelId', () => {
		it('should strip cortex/ prefix', () => {
			expect(provider.normalizeModelId('cortex/claude-sonnet-4-5')).toBe(
				'claude-sonnet-4-5'
			);
		});

		it('should handle models without prefix', () => {
			expect(provider.normalizeModelId('llama3-70b')).toBe('llama3-70b');
		});

		it('should handle null/undefined', () => {
			// normalizeModelId converts null/undefined to empty string
			expect(provider.normalizeModelId(null)).toBe('');
			expect(provider.normalizeModelId(undefined)).toBe('');
		});
	});

	describe('_normalizeParams', () => {
		it('should normalize model ID', () => {
			const params = {
				modelId: 'cortex/claude-sonnet-4-5',
				temperature: 0.7
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.modelId).toBe('claude-sonnet-4-5');
		});

		it('should remove temperature for OpenAI models', () => {
			const params = {
				modelId: 'cortex/openai-gpt-4',
				temperature: 0.7
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.temperature).toBeUndefined();
		});

		it('should remove temperature for structured outputs', () => {
			const params = {
				modelId: 'cortex/claude-sonnet-4-5',
				temperature: 0.7,
				objectName: 'TestObject'
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.temperature).toBeUndefined();
		});

		it('should keep temperature for Claude models without objectName', () => {
			const params = {
				modelId: 'cortex/claude-sonnet-4-5',
				temperature: 0.7
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.temperature).toBe(0.7);
		});

		// Token handling tests
		it('should set maxTokens from supported-models.json if not provided', () => {
			const params = {
				modelId: 'cortex/claude-sonnet-4-5'
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.maxTokens).toBe(64000); // From mock data
		});

		it('should use different max_tokens for different models', () => {
			const claudeParams = {
				modelId: 'cortex/claude-haiku-4-5'
			};
			const gptParams = {
				modelId: 'cortex/openai-gpt-5'
			};
			
			const claudeNormalized = provider._normalizeParams(claudeParams);
			const gptNormalized = provider._normalizeParams(gptParams);
			
			expect(claudeNormalized.maxTokens).toBe(64000); // Claude Haiku has 64K
			expect(gptNormalized.maxTokens).toBe(8192);     // GPT-5 has 8K
		});

		it('should cap maxTokens at model maximum if user provides higher value', () => {
			const params = {
				modelId: 'cortex/openai-gpt-5',
				maxTokens: 16384 // Requesting more than 8192 max
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.maxTokens).toBe(8192); // Capped at model's maximum
		});

	it('should enforce minimum 8192 tokens', () => {
		const params = {
			modelId: 'cortex/claude-sonnet-4-5',
			maxTokens: 4096 // Below 8192 minimum
		};
		const normalized = provider._normalizeParams(params);
		expect(normalized.maxTokens).toBe(8192); // Raised to minimum
	});

		it('should default to 8192 for unknown models', () => {
			const params = {
				modelId: 'cortex/unknown-model'
			};
			const normalized = provider._normalizeParams(params);
			expect(normalized.maxTokens).toBe(8192); // Default fallback
		});
	});

	describe('generateObject', () => {
		it('should delegate to package helper', async () => {
			const { generateObjectWithPromptEngineering } = await import(
				'@tm/ai-sdk-provider-cortex-code'
			);

			const result = await provider.generateObject({
				modelId: 'cortex/claude-sonnet-4-5',
				schema: { type: 'object', properties: { test: { type: 'string' } } },
				objectName: 'TestObject',
				messages: [{ role: 'user', content: 'test' }]
			});

			expect(generateObjectWithPromptEngineering).toHaveBeenCalled();
			expect(result).toEqual(
				expect.objectContaining({
					object: expect.any(Object),
					finishReason: expect.any(String)
				})
			);
		});

		it('should pass generateText function to helper', async () => {
			const { generateObjectWithPromptEngineering } = await import(
				'@tm/ai-sdk-provider-cortex-code'
			);

			await provider.generateObject({
				modelId: 'cortex/claude-sonnet-4-5',
				schema: { type: 'object' },
				objectName: 'TestObject',
				messages: [{ role: 'user', content: 'test' }]
			});

			const callArgs = generateObjectWithPromptEngineering.mock.calls[0][0];
			expect(callArgs).toHaveProperty('generateText');
			expect(typeof callArgs.generateText).toBe('function');
		});
	});

	describe('API key management', () => {
		it('should return CORTEX_API_KEY as required key name', () => {
			expect(provider.getRequiredApiKeyName()).toBe('CORTEX_API_KEY');
		});

		it('should mark API key as not strictly required', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('error handling', () => {
		it('should handle client initialization errors', async () => {
			const { createCortexCode } = await import(
				'@tm/ai-sdk-provider-cortex-code'
			);
			createCortexCode.mockImplementationOnce(() => {
				throw new Error('Mock initialization error');
			});

			const errorProvider = new CortexCodeProvider();
			expect(() => errorProvider.getClient({})).toThrow(
				'Mock initialization error'
			);
		});

		it('should provide setup instructions for ENOENT errors', async () => {
			const { createCortexCode } = await import(
				'@tm/ai-sdk-provider-cortex-code'
			);
			const error = new Error('cortex not found');
			error.code = 'ENOENT';
			createCortexCode.mockImplementationOnce(() => {
				throw error;
			});

		const errorProvider = new CortexCodeProvider();
		expect(() => errorProvider.getClient({})).toThrow(/Please see your Snowflake Account Executive/);
		});
	});
});
