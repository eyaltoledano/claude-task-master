/**
 * @fileoverview Zod schemas for configuration validation
 * Provides runtime validation for all configuration types
 */

import { z } from 'zod';
import type { TaskComplexity, TaskPriority, StorageType } from '../types/index.js';

/**
 * Model configuration schema
 */
export const modelConfigSchema = z.object({
	main: z.string().min(1, 'Main model must be specified'),
	research: z.string().optional(),
	fallback: z.string().min(1, 'Fallback model must be specified')
});

/**
 * Provider configuration schema
 */
export const providerConfigSchema = z.object({
	name: z.string().min(1, 'Provider name is required'),
	apiKey: z.string().optional(),
	baseUrl: z.string().url().optional(),
	options: z.record(z.unknown()).optional(),
	enabled: z.boolean().optional().default(true)
});

/**
 * Task settings schema
 */
export const taskSettingsSchema = z.object({
	defaultPriority: z.enum(['low', 'medium', 'high', 'critical'] as const),
	defaultComplexity: z.enum([
		'trivial',
		'simple',
		'moderate',
		'complex',
		'very-complex'
	] as const),
	maxSubtasks: z.number().int().min(1).max(100),
	maxConcurrentTasks: z.number().int().min(1).max(50),
	autoGenerateIds: z.boolean(),
	taskIdPrefix: z.string().optional(),
	validateDependencies: z.boolean(),
	enableTimestamps: z.boolean(),
	enableEffortTracking: z.boolean()
});

/**
 * Tag settings schema
 */
export const tagSettingsSchema = z.object({
	enableTags: z.boolean(),
	defaultTag: z.string().min(1),
	maxTagsPerTask: z.number().int().min(1).max(50),
	autoCreateFromBranch: z.boolean(),
	tagNamingConvention: z.enum(['kebab-case', 'camelCase', 'snake_case'])
});

/**
 * Workflow/autopilot configuration schema
 */
export const workflowSettingsSchema = z.object({
	/** Enable autopilot/TDD workflow features */
	enableAutopilot: z.boolean().default(true),

	/** Maximum retry attempts for phase validation */
	maxPhaseAttempts: z.number().int().min(1).max(10).default(3),

	/** Branch naming pattern for workflow branches */
	branchPattern: z.string().default('task-{taskId}'),

	/** Require clean working tree before starting workflow */
	requireCleanWorkingTree: z.boolean().default(true),

	/** Automatically stage all changes during commit phase */
	autoStageChanges: z.boolean().default(true),

	/** Include co-author attribution in commits */
	includeCoAuthor: z.boolean().default(true),

	/** Co-author name for commit messages */
	coAuthorName: z.string().default('TaskMaster AI'),

	/** Co-author email for commit messages */
	coAuthorEmail: z.string().email().default('taskmaster@example.com'),

	/** Test result thresholds for phase validation */
	testThresholds: z
		.object({
			/** Minimum test count for valid RED phase */
			minTests: z.number().int().min(1).default(1),
			/** Maximum allowed failing tests in GREEN phase */
			maxFailuresInGreen: z.number().int().min(0).default(0)
		})
		.default({}),

	/** Commit message template pattern */
	commitMessageTemplate: z
		.string()
		.default('{type}({scope}): {description} (Task {taskId}.{subtaskIndex})'),

	/** Conventional commit types allowed */
	allowedCommitTypes: z
		.array(z.string())
		.default(['feat', 'fix', 'refactor', 'test', 'docs', 'chore']),

	/** Default commit type for autopilot */
	defaultCommitType: z.string().default('feat'),

	/** Timeout for workflow operations in milliseconds */
	operationTimeout: z.number().int().min(1000).max(300000).default(60000),

	/** Enable activity logging for workflow events */
	enableActivityLogging: z.boolean().default(true),

	/** Path to store workflow activity logs */
	activityLogPath: z.string().default('.taskmaster/logs/workflow-activity.log'),

	/** Enable automatic backup of workflow state */
	enableStateBackup: z.boolean().default(true),

	/** Maximum workflow state backups to retain */
	maxStateBackups: z.number().int().min(1).max(20).default(5),

	/** Abort workflow if validation fails after max attempts */
	abortOnMaxAttempts: z.boolean().default(false)
});

/**
 * Storage settings schema
 */
export const storageSettingsSchema = z.object({
	type: z.enum(['auto', 'file', 'api'] as const),
	basePath: z.string().optional(),
	apiEndpoint: z.string().url().optional(),
	apiAccessToken: z.string().optional(),
	enableBackup: z.boolean(),
	maxBackups: z.number().int().min(0).max(100),
	enableCompression: z.boolean(),
	encoding: z.string(),
	atomicOperations: z.boolean()
});

/**
 * Retry settings schema
 */
export const retrySettingsSchema = z.object({
	retryAttempts: z.number().int().min(0).max(10),
	retryDelay: z.number().int().min(0).max(10000),
	maxRetryDelay: z.number().int().min(0).max(60000),
	backoffMultiplier: z.number().min(1).max(10),
	requestTimeout: z.number().int().min(1000).max(300000),
	retryOnNetworkError: z.boolean(),
	retryOnRateLimit: z.boolean()
});

/**
 * Logging settings schema
 */
export const loggingSettingsSchema = z.object({
	enabled: z.boolean(),
	level: z.enum(['error', 'warn', 'info', 'debug']),
	filePath: z.string().optional(),
	logRequests: z.boolean(),
	logPerformance: z.boolean(),
	logStackTraces: z.boolean(),
	maxFileSize: z.number().int().min(1).max(1000),
	maxFiles: z.number().int().min(1).max(100)
});

/**
 * Security settings schema
 */
export const securitySettingsSchema = z.object({
	validateApiKeys: z.boolean(),
	enableRateLimit: z.boolean(),
	maxRequestsPerMinute: z.number().int().min(1).max(1000),
	sanitizeInputs: z.boolean(),
	maxPromptLength: z.number().int().min(1000).max(1000000),
	allowedFileExtensions: z.array(z.string()),
	enableCors: z.boolean()
});

/**
 * Main configuration schema
 */
export const configurationSchema = z.object({
	projectPath: z.string().min(1, 'Project path is required'),
	aiProvider: z.string().min(1, 'AI provider is required'),
	apiKeys: z.record(z.string()),
	models: modelConfigSchema,
	providers: z.record(providerConfigSchema),
	tasks: taskSettingsSchema,
	tags: tagSettingsSchema,
	workflow: workflowSettingsSchema,
	storage: storageSettingsSchema,
	retry: retrySettingsSchema,
	logging: loggingSettingsSchema,
	security: securitySettingsSchema,
	custom: z.record(z.unknown()).optional(),
	version: z.string(),
	lastUpdated: z.string()
});

/**
 * Partial configuration schema for updates
 */
export const partialConfigurationSchema = configurationSchema.partial();

/**
 * Environment configuration schema
 */
export const environmentConfigSchema = z.object({
	variables: z.record(z.string()),
	prefix: z.string().default('TM_'),
	override: z.boolean().default(false)
});

/**
 * Configuration validation result schema
 */
export const configValidationResultSchema = z.object({
	isValid: z.boolean(),
	errors: z.array(z.string()),
	warnings: z.array(z.string()),
	suggestions: z.array(z.string()).optional()
});

/**
 * Type exports inferred from schemas
 */
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type TaskSettings = z.infer<typeof taskSettingsSchema>;
export type TagSettings = z.infer<typeof tagSettingsSchema>;
export type WorkflowSettings = z.infer<typeof workflowSettingsSchema>;
export type StorageSettings = z.infer<typeof storageSettingsSchema>;
export type RetrySettings = z.infer<typeof retrySettingsSchema>;
export type LoggingSettings = z.infer<typeof loggingSettingsSchema>;
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
export type PartialConfiguration = z.infer<typeof partialConfigurationSchema>;
export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;
export type ConfigValidationResult = z.infer<
	typeof configValidationResultSchema
>;

/**
 * Validate configuration against schema
 * @param config - Configuration to validate
 * @returns Validation result with detailed errors
 */
export function validateConfiguration(
	config: unknown
): ConfigValidationResult {
	const result = configurationSchema.safeParse(config);

	if (result.success) {
		return {
			isValid: true,
			errors: [],
			warnings: []
		};
	}

	// Handle Zod v4 error format
	const errors: string[] = [];
	if (result.error && typeof result.error.format === 'function') {
		const formatted = result.error.format();
		errors.push(JSON.stringify(formatted, null, 2));
	} else if (result.error && result.error.errors) {
		result.error.errors.forEach((err: any) => {
			const path = err.path ? err.path.join('.') : 'unknown';
			errors.push(`${path}: ${err.message || 'Validation error'}`);
		});
	} else {
		errors.push('Configuration validation failed');
	}

	return {
		isValid: false,
		errors,
		warnings: []
	};
}

/**
 * Validate partial configuration for updates
 * @param config - Partial configuration to validate
 * @returns Validation result
 */
export function validatePartialConfiguration(
	config: unknown
): ConfigValidationResult {
	const result = partialConfigurationSchema.safeParse(config);

	if (result.success) {
		return {
			isValid: true,
			errors: [],
			warnings: []
		};
	}

	// Handle Zod v4 error format
	const errors: string[] = [];
	if (result.error && typeof result.error.format === 'function') {
		const formatted = result.error.format();
		errors.push(JSON.stringify(formatted, null, 2));
	} else if (result.error && result.error.errors) {
		result.error.errors.forEach((err: any) => {
			const path = err.path ? err.path.join('.') : 'unknown';
			errors.push(`${path}: ${err.message || 'Validation error'}`);
		});
	} else {
		errors.push('Configuration validation failed');
	}

	return {
		isValid: false,
		errors,
		warnings: []
	};
}
