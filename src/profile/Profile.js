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
			const errorDetails = result.error || 'Unknown error';
			const context = result.context ? ` (${result.context})` : '';
			return `${this.displayName}: [ERROR] Failed - ${errorDetails}${context}`;
		}

		// Operation-specific summary functions
		const operationSummaries = {
			add: () => {
				if (!this.includeDefaultRules) {
					// Integration guide profiles
					const mcpStatus = this.hasMcpConfig()
						? ' with MCP configuration'
						: '';
					const notice = result.notice ? ` (${result.notice})` : '';
					return `${this.displayName}: [OK] Integration guide installed${mcpStatus}${notice}`;
				}

				// Standard rule profiles
				const processed = result.filesProcessed || 0;
				const skipped = result.filesSkipped || 0;
				const total = processed + skipped;
				const existing = result.filesExisting || 0;
				const updated = result.filesUpdated || 0;

				// Handle edge cases
				if (processed === 0 && skipped === 0) {
					return `${this.displayName}: [WARN] No files processed - profile may already be installed`;
				}

				if (processed === 0 && skipped > 0) {
					return `${this.displayName}: [WARN] All ${skipped} files skipped - profile may already be installed`;
				}

				// Build detailed summary
				let summary = `${this.displayName}: [OK] ${processed} file${processed !== 1 ? 's' : ''} processed`;

				if (updated > 0) {
					summary += ` (${updated} updated)`;
				}

				if (skipped > 0) {
					summary += `, ${skipped} skipped`;
				}

				if (existing > 0) {
					summary += ` (${existing} already existed)`;
				}

				// Add MCP configuration status
				if (this.hasMcpConfig() && result.mcpConfigInstalled) {
					summary += ', MCP config installed';
				}

				const notice = result.notice ? ` - ${result.notice}` : '';
				return summary + notice;
			},

			remove: () => {
				const removedCount = result.filesRemoved || 0;
				const notFoundCount = result.filesNotFound || 0;
				const total = removedCount + notFoundCount;

				// Handle edge cases
				if (removedCount === 0 && notFoundCount === 0) {
					const profileType = this.includeDefaultRules
						? 'rule profile'
						: 'integration guide';
					return `${this.displayName}: [WARN] No files found to remove - ${profileType} may not be installed`;
				}

				if (removedCount === 0 && notFoundCount > 0) {
					const profileType = this.includeDefaultRules
						? 'rule profile'
						: 'integration guide';
					return `${this.displayName}: [WARN] ${profileType} not found - may already be removed`;
				}

				// Build detailed summary
				const profileType = this.includeDefaultRules
					? 'rule profile'
					: 'integration guide';
				let summary = `${this.displayName}: [OK] ${profileType} removed`;

				if (removedCount > 0) {
					summary += ` (${removedCount} file${removedCount !== 1 ? 's' : ''} deleted)`;
				}

				if (notFoundCount > 0) {
					summary += `, ${notFoundCount} file${notFoundCount !== 1 ? 's' : ''} not found`;
				}

				// Add MCP configuration removal status
				if (this.hasMcpConfig() && result.mcpConfigRemoved) {
					summary += ', MCP config removed';
				}

				const notice = result.notice ? ` - ${result.notice}` : '';
				return summary + notice;
			},

			convert: () => {
				const converted = result.filesConverted || 0;
				const skipped = result.filesSkipped || 0;
				const errors = result.conversionErrors || 0;

				// Handle edge cases
				if (converted === 0 && skipped === 0 && errors === 0) {
					return `${this.displayName}: [WARN] No files found to convert`;
				}

				if (converted === 0 && errors > 0) {
					return `${this.displayName}: [ERROR] Conversion failed for ${errors} file${errors !== 1 ? 's' : ''}`;
				}

				// Build detailed summary
				let summary = `${this.displayName}: [OK] Rules converted successfully`;

				if (converted > 0) {
					summary += ` (${converted} file${converted !== 1 ? 's' : ''})`;
				}

				if (skipped > 0) {
					summary += `, ${skipped} skipped`;
				}

				if (errors > 0) {
					summary += `, ${errors} error${errors !== 1 ? 's' : ''}`;
				}

				const notice = result.notice ? ` - ${result.notice}` : '';
				return summary + notice;
			},

			default: () => {
				const status = result.success ? '[OK]' : '[ERROR]';
				const notice = result.notice ? ` - ${result.notice}` : '';
				const duration = result.duration ? ` (${result.duration}ms)` : '';
				return `${this.displayName}: ${status} ${operation} completed${duration}${notice}`;
			}
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
