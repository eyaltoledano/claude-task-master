/**
 * @fileoverview Configuration Manager
 * Orchestrates configuration services following clean architecture principles
 *
 * This ConfigManager delegates responsibilities to specialized services for better
 * maintainability, testability, and separation of concerns.
 */

import type {
	PartialConfiguration,
	RuntimeStorageConfig
} from '../../../common/interfaces/configuration.interface.js';
import { DEFAULT_CONFIG_VALUES as DEFAULTS } from '../../../common/interfaces/configuration.interface.js';
import { ConfigLoader } from '../services/config-loader.service.js';
import {
	ConfigMerger,
	CONFIG_PRECEDENCE
} from '../services/config-merger.service.js';
import { RuntimeStateManager } from '../services/runtime-state-manager.service.js';
import { ConfigPersistence } from '../services/config-persistence.service.js';
import { EnvironmentConfigProvider } from '../services/environment-config-provider.service.js';

/**
 * ConfigManager orchestrates all configuration services
 *
 * This class delegates responsibilities to specialized services:
 * - ConfigLoader: Loads configuration from files
 * - ConfigMerger: Merges configurations with precedence
 * - RuntimeStateManager: Manages runtime state
 * - ConfigPersistence: Handles file persistence
 * - EnvironmentConfigProvider: Extracts env var configuration
 */
export class ConfigManager {
	private projectRoot: string;
	private config: PartialConfiguration = {};
	private initialized = false;

	// Services
	private loader: ConfigLoader;
	private merger: ConfigMerger;
	private stateManager: RuntimeStateManager;
	private persistence: ConfigPersistence;
	private envProvider: EnvironmentConfigProvider;

	/**
	 * Create and initialize a new ConfigManager instance
	 * This is the ONLY way to create a ConfigManager
	 *
	 * @param projectRoot - The root directory of the project
	 * @returns Fully initialized ConfigManager instance
	 */
	static async create(projectRoot: string): Promise<ConfigManager> {
		const manager = new ConfigManager(projectRoot);
		await manager.initialize();
		return manager;
	}

	/**
	 * Private constructor - use ConfigManager.create() instead
	 * This ensures the ConfigManager is always properly initialized
	 */
	private constructor(projectRoot: string) {
		this.projectRoot = projectRoot;

		// Initialize services
		this.loader = new ConfigLoader(projectRoot);
		this.merger = new ConfigMerger();
		this.stateManager = new RuntimeStateManager(projectRoot);
		this.persistence = new ConfigPersistence(projectRoot);
		this.envProvider = new EnvironmentConfigProvider();
	}

	/**
	 * Initialize by loading configuration from all sources
	 * Private - only called by the factory method
	 */
	private async initialize(): Promise<void> {
		if (this.initialized) return;

		// Clear any existing configuration sources
		this.merger.clearSources();

		// 1. Load default configuration (lowest precedence)
		this.merger.addSource({
			name: 'defaults',
			config: this.loader.getDefaultConfig(),
			precedence: CONFIG_PRECEDENCE.DEFAULTS
		});

		// 2. Load global configuration (if exists)
		const globalConfig = await this.loader.loadGlobalConfig();
		if (globalConfig) {
			this.merger.addSource({
				name: 'global',
				config: globalConfig,
				precedence: CONFIG_PRECEDENCE.GLOBAL
			});
		}

		// 3. Load local project configuration
		const localConfig = await this.loader.loadLocalConfig();
		if (localConfig) {
			this.merger.addSource({
				name: 'local',
				config: localConfig,
				precedence: CONFIG_PRECEDENCE.LOCAL
			});
		}

		// 4. Load environment variables (highest precedence)
		const envConfig = this.envProvider.loadConfig();
		if (Object.keys(envConfig).length > 0) {
			this.merger.addSource({
				name: 'environment',
				config: envConfig,
				precedence: CONFIG_PRECEDENCE.ENVIRONMENT
			});
		}

		// 5. Merge all configurations
		this.config = this.merger.merge();

		// 6. Load runtime state
		await this.stateManager.loadState();

		this.initialized = true;
	}

	// ==================== Configuration Access ====================

	/**
	 * Get full configuration
	 */
	getConfig(): PartialConfiguration {
		return this.config;
	}

	/**
	 * Get storage configuration
	 */
	getStorageConfig(): RuntimeStorageConfig {
		const storage = this.config.storage;

		// Return the configured type (including 'auto')
		const storageType = storage?.type || 'auto';
		const basePath = storage?.basePath ?? this.projectRoot;

		if (storageType === 'api' || storageType === 'auto') {
			return {
				type: storageType,
				basePath,
				apiEndpoint: storage?.apiEndpoint,
				apiAccessToken: storage?.apiAccessToken,
				apiConfigured: Boolean(storage?.apiEndpoint || storage?.apiAccessToken)
			};
		}

		return {
			type: storageType,
			basePath,
			apiConfigured: false
		};
	}

	/**
	 * Get model configuration
	 */
	getModelConfig() {
		return (
			this.config.models || {
				main: DEFAULTS.MODELS.MAIN,
				fallback: DEFAULTS.MODELS.FALLBACK
			}
		);
	}

	/**
	 * Get response language setting
	 */
	getResponseLanguage(): string {
		const customConfig = this.config.custom as any;
		return customConfig?.responseLanguage || 'English';
	}

	/**
	 * Get project root path
	 */
	getProjectRoot(): string {
		return this.projectRoot;
	}

	/**
	 * Check if explicitly configured to use API storage
	 * Excludes 'auto' type
	 */
	isApiExplicitlyConfigured(): boolean {
		return this.getStorageConfig().type === 'api';
	}

	// ==================== Runtime State ====================

	/**
	 * Get the currently active tag
	 */
	getActiveTag(): string {
		return this.stateManager.getCurrentTag();
	}

	/**
	 * Set the active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		await this.stateManager.setCurrentTag(tag);
	}

	// ==================== Configuration Updates ====================

	/**
	 * Update configuration
	 */
	async updateConfig(updates: PartialConfiguration): Promise<void> {
		// Merge updates into current config
		Object.assign(this.config, updates);

		// Save to persistence
		await this.persistence.saveConfig(this.config);

		// Re-initialize to respect precedence
		this.initialized = false;
		await this.initialize();
	}

	/**
	 * Set response language
	 */
	async setResponseLanguage(language: string): Promise<void> {
		if (!this.config.custom) {
			this.config.custom = {};
		}
		(this.config.custom as any).responseLanguage = language;
		await this.persistence.saveConfig(this.config);
	}

	/**
	 * Save current configuration
	 */
	async saveConfig(): Promise<void> {
		await this.persistence.saveConfig(this.config, {
			createBackup: true,
			atomic: true
		});
	}

	// ==================== Utilities ====================

	/**
	 * Reset configuration to defaults
	 */
	async reset(): Promise<void> {
		// Clear configuration file
		await this.persistence.deleteConfig();

		// Clear runtime state
		await this.stateManager.clearState();

		// Reset internal state
		this.initialized = false;
		this.config = {};

		// Re-initialize with defaults
		await this.initialize();
	}

	/**
	 * Get configuration sources for debugging
	 */
	getConfigSources() {
		return this.merger.getSources();
	}
}
