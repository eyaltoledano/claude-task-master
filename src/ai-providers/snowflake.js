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
 * Snowflake provider - thin wrapper around @tm/ai-sdk-provider-snowflake
 */
export class SnowflakeProvider extends BaseAIProvider {
	constructor(options = {}) {
		super();
		this.name = 'Snowflake';
		this.options = options;
		this.supportedModels = getSupportedModelsForProvider('snowflake');
		this.supportsStructuredOutputs = true;
		this.supportsTemperature = true;
	}

	getRequiredApiKeyName() {
		return 'SNOWFLAKE_API_KEY';
	}

	isRequiredApiKey() {
		return false; // Supports key pair auth, CLI fallback
	}

	async validateAuth(params) {
		const result = await validateCredentials({
			connection: params.connection || 'default',
			apiKey: params.apiKey,
			baseURL: params.baseURL
		});

		if (!result.rest && result.cli) {
			log('debug', 'REST API auth not available, will use Cortex Code CLI');
		}
	}

	getClient(params = {}) {
		return createSnowflake({
			...this.options,
			...params,
			executionMode:
				params.executionMode || this.options.executionMode || 'auto'
		});
	}

	getSupportedModels() {
		return this.supportedModels.map((m) => (typeof m === 'object' ? m.id : m));
	}

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

// Re-export for external use
export { createSnowflake };
