/**
 * Unified Snowflake provider factory
 *
 * Creates language models that use the Cortex REST API endpoint.
 *
 * Execution modes:
 * - 'auto': Auto-detect based on available credentials (prefers REST if credentials exist,
 *           falls back to CLI if no REST credentials - CLI availability is checked at generation time)
 * - 'rest': Use Cortex REST API (/api/v2/cortex/inference:complete) - DEFAULT
 * - 'cli': Use Cortex Code CLI
 */

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { CliLanguageModel, isCortexCliAvailable } from './cli/index.js';
import { RestLanguageModel } from './rest/index.js';
import type {
	SnowflakeProviderSettings,
	SnowflakeModelId,
	ExecutionMode,
	PreferredEndpoint
} from './types.js';
import {
	getExecutionMode,
	getDangerouslyAllowAllToolCalls,
	getEnableMcpServers,
	getEnvVar,
	ENV_VARS
} from './config/index.js';
import { prefixModelId } from './utils/models.js';

/**
 * Provider options
 */
export interface SnowflakeProviderOptions extends SnowflakeProviderSettings {
	// All settings are inherited from SnowflakeProviderSettings
}

/**
 * Snowflake provider interface
 */
export interface SnowflakeProvider {
	/**
	 * Create a language model
	 * @param modelId - Model ID (e.g., 'claude-sonnet-4-5' or 'cortex/claude-sonnet-4-5')
	 * @param settings - Optional per-model settings
	 * @returns Language model instance (always synchronous per AI SDK pattern)
	 */
	languageModel(
		modelId: SnowflakeModelId,
		settings?: SnowflakeProviderSettings
	): LanguageModelV2;

	/**
	 * Shorthand for creating a language model
	 * @returns Language model instance (always synchronous per AI SDK pattern)
	 */
	(
		modelId: SnowflakeModelId,
		settings?: SnowflakeProviderSettings
	): LanguageModelV2;

	/**
	 * Provider name
	 */
	readonly provider: string;
}

// Cache CLI availability check result
let cliAvailableCache: boolean | null = null;
let cliCheckPromise: Promise<boolean> | null = null;

// For testing: when set, bypasses the actual CLI check
let testingCliAvailability: boolean | null = null;

/**
 * Reset the CLI availability cache
 * Useful for testing to ensure clean state between tests
 */
export function resetCliAvailabilityCache(): void {
	cliAvailableCache = null;
	cliCheckPromise = null;
	testingCliAvailability = null;
}

/**
 * Set CLI availability result for testing
 * When set, bypasses the actual CLI availability check entirely.
 * Call resetCliAvailabilityCache() to clear this override.
 * 
 * @param available - Whether CLI should be considered available in tests
 */
export function setCliAvailabilityForTesting(available: boolean): void {
	testingCliAvailability = available;
	cliAvailableCache = available;
}

/**
 * Check if Cortex CLI is available (with caching)
 */
async function checkCliAvailable(): Promise<boolean> {
	// Testing override takes precedence
	if (testingCliAvailability !== null) {
		return testingCliAvailability;
	}

	if (cliAvailableCache !== null) {
		return cliAvailableCache;
	}

	if (cliCheckPromise) {
		return cliCheckPromise;
	}

	cliCheckPromise = isCortexCliAvailable().then((available) => {
		cliAvailableCache = available;
		cliCheckPromise = null;
		return available;
	});

	return cliCheckPromise;
}

/**
 * Check if REST API credentials are available
 *
 * Uses shared environment variable utilities from auth module.
 * Checks for:
 * 1. API key + base URL (or account to derive URL)
 * 2. Key pair authentication (account + user + private key)
 */
function hasRestCredentials(settings: SnowflakeProviderSettings): boolean {
	// Use shared env var utilities from auth module
	const account = getEnvVar(ENV_VARS.account);
	const envApiKey = getEnvVar(ENV_VARS.token);
	const envBaseUrl = getEnvVar(ENV_VARS.baseURL);

	// Check settings first - apiKey with either explicit baseURL or account to derive URL
	if (settings.apiKey && (settings.baseURL || account)) {
		return true;
	}

	// Check environment: API key with either explicit base URL or account to derive URL
	if (envApiKey && (envBaseUrl || account)) {
		return true;
	}

	// Check for key pair authentication (account + user + private key)
	const user = getEnvVar(ENV_VARS.user);
	const privateKeyPath = getEnvVar(ENV_VARS.privateKeyPath);

	if (account && user && privateKeyPath) {
		return true;
	}

	return false;
}

/**
 * Create a language model with the specified execution mode
 */
function createLanguageModelWithMode(
	modelId: SnowflakeModelId,
	settings: SnowflakeProviderSettings,
	mode: ExecutionMode | PreferredEndpoint
): LanguageModelV2 {
	// Ensure model ID has cortex/ prefix
	const normalizedId = prefixModelId(modelId);

	switch (mode) {
		case 'rest':
			return new RestLanguageModel({
				id: normalizedId,
				settings
			});

		case 'cli':
			return new CliLanguageModel({
				id: normalizedId,
				settings
			});

		case 'auto':
		default:
			// This shouldn't happen as auto is handled before this function
			// Default to REST API
			return new RestLanguageModel({
				id: normalizedId,
				settings
			});
	}
}

/**
 * Create a unified Snowflake provider
 *
 * @param options - Provider options
 * @returns Snowflake provider instance
 *
 * @example
 * ```typescript
 * import { createSnowflake } from '@tm/ai-sdk-provider-snowflake';
 *
 * // Default: auto-detect based on available credentials
 * const snowflake = createSnowflake();
 * const claudeModel = snowflake('cortex/claude-sonnet-4-5');
 * const openaiModel = snowflake('cortex/openai-gpt-4.1');
 *
 * // Force specific execution mode
 * const restProvider = createSnowflake({
 *   executionMode: 'rest'  // Use REST API
 * });
 *
 * const cliProvider = createSnowflake({
 *   executionMode: 'cli'  // Use CLI
 * });
 * ```
 */
export function createSnowflake(
	options: SnowflakeProviderOptions = {}
): SnowflakeProvider {
	// Pre-check CLI availability for 'auto' mode (in background)
	if (options.executionMode === 'auto' || !options.executionMode) {
		checkCliAvailable().catch(() => {
			// Ignore errors, will try other methods
		});
	}

	const createModel = (
		modelId: SnowflakeModelId,
		modelSettings?: SnowflakeProviderSettings
	): LanguageModelV2 => {
		// Get config-based settings
		const configDangerouslyAllowAllToolCalls =
			getDangerouslyAllowAllToolCalls();
		const configEnableMcpServers = getEnableMcpServers();

		const mergedSettings: SnowflakeProviderSettings = {
			...options,
			...modelSettings,
			// Apply config-based dangerouslyAllowAllToolCalls if not explicitly set
			dangerouslyAllowAllToolCalls:
				modelSettings?.dangerouslyAllowAllToolCalls ??
				options?.dangerouslyAllowAllToolCalls ??
				configDangerouslyAllowAllToolCalls,
			// Apply config-based noMcp (inverted from enableMcpServers) if not explicitly set
			// noMcp=true means --no-mcp flag is added, enableMcpServers=false means the same
			noMcp: modelSettings?.noMcp ?? options?.noMcp ?? !configEnableMcpServers
		};

		// Determine execution mode with priority:
		// 1. Programmatic settings (mergedSettings.executionMode) - highest priority for tests
		// 2. Environment variables (CORTEX_EXECUTION_MODE, SNOWFLAKE_EXECUTION_MODE)
		// 3. Config file (.taskmaster/config.json snowflake.executionMode)
		// 4. Default to 'auto'
		const configExecutionMode = getExecutionMode();
		const requestedMode =
			mergedSettings.executionMode || configExecutionMode || 'auto';

		// Debug logging
		if (process.env.DEBUG?.includes('snowflake:provider')) {
			console.log(`[DEBUG snowflake:provider] Execution mode resolution:`);
			console.log(
				`  - From settings: ${mergedSettings.executionMode || '(not set)'}`
			);
			console.log(`  - From env/config: ${configExecutionMode || '(not set)'}`);
			console.log(`  - Final: ${requestedMode}`);
		}

		// For explicit modes (not 'auto'), use directly
		if (requestedMode !== 'auto') {
			return createLanguageModelWithMode(
				modelId,
				mergedSettings,
				requestedMode
			);
		}

		// Auto mode: Check if we have REST credentials
		const hasRest = hasRestCredentials(mergedSettings);
		
		if (hasRest) {
			// Use REST API
			if (process.env.DEBUG?.includes('snowflake:provider')) {
				console.log(
					`[DEBUG snowflake:provider] Auto-routing model ${modelId} to rest endpoint (REST credentials available)`
				);
			}

			return createLanguageModelWithMode(modelId, mergedSettings, 'rest');
		}

		// If CLI is available (cached), use it
		if (cliAvailableCache === true) {
			if (process.env.DEBUG?.includes('snowflake:provider')) {
				console.log(
					`[DEBUG snowflake:provider] Auto-routing model ${modelId} to cli endpoint (CLI available)`
				);
			}
			return createLanguageModelWithMode(modelId, mergedSettings, 'cli');
		}

		// If CLI check already failed and no REST credentials, throw error
		if (cliAvailableCache === false) {
			throw new Error(
				'No Snowflake authentication available: REST API credentials not found and Cortex CLI not available. ' +
				'Please configure REST credentials (SNOWFLAKE_API_KEY/SNOWFLAKE_ACCOUNT or key pair authentication) or install Cortex CLI.'
			);
		}

		// CLI check is still pending (cliAvailableCache === null) and no REST credentials
		// Return CLI model optimistically - it will check availability and throw a clear error
		// if CLI is not installed when doGenerate() is called. This maintains the synchronous
		// return pattern required by the AI SDK.
		if (process.env.DEBUG?.includes('snowflake:provider')) {
			console.log(
				`[DEBUG snowflake:provider] Auto mode: returning CLI model optimistically (no REST credentials, CLI check pending)`
			);
		}
		return createLanguageModelWithMode(modelId, mergedSettings, 'cli');
	};

	// Create the provider function that also has methods
	const provider = createModel as SnowflakeProvider;

	// Add languageModel method
	Object.defineProperty(provider, 'languageModel', {
		value: createModel,
		writable: false,
		enumerable: true
	});

	// Add provider name
	Object.defineProperty(provider, 'provider', {
		value: 'snowflake',
		writable: false,
		enumerable: true
	});

	return provider;
}

/**
 * Default Snowflake provider instance with auto-detection
 * 
 * @example
 * ```typescript
 * import { snowflake } from '@tm/ai-sdk-provider-snowflake';
 * 
 * const model = snowflake('cortex/claude-sonnet-4-5');
 * ```
 */
export const snowflake = createSnowflake();

/**
 * Re-export execution mode and endpoint types
 */
export type { ExecutionMode, PreferredEndpoint };
