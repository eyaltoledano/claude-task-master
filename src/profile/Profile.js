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
		this.fileMap = Object.freeze(config.fileMap ?? {});
		this.conversionConfig = Object.freeze(config.conversionConfig ?? {});
		this.globalReplacements = Object.freeze(config.globalReplacements ?? []);
		this.hooks = Object.freeze(config.hooks ?? {});

		// MCP configuration
		this._mcpConfigRaw = config.mcpConfig;
		this.mcpConfig = this._deriveMcpConfigBoolean(config.mcpConfig);

		// Core profile behavior
		this.includeDefaultRules = config.includeDefaultRules ?? true;
		this.supportsRulesSubdirectories =
			config.supportsRulesSubdirectories ?? false;
		this.targetExtension = config.targetExtension ?? '.md';

		// Computed properties
		this.mcpConfigName = this._computeMcpConfigName();
		this.mcpConfigPath = this._computeMcpConfigPath();

		// Freeze the instance for immutability
		Object.freeze(this);
	}

	/**
	 * Handle operation errors consistently
	 * @private
	 * @param {string} operation - Operation type
	 * @param {Error} error - Error object
	 * @throws {ProfileOperationError}
	 */
	_handleOperationError(operation, error) {
		throw new ProfileOperationError(
			operation,
			this.profileName,
			error.message,
			error
		);
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
			this._handleOperationError('install', error);
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
			this._handleOperationError('remove', error);
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
			this._handleOperationError('convert', error);
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
		if (!result.success) {
			return `${this.displayName}: Failed - ${result.error || 'Unknown error'}`;
		}

		// Operation-specific summary functions
		const operationSummaries = {
			add: () => {
				if (!this.includeDefaultRules) {
					return `${this.displayName}: Integration guide installed`;
				}
				const processed = result.filesProcessed || 0;
				const skipped = result.filesSkipped || 0;
				return `${this.displayName}: ${processed} files processed${skipped > 0 ? `, ${skipped} skipped` : ''}`;
			},
			remove: () => {
				const notice = result.notice ? ` (${result.notice})` : '';
				return this.includeDefaultRules
					? `${this.displayName}: Rule profile removed${notice}`
					: `${this.displayName}: Integration guide removed${notice}`;
			},
			convert: () => `${this.displayName}: Rules converted successfully`,
			default: () => `${this.displayName}: ${operation} completed`
		};

		const summaryFn =
			operationSummaries[operation] || operationSummaries.default;
		return summaryFn();
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
	 * Normalize file paths by joining segments and removing duplicate slashes
	 * @private
	 * @param {...string} segments - Path segments to join
	 * @returns {string} Normalized path
	 */
	_normalizePath(...segments) {
		return segments
			.filter(Boolean)
			.join('/')
			.replace(/\/+/g, '/')
			.replace(/\/$/, '');
	}

	/**
	 * Compute MCP config name from configuration
	 * @private
	 */
	_computeMcpConfigName() {
		if (!this.mcpConfig) return null;
		const { configName = 'mcp.json' } =
			typeof this._mcpConfigRaw === 'object' ? this._mcpConfigRaw : {};
		return configName;
	}

	/**
	 * Compute MCP config path from configuration
	 * @private
	 */
	_computeMcpConfigPath() {
		return this.mcpConfigName
			? this._normalizePath(
					this.profileDir === '.' ? '' : this.profileDir,
					this.mcpConfigName
				)
			: null;
	}

	/**
	 * Derive a boolean value from the MCP config.
	 * Returns true if MCP is enabled (either true or a config object), false otherwise.
	 * @private
	 */
	_deriveMcpConfigBoolean(config) {
		if (config === true) return true;
		if (config === false || config == null) return false;
		return typeof config === 'object';
	}
}
