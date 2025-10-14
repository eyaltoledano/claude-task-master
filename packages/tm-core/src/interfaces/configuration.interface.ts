/**
 * @fileoverview Configuration interface definitions for the tm-core package
 * This file defines the contract for configuration management
 */

import type {
	TaskComplexity,
	TaskPriority,
	StorageType
} from '../types/index.js';

/**
 * Conventional Commit types allowed in workflow
 */
export type CommitType =
	| 'feat'
	| 'fix'
	| 'refactor'
	| 'test'
	| 'docs'
	| 'chore';

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
	/**
	 * Maximum number of subtasks per task
	 * @minimum 1
	 */
	maxSubtasks: number;
	/**
	 * Maximum number of concurrent tasks
	 * @minimum 1
	 */
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
	/**
	 * Maximum number of tags per task
	 * @minimum 1
	 */
	maxTagsPerTask: number;
	/** Enable automatic tag creation from Git branches */
	autoCreateFromBranch: boolean;
	/** Tag naming convention (kebab-case, camelCase, snake_case) */
	tagNamingConvention: 'kebab-case' | 'camelCase' | 'snake_case';
}

/**
 * Runtime storage configuration used for storage backend selection
 * This is what getStorageConfig() returns and what StorageFactory expects
 */
export interface RuntimeStorageConfig {
	/** Storage backend type */
	type: StorageType;
	/** Base path for file storage (if configured) */
	basePath?: string;
	/** API endpoint for API storage (Hamster integration) */
	apiEndpoint?: string;
	/** Access token for API authentication */
	apiAccessToken?: string;
	/**
	 * Indicates whether API is configured (has endpoint or token)
	 * @computed Derived automatically from presence of apiEndpoint or apiAccessToken
	 * @internal Should not be set manually - computed by ConfigManager
	 */
	readonly apiConfigured: boolean;
}

/**
 * Storage and persistence settings
 * Extended storage settings including file operation preferences
 */
export interface StorageSettings
	extends Omit<RuntimeStorageConfig, 'apiConfigured'> {
	/** Base path for file storage */
	basePath?: string;
	/**
	 * Indicates whether API is configured
	 * @computed Derived automatically from presence of apiEndpoint or apiAccessToken
	 * @internal Should not be set manually in user config - computed by ConfigManager
	 */
	readonly apiConfigured?: boolean;
	/** Enable automatic backups */
	enableBackup: boolean;
	/**
	 * Maximum number of backups to retain
	 * @minimum 0
	 */
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
	/**
	 * Number of retry attempts for failed operations
	 * @minimum 0
	 */
	retryAttempts: number;
	/**
	 * Base delay between retries in milliseconds
	 * @minimum 0
	 */
	retryDelay: number;
	/**
	 * Maximum delay between retries in milliseconds
	 * @minimum 0
	 */
	maxRetryDelay: number;
	/**
	 * Exponential backoff multiplier
	 * @minimum 1
	 */
	backoffMultiplier: number;
	/**
	 * Request timeout in milliseconds
	 * @minimum 0
	 */
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
	/**
	 * Maximum log file size in MB
	 * @minimum 1
	 */
	maxFileSize: number;
	/**
	 * Maximum number of log files to retain
	 * @minimum 1
	 */
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
	/**
	 * Maximum requests per minute
	 * @minimum 1
	 */
	maxRequestsPerMinute: number;
	/** Enable input sanitization */
	sanitizeInputs: boolean;
	/**
	 * Maximum prompt length in characters
	 * @minimum 1
	 */
	maxPromptLength: number;
	/** Allowed file extensions for imports */
	allowedFileExtensions: string[];
	/** Enable CORS protection */
	enableCors: boolean;
}

/**
 * Workflow and autopilot TDD settings
 */
export interface WorkflowSettings {
	/** Enable autopilot/TDD workflow features */
	enableAutopilot: boolean;
	/**
	 * Maximum retry attempts for phase validation
	 * @minimum 1
	 * @maximum 10
	 */
	maxPhaseAttempts: number;
	/** Branch naming pattern for workflow branches */
	branchPattern: string;
	/** Require clean working tree before starting workflow */
	requireCleanWorkingTree: boolean;
	/** Automatically stage all changes during commit phase */
	autoStageChanges: boolean;
	/** Include co-author attribution in commits */
	includeCoAuthor: boolean;
	/** Co-author name for commit messages */
	coAuthorName: string;
	/** Co-author email for commit messages (defaults to taskmaster@tryhamster.com) */
	coAuthorEmail: string;
	/** Test result thresholds for phase validation */
	testThresholds: {
		/**
		 * Minimum test count for valid RED phase
		 * @minimum 0
		 */
		minTests: number;
		/**
		 * Maximum allowed failing tests in GREEN phase
		 * @minimum 0
		 */
		maxFailuresInGreen: number;
	};
	/** Commit message template pattern */
	commitMessageTemplate: string;
	/** Conventional commit types allowed */
	allowedCommitTypes: readonly CommitType[];
	/**
	 * Default commit type for autopilot
	 * @validation Must be present in allowedCommitTypes array
	 */
	defaultCommitType: CommitType;
	/**
	 * Timeout for workflow operations in milliseconds
	 * @minimum 0
	 */
	operationTimeout: number;
	/** Enable activity logging for workflow events */
	enableActivityLogging: boolean;
	/** Path to store workflow activity logs */
	activityLogPath: string;
	/** Enable automatic backup of workflow state */
	enableStateBackup: boolean;
	/**
	 * Maximum workflow state backups to retain
	 * @minimum 0
	 */
	maxStateBackups: number;
	/** Abort workflow if validation fails after max attempts */
	abortOnMaxAttempts: boolean;
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

	/** Workflow and autopilot settings */
	workflow: WorkflowSettings;

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
		MAIN: 'claude-sonnet-4-20250514',
		FALLBACK: 'claude-3-7-sonnet-20250219'
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
	WORKFLOW: {
		ENABLE_AUTOPILOT: true,
		MAX_PHASE_ATTEMPTS: 3,
		BRANCH_PATTERN: 'task-{taskId}',
		REQUIRE_CLEAN_WORKING_TREE: true,
		AUTO_STAGE_CHANGES: true,
		INCLUDE_CO_AUTHOR: true,
		CO_AUTHOR_NAME: 'TaskMaster AI',
		CO_AUTHOR_EMAIL: 'taskmaster@tryhamster.com',
		MIN_TESTS: 1,
		MAX_FAILURES_IN_GREEN: 0,
		COMMIT_MESSAGE_TEMPLATE:
			'{type}({scope}): {description} (Task {taskId}.{subtaskIndex})',
		ALLOWED_COMMIT_TYPES: [
			'feat',
			'fix',
			'refactor',
			'test',
			'docs',
			'chore'
		] as const satisfies readonly CommitType[],
		DEFAULT_COMMIT_TYPE: 'feat' as CommitType,
		OPERATION_TIMEOUT: 60000,
		ENABLE_ACTIVITY_LOGGING: true,
		ACTIVITY_LOG_PATH: '.taskmaster/logs/workflow-activity.log',
		ENABLE_STATE_BACKUP: true,
		MAX_STATE_BACKUPS: 5,
		ABORT_ON_MAX_ATTEMPTS: false
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
