/**
 * Unit tests for the unified Snowflake provider
 */

import { createSnowflake, snowflake } from '../src/provider.js';
import { isCortexCliAvailable, CliLanguageModel } from '../src/cli/index.js';
import { RestLanguageModel } from '../src/rest/index.js';
import { getExecutionMode } from '../src/config/index.js';

// Mock the CLI availability check
jest.mock('../src/cli/index.js', () => ({
	...jest.requireActual('../src/cli/index.js'),
	isCortexCliAvailable: jest.fn()
}));

// Mock the config getExecutionMode to prevent env/config interference
jest.mock('../src/config/index.js', () => ({
	...jest.requireActual('../src/config/index.js'),
	getExecutionMode: jest.fn()
}));

const mockIsCortexCliAvailable = isCortexCliAvailable as jest.MockedFunction<
	typeof isCortexCliAvailable
>;
const mockGetExecutionMode = getExecutionMode as jest.MockedFunction<
	typeof getExecutionMode
>;

describe('SnowflakeProvider', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.clearAllMocks();
		// Reset environment variables
		process.env = { ...originalEnv };
		// Clear relevant env vars
		delete process.env.SNOWFLAKE_API_KEY;
		delete process.env.SNOWFLAKE_BASE_URL;
		delete process.env.SNOWFLAKE_ACCOUNT;
		delete process.env.SNOWFLAKE_USER;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_PATH;
		delete process.env.SNOWFLAKE_PRIVATE_KEY_FILE;
		delete process.env.CORTEX_EXECUTION_MODE;
		delete process.env.SNOWFLAKE_EXECUTION_MODE;

		// Mock CLI as unavailable by default (tests can override)
		mockIsCortexCliAvailable.mockResolvedValue(false);

		// Mock config getExecutionMode to return undefined (no config override)
		mockGetExecutionMode.mockReturnValue(undefined);
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('createSnowflake', () => {
		it('should create a provider with default settings', () => {
			const provider = createSnowflake();

			expect(provider).toBeDefined();
			expect(typeof provider).toBe('function');
			expect(provider.provider).toBe('snowflake');
			expect(typeof provider.languageModel).toBe('function');
		});

		it('should create a language model from provider function with rest mode', () => {
			mockIsCortexCliAvailable.mockResolvedValue(false);

			// Explicitly request rest mode
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/openai-gpt-4.1');

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should create a language model from languageModel method with rest mode', () => {
			mockIsCortexCliAvailable.mockResolvedValue(false);

			// Explicitly request rest mode
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider.languageModel('cortex/openai-gpt-4.1');

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});
	});

	describe('execution mode selection', () => {
		it('should create REST model when executionMode is "rest"', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/openai-gpt-4.1');

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should create CLI model when executionMode is "cli"', () => {
			const provider = createSnowflake({ executionMode: 'cli' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model).toBeInstanceOf(CliLanguageModel);
		});

		it('should auto-route to REST by default when REST credentials available', () => {
			// Set REST credentials
			process.env.SNOWFLAKE_API_KEY = 'test-api-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';

			mockIsCortexCliAvailable.mockResolvedValue(true);

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			// All models default to REST API
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should auto-route OpenAI to REST when REST credentials available', () => {
			// Set REST credentials
			process.env.SNOWFLAKE_API_KEY = 'test-api-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';

			mockIsCortexCliAvailable.mockResolvedValue(true);

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/openai-gpt-4.1');

			// OpenAI models auto-route to REST API
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should auto-route to REST when key pair auth credentials available', () => {
			// Set key pair auth credentials
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';

			mockIsCortexCliAvailable.mockResolvedValue(true);

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			// All models default to REST API
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should auto-route when key pair auth with SNOWFLAKE_PRIVATE_KEY_FILE', () => {
			// Set key pair auth with alternative env var name
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';
			process.env.SNOWFLAKE_USER = 'test-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_FILE = '/path/to/key.p8';

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			// All models default to REST API
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should default to REST when no credentials and CLI cache not set', () => {
			// No REST credentials set
			// No CLI cache set (auto mode defaults to REST)
			mockIsCortexCliAvailable.mockResolvedValue(true);

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			// Without REST credentials or cached CLI, defaults to REST
			// (The actual API call would fail with a clear error about missing credentials)
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should prefer REST over CLI when credentials are available', () => {
			// Set REST credentials
			process.env.SNOWFLAKE_API_KEY = 'test-api-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';

			// Even though CLI is available, REST endpoints should be preferred
			mockIsCortexCliAvailable.mockResolvedValue(true);

			const provider = createSnowflake();
			const model = provider('cortex/claude-sonnet-4-5');

			// All models default to REST API
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});
	});

	describe('model ID normalization', () => {
		it('should accept model ID without prefix', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('claude-sonnet-4-5');

			expect(model.modelId).toBe('cortex/claude-sonnet-4-5');
		});

		it('should accept model ID with cortex/ prefix', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.modelId).toBe('cortex/claude-sonnet-4-5');
		});

		it('should handle various model IDs', () => {
			const provider = createSnowflake({ executionMode: 'rest' });

			const models = [
				'gpt-4o',
				'cortex/gpt-4o',
				'llama3.1-70b',
				'cortex/llama3.1-70b',
				'mistral-large2'
			];

			for (const modelId of models) {
				const model = provider(modelId);
				expect(model.modelId).toMatch(/^cortex\//);
			}
		});
	});

	describe('settings merging', () => {
		it('should merge provider settings with model settings', () => {
			const provider = createSnowflake({
				executionMode: 'rest',
				connection: 'default',
				timeout: 60000
			});

			const model = provider('cortex/openai-gpt-4.1', {
				timeout: 120000
			});

			// Model settings should override provider settings
			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
			// The model should have the overridden timeout
			// (We can't directly access private settings, but we verify the model is created)
		});

		it('should use model-specific execution mode if provided', () => {
			const provider = createSnowflake({ executionMode: 'rest' });

			// Override at model level
			const model = provider('cortex/claude-sonnet-4-5', {
				executionMode: 'cli'
			});

			expect(model).toBeInstanceOf(CliLanguageModel);
		});
	});

	describe('default snowflake instance', () => {
		it('should export a default snowflake provider', () => {
			expect(snowflake).toBeDefined();
			expect(typeof snowflake).toBe('function');
			expect(snowflake.provider).toBe('snowflake');
		});

		it('should create models from default provider', () => {
			mockIsCortexCliAvailable.mockResolvedValue(false);

			// Force rest mode for predictable testing
			const model = snowflake.languageModel('cortex/openai-gpt-4.1', {
				executionMode: 'rest'
			});

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});
	});

	describe('CLI language model', () => {
		it('should create CLI model with correct settings', () => {
			const provider = createSnowflake({
				executionMode: 'cli',
				connection: 'myconn',
				workingDirectory: '/custom/dir',
				plan: true,
				noMcp: true
			});

			const model = provider('cortex/claude-sonnet-4-5');

			expect(model).toBeInstanceOf(CliLanguageModel);
			expect(model.modelId).toBe('cortex/claude-sonnet-4-5');
		});
	});

	describe('REST language model', () => {
		it('should create REST model with correct settings', () => {
			const provider = createSnowflake({
				executionMode: 'rest',
				apiKey: 'test-key',
				baseURL: 'https://custom.snowflakecomputing.com'
			});

			const model = provider('cortex/openai-gpt-4.1');

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
			expect(model.modelId).toBe('cortex/openai-gpt-4.1');
		});

		it('should handle Claude models via REST', () => {
			const provider = createSnowflake({
				executionMode: 'rest',
				apiKey: 'test-key',
				baseURL: 'https://custom.snowflakecomputing.com'
			});

			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
			expect(model.modelId).toBe('cortex/claude-sonnet-4-5');
		});
	});
});

describe('LanguageModel properties', () => {
	describe('RestLanguageModel', () => {
		it('should have correct specification version', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.specificationVersion).toBe('v2');
		});

		it('should support structured outputs', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/claude-sonnet-4-5') as RestLanguageModel;

			expect(model.supportsStructuredOutputs).toBe(true);
		});

		it('should have correct provider name', () => {
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.provider).toBe('snowflake');
		});
	});

	describe('CliLanguageModel', () => {
		it('should have correct specification version', () => {
			const provider = createSnowflake({ executionMode: 'cli' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.specificationVersion).toBe('v2');
		});

		it('should have correct provider name', () => {
			const provider = createSnowflake({ executionMode: 'cli' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.provider).toBe('snowflake');
		});
	});
});
