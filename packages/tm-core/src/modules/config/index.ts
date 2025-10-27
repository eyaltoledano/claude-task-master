/**
 * @fileoverview Configuration module exports
 * Exports the main ConfigManager and all configuration services
 */

// Export the main ConfigManager
export { ConfigManager } from './managers/config-manager.js';

// Export all configuration services for advanced usage
export {
	ConfigLoader,
	ConfigMerger,
	CONFIG_PRECEDENCE,
	RuntimeStateManager,
	ConfigPersistence,
	EnvironmentConfigProvider,
	type ConfigSource,
	type RuntimeState,
	type PersistenceOptions
} from './services/index.js';

// Re-export configuration interfaces
export type {
	IConfiguration,
	PartialConfiguration,
	ModelConfig,
	ProviderConfig,
	TaskSettings,
	TagSettings,
	WorkflowSettings,
	StorageSettings,
	RetrySettings,
	LoggingSettings,
	SecuritySettings,
	ConfigValidationResult,
	EnvironmentConfig,
	ConfigSchema,
	ConfigProperty,
	IConfigurationFactory,
	IConfigurationManager
} from '../../common/interfaces/configuration.interface.js';

// Re-export default values
export { DEFAULT_CONFIG_VALUES } from '../../common/interfaces/configuration.interface.js';
