/**
 * @fileoverview Fluent builder for creating Profile instances with validation
 */

import Profile from './Profile.js';
import { ProfileValidationError } from './ProfileError.js';

/**
 * Fluent builder for creating Profile instances
 *
 * @class ProfileBuilder
 */
export class ProfileBuilder {
	/**
	 * Creates a new ProfileBuilder instance
	 */
	constructor() {
		this._config = {
			hooks: {}
		};
	}

	/**
	 * Set the profile name (required)
	 *
	 * @param {string} name - Profile identifier
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	withName(name) {
		if (typeof name !== 'string' || !name.trim()) {
			throw new ProfileValidationError(
				'Profile name must be a non-empty string',
				'profileName'
			);
		}
		this._config.profileName = name.trim();
		return this;
	}

	/**
	 * Set the display name for the profile (optional)
	 *
	 * @param {string} displayName - Human-readable profile name
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	display(displayName) {
		if (typeof displayName !== 'string' || !displayName.trim()) {
			throw new ProfileValidationError(
				'Display name must be a non-empty string',
				'displayName'
			);
		}
		this._config.displayName = displayName.trim();
		return this;
	}

	/**
	 * Set the rules directory (required)
	 *
	 * @param {string} dir - Directory for rule files
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	rulesDir(dir) {
		if (typeof dir !== 'string' || !dir.trim()) {
			throw new ProfileValidationError(
				'Rules directory must be a non-empty string',
				'rulesDir'
			);
		}
		this._config.rulesDir = dir.trim();
		return this;
	}

	/**
	 * Set the profile directory (required)
	 *
	 * @param {string} dir - Profile configuration directory
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	profileDir(dir) {
		if (typeof dir !== 'string' || !dir.trim()) {
			throw new ProfileValidationError(
				'Profile directory must be a non-empty string',
				'profileDir'
			);
		}
		this._config.profileDir = dir.trim();
		return this;
	}

	/**
	 * Set the file mapping configuration
	 *
	 * @param {Object<string, string>} map - Source to target file mappings
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	fileMap(map) {
		if (typeof map !== 'object' || map === null) {
			throw new ProfileValidationError('File map must be an object', 'fileMap');
		}
		this._config.fileMap = { ...map };
		return this;
	}

	/**
	 * Set the target file extension for default file mappings
	 *
	 * @param {string} extension - Target file extension (e.g., '.md', '.instructions.md')
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	targetExtension(extension) {
		if (typeof extension !== 'string' || !extension.startsWith('.')) {
			throw new ProfileValidationError(
				'Target extension must be a string starting with "."',
				'targetExtension'
			);
		}
		this._config.targetExtension = extension;
		return this;
	}

	/**
	 * Set the conversion configuration
	 *
	 * @param {import('./types.js').ConversionConfig} config - Rule transformation configuration
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	conversion(config) {
		if (typeof config !== 'object' || config === null) {
			throw new ProfileValidationError(
				'Conversion config must be an object',
				'conversionConfig'
			);
		}
		this._config.conversionConfig = { ...config };
		return this;
	}

	/**
	 * Set the global replacements array
	 *
	 * @param {Array<{from: RegExp|string, to: string|Function}>} replacements - Global text replacements
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	globalReplacements(replacements) {
		if (!Array.isArray(replacements)) {
			throw new ProfileValidationError(
				'Global replacements must be an array',
				'globalReplacements'
			);
		}
		this._config.globalReplacements = [...replacements];
		return this;
	}

	/**
	 * Set the MCP configuration
	 *
	 * @param {boolean|Object} config - MCP configuration settings
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	mcpConfig(config) {
		if (
			typeof config !== 'boolean' &&
			(typeof config !== 'object' || config === null)
		) {
			throw new ProfileValidationError(
				'MCP config must be a boolean or object',
				'mcpConfig'
			);
		}
		this._config.mcpConfig = config;
		return this;
	}

	/**
	 * Set whether to include default rule files
	 *
	 * @param {boolean} include - Whether to include default rules
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	includeDefaultRules(include) {
		if (typeof include !== 'boolean') {
			throw new ProfileValidationError(
				'Include default rules must be a boolean',
				'includeDefaultRules'
			);
		}
		this._config.includeDefaultRules = include;
		return this;
	}

	/**
	 * Set whether the profile supports rules subdirectories
	 *
	 * @param {boolean} supports - Whether to support subdirectories
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	supportsSubdirectories(supports) {
		if (typeof supports !== 'boolean') {
			throw new ProfileValidationError(
				'Supports subdirectories must be a boolean',
				'supportsRulesSubdirectories'
			);
		}
		this._config.supportsRulesSubdirectories = supports;
		return this;
	}

	/**
	 * Set the onAdd lifecycle hook
	 *
	 * @param {Function} callback - Called when profile is added to project
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	onAdd(callback) {
		if (typeof callback !== 'function') {
			throw new ProfileValidationError(
				'onAdd hook must be a function',
				'hooks.onAdd'
			);
		}
		this._config.hooks.onAdd = callback;
		return this;
	}

	/**
	 * Set the onRemove lifecycle hook
	 *
	 * @param {Function} callback - Called when profile is removed from project
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	onRemove(callback) {
		if (typeof callback !== 'function') {
			throw new ProfileValidationError(
				'onRemove hook must be a function',
				'hooks.onRemove'
			);
		}
		this._config.hooks.onRemove = callback;
		return this;
	}

	/**
	 * Set the onPost lifecycle hook
	 *
	 * @param {Function} callback - Called after rule conversion is complete
	 * @returns {ProfileBuilder} This builder instance for chaining
	 */
	onPost(callback) {
		if (typeof callback !== 'function') {
			throw new ProfileValidationError(
				'onPost hook must be a function',
				'hooks.onPost'
			);
		}
		this._config.hooks.onPost = callback;
		return this;
	}

	/**
	 * Create a new ProfileBuilder that extends an existing profile
	 *
	 * @param {Profile} baseProfile - Profile to extend
	 * @returns {ProfileBuilder} New builder instance with base profile settings
	 */
	static extend(baseProfile) {
		const builder = new ProfileBuilder();

		// Copy all configuration from base profile
		builder._config = {
			profileName: baseProfile.profileName,
			displayName: baseProfile.displayName,
			rulesDir: baseProfile.rulesDir,
			profileDir: baseProfile.profileDir,
			fileMap: { ...baseProfile.fileMap },
			conversionConfig: { ...baseProfile.conversionConfig },
			globalReplacements: [...baseProfile.globalReplacements],
			mcpConfig: baseProfile.mcpConfig,
			includeDefaultRules: baseProfile.includeDefaultRules,
			supportsRulesSubdirectories: baseProfile.supportsRulesSubdirectories,
			hooks: { ...baseProfile.hooks }
		};

		return builder;
	}

	/**
	 * Create a minimal profile configuration with smart defaults
	 *
	 * @param {string} name - Profile name
	 * @returns {ProfileBuilder} Builder instance with minimal defaults set
	 */
	static minimal(name) {
		return new ProfileBuilder()
			.withName(name)
			.display(name.charAt(0).toUpperCase() + name.slice(1))
			.rulesDir(`.${name.toLowerCase()}/rules`)
			.profileDir(`.${name.toLowerCase()}`)
			.fileMap({})
			.conversion({})
			.globalReplacements([])
			.mcpConfig(true)
			.includeDefaultRules(true)
			.supportsSubdirectories(false);
	}

	/**
	 * Build and validate the Profile instance
	 *
	 * @returns {Profile} Immutable Profile instance
	 * @throws {ProfileValidationError} If required fields are missing or invalid
	 */
	build() {
		// Validate required fields
		const required = ['profileName', 'rulesDir', 'profileDir'];
		for (const field of required) {
			if (!this._config[field]) {
				throw new ProfileValidationError(
					`Missing required field: ${field}`,
					field,
					this._config.profileName
				);
			}
		}

		// Validate profile name format (alphanumeric, hyphens, underscores only)
		const namePattern = /^[a-zA-Z0-9_-]+$/;
		if (!namePattern.test(this._config.profileName)) {
			throw new ProfileValidationError(
				'Profile name must contain only alphanumeric characters, hyphens, and underscores',
				'profileName',
				this._config.profileName
			);
		}

		// Generate default file mappings if includeDefaultRules is true
		if (this._config.includeDefaultRules) {
			const profileName = this._config.profileName.toLowerCase();
			const targetExtension = this._config.targetExtension || '.md'; // Use configured or default target extension
			const supportsSubdirectories =
				this._config.supportsRulesSubdirectories || false;

			// Use taskmaster subdirectory only if profile supports it
			const taskmasterPrefix = supportsSubdirectories ? 'taskmaster/' : '';

			const defaultFileMap = {
				'rules/cursor_rules.mdc': `${profileName}_rules${targetExtension}`,
				'rules/dev_workflow.mdc': `${taskmasterPrefix}dev_workflow${targetExtension}`,
				'rules/self_improve.mdc': `self_improve${targetExtension}`,
				'rules/taskmaster.mdc': `${taskmasterPrefix}taskmaster${targetExtension}`
			};

			// Merge defaults with any custom fileMap entries
			this._config.fileMap = {
				...defaultFileMap,
				...(this._config.fileMap || {})
			};
		}

		// Validate file map structure if provided
		if (this._config.fileMap) {
			for (const [source, target] of Object.entries(this._config.fileMap)) {
				if (typeof source !== 'string' || typeof target !== 'string') {
					throw new ProfileValidationError(
						'File map entries must be string to string mappings',
						'fileMap',
						this._config.profileName
					);
				}
			}
		}

		// Create and return the immutable Profile
		return new Profile(this._config);
	}
}
