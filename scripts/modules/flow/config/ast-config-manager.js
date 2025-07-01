/**
 * AST Configuration Manager for Phase 4.1
 *
 * Unified configuration management for all AST integration phases.
 * Handles loading, validation, and management of AST configurations.
 *
 * Key Features:
 * - Single JSON configuration file
 * - Flow command integration
 * - Smart validation with startup prevention
 * - Simple configuration scope
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AST Configuration Manager
 *
 * Manages all AST-related configuration in a unified manner.
 * Integrates with the flow command system for user interaction.
 */
class ASTConfigManager {
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
	 * Validate configuration
	 */
	validateConfiguration(config) {
		const errors = [];
		const warnings = [];

		try {
			// Critical validations (prevent startup)
			if (!config.ast) {
				errors.push('Missing required "ast" configuration section');
				return { hasErrors: true, hasWarnings: false, errors, warnings };
			}

			const ast = config.ast;

			// Validate cache invalidation strategy
			if (ast.cacheInvalidation) {
				const validStrategies = [
					'conservative',
					'selective',
					'aggressive',
					'immediate'
				];
				if (
					ast.cacheInvalidation.strategy &&
					!validStrategies.includes(ast.cacheInvalidation.strategy)
				) {
					errors.push(
						`cacheInvalidation.strategy must be one of: ${validStrategies.join(', ')}`
					);
				}
			}

			// Validate worktree manager configuration
			if (ast.worktreeManager) {
				const validCoordStrategies = ['safe', 'balanced', 'fast'];
				if (
					ast.worktreeManager.coordinationStrategy &&
					!validCoordStrategies.includes(
						ast.worktreeManager.coordinationStrategy
					)
				) {
					errors.push(
						`worktreeManager.coordinationStrategy must be one of: ${validCoordStrategies.join(', ')}`
					);
				}
			}

			return {
				hasErrors: errors.length > 0,
				hasWarnings: warnings.length > 0,
				errors,
				warnings
			};
		} catch (error) {
			errors.push(`Configuration validation error: ${error.message}`);
			return { hasErrors: true, hasWarnings: false, errors, warnings };
		}
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

export default ASTConfigManager;
