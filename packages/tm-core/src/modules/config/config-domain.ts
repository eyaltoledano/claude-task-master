/**
 * @fileoverview Config Domain Facade
 * Public API for configuration management
 */

import type { ConfigManager } from './managers/config-manager.js';
import type {
	PartialConfiguration,
	RuntimeStorageConfig
} from '../../common/interfaces/configuration.interface.js';

/**
 * Config Domain - Unified API for configuration operations
 */
export class ConfigDomain {
	constructor(private configManager: ConfigManager) {}

	// ========== Configuration Access ==========

	/**
	 * Get the full configuration
	 */
	getConfig(): PartialConfiguration {
		return this.configManager.getConfig();
	}

	/**
	 * Get storage configuration
	 */
	getStorageConfig(): RuntimeStorageConfig {
		return this.configManager.getStorageConfig();
	}

	/**
	 * Get model configuration
	 */
	getModelConfig() {
		return this.configManager.getModelConfig();
	}

	/**
	 * Get response language
	 */
	getResponseLanguage(): string {
		return this.configManager.getResponseLanguage();
	}

	/**
	 * Get project root path
	 */
	getProjectRoot(): string {
		return this.configManager.getProjectRoot();
	}

	/**
	 * Check if API is explicitly configured
	 */
	isApiExplicitlyConfigured(): boolean {
		return this.configManager.isApiExplicitlyConfigured();
	}

	// ========== Runtime State ==========

	/**
	 * Get the currently active tag
	 */
	getActiveTag(): string {
		return this.configManager.getActiveTag();
	}

	/**
	 * Set the active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		return this.configManager.setActiveTag(tag);
	}

	// ========== Configuration Updates ==========

	/**
	 * Update configuration
	 */
	async updateConfig(updates: PartialConfiguration): Promise<void> {
		return this.configManager.updateConfig(updates);
	}

	/**
	 * Set response language
	 */
	async setResponseLanguage(language: string): Promise<void> {
		return this.configManager.setResponseLanguage(language);
	}

	/**
	 * Save current configuration
	 */
	async saveConfig(): Promise<void> {
		return this.configManager.saveConfig();
	}

	/**
	 * Reset configuration to defaults
	 */
	async reset(): Promise<void> {
		return this.configManager.reset();
	}

	// ========== Utilities ==========

	/**
	 * Get configuration sources for debugging
	 */
	getConfigSources() {
		return this.configManager.getConfigSources();
	}
}
