/**
 * @fileoverview Configuration interface definitions for the tm-core package
 * This file defines the contract for configuration management
 */

import type { TaskComplexity, TaskPriority } from '../types/index';

/**
 * Model configuration for different AI roles
 */
export interface ModelConfig {
	/** Primary model for task generation and updates */
	main: string;
	/** Research model for enhanced task analysis (optional) */
	research?: string;
	/** Fallback model when primary fails */
	fallback: string;
}

/**
 * AI provider configuration
 */
export interface ProviderConfig {
	/** Provider name (e.g., 'anthropic', 'openai', 'perplexity') */
	name: string;
	/** API key for the provider */
	apiKey?: string;
	/** Base URL override */
	baseUrl?: string;
	/** Custom configuration options */
	options?: Record<string, unknown>;
	/** Whether this provider is enabled */
	enabled?: boolean;
}

/**
 * Task generation and management settings
 */
export interface TaskSettings {
	/** Default priority for new tasks */
	defaultPriority: TaskPriority;
	/** Default complexity for analysis */
	defaultComplexity: TaskComplexity;
	/** Maximum number of subtasks per task */
	maxSubtasks: number;
	/** Maximum number of concurrent tasks */
	maxConcurrentTasks: number;
	/** Enable automatic task ID generation */
	autoGenerateIds: boolean;
	/** Task ID prefix (e.g., 'TASK-', 'TM-') */
	taskIdPrefix?: string;
	/** Enable task dependency validation */
	validateDependencies: boolean;
	/** Enable automatic timestamps */
	enableTimestamps: boolean;
	/** Enable effort tracking */
	enableEffortTracking: boolean;
}

/**
 * Tag and context management settings
 */
export interface TagSettings {
	/** Enable tag-based task organization */
	enableTags: boolean;
	/** Default tag for new tasks */
	defaultTag: string;
	/** Maximum number of tags per task */
	maxTagsPerTask: number;
	/** Enable automatic tag creation from Git branches */
	autoCreateFromBranch: boolean;
	/** Tag naming convention (kebab-case, camelCase, snake_case) */
	tagNamingConvention: 'kebab-case' | 'camelCase' | 'snake_case';
}

/**
 * Storage and persistence settings
 */
export interface StorageSettings {
	/** Storage backend type - 'auto' detects based on auth status */
	type: 'file' | 'api' | 'auto';
	/** Base path for file storage */
	basePath?: string;
	/** API endpoint for API storage (Hamster integration) */
	apiEndpoint?: string;
	/** Access token for API authentication */
	apiAccessToken?: string;
	/** Indicates whether API is configured (has endpoint or token) */
	apiConfigured?: boolean;
	/** Enable automatic backups */
	enableBackup: boolean;
	/** Maximum number of backups to retain */
	maxBackups: number;
	/** Enable compression for storage */
	enableCompression: boolean;
	/** File encoding for text files */
	encoding: BufferEncoding;
	/** Enable atomic file operations */
	atomicOperations: boolean;
}

/**
 * Retry and resilience settings
 */
export interface RetrySettings {
	/** Number of retry attempts for failed operations */
	retryAttempts: number;
	/** Base delay between retries in milliseconds */
	retryDelay: number;
	/** Maximum delay between retries in milliseconds */
	maxRetryDelay: number;
	/** Exponential backoff multiplier */
	backoffMultiplier: number;
	/** Request timeout in milliseconds */
	requestTimeout: number;
	/** Enable retry for network errors */
	retryOnNetworkError: boolean;
	/** Enable retry for rate limit errors */
	retryOnRateLimit: boolean;
}

/**
 * Logging and debugging settings
 */
export interface LoggingSettings {
	/** Enable logging */
	enabled: boolean;
	/** Log level (error, warn, info, debug) */
	level: 'error' | 'warn' | 'info' | 'debug';
	/** Log file path (optional) */
	filePath?: string;
	/** Enable request/response logging */
	logRequests: boolean;
	/** Enable performance metrics logging */
	logPerformance: boolean;
	/** Enable error stack traces */
	logStackTraces: boolean;
	/** Maximum log file size in MB */
	maxFileSize: number;
	/** Maximum number of log files to retain */
	maxFiles: number;
}

/**
 * Security and validation settings
 */
export interface SecuritySettings {
	/** Enable API key validation */
	validateApiKeys: boolean;
	/** Enable request rate limiting */
	enableRateLimit: boolean;
	/** Maximum requests per minute */
	maxRequestsPerMinute: number;
	/** Enable input sanitization */
	sanitizeInputs: boolean;
	/** Maximum prompt length in characters */
	maxPromptLength: number;
	/** Allowed file extensions for imports */
	allowedFileExtensions: string[];
	/** Enable CORS protection */
	enableCors: boolean;
}

/**
 * Main configuration interface for Task Master core
 */
export interface IConfiguration {
	/** Project root path */
	projectPath: string;

	/** Current AI provider name */
	aiProvider: string;

	/** API keys for different providers */
	apiKeys: Record<string, string>;

	/** Model configuration for different roles */
	models: ModelConfig;

	/** Provider configurations */
	providers: Record<string, ProviderConfig>;

	/** Task management settings */
	tasks: TaskSettings;

	/** Tag and context settings */
	tags: TagSettings;

	/** Storage configuration */
	storage: StorageSettings;

	/** Retry and resilience settings */
	retry: RetrySettings;

	/** Logging configuration */
	logging: LoggingSettings;

	/** Security settings */
	security: SecuritySettings;

	/** Custom user-defined settings */
	custom?: Record<string, unknown>;

	/** Configuration version for migration purposes */
	version: string;

	/** Last updated timestamp */
	lastUpdated: string;
}

/**
 * Partial configuration for updates (all fields optional)
 */
export type PartialConfiguration = Partial<IConfiguration>;

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
	/** Whether the configuration is valid */
	isValid: boolean;
	/** Array of error messages */
	errors: string[];
	/** Array of warning messages */
	warnings: string[];
	/** Suggested fixes */
	suggestions?: string[];
}

/**
 * Environment variable configuration mapping
 */
export interface EnvironmentConfig {
	/** Mapping of environment variables to config paths */
	variables: Record<string, string>;
	/** Prefix for environment variables */
	prefix: string;
	/** Whether to override existing config with env vars */
	override: boolean;
}

/**
 * Configuration schema definition for validation
 */
export interface ConfigSchema {
	/** Schema for the main configuration */
	properties: Record<string, ConfigProperty>;
	/** Required properties */
	required: string[];
	/** Additional properties allowed */
	additionalProperties: boolean;
}

/**
 * Configuration property schema
 */
export interface ConfigProperty {
	/** Property type */
	type: 'string' | 'number' | 'boolean' | 'object' | 'array';
	/** Property description */
	description?: string;
	/** Default value */
	default?: unknown;
	/** Allowed values for enums */
	enum?: unknown[];
	/** Minimum value (for numbers) */
	minimum?: number;
	/** Maximum value (for numbers) */
	maximum?: number;
	/** Pattern for string validation */
	pattern?: string;
	/** Nested properties (for objects) */
	properties?: Record<string, ConfigProperty>;
	/** Array item type (for arrays) */
	items?: ConfigProperty;
	/** Whether the property is required */
	required?: boolean;
}

/**
 * Default configuration factory
 */
export interface IConfigurationFactory {
	/**
	 * Create a default configuration
	 * @param projectPath - Project root path
	 * @returns Default configuration object
	 */
	createDefault(projectPath: string): IConfiguration;

	/**
	 * Merge configurations with precedence
	 * @param base - Base configuration
	 * @param override - Override configuration
	 * @returns Merged configuration
	 */
	merge(base: IConfiguration, override: PartialConfiguration): IConfiguration;

	/**
	 * Validate configuration against schema
	 * @param config - Configuration to validate
	 * @returns Validation result
	 */
	validate(config: IConfiguration): ConfigValidationResult;

	/**
	 * Load configuration from environment variables
	 * @param envConfig - Environment variable mapping
	 * @returns Partial configuration from environment
	 */
	loadFromEnvironment(envConfig: EnvironmentConfig): PartialConfiguration;

	/**
	 * Get configuration schema
	 * @returns Configuration schema definition
	 */
	getSchema(): ConfigSchema;
}

/**
 * Configuration manager interface
 */
export interface IConfigurationManager {
	/**
	 * Load configuration from file or create default
	 * @param configPath - Path to configuration file
	 * @returns Promise that resolves to configuration
	 */
	load(configPath?: string): Promise<IConfiguration>;

	/**
	 * Save configuration to file
	 * @param config - Configuration to save
	 * @param configPath - Optional path override
	 * @returns Promise that resolves when save is complete
	 */
	save(config: IConfiguration, configPath?: string): Promise<void>;

	/**
	 * Update configuration with partial changes
	 * @param updates - Partial configuration updates
	 * @returns Promise that resolves to updated configuration
	 */
	update(updates: PartialConfiguration): Promise<IConfiguration>;

	/**
	 * Get current configuration
	 * @returns Current configuration object
	 */
	getConfig(): IConfiguration;

	/**
	 * Watch for configuration changes
	 * @param callback - Function to call when config changes
	 * @returns Function to stop watching
	 */
	watch(callback: (config: IConfiguration) => void): () => void;

	/**
	 * Validate current configuration
	 * @returns Validation result
	 */
	validate(): ConfigValidationResult;

	/**
	 * Reset configuration to defaults
	 * @returns Promise that resolves when reset is complete
	 */
	reset(): Promise<void>;
}

/**
 * Constants for default configuration values
 */
export const DEFAULT_CONFIG_VALUES = {
	MODELS: {
		MAIN: 'claude-3-5-sonnet-20241022',
		FALLBACK: 'gpt-4o-mini'
	},
	TASKS: {
		DEFAULT_PRIORITY: 'medium' as TaskPriority,
		DEFAULT_COMPLEXITY: 'moderate' as TaskComplexity,
		MAX_SUBTASKS: 20,
		MAX_CONCURRENT: 5,
		TASK_ID_PREFIX: 'TASK-'
	},
	TAGS: {
		DEFAULT_TAG: 'master',
		MAX_TAGS_PER_TASK: 10,
		NAMING_CONVENTION: 'kebab-case' as const
	},
	STORAGE: {
		TYPE: 'auto' as const,
		ENCODING: 'utf8' as BufferEncoding,
		MAX_BACKUPS: 5
	},
	RETRY: {
		ATTEMPTS: 3,
		DELAY: 1000,
		MAX_DELAY: 30000,
		BACKOFF_MULTIPLIER: 2,
		TIMEOUT: 30000
	},
	LOGGING: {
		LEVEL: 'info' as const,
		MAX_FILE_SIZE: 10,
		MAX_FILES: 5
	},
	SECURITY: {
		MAX_REQUESTS_PER_MINUTE: 60,
		MAX_PROMPT_LENGTH: 100000,
		ALLOWED_EXTENSIONS: ['.txt', '.md', '.json']
	},
	VERSION: '1.0.0'
} as const;
