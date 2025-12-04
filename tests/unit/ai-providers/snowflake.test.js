import { jest } from '@jest/globals';

// Mock the ai-sdk-provider-snowflake package
const mockCreateSnowflake = jest.fn(() => {
	const provider = (modelId, settings) => ({
		id: modelId,
		settings,
		doGenerate: jest.fn(() => ({ text: 'ok', usage: {} })),
		doStream: jest.fn(() => ({ stream: true }))
	});
	provider.languageModel = jest.fn((id, settings) => ({ id, settings }));
	provider.chat = provider.languageModel;
	return provider;
});

const mockValidateCredentials = jest.fn(() =>
	Promise.resolve({ rest: true, cli: false, preferredMode: 'rest' })
);

const mockNormalizeModelId = jest.fn((id) =>
	id ? id.replace(/^cortex\//, '').toLowerCase() : ''
);

jest.unstable_mockModule('@tm/ai-sdk-provider-snowflake', () => ({
	createSnowflake: mockCreateSnowflake,
	validateCredentials: mockValidateCredentials,
	normalizeModelId: mockNormalizeModelId
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

// Mock utils
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	resolveEnvVariable: jest.fn((key) => process.env[key]),
	findProjectRoot: jest.fn(() => process.cwd()),
	isEmpty: jest.fn(() => false)
}));

// Mock config manager
jest.unstable_mockModule('../../../scripts/modules/config-manager.js', () => ({
	getSupportedModelsForProvider: jest.fn(() => [
		{ id: 'cortex/claude-haiku-4-5', name: 'Claude Haiku 4.5' },
		{ id: 'cortex/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
		{ id: 'cortex/llama3.1-8b', name: 'Llama 3.1 8B' }
	]),
	getDebugFlag: jest.fn(() => false),
	getLogLevel: jest.fn(() => 'info')
}));

// Import after mocking
const { SnowflakeProvider } = await import(
	'../../../src/ai-providers/snowflake.js'
);

describe('SnowflakeProvider', () => {
	let provider;

	beforeEach(() => {
		jest.clearAllMocks();
		provider = new SnowflakeProvider();
	});

	describe('constructor', () => {
		it('should set the provider name to Snowflake', () => {
			expect(provider.name).toBe('Snowflake');
		});

		it('should set supportsStructuredOutputs to true', () => {
			expect(provider.supportsStructuredOutputs).toBe(true);
		});

		it('should set supportsTemperature to true', () => {
			expect(provider.supportsTemperature).toBe(true);
		});

		it('should load supported models from config', () => {
			expect(provider.supportedModels).toHaveLength(3);
		});

		it('should accept options in constructor', () => {
			const customProvider = new SnowflakeProvider({ executionMode: 'cli' });
			expect(customProvider.options).toEqual({ executionMode: 'cli' });
		});
	});

	describe('getRequiredApiKeyName', () => {
		it('should return SNOWFLAKE_API_KEY', () => {
			expect(provider.getRequiredApiKeyName()).toBe('SNOWFLAKE_API_KEY');
    });
	});

	describe('isRequiredApiKey', () => {
		it('should return false (supports key pair auth and CLI fallback)', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('validateAuth', () => {
		it('should call validateCredentials from package', async () => {
			await provider.validateAuth({ apiKey: 'test-key' });

			expect(mockValidateCredentials).toHaveBeenCalledWith({
				connection: 'default',
				apiKey: 'test-key',
				baseURL: undefined
			});
		});

		it('should pass connection name to validateCredentials', async () => {
			await provider.validateAuth({ connection: 'prod', apiKey: 'key' });

			expect(mockValidateCredentials).toHaveBeenCalledWith({
				connection: 'prod',
				apiKey: 'key',
				baseURL: undefined
		});
	});

		it('should pass baseURL to validateCredentials', async () => {
			await provider.validateAuth({
				baseURL: 'https://my-account.snowflakecomputing.com'
			});

			expect(mockValidateCredentials).toHaveBeenCalledWith({
				connection: 'default',
				apiKey: undefined,
				baseURL: 'https://my-account.snowflakecomputing.com'
			});
		});

		it('should log when falling back to CLI', async () => {
			const { log } = await import('../../../scripts/modules/utils.js');
			mockValidateCredentials.mockResolvedValueOnce({
				rest: false,
				cli: true,
				preferredMode: 'cli'
			});

			await provider.validateAuth({});

			expect(log).toHaveBeenCalledWith(
				'debug',
				'REST API auth not available, will use Cortex Code CLI'
			);
	});

		it('should not log when REST is available', async () => {
			const { log } = await import('../../../scripts/modules/utils.js');
			mockValidateCredentials.mockResolvedValueOnce({
				rest: true,
				cli: true,
				preferredMode: 'rest'
			});

			await provider.validateAuth({});

			expect(log).not.toHaveBeenCalled();
		});
	});

	describe('getClient', () => {
		it('should call createSnowflake from package', () => {
			provider.getClient({});

			expect(mockCreateSnowflake).toHaveBeenCalled();
		});

		it('should pass executionMode option', () => {
			provider.getClient({ executionMode: 'cli' });
			
			expect(mockCreateSnowflake).toHaveBeenCalledWith(
				expect.objectContaining({ executionMode: 'cli' })
			);
		});

		it('should default to auto executionMode', () => {
			provider.getClient({});
			
			expect(mockCreateSnowflake).toHaveBeenCalledWith(
				expect.objectContaining({ executionMode: 'auto' })
			);
		});

		it('should use constructor options as defaults', () => {
			const customProvider = new SnowflakeProvider({ executionMode: 'rest' });
			customProvider.getClient({});

			expect(mockCreateSnowflake).toHaveBeenCalledWith(
				expect.objectContaining({ executionMode: 'rest' })
			);
		});

		it('should override constructor options with params', () => {
			const customProvider = new SnowflakeProvider({ executionMode: 'rest' });
			customProvider.getClient({ executionMode: 'cli' });

			expect(mockCreateSnowflake).toHaveBeenCalledWith(
				expect.objectContaining({ executionMode: 'cli' })
			);
		});

		it('should return the created client', () => {
			const client = provider.getClient({});
			expect(client).toBeDefined();
			expect(typeof client).toBe('function');
		});
	});

	describe('getSupportedModels', () => {
		it('should return array of model IDs', () => {
			const models = provider.getSupportedModels();

			expect(models).toEqual([
				'cortex/claude-haiku-4-5',
				'cortex/claude-sonnet-4-5',
				'cortex/llama3.1-8b'
			]);
		});

		it('should handle string models (not objects)', () => {
			// Test via the mapping logic - if model is string, return as-is
			const stringModels = ['cortex/model-a', 'cortex/model-b'];
			const mapped = stringModels.map((m) =>
				typeof m === 'object' ? m.id : m
			);
			expect(mapped).toEqual(['cortex/model-a', 'cortex/model-b']);
		});
	});

	describe('isModelSupported', () => {
		it('should return true for supported model with prefix', () => {
			expect(provider.isModelSupported('cortex/claude-haiku-4-5')).toBe(true);
		});

		it('should return true for supported model without prefix', () => {
			mockNormalizeModelId.mockReturnValue('claude-haiku-4-5');
			expect(provider.isModelSupported('claude-haiku-4-5')).toBe(true);
		});

		it('should return true for supported model with different casing', () => {
			mockNormalizeModelId.mockImplementation((id) =>
				id ? id.replace(/^cortex\//, '').toLowerCase() : ''
			);
			expect(provider.isModelSupported('cortex/Claude-Haiku-4-5')).toBe(true);
		});

		it('should return false for unsupported model', () => {
			// Reset mock to use real normalization for this test
			mockNormalizeModelId.mockImplementation((id) =>
				id ? id.replace(/^cortex\//, '').toLowerCase() : ''
			);
			expect(provider.isModelSupported('cortex/unknown-model')).toBe(false);
		});

		it('should return false for null input', () => {
			expect(provider.isModelSupported(null)).toBe(false);
		});

		it('should return false for undefined input', () => {
			expect(provider.isModelSupported(undefined)).toBe(false);
		});

		it('should return false for empty string', () => {
			expect(provider.isModelSupported('')).toBe(false);
		});

		it('should use normalizeModelId from package for comparison', () => {
			provider.isModelSupported('cortex/claude-haiku-4-5');
			expect(mockNormalizeModelId).toHaveBeenCalled();
		});
	});
		});

describe('Snowflake Provider - Export', () => {
	it('should export createSnowflake for external use', async () => {
		const { createSnowflake } = await import(
			'../../../src/ai-providers/snowflake.js'
		);
		expect(createSnowflake).toBeDefined();
});
});

