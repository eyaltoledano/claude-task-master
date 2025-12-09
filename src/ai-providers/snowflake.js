/**
 * Snowflake AI provider - Unified provider for REST API and CLI
 *
 * Uses the @sfc-gh-dflippo/ai-sdk-provider-snowflake package (from git submodule) for all functionality.
 * Supports cortex/ model prefix with auto-detection between REST API and CLI.
 *
 * IMPORTANT: This uses the improved provider from:
 * https://github.com/sfc-gh-dflippo/ai-sdk-provider-snowflake
 *
 * Key improvements in the new provider:
 * - Uses @ai-sdk/provider-utils for cleaner HTTP handling (postJsonToApi)
 * - Modular type definitions for better maintainability
 * - Improved error handling with createJsonErrorResponseHandler
 * - Streaming implementation using TransformStream
 * - Better code organization and comprehensive test coverage
 *
 * @see https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api
 */
import {
	createSnowflake,
	validateCredentials,
	normalizeModelId
} from '@sfc-gh-dflippo/ai-sdk-provider-snowflake';
import { BaseAIProvider } from './base-provider.js';
import { log } from '../../scripts/modules/utils.js';
import { getSupportedModelsForProvider } from '../../scripts/modules/config-manager.js';

/**
 * Snowflake Cortex AI Provider
 *
 * Provides integration with Snowflake Cortex LLM services via REST API or CLI.
 * Supports multiple execution modes: REST API, Cortex Code CLI, or automatic fallback.
 *
 * @extends BaseAIProvider
 * @example
 * const provider = new SnowflakeProvider({ executionMode: 'auto' });
 * const client = provider.getClient();
 * const isSupported = provider.isModelSupported('cortex/claude-sonnet-4-5');
 */
export class SnowflakeProvider extends BaseAIProvider {
	/**
	 * Creates a new SnowflakeProvider instance
	 *
	 * @param {Object} [options={}] - Configuration options
	 * @param {string} [options.executionMode='auto'] - Execution mode: 'rest', 'cli', or 'auto'
	 * @param {string} [options.connection='default'] - Snowflake connection profile name
	 * @param {string} [options.apiKey] - Snowflake API key (optional, supports key pair auth)
	 * @param {string} [options.baseURL] - Custom base URL for Snowflake Cortex API
	 */
	constructor(options = {}) {
		super();
		this.name = 'Snowflake';
		this.options = options;
		this.supportedModels = getSupportedModelsForProvider('snowflake');
		this.supportsStructuredOutputs = true;
		this.supportsTemperature = true;
	}

	/**
	 * Gets the required API key environment variable name
	 *
	 * @returns {string} The environment variable name for Snowflake API key
	 */
	getRequiredApiKeyName() {
		return 'SNOWFLAKE_API_KEY';
	}

	/**
	 * Indicates whether an API key is strictly required
	 *
	 * Returns false because Snowflake supports multiple authentication methods:
	 * - Direct API key
	 * - Key pair authentication (public/private key)
	 * - Cortex Code CLI with connection profiles
	 *
	 * @returns {boolean} False - API key is not strictly required
	 */
	isRequiredApiKey() {
		return false; // Supports key pair auth, CLI fallback
	}

	/**
	 * Validates authentication credentials and determines available execution modes
	 *
	 * Checks for REST API authentication and Cortex Code CLI availability.
	 * Logs a debug message if only CLI authentication is available.
	 *
	 * @param {Object} params - Authentication parameters
	 * @param {string} [params.connection='default'] - Connection profile name
	 * @param {string} [params.apiKey] - API key for REST authentication
	 * @param {string} [params.baseURL] - Base URL for REST API
	 * @returns {Promise<void>}
	 * @throws {Error} If no authentication method is available
	 */
	async validateAuth(params) {
		try {
			const result = await validateCredentials({
				connection: params.connection || 'default',
				apiKey: params.apiKey,
				baseURL: params.baseURL
			});

			if (!result.rest && result.cli) {
				log('debug', 'REST API auth not available, will use Cortex Code CLI');
			}
		} catch (error) {
			log('warn', `Snowflake auth validation failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Creates a Snowflake Cortex client instance
	 *
	 * Merges constructor options with runtime parameters, with runtime params taking precedence.
	 * Ensures executionMode is set to 'auto' by default if not specified.
	 *
	 * @param {Object} [params={}] - Client configuration parameters
	 * @param {string} [params.executionMode] - Override execution mode for this client
	 * @param {string} [params.connection] - Override connection profile
	 * @param {string} [params.apiKey] - Override API key
	 * @returns {Object} Configured Snowflake client from @sfc-gh-dflippo/ai-sdk-provider-snowflake
	 */
	getClient(params = {}) {
		return createSnowflake({
			...this.options,
			...params,
			executionMode:
				params.executionMode || this.options.executionMode || 'auto'
		});
	}

	/**
	 * Gets list of supported model IDs
	 *
	 * Extracts model IDs from the supported models configuration, handling both
	 * string model IDs and object configurations with an 'id' property.
	 *
	 * @returns {string[]} Array of supported model IDs (e.g., ['cortex/claude-sonnet-4-5', ...])
	 */
	getSupportedModels() {
		return this.supportedModels.map((m) => (typeof m === 'object' ? m.id : m));
	}

	/**
	 * Checks if a model ID is supported by this provider
	 *
	 * Performs case-insensitive comparison and handles the 'cortex/' prefix automatically.
	 * Examples: 'cortex/claude-sonnet-4-5', 'CLAUDE-SONNET-4-5', 'claude-sonnet-4-5' all match.
	 *
	 * @param {string} modelId - The model ID to check
	 * @returns {boolean} True if the model is supported, false otherwise
	 * @example
	 * provider.isModelSupported('cortex/claude-sonnet-4-5'); // true
	 * provider.isModelSupported('CLAUDE-SONNET-4-5'); // true
	 * provider.isModelSupported('invalid-model'); // false
	 */
	isModelSupported(modelId) {
		if (!modelId) return false;
		// Normalize to strip cortex/ prefix and lowercase
		const normalized = normalizeModelId(modelId);
		return this.supportedModels.some((m) => {
			const supportedId = typeof m === 'object' ? m.id : m;
			return normalizeModelId(supportedId) === normalized;
		});
	}
}

/**
 * Creates a Snowflake Cortex client with the specified configuration
 *
 * Re-exported from @sfc-gh-dflippo/ai-sdk-provider-snowflake for direct client creation.
 * Use this when you need fine-grained control over client configuration.
 *
 * @function
 * @param {Object} options - Client configuration options
 * @param {string} [options.executionMode='auto'] - Execution mode: 'rest', 'cli', or 'auto'
 * @param {string} [options.connection] - Connection profile name
 * @param {string} [options.apiKey] - API key for REST authentication
 * @param {string} [options.baseURL] - Base URL for Cortex API
 * @returns {Object} Configured Snowflake client
 * @see {@link https://github.com/sfc-gh-dflippo/ai-sdk-provider-snowflake|ai-sdk-provider-snowflake}
 * @example
 * import { createSnowflake } from './ai-providers/snowflake.js';
 * const client = createSnowflake({ executionMode: 'rest' });
 */
export { createSnowflake };
