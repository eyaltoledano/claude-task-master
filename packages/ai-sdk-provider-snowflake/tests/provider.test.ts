/**
 * Unit tests for the unified Snowflake provider
 */

import { createSnowflake, snowflake, resetCliAvailabilityCache, setCliAvailabilityForTesting } from '../src/provider.js';
import { CliLanguageModel } from '../src/cli/index.js';
import { RestLanguageModel } from '../src/rest/index.js';
import {
	getExecutionMode,
	getDangerouslyAllowAllToolCalls,
	getEnableMcpServers
} from '../src/config/index.js';

// Mock the config functions to prevent env/config interference
jest.mock('../src/config/index.js', () => ({
	...jest.requireActual('../src/config/index.js'),
	getExecutionMode: jest.fn(),
	getDangerouslyAllowAllToolCalls: jest.fn(),
	getEnableMcpServers: jest.fn()
}));

const mockGetExecutionMode = getExecutionMode as jest.MockedFunction<
	typeof getExecutionMode
>;
const mockGetDangerouslyAllowAllToolCalls =
	getDangerouslyAllowAllToolCalls as jest.MockedFunction<
		typeof getDangerouslyAllowAllToolCalls
	>;
const mockGetEnableMcpServers = getEnableMcpServers as jest.MockedFunction<
	typeof getEnableMcpServers
>;

describe('SnowflakeProvider', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.clearAllMocks();
		// Reset CLI availability cache to ensure clean state between tests
		resetCliAvailabilityCache();
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
		delete process.env.CORTEX_API_KEY;
		delete process.env.CORTEX_BASE_URL;
		delete process.env.CORTEX_ACCOUNT;
		delete process.env.CORTEX_USER;
		delete process.env.DEBUG;

		// Set CLI as unavailable by default (tests can override with setCliAvailabilityForTesting)
		setCliAvailabilityForTesting(false);

		// Mock config getExecutionMode to return undefined (no config override)
		mockGetExecutionMode.mockReturnValue(undefined);
		mockGetDangerouslyAllowAllToolCalls.mockReturnValue(false);
		mockGetEnableMcpServers.mockReturnValue(true);
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
			setCliAvailabilityForTesting(false);

			// Explicitly request rest mode
			const provider = createSnowflake({ executionMode: 'rest' });
			const model = provider('cortex/openai-gpt-4.1');

			expect(model.constructor.name).toBe('RestLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should create a language model from languageModel method with rest mode', () => {
			setCliAvailabilityForTesting(false);

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

			setCliAvailabilityForTesting(true);

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

			setCliAvailabilityForTesting(true);

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

			setCliAvailabilityForTesting(true);

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

		it('should throw error when no credentials and CLI not available', () => {
			// No REST credentials set
			// CLI is not available
			setCliAvailabilityForTesting(false);

			const provider = createSnowflake({ executionMode: 'auto' });
			
			// Without REST credentials and CLI not available, should throw
			expect(() => provider('cortex/claude-sonnet-4-5')).toThrow(
				'No Snowflake authentication available'
			);
		});

		it('should fall back to CLI when no REST credentials but CLI available', async () => {
			// No REST credentials set
			// CLI is available
			setCliAvailabilityForTesting(true);

			const provider = createSnowflake({ executionMode: 'auto' });
			const modelOrPromise = provider('cortex/claude-sonnet-4-5');
			
			// When no REST credentials, provider awaits CLI check and returns CLI model
			const model = await Promise.resolve(modelOrPromise);
			expect(model.constructor.name).toBe('CliLanguageModel');
			expect(model.provider).toBe('snowflake');
		});

		it('should prefer REST over CLI when credentials are available', () => {
			// Set REST credentials
			process.env.SNOWFLAKE_API_KEY = 'test-api-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';

			// Even though CLI is available, REST endpoints should be preferred
			setCliAvailabilityForTesting(true);

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
			setCliAvailabilityForTesting(false);

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

	describe('CORTEX_* environment variables (priority over SNOWFLAKE_*)', () => {
		it('should use CORTEX_API_KEY with CORTEX_BASE_URL', () => {
			process.env.CORTEX_API_KEY = 'cortex-api-key';
			process.env.CORTEX_BASE_URL = 'https://cortex.snowflakecomputing.com';

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			// Should use REST due to credentials
			expect(model.constructor.name).toBe('RestLanguageModel');
		});

		it('should use CORTEX_API_KEY with CORTEX_ACCOUNT', () => {
			process.env.CORTEX_API_KEY = 'cortex-api-key';
			process.env.CORTEX_ACCOUNT = 'cortex-account';

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.constructor.name).toBe('RestLanguageModel');
		});

		it('should use CORTEX_* key pair auth variables', () => {
			process.env.CORTEX_ACCOUNT = 'cortex-account';
			process.env.CORTEX_USER = 'cortex-user';
			process.env.SNOWFLAKE_PRIVATE_KEY_PATH = '/path/to/key.p8';

			const provider = createSnowflake({ executionMode: 'auto' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.constructor.name).toBe('RestLanguageModel');
		});
	});

	describe('settings-based credentials', () => {
		it('should use apiKey from settings with baseURL from settings', () => {
			const provider = createSnowflake({
				executionMode: 'auto',
				apiKey: 'settings-api-key',
				baseURL: 'https://settings.snowflakecomputing.com'
			});

			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.constructor.name).toBe('RestLanguageModel');
		});

		it('should use apiKey from settings with account from env', () => {
			process.env.SNOWFLAKE_ACCOUNT = 'test-account';

			const provider = createSnowflake({
				executionMode: 'auto',
				apiKey: 'settings-api-key'
			});

			const model = provider('cortex/claude-sonnet-4-5');

			expect(model.constructor.name).toBe('RestLanguageModel');
		});
	});

	describe('config-based settings', () => {
		it('should apply dangerouslyAllowAllToolCalls from config', () => {
			mockGetDangerouslyAllowAllToolCalls.mockReturnValue(true);

			const provider = createSnowflake({ executionMode: 'cli' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model).toBeInstanceOf(CliLanguageModel);
		});

		it('should apply noMcp from config (inverse of enableMcpServers)', () => {
			mockGetEnableMcpServers.mockReturnValue(false);

			const provider = createSnowflake({ executionMode: 'cli' });
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model).toBeInstanceOf(CliLanguageModel);
		});

		it('should override config settings with programmatic settings', () => {
			mockGetDangerouslyAllowAllToolCalls.mockReturnValue(true);
			mockGetEnableMcpServers.mockReturnValue(false);

			const provider = createSnowflake({
				executionMode: 'cli',
				dangerouslyAllowAllToolCalls: false,
				noMcp: false
			});

			const model = provider('cortex/claude-sonnet-4-5');

			expect(model).toBeInstanceOf(CliLanguageModel);
		});

		it('should use config execution mode when not set programmatically', () => {
			mockGetExecutionMode.mockReturnValue('cli');

			const provider = createSnowflake();
			const model = provider('cortex/claude-sonnet-4-5');

			expect(model).toBeInstanceOf(CliLanguageModel);
		});
	});

	describe('debug logging', () => {
		it('should log execution mode resolution when DEBUG includes snowflake:provider', () => {
			process.env.DEBUG = 'snowflake:provider';
			const consoleSpy = jest
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			const provider = createSnowflake({ executionMode: 'rest' });
			provider('cortex/claude-sonnet-4-5');

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[DEBUG snowflake:provider]')
			);

			consoleSpy.mockRestore();
		});

		it('should log auto-routing when DEBUG includes snowflake:provider', () => {
			process.env.DEBUG = 'snowflake:provider';
			process.env.SNOWFLAKE_API_KEY = 'test-key';
			process.env.SNOWFLAKE_BASE_URL = 'https://test.snowflakecomputing.com';
			const consoleSpy = jest
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			const provider = createSnowflake({ executionMode: 'auto' });
			provider('cortex/claude-sonnet-4-5');

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Auto-routing model')
			);

			consoleSpy.mockRestore();
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
