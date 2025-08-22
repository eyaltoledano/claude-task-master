/**
 * @fileoverview Zod validation schema for IConfiguration interface
 * This file provides the main schema export for configuration validation
 */

export {
	configurationSchema,
	partialConfigurationSchema,
	modelConfigSchema,
	providerConfigSchema,
	taskSettingsSchema,
	tagSettingsSchema,
	storageSettingsSchema,
	retrySettingsSchema,
	loggingSettingsSchema,
	loggingConfigSchema, // Legacy alias
	cacheConfigSchema,
	securitySettingsSchema,
	taskPrioritySchema,
	taskComplexitySchema,
	logLevelSchema,
	storageTypeSchema,
	tagNamingConventionSchema,
	bufferEncodingSchema,
	type ConfigurationSchema,
	type PartialConfigurationSchema
} from './validation.js';

// Re-export the main schema as the default export for convenience
export { configurationSchema as default } from './validation.js';
