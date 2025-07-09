/**
 * AST Configuration Manager
 * Handles advanced AST configuration management and validation
 */

import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_ADVANCED_AST_CONFIG } from '../ast-config.js';
import { ConfigValidator } from '../schemas/ast-config-schema.js';
import { mergeConfigurations, parseConfigValue } from '../utils/config-utils.js';

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
		return DEFAULT_ADVANCED_AST_CONFIG;
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
			this.currentConfig = mergeConfigurations(
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
			current[lastPart] = parseConfigValue(value);

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