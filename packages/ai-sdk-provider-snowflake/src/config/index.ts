/**
 * Configuration module exports
 */

export {
	// Environment variable utilities
	ENV_VARS,
	getEnvVar,
	// Project root
	getProjectRoot,
	// Config loading
	loadUserConfig,
	clearConfigCache,
	// Feature checks
	isFeatureEnabled,
	getThinkingLevel,
	getResolvedConfig,
	// Execution settings
	getExecutionMode,
	getEnableMcpServers,
	getDangerouslyAllowAllToolCalls,
	// Defaults
	DEFAULT_FEATURES,
	DEFAULT_THINKING,
	DEFAULT_USER_CONFIG
} from './config.js';
