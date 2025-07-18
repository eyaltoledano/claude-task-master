/**
 * @fileoverview Immutable Profile class representing a complete profile configuration
 */

import { ProfileOperationError } from './ProfileError.js';

/**
 * Immutable Profile class representing a complete profile configuration
 *
 * @class Profile
 */
export default class Profile {
	/**
	 * Creates a new Profile instance
	 * @param {import('./types.js').ProfileInit} config - Profile configuration
	 */
	constructor(config) {
		// Required properties
		this.profileName = config.profileName;
		this.rulesDir = config.rulesDir;
		this.profileDir = config.profileDir;

		// Optional properties with defaults
		this.displayName = config.displayName ?? config.profileName;
		this.fileMap = config.fileMap ?? {};
		this.conversionConfig = config.conversionConfig ?? {};
		this.globalReplacements = config.globalReplacements ?? [];
		this.mcpConfig = config.mcpConfig;
		this.hooks = config.hooks ?? {};

		// Legacy compatibility properties
		this.includeDefaultRules = config.includeDefaultRules ?? true;
		this.supportsRulesSubdirectories =
			config.supportsRulesSubdirectories ?? false;

		// Computed properties for legacy compatibility
		this.mcpConfigName = this._computeMcpConfigName();
		this.mcpConfigPath = this._computeMcpConfigPath();

		// Freeze the object to ensure immutability
		Object.freeze(this.fileMap);
		Object.freeze(this.conversionConfig);
		Object.freeze(this.globalReplacements);
		Object.freeze(this.hooks);
		Object.freeze(this);
	}

	/**
	 * Install this profile to a project directory
	 * Template method that delegates to hooks
	 *
	 * @param {string} projectRoot - Target project directory
	 * @param {string} assetsDir - Source assets directory
	 * @returns {Promise<import('./types.js').ProfileOperationResult>}
	 */
	async install(projectRoot, assetsDir) {
		try {
			if (this.hooks.onAdd) {
				await Promise.resolve(this.hooks.onAdd(projectRoot, assetsDir));
			}
			return {
				success: true,
				filesProcessed: Object.keys(this.fileMap).length
			};
		} catch (error) {
			throw new ProfileOperationError(
				'install',
				this.profileName,
				error.message,
				error
			);
		}
	}

	/**
	 * Remove this profile from a project directory
	 * Template method that delegates to hooks
	 *
	 * @param {string} projectRoot - Target project directory
	 * @returns {Promise<import('./types.js').ProfileOperationResult>}
	 */
	async remove(projectRoot) {
		try {
			if (this.hooks.onRemove) {
				await Promise.resolve(this.hooks.onRemove(projectRoot));
			}
			return {
				success: true
			};
		} catch (error) {
			throw new ProfileOperationError(
				'remove',
				this.profileName,
				error.message,
				error
			);
		}
	}

	/**
	 * Post-conversion processing for this profile
	 * Template method that delegates to hooks
	 *
	 * @param {string} projectRoot - Target project directory
	 * @param {string} assetsDir - Source assets directory
	 * @returns {Promise<import('./types.js').ProfileOperationResult>}
	 */
	async postConvert(projectRoot, assetsDir) {
		try {
			if (this.hooks.onPost) {
				await Promise.resolve(this.hooks.onPost(projectRoot, assetsDir));
			}
			return {
				success: true
			};
		} catch (error) {
			throw new ProfileOperationError(
				'convert',
				this.profileName,
				error.message,
				error
			);
		}
	}

	/**
	 * Generate a human-readable summary for an operation
	 *
	 * @param {import('./types.js').ProfileOperation} operation - Type of operation
	 * @param {import('./types.js').ProfileOperationResult} result - Operation result
	 * @returns {string} Formatted summary message
	 */
	summary(operation, result) {
		const baseName = this.displayName;

		if (!result.success) {
			return `${baseName}: Failed - ${result.error || 'Unknown error'}`;
		}

		switch (operation) {
			case 'add':
				if (!this.includeDefaultRules) {
					// Integration guide profiles
					return `${baseName}: Integration guide installed`;
				} else {
					// Standard rule profiles
					const processed = result.filesProcessed || 0;
					const skipped = result.filesSkipped || 0;
					return `${baseName}: ${processed} files processed${skipped > 0 ? `, ${skipped} skipped` : ''}`;
				}

			case 'remove':
				const notice = result.notice ? ` (${result.notice})` : '';
				if (!this.includeDefaultRules) {
					return `${baseName}: Integration guide removed${notice}`;
				} else {
					return `${baseName}: Rule profile removed${notice}`;
				}

			case 'convert':
				return `${baseName}: Rules converted successfully`;

			default:
				return `${baseName}: ${operation} completed`;
		}
	}

	/**
	 * Convert this Profile to legacy object format for compatibility
	 *
	 * @returns {Object} Legacy profile object
	 */
	toLegacyFormat() {
		return {
			profileName: this.profileName,
			displayName: this.displayName,
			profileDir: this.profileDir,
			rulesDir: this.rulesDir,
			mcpConfig: this.mcpConfig,
			mcpConfigName: this.mcpConfigName,
			mcpConfigPath: this.mcpConfigPath,
			supportsRulesSubdirectories: this.supportsRulesSubdirectories,
			includeDefaultRules: this.includeDefaultRules,
			fileMap: this.fileMap,
			globalReplacements: this.globalReplacements,
			conversionConfig: this.conversionConfig,

			// Legacy lifecycle hooks (sync versions)
			...(this.hooks.onAdd && { onAddRulesProfile: this.hooks.onAdd }),
			...(this.hooks.onRemove && { onRemoveRulesProfile: this.hooks.onRemove }),
			...(this.hooks.onPost && { onPostConvertRulesProfile: this.hooks.onPost })
		};
	}

	/**
	 * Check if this profile has any lifecycle hooks defined
	 *
	 * @returns {boolean} True if profile has hooks
	 */
	hasHooks() {
		return Object.keys(this.hooks).length > 0;
	}

	/**
	 * Check if this profile includes default rule files
	 *
	 * @returns {boolean} True if profile includes default rules
	 */
	hasDefaultRules() {
		return this.includeDefaultRules;
	}

	/**
	 * Check if this profile has MCP configuration enabled
	 *
	 * @returns {boolean} True if MCP config is enabled
	 */
	hasMcpConfig() {
		return Boolean(this.mcpConfig);
	}

	/**
	 * Get the number of files this profile will process
	 *
	 * @returns {number} Number of files in fileMap
	 */
	getFileCount() {
		return Object.keys(this.fileMap).length;
	}

	// Private helper methods

	/**
	 * Compute MCP config name for legacy compatibility
	 * @private
	 */
	_computeMcpConfigName() {
		if (!this.mcpConfig) return null;
		if (typeof this.mcpConfig === 'object' && this.mcpConfig.configName) {
			return this.mcpConfig.configName;
		}
		return 'mcp.json';
	}

	/**
	 * Compute MCP config path for legacy compatibility
	 * @private
	 */
	_computeMcpConfigPath() {
		if (!this.mcpConfigName) return null;
		// Simple path joining - may need to be more sophisticated
		return `${this.profileDir}/${this.mcpConfigName}`.replace(/\/+/g, '/');
	}
}
