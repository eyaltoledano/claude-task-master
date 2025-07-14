/**
 * Task Master Flow - Effect Configuration
 * Phase 0: Foundation & Setup
 *
 * Configuration constants and utilities for Effect integration.
 */

import { Config } from 'effect';

/**
 * Modern Effect Configuration using Effect's Config system
 *
 * Type-safe configuration with environment variable support
 * following current Effect ecosystem best practices.
 */
export const FlowConfig = Config.all({
	// Phase 0 configurations
	enabled: Config.boolean('FLOW_EFFECT_ENABLED').pipe(Config.withDefault(true)),

	logLevel: Config.string('FLOW_EFFECT_LOG_LEVEL').pipe(
		Config.withDefault('Info')
	),

	// Runtime configurations
	maxConcurrentEffects: Config.number('FLOW_MAX_CONCURRENT').pipe(
		Config.withDefault(10)
	),

	defaultTimeout: Config.number('FLOW_DEFAULT_TIMEOUT').pipe(
		Config.withDefault(30000)
	),

	// Storage configuration
	storageBasePath: Config.string('FLOW_STORAGE_PATH').pipe(
		Config.withDefault('.taskmaster/flow')
	)
});

// Simplified configuration for Phase 0 - will be enhanced in later phases

/**
 * Phase 0 specific configuration constants
 */
export const PHASE_0_CONFIG = {
	// Module information
	moduleName: 'task-master-flow-effect',
	version: '0.1.0',
	phase: 'Foundation & Setup',

	// Feature flags
	features: {
		healthCheck: true,
		basicRuntime: true,
		configSystem: true
	},

	// Environment variable prefixes
	envPrefix: 'FLOW_EFFECT_',

	// Default paths
	paths: {
		effect: 'scripts/modules/flow/effect',
		storage: '.taskmaster/flow',
		logs: '.taskmaster/flow/logs',
		cache: '.taskmaster/flow/cache'
	},

	// Runtime limits
	limits: {
		maxConcurrentEffects: 10,
		defaultTimeout: 30000,
		maxRetries: 3
	}
};

/**
 * Validate Effect configuration
 *
 * @param {object} config - Configuration object to validate
 * @returns {boolean} True if configuration is valid
 */
export const validateEffectConfig = (config) => {
	const required = ['enabled', 'logLevel'];
	return required.every((key) => key in config);
};

/**
 * Get default configuration for testing
 *
 * @returns {object} Default configuration object
 */
export const getDefaultConfig = () => ({
	enabled: true,
	logLevel: 'Info',
	defaultProvider: 'mock',
	defaultAgent: 'mock',
	telemetryEnabled: false,
	storageBasePath: '.taskmaster/flow',
	executionTimeout: 300000,
	streamingEnabled: false,
	streamingBufferSize: 1024
});
