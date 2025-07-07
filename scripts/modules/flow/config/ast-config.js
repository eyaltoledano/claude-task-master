/**
 * Unified AST Configuration Management for Task Master Flow
 * 
 * Combines functionality from:
 * - ast-config.js (simple loading API)
 * - ast-config-manager.js (advanced management)
 * - config-validator.js (validation rules)
 * 
 * Provides both simple and advanced APIs for AST configuration.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SIMPLE API (backward compatible with existing ast-config.js usage)
// ============================================================================

/**
 * Default AST configuration
 */
const DEFAULT_AST_CONFIG = {
	enabled: false,
	cacheMaxAge: '2h',
	cacheMaxSize: '100MB',
	supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
	excludePatterns: [
		'node_modules/**',
		'dist/**',
		'build/**',
		'.git/**',
		'*.min.js'
	],
	contextInclusion: {
		maxFunctions: 10,
		maxComplexityScore: 8,
		includeImports: true,
		includeDependencies: true
	}
};

/**
 * Load AST configuration - now self-contained with sensible defaults
 * BACKWARD COMPATIBLE - used by 11+ AST components
 */
export async function loadASTConfig() {
	try {
		// AST configuration is now self-contained to avoid duplication
		// with flow-config.js which has its own comprehensive configuration
		return {
			success: true,
			config: DEFAULT_AST_CONFIG
		};
	} catch (error) {
		console.warn('Error loading AST config:', error.message);
		return {
			success: true,
			config: DEFAULT_AST_CONFIG
		};
	}
}

/**
 * Validate AST configuration
 */
export function validateASTConfig(config) {
	const errors = [];

	// Check required fields
	if (typeof config.enabled !== 'boolean') {
		errors.push('enabled must be a boolean');
	}

	if (typeof config.cacheMaxAge !== 'string') {
		errors.push('cacheMaxAge must be a string');
	} else {
		// Validate cache age format (e.g., "2h", "30m", "24h")
		const cacheAgePattern = /^\d+[mhd]$/;
		if (!cacheAgePattern.test(config.cacheMaxAge)) {
			errors.push('cacheMaxAge must be in format like "2h", "30m", or "24h"');
		}
	}

	if (typeof config.cacheMaxSize !== 'string') {
		errors.push('cacheMaxSize must be a string');
	} else {
		// Validate cache size format (e.g., "100MB", "1GB")
		const cacheSizePattern = /^\d+(MB|GB)$/;
		if (!cacheSizePattern.test(config.cacheMaxSize)) {
			errors.push('cacheMaxSize must be in format like "100MB" or "1GB"');
		}
	}

	if (!Array.isArray(config.supportedLanguages)) {
		errors.push('supportedLanguages must be an array');
	} else {
		const validLanguages = [
			'javascript',
			'typescript',
			'python',
			'go',
			'rust',
			'java',
			'csharp',
			'php',
			'ruby'
		];
		const invalidLanguages = config.supportedLanguages.filter(
			(lang) => !validLanguages.includes(lang)
		);
		if (invalidLanguages.length > 0) {
			errors.push(
				`Invalid languages: ${invalidLanguages.join(', ')}. Valid languages: ${validLanguages.join(', ')}`
			);
		}
	}

	if (!Array.isArray(config.excludePatterns)) {
		errors.push('excludePatterns must be an array');
	}

	if (!config.contextInclusion || typeof config.contextInclusion !== 'object') {
		errors.push('contextInclusion must be an object');
	} else {
		const ctx = config.contextInclusion;
		if (typeof ctx.maxFunctions !== 'number' || ctx.maxFunctions < 1) {
			errors.push('contextInclusion.maxFunctions must be a positive number');
		}
		if (
			typeof ctx.maxComplexityScore !== 'number' ||
			ctx.maxComplexityScore < 1 ||
			ctx.maxComplexityScore > 10
		) {
			errors.push(
				'contextInclusion.maxComplexityScore must be a number between 1 and 10'
			);
		}
		if (typeof ctx.includeImports !== 'boolean') {
			errors.push('contextInclusion.includeImports must be a boolean');
		}
		if (typeof ctx.includeDependencies !== 'boolean') {
			errors.push('contextInclusion.includeDependencies must be a boolean');
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		config: errors.length === 0 ? config : null
	};
}

/**
 * Parse cache duration string to milliseconds
 */
export function parseCacheDuration(duration) {
	const match = duration.match(/^(\d+)([mhd])$/);
	if (!match) {
		throw new Error(`Invalid duration format: ${duration}`);
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	switch (unit) {
		case 'm':
			return value * 60 * 1000; // minutes to ms
		case 'h':
			return value * 60 * 60 * 1000; // hours to ms
		case 'd':
			return value * 24 * 60 * 60 * 1000; // days to ms
		default:
			throw new Error(`Invalid duration unit: ${unit}`);
	}
}

/**
 * Parse cache size string to bytes
 */
export function parseCacheSize(size) {
	const match = size.match(/^(\d+)(MB|GB)$/);
	if (!match) {
		throw new Error(`Invalid size format: ${size}`);
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	switch (unit) {
		case 'MB':
			return value * 1024 * 1024; // MB to bytes
		case 'GB':
			return value * 1024 * 1024 * 1024; // GB to bytes
		default:
			throw new Error(`Invalid size unit: ${unit}`);
	}
}

/**
 * Check if AST analysis is enabled for a specific language
 */
export function isLanguageSupported(config, language) {
	return config.enabled && config.supportedLanguages.includes(language);
}

/**
 * Get file extensions supported by AST analysis
 */
export function getSupportedExtensions(config) {
	const extensionMap = {
		javascript: ['.js', '.jsx'],
		typescript: ['.ts', '.tsx'],
		python: ['.py'],
		go: ['.go'],
		rust: ['.rs'],
		java: ['.java'],
		csharp: ['.cs'],
		php: ['.php'],
		ruby: ['.rb']
	};

	const extensions = [];
	for (const language of config.supportedLanguages) {
		if (extensionMap[language]) {
			extensions.push(...extensionMap[language]);
		}
	}

	return [...new Set(extensions)]; // Remove duplicates
}

// ============================================================================
// ADVANCED CONFIGURATION MANAGEMENT API (from ast-config-manager.js)
// ============================================================================

/**
 * Advanced AST Configuration Manager
 * Provides full configuration management capabilities for CLI commands
 */
export class ASTConfigManager {
	constructor(options = {}) {
		this.projectRoot = options.projectRoot || process.cwd();
		this.configFile = path.join(
			this.projectRoot,
			'.taskmaster',
			'ast-config.json'
		);
		this.configDir = path.dirname(this.configFile);

		// Configuration state
		this.currentConfig = null;
		this.isLoaded = false;
		this.validationErrors = [];
		this.validationWarnings = [];

		// Default configuration with research-backed settings
		this.defaultConfig = this.getDefaultConfiguration();

		console.log('ASTConfigManager initialized');
	}

	/**
	 * Get default configuration with research-backed settings
	 */
	getDefaultConfiguration() {
		return {
			ast: {
				enabled: true,
				version: '4.1',

				parsing: {
					supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
					excludePatterns: [
						'node_modules/**',
						'dist/**',
						'build/**',
						'.git/**',
						'coverage/**',
						'*.min.js',
						'*.bundle.js'
					],
					maxFileSize: '1MB',
					timeoutMs: 5000,
					enableFallback: true
				},

				fileWatching: {
					enabled: true,
					batchDelay: 500,
					maxConcurrentAnalysis: 3,
					watchPatterns: ['**/*.{js,jsx,ts,tsx,py,go,json}'],
					ignorePatterns: [
						'node_modules/**',
						'dist/**',
						'build/**',
						'.git/**',
						'coverage/**',
						'*.tmp',
						'*.log'
					],
					enablePreemptiveAnalysis: true,
					backgroundProcessing: true,
					debounceWindow: 300,
					resourceThrottling: {
						cpuThreshold: 80,
						memoryThreshold: 75,
						enableAdaptiveThrottling: true
					}
				},

				cacheInvalidation: {
					strategy: 'selective', // conservative | selective | aggressive | immediate
					dependencyTracking: true,
					batchInvalidation: true,
					maxInvalidationDelay: 1000,
					maxDependencyDepth: 5,
					separateTestFiles: true,
					contentHashing: {
						algorithm: 'sha256',
						languageAware: true,
						normalizeWhitespace: true,
						ignoreComments: true
					}
				},

				worktreeManager: {
					enabled: true,
					discoveryInterval: 30000,
					maxConcurrentWatchers: 8,
					coordinationStrategy: 'balanced', // safe | balanced | fast
					resourceLimits: {
						maxMemoryMB: 50,
						maxCpuPercent: 15,
						maxEventsPerSecond: 1000
					},
					conflictResolution: {
						maxRetries: 3,
						retryDelayMs: 100,
						timeoutMs: 5000
					},
					gitIntegration: {
						enabled: false, // Disabled by default for safety
						preserveExistingHooks: true,
						enableGracefulFallback: true
					}
				},

				performance: {
					maxAnalysisTime: 2000,
					maxMemoryUsage: '200MB',
					cacheHitRateTarget: 80,
					monitoringInterval: 5000,
					gracefulDegradation: true
				},

				contextGeneration: {
					maxFunctions: 10,
					maxComplexityScore: 8,
					includeImports: true,
					includeDependencies: true,
					relevanceThreshold: 0.4,
					maxContextSize: '50KB'
				},

				debugging: {
					enableVerboseLogging: false,
					logConfigChanges: true,
					validateOnReload: true
				}
			}
		};
	}

	/**
	 * Load configuration from file, merging with defaults
	 */
	async loadConfiguration(force = false) {
		if (this.isLoaded && !force) {
			return this.currentConfig;
		}

		try {
			console.log(`Loading AST configuration from: ${this.configFile}`);

			// Ensure config directory exists
			await this.ensureConfigDirectory();

			let fileConfig = {};

			// Try to load existing configuration
			try {
				const configContent = await fs.readFile(this.configFile, 'utf-8');
				fileConfig = JSON.parse(configContent);
				console.log('Loaded existing AST configuration');
			} catch (error) {
				if (error.code === 'ENOENT') {
					console.log('No existing AST configuration found, using defaults');
				} else {
					console.error('Error reading AST configuration file:', error.message);
					throw new Error(
						`Failed to parse AST configuration: ${error.message}`
					);
				}
			}

			// Merge with defaults
			this.currentConfig = this.mergeConfigurations(
				this.defaultConfig,
				fileConfig
			);

			// Validate configuration
			const validation = this.validateConfiguration(this.currentConfig);

			if (validation.hasErrors) {
				console.error('AST Configuration validation failed:');
				validation.errors.forEach((error) => console.error(`  - ${error}`));
				throw new Error('Invalid AST configuration prevents startup');
			}

			if (validation.hasWarnings) {
				console.warn('AST Configuration warnings:');
				validation.warnings.forEach((warning) =>
					console.warn(`  - ${warning}`)
				);
			}

			// Save merged configuration back to file
			await this.saveConfiguration(this.currentConfig);

			this.isLoaded = true;

			console.log('AST configuration loaded successfully');
			return this.currentConfig;
		} catch (error) {
			console.error('Failed to load AST configuration:', error);
			throw error;
		}
	}

	/**
	 * Validate configuration using built-in validation rules
	 */
	validateConfiguration(config) {
		const validator = new ConfigValidator();
		return validator.validate(config);
	}

	/**
	 * Save configuration to file
	 */
	async saveConfiguration(config) {
		try {
			await this.ensureConfigDirectory();

			const configJson = JSON.stringify(config, null, 2);
			await fs.writeFile(this.configFile, configJson, 'utf-8');

			console.log('AST configuration saved successfully');
		} catch (error) {
			console.error('Failed to save AST configuration:', error);
			throw error;
		}
	}

	/**
	 * Get effective configuration (current config or defaults)
	 */
	getEffectiveConfig() {
		return this.currentConfig || this.defaultConfig;
	}

	/**
	 * Set a configuration value using dot notation
	 */
	async setConfigValue(path, value) {
		try {
			await this.loadConfiguration();

			const pathParts = path.split('.');
			let current = this.currentConfig;

			// Navigate to the parent of the target property
			for (let i = 0; i < pathParts.length - 1; i++) {
				if (!current[pathParts[i]]) {
					current[pathParts[i]] = {};
				}
				current = current[pathParts[i]];
			}

			// Set the value
			const lastPart = pathParts[pathParts.length - 1];
			current[lastPart] = this.parseConfigValue(value);

			// Validate and save
			const validation = this.validateConfiguration(this.currentConfig);

			if (validation.hasErrors) {
				throw new Error(
					`Configuration validation failed: ${validation.errors.join(', ')}`
				);
			}

			await this.saveConfiguration(this.currentConfig);

			console.log(`Configuration updated: ${path} = ${value}`);
		} catch (error) {
			console.error(`Failed to set configuration ${path}:`, error);
			throw error;
		}
	}

	/**
	 * Reset configuration to defaults
	 */
	async resetToDefaults(section = null) {
		try {
			if (section) {
				await this.loadConfiguration();

				const sectionPath = section.split('.');
				let defaultCurrent = this.defaultConfig;
				let configCurrent = this.currentConfig;

				// Navigate to the parent of the section
				for (let i = 0; i < sectionPath.length - 1; i++) {
					if (!defaultCurrent[sectionPath[i]]) {
						throw new Error(`Invalid configuration section: ${section}`);
					}
					defaultCurrent = defaultCurrent[sectionPath[i]];

					if (!configCurrent[sectionPath[i]]) {
						configCurrent[sectionPath[i]] = {};
					}
					configCurrent = configCurrent[sectionPath[i]];
				}

				// Get the final section name and reset it
				const finalSectionName = sectionPath[sectionPath.length - 1];
				if (!defaultCurrent[finalSectionName]) {
					throw new Error(`Invalid configuration section: ${section}`);
				}

				// Deep copy the default section
				configCurrent[finalSectionName] = JSON.parse(
					JSON.stringify(defaultCurrent[finalSectionName])
				);

				console.log(`Reset configuration section: ${section}`);
			} else {
				this.currentConfig = JSON.parse(JSON.stringify(this.defaultConfig));
				console.log('Reset entire AST configuration to defaults');
			}

			await this.saveConfiguration(this.currentConfig);
		} catch (error) {
			console.error('Failed to reset configuration:', error);
			throw error;
		}
	}

	/**
	 * Get configuration summary for display
	 */
	getConfigurationSummary(section = null) {
		const config = this.getEffectiveConfig();

		if (section) {
			const sectionPath = section.split('.');
			let current = config;

			for (const part of sectionPath) {
				if (!current[part]) {
					return null;
				}
				current = current[part];
			}

			return current;
		}

		return config;
	}

	/**
	 * Merge configurations with deep merge
	 */
	mergeConfigurations(defaultConfig, userConfig) {
		const merged = JSON.parse(JSON.stringify(defaultConfig));

		function deepMerge(target, source) {
			for (const key in source) {
				if (
					source[key] &&
					typeof source[key] === 'object' &&
					!Array.isArray(source[key])
				) {
					if (!target[key]) target[key] = {};
					deepMerge(target[key], source[key]);
				} else {
					target[key] = source[key];
				}
			}
		}

		deepMerge(merged, userConfig);
		return merged;
	}

	/**
	 * Parse configuration value from string
	 */
	parseConfigValue(value) {
		// Handle boolean values directly
		if (typeof value === 'boolean') {
			return value;
		}

		// Convert to string for parsing
		const stringValue = String(value);

		// Handle boolean strings
		if (stringValue === 'true') return true;
		if (stringValue === 'false') return false;

		// Handle numeric strings
		if (/^\d+$/.test(stringValue)) return parseInt(stringValue, 10);
		if (/^\d+\.\d+$/.test(stringValue)) return parseFloat(stringValue);

		// Handle arrays (comma-separated)
		if (stringValue.includes(',')) {
			return stringValue.split(',').map((v) => v.trim());
		}

		// Return as string
		return stringValue;
	}

	/**
	 * Ensure configuration directory exists
	 */
	async ensureConfigDirectory() {
		try {
			await fs.mkdir(this.configDir, { recursive: true });
		} catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}
	}
}

// ============================================================================
// BUILT-IN VALIDATION (from config-validator.js)
// ============================================================================

/**
 * Configuration Validator with built-in rules
 */
class ConfigValidator {
	constructor() {
		this.validationRules = this.getValidationRules();
	}

	/**
	 * Get validation rules organized by severity
	 */
	getValidationRules() {
		return {
			critical: [
				{
					path: 'ast',
					type: 'required',
					message: 'Missing required "ast" configuration section'
				},
				{
					path: 'ast.parsing.supportedLanguages',
					type: 'array',
					message: 'parsing.supportedLanguages must be an array'
				},
				{
					path: 'ast.parsing.timeoutMs',
					type: 'range',
					min: 1000,
					max: 30000,
					message: 'parsing.timeoutMs must be between 1000 and 30000'
				},
				{
					path: 'ast.cacheInvalidation.strategy',
					type: 'enum',
					values: ['conservative', 'selective', 'aggressive', 'immediate'],
					message:
						'cacheInvalidation.strategy must be one of: conservative, selective, aggressive, immediate'
				},
				{
					path: 'ast.worktreeManager.coordinationStrategy',
					type: 'enum',
					values: ['safe', 'balanced', 'fast'],
					message:
						'worktreeManager.coordinationStrategy must be one of: safe, balanced, fast'
				}
			],

			warning: [
				{
					path: 'ast.parsing.maxFileSize',
					type: 'size',
					max: '10MB',
					message: 'parsing.maxFileSize is very large, may impact performance'
				},
				{
					path: 'ast.fileWatching.maxConcurrentAnalysis',
					type: 'range',
					max: 10,
					message:
						'fileWatching.maxConcurrentAnalysis > 10 may cause high CPU usage'
				},
				{
					path: 'ast.fileWatching.batchDelay',
					type: 'range',
					min: 100,
					message:
						'fileWatching.batchDelay < 100ms may cause excessive processing'
				},
				{
					path: 'ast.cacheInvalidation.maxDependencyDepth',
					type: 'range',
					max: 10,
					message:
						'cacheInvalidation.maxDependencyDepth > 10 may impact performance'
				},
				{
					path: 'ast.worktreeManager.maxConcurrentWatchers',
					type: 'range',
					max: 20,
					message:
						'worktreeManager.maxConcurrentWatchers > 20 may cause resource exhaustion'
				},
				{
					path: 'ast.performance.maxAnalysisTime',
					type: 'range',
					max: 10000,
					message: 'performance.maxAnalysisTime > 10s may cause timeouts'
				},
				{
					path: 'ast.performance.maxMemoryUsage',
					type: 'size',
					max: '1GB',
					message:
						'performance.maxMemoryUsage > 1GB may impact system performance'
				}
			]
		};
	}

	/**
	 * Validate configuration and return results
	 */
	validate(config) {
		const result = {
			isValid: true,
			hasErrors: false,
			hasWarnings: false,
			errors: [],
			warnings: []
		};

		// Validate critical rules
		for (const rule of this.validationRules.critical) {
			const error = this.validateRule(config, rule);
			if (error) {
				result.errors.push(error);
				result.hasErrors = true;
				result.isValid = false;
			}
		}

		// Validate warning rules
		for (const rule of this.validationRules.warning) {
			const warning = this.validateRule(config, rule);
			if (warning) {
				result.warnings.push(warning);
				result.hasWarnings = true;
			}
		}

		return result;
	}

	/**
	 * Validate a single rule against configuration
	 */
	validateRule(config, rule) {
		const value = this.getNestedValue(config, rule.path);

		switch (rule.type) {
			case 'required':
				return this.validateRequired(value, rule);

			case 'array':
				return this.validateArray(value, rule);

			case 'range':
				return this.validateRange(value, rule);

			case 'enum':
				return this.validateEnum(value, rule);

			case 'size':
				return this.validateSize(value, rule);

			default:
				return null;
		}
	}

	/**
	 * Validate required field
	 */
	validateRequired(value, rule) {
		if (value === undefined || value === null) {
			return rule.message;
		}
		return null;
	}

	/**
	 * Validate array type
	 */
	validateArray(value, rule) {
		if (value !== undefined && value !== null && !Array.isArray(value)) {
			return rule.message;
		}
		return null;
	}

	/**
	 * Validate numeric range
	 */
	validateRange(value, rule) {
		if (value === undefined || value === null) {
			return null;
		}

		const numValue = typeof value === 'number' ? value : parseFloat(value);

		if (Number.isNaN(numValue)) {
			return `${rule.path} must be a number`;
		}

		if (rule.min !== undefined && numValue < rule.min) {
			return rule.message;
		}

		if (rule.max !== undefined && numValue > rule.max) {
			return rule.message;
		}

		return null;
	}

	/**
	 * Validate enum values
	 */
	validateEnum(value, rule) {
		if (value === undefined || value === null) {
			return null;
		}

		if (!rule.values.includes(value)) {
			return rule.message;
		}

		return null;
	}

	/**
	 * Validate size values (e.g., "1MB", "500KB")
	 */
	validateSize(value, rule) {
		if (value === undefined || value === null) {
			return null;
		}

		try {
			const sizeBytes = this.parseSize(value);
			const maxSizeBytes = this.parseSize(rule.max);

			if (sizeBytes > maxSizeBytes) {
				return rule.message;
			}

			return null;
		} catch (error) {
			return `${rule.path} has invalid size format: ${value}`;
		}
	}

	/**
	 * Get nested value from object using dot notation
	 */
	getNestedValue(obj, path) {
		return path.split('.').reduce((current, key) => {
			return current && current[key] !== undefined ? current[key] : undefined;
		}, obj);
	}

	/**
	 * Parse size strings like "1MB", "500KB"
	 */
	parseSize(sizeStr) {
		const units = {
			B: 1,
			KB: 1024,
			MB: 1024 * 1024,
			GB: 1024 * 1024 * 1024,
			TB: 1024 * 1024 * 1024 * 1024
		};

		const match = sizeStr.toString().match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
		if (!match) {
			throw new Error(`Invalid size format: ${sizeStr}`);
		}

		const value = parseFloat(match[1]);
		const unit = match[2].toUpperCase();

		return value * (units[unit] || 1);
	}

	/**
	 * Add custom validation rule
	 */
	addRule(severity, rule) {
		if (!this.validationRules[severity]) {
			this.validationRules[severity] = [];
		}

		this.validationRules[severity].push(rule);
	}

	/**
	 * Remove validation rule
	 */
	removeRule(severity, path) {
		if (this.validationRules[severity]) {
			this.validationRules[severity] = this.validationRules[severity].filter(
				(rule) => rule.path !== path
			);
		}
	}

	/**
	 * Get validation summary
	 */
	getValidationSummary() {
		const criticalCount = this.validationRules.critical.length;
		const warningCount = this.validationRules.warning.length;

		return {
			totalRules: criticalCount + warningCount,
			criticalRules: criticalCount,
			warningRules: warningCount,
			rules: this.validationRules
		};
	}
}

// ============================================================================
// EXPORTS
// ============================================================================

// Simple API exports (backward compatible)
export { DEFAULT_AST_CONFIG };

// Advanced API exports  
export default ASTConfigManager;

// Validator export for those who need it directly
export { ConfigValidator }; 