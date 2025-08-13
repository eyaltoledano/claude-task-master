/**
 * @fileoverview Zod validation schemas for configuration interfaces
 */

import { z } from 'zod';
import { TaskPriority, TaskComplexity } from '../types/index.js';

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Task priority validation schema
 */
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Task complexity validation schema
 */
export const taskComplexitySchema = z.enum([
	'simple',
	'moderate',
	'complex',
	'very-complex'
]);

/**
 * Log level validation schema
 */
export const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);

/**
 * Storage type validation schema
 */
export const storageTypeSchema = z.enum(['file', 'memory', 'database']);

/**
 * Tag naming convention validation schema
 */
export const tagNamingConventionSchema = z.enum([
	'kebab-case',
	'camelCase',
	'snake_case'
]);

/**
 * Buffer encoding validation schema
 */
export const bufferEncodingSchema = z.enum([
	'ascii',
	'utf8',
	'utf-8',
	'utf16le',
	'ucs2',
	'ucs-2',
	'base64',
	'base64url',
	'latin1',
	'binary',
	'hex'
]);

// ============================================================================
// Sub-interface Schemas
// ============================================================================

/**
 * Model configuration validation schema
 */
export const modelConfigSchema = z.object({
	main: z.string().min(1, 'Main model name is required'),
	research: z.string().min(1).optional(),
	fallback: z.string().min(1, 'Fallback model name is required')
});

/**
 * Provider configuration validation schema
 */
export const providerConfigSchema = z.object({
	name: z.string().min(1, 'Provider name is required'),
	apiKey: z.string().optional(),
	baseUrl: z.string().url().optional(),
	options: z.record(z.unknown()).optional(),
	enabled: z.boolean().optional().default(true)
});

/**
 * Task settings validation schema
 */
export const taskSettingsSchema = z.object({
	defaultPriority: taskPrioritySchema,
	defaultComplexity: taskComplexitySchema,
	maxSubtasks: z.number().int().min(1).max(100),
	maxConcurrentTasks: z.number().int().min(1).max(50),
	autoGenerateIds: z.boolean(),
	taskIdPrefix: z.string().optional(),
	validateDependencies: z.boolean(),
	enableTimestamps: z.boolean(),
	enableEffortTracking: z.boolean()
});

/**
 * Tag settings validation schema
 */
export const tagSettingsSchema = z.object({
	enableTags: z.boolean(),
	defaultTag: z.string().min(1),
	maxTagsPerTask: z.number().int().min(1).max(50),
	autoCreateFromBranch: z.boolean(),
	tagNamingConvention: tagNamingConventionSchema
});

/**
 * Storage settings validation schema
 */
export const storageSettingsSchema = z.object({
	type: storageTypeSchema,
	basePath: z.string().optional(),
	enableBackup: z.boolean(),
	maxBackups: z.number().int().min(0).max(100),
	enableCompression: z.boolean(),
	encoding: bufferEncodingSchema,
	atomicOperations: z.boolean()
});

/**
 * Retry settings validation schema
 */
export const retrySettingsSchema = z.object({
	retryAttempts: z.number().int().min(0).max(10),
	retryDelay: z.number().int().min(100).max(60000),
	maxRetryDelay: z.number().int().min(1000).max(300000),
	backoffMultiplier: z.number().min(1).max(10),
	requestTimeout: z.number().int().min(1000).max(600000),
	retryOnNetworkError: z.boolean(),
	retryOnRateLimit: z.boolean()
});

/**
 * Logging settings validation schema
 */
export const loggingSettingsSchema = z.object({
	enabled: z.boolean(),
	level: logLevelSchema,
	filePath: z.string().optional(),
	logRequests: z.boolean(),
	logPerformance: z.boolean(),
	logStackTraces: z.boolean(),
	maxFileSize: z.number().min(1).max(1000),
	maxFiles: z.number().int().min(1).max(100)
});

/**
 * Security settings validation schema
 */
export const securitySettingsSchema = z.object({
	validateApiKeys: z.boolean(),
	enableRateLimit: z.boolean(),
	maxRequestsPerMinute: z.number().int().min(1).max(10000),
	sanitizeInputs: z.boolean(),
	maxPromptLength: z.number().int().min(100).max(1000000),
	allowedFileExtensions: z.array(z.string().regex(/^\.[a-zA-Z0-9]+$/)),
	enableCors: z.boolean()
});

// ============================================================================
// Main Configuration Schema
// ============================================================================

/**
 * Base configuration object schema (without refinements)
 */
const baseConfigurationSchema = z.object({
	projectPath: z.string().min(1, 'Project path is required'),
	aiProvider: z.string().min(1, 'AI provider is required'),
	apiKeys: z.record(z.string()),
	models: modelConfigSchema,
	providers: z.record(providerConfigSchema),
	tasks: taskSettingsSchema,
	tags: tagSettingsSchema,
	storage: storageSettingsSchema,
	retry: retrySettingsSchema,
	logging: loggingSettingsSchema,
	security: securitySettingsSchema,
	custom: z.record(z.unknown()).optional(),
	version: z.string().min(1, 'Version is required'),
	lastUpdated: z.string().min(1, 'Last updated timestamp is required')
});

/**
 * Main configuration validation schema with custom refinements
 */
export const configurationSchema = baseConfigurationSchema.refine(
	(data) => {
		// Custom validation: maxRetryDelay should be >= retryDelay
		return data.retry.maxRetryDelay >= data.retry.retryDelay;
	},
	{
		message: 'maxRetryDelay must be greater than or equal to retryDelay',
		path: ['retry', 'maxRetryDelay']
	}
);

/**
 * Partial configuration validation schema for updates
 */
export const partialConfigurationSchema = baseConfigurationSchema.partial();

// ============================================================================
// Legacy/Alias Exports (for backwards compatibility)
// ============================================================================

/**
 * Alias for loggingSettingsSchema (for backwards compatibility)
 * @deprecated Use loggingSettingsSchema instead
 */
export const loggingConfigSchema = loggingSettingsSchema;

/**
 * Cache configuration validation schema (stub - not implemented in IConfiguration yet)
 * This is exported for consistency with config-schema.ts exports
 */
export const cacheConfigSchema = z
	.object({
		enabled: z.boolean().optional().default(false),
		ttl: z.number().int().min(1).optional().default(300),
		maxSize: z.number().int().min(1).optional().default(1000)
	})
	.optional();

// ============================================================================
// Type exports for runtime validation
// ============================================================================

export type ConfigurationSchema = z.infer<typeof configurationSchema>;
export type PartialConfigurationSchema = z.infer<
	typeof partialConfigurationSchema
>;
