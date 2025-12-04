/**
 * Configuration loader for Snowflake provider settings
 *
 * Reads user configuration from .taskmaster/config.json (snowflake section)
 * and merges with provider defaults.
 *
 * Configuration Priority (highest to lowest):
 * 1. CORTEX_EXECUTION_MODE environment variable
 * 2. SNOWFLAKE_EXECUTION_MODE environment variable
 * 3. .taskmaster/config.json snowflake.executionMode
 * 4. Provider settings passed programmatically
 * 5. Auto-detection (REST API with model-based routing, or CLI fallback)
 */

import type {
	SnowflakeUserConfig,
	ThinkingLevel,
	ExecutionMode
} from '../types.js';

/** Default feature settings */
const DEFAULT_FEATURES = {
	structuredOutputs: true,
	promptCaching: true,
	thinking: true,
	streaming: true
};

/** Default thinking level configuration */
const DEFAULT_THINKING = {
	defaultLevel: 'medium' as ThinkingLevel,
	researchLevel: 'high' as ThinkingLevel
};

/** Default user config */
const DEFAULT_USER_CONFIG: SnowflakeUserConfig = {
	features: DEFAULT_FEATURES,
	thinking: DEFAULT_THINKING
};

// Cache for loaded config
let cachedConfig: SnowflakeUserConfig | null = null;
let configLoadAttempted = false;

/**
 * Find the project root by looking for .taskmaster directory
 */
function findProjectRoot(): string | null {
	try {
		// Try to get from environment first
		if (process.env.TASKMASTER_PROJECT_ROOT) {
			return process.env.TASKMASTER_PROJECT_ROOT;
		}

		// Try to find .taskmaster directory by walking up from cwd
		const fs = require('fs');
		const path = require('path');

		let currentDir = process.cwd();
		const root = path.parse(currentDir).root;

		while (currentDir !== root) {
			const taskmasterDir = path.join(currentDir, '.taskmaster');
			if (fs.existsSync(taskmasterDir)) {
				return currentDir;
			}
			currentDir = path.dirname(currentDir);
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Load user configuration from .taskmaster/config.json
 *
 * @param forceReload - Force reload the config (ignore cache)
 * @returns The user configuration or defaults if not found
 */
export function loadUserConfig(forceReload = false): SnowflakeUserConfig {
	// Return cached config if available
	if (cachedConfig && !forceReload && configLoadAttempted) {
		return cachedConfig;
	}

	configLoadAttempted = true;

	try {
		const fs = require('fs');
		const path = require('path');

		const projectRoot = findProjectRoot();
		if (!projectRoot) {
			cachedConfig = DEFAULT_USER_CONFIG;
			return cachedConfig;
		}

		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');

		if (!fs.existsSync(configPath)) {
			cachedConfig = DEFAULT_USER_CONFIG;
			return cachedConfig;
		}

		const configContent = fs.readFileSync(configPath, 'utf-8');
		const fullConfig = JSON.parse(configContent);

		// Extract snowflake section
		const snowflakeConfig = fullConfig.snowflake || {};

		// Merge with defaults
		cachedConfig = {
			features: {
				...DEFAULT_FEATURES,
				...snowflakeConfig.features
			},
			thinking: {
				...DEFAULT_THINKING,
				...snowflakeConfig.thinking
			}
		};

		return cachedConfig;
	} catch (error) {
		// Log error in debug mode
		if (process.env.DEBUG?.includes('snowflake:config')) {
			console.error('[DEBUG snowflake:config] Error loading config:', error);
		}

		cachedConfig = DEFAULT_USER_CONFIG;
		return cachedConfig;
	}
}

/**
 * Clear the cached configuration
 * Useful for testing or when config file changes
 */
export function clearConfigCache(): void {
	cachedConfig = null;
	configLoadAttempted = false;
}

/**
 * Check if a feature is enabled based on user config
 */
export function isFeatureEnabled(
	feature: keyof NonNullable<SnowflakeUserConfig['features']>,
	userOverride?: boolean
): boolean {
	// User override takes precedence
	if (userOverride !== undefined) {
		return userOverride;
	}

	const config = loadUserConfig();
	return config.features?.[feature] ?? DEFAULT_FEATURES[feature];
}

/**
 * Get the thinking level for a request type
 */
export function getThinkingLevel(isResearch = false): ThinkingLevel {
	const config = loadUserConfig();

	if (isResearch) {
		return config.thinking?.researchLevel ?? DEFAULT_THINKING.researchLevel;
	}

	return config.thinking?.defaultLevel ?? DEFAULT_THINKING.defaultLevel;
}

/**
 * Get the full resolved configuration
 * Merges defaults with user config
 */
export function getResolvedConfig(): Required<SnowflakeUserConfig> {
	const config = loadUserConfig();

	return {
		features: {
			...DEFAULT_FEATURES,
			...config.features
		},
		thinking: {
			...DEFAULT_THINKING,
			...config.thinking
		}
	};
}

/**
 * Get the execution mode from environment variables or config
 *
 * Priority:
 * 1. CORTEX_EXECUTION_MODE environment variable
 * 2. SNOWFLAKE_EXECUTION_MODE environment variable
 * 3. .taskmaster/config.json snowflake.executionMode
 * 4. Returns undefined to let provider use its own logic
 *
 * Valid values: 'auto', 'cortex', 'cli', 'anthropic', 'openai-compat', 'native', 'rest'
 */
export function getExecutionMode(): ExecutionMode | undefined {
	// Check environment variables first (highest priority)
	const envMode =
		process.env.CORTEX_EXECUTION_MODE || process.env.SNOWFLAKE_EXECUTION_MODE;

	if (envMode) {
		const normalizedMode = envMode.toLowerCase().trim();
		const validModes: ExecutionMode[] = ['auto', 'rest', 'cli'];

		if (validModes.includes(normalizedMode as ExecutionMode)) {
			if (process.env.DEBUG?.includes('snowflake:config')) {
				console.log(
					`[DEBUG snowflake:config] Execution mode from env: ${normalizedMode}`
				);
			}
			return normalizedMode as ExecutionMode;
		} else {
			console.warn(
				`[WARN] Invalid CORTEX_EXECUTION_MODE/SNOWFLAKE_EXECUTION_MODE value: ${envMode}. Valid values: ${validModes.join(', ')}`
			);
		}
	}

	// Check config file
	try {
		const fs = require('fs');
		const path = require('path');

		const projectRoot = findProjectRoot();
		if (!projectRoot) {
			return undefined;
		}

		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');

		if (!fs.existsSync(configPath)) {
			return undefined;
		}

		const configContent = fs.readFileSync(configPath, 'utf-8');
		const fullConfig = JSON.parse(configContent);

		const snowflakeConfig = fullConfig.snowflake || {};
		const configMode = snowflakeConfig.executionMode;

		if (configMode) {
			const normalizedMode = String(configMode).toLowerCase().trim();
			const validModes: ExecutionMode[] = ['auto', 'rest', 'cli'];

			if (validModes.includes(normalizedMode as ExecutionMode)) {
				if (process.env.DEBUG?.includes('snowflake:config')) {
					console.log(
						`[DEBUG snowflake:config] Execution mode from config.json: ${normalizedMode}`
					);
				}
				return normalizedMode as ExecutionMode;
			}
		}
	} catch (error) {
		if (process.env.DEBUG?.includes('snowflake:config')) {
			console.error(
				'[DEBUG snowflake:config] Error reading execution mode from config:',
				error
			);
		}
	}

	return undefined;
}

/**
 * Get the enableMcpServers setting from environment or config
 *
 * When false, adds --no-mcp flag to disable Model Context Protocol servers in Cortex Code CLI.
 *
 * Priority:
 * 1. CORTEX_ENABLE_MCP_SERVERS environment variable
 * 2. .taskmaster/config.json snowflake.enableMcpServers
 * 3. Returns true (MCP enabled by default)
 */
export function getEnableMcpServers(): boolean {
	// Check environment variable first (highest priority)
	const envValue = process.env.CORTEX_ENABLE_MCP_SERVERS;

	if (envValue !== undefined) {
		const enabled = envValue.toLowerCase() !== 'false' && envValue !== '0';
		if (process.env.DEBUG?.includes('snowflake:config') && !enabled) {
			console.log(
				'[DEBUG snowflake:config] MCP servers disabled from env (--no-mcp will be used)'
			);
		}
		return enabled;
	}

	// Check config file
	try {
		const fs = require('fs');
		const path = require('path');

		const projectRoot = findProjectRoot();
		if (!projectRoot) {
			return true; // Default: MCP enabled
		}

		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');

		if (!fs.existsSync(configPath)) {
			return true; // Default: MCP enabled
		}

		const configContent = fs.readFileSync(configPath, 'utf-8');
		const fullConfig = JSON.parse(configContent);

		const snowflakeConfig = fullConfig.snowflake || {};

		// enableMcpServers defaults to true
		if (snowflakeConfig.enableMcpServers === false) {
			if (process.env.DEBUG?.includes('snowflake:config')) {
				console.log(
					'[DEBUG snowflake:config] MCP servers disabled from config.json (--no-mcp will be used)'
				);
			}
			return false;
		}

		return true;
	} catch {
		return true; // Default: MCP enabled
	}
}

/**
 * Get the dangerouslyAllowAllToolCalls setting from environment or config
 *
 * [DANGEROUS] This disables all safety checks for bash and SQL commands in Cortex Code CLI.
 * Only use in trusted, automated environments.
 *
 * Priority:
 * 1. CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS environment variable
 * 2. .taskmaster/config.json snowflake.dangerouslyAllowAllToolCalls
 * 3. Returns false (safe default)
 */
export function getDangerouslyAllowAllToolCalls(): boolean {
	// Check environment variable first (highest priority)
	const envValue = process.env.CORTEX_DANGEROUSLY_ALLOW_ALL_TOOL_CALLS;

	if (envValue !== undefined) {
		const enabled = envValue.toLowerCase() === 'true' || envValue === '1';
		if (process.env.DEBUG?.includes('snowflake:config') && enabled) {
			console.log(
				'[DEBUG snowflake:config] dangerouslyAllowAllToolCalls enabled from env'
			);
		}
		return enabled;
	}

	// Check config file
	try {
		const fs = require('fs');
		const path = require('path');

		const projectRoot = findProjectRoot();
		if (!projectRoot) {
			return false;
		}

		const configPath = path.join(projectRoot, '.taskmaster', 'config.json');

		if (!fs.existsSync(configPath)) {
			return false;
		}

		const configContent = fs.readFileSync(configPath, 'utf-8');
		const fullConfig = JSON.parse(configContent);

		const snowflakeConfig = fullConfig.snowflake || {};
		const enabled = snowflakeConfig.dangerouslyAllowAllToolCalls === true;

		if (process.env.DEBUG?.includes('snowflake:config') && enabled) {
			console.log(
				'[DEBUG snowflake:config] dangerouslyAllowAllToolCalls enabled from config.json'
			);
		}

		return enabled;
	} catch {
		return false;
	}
}

// Export defaults for testing
export { DEFAULT_FEATURES, DEFAULT_THINKING, DEFAULT_USER_CONFIG };
