/**
 * @fileoverview Centralized registry for managing Profile instances
 */

import { ProfileError } from './ProfileError.js';
import {
	ProfileNotFoundError,
	ProfileRegistrationError
} from './ProfileError.js';

/**
 * Centralized registry for managing Profile instances
 * Implements singleton pattern for global profile management
 *
 * @class ProfileRegistry
 */
class ProfileRegistry {
	/**
	 * Creates a new ProfileRegistry instance
	 * @private
	 */
	constructor() {
		/** @type {Map<string, import('./Profile.js').default>} */
		this._profiles = new Map();

		/** @type {boolean} */
		this._sealed = false;
	}

	/**
	 * Register a new profile in the registry
	 *
	 * @param {import('./Profile.js').default} profile - Profile instance to register
	 * @throws {ProfileRegistrationError} If profile is already registered or registry is sealed
	 */
	register(profile) {
		if (this._sealed) {
			throw new ProfileRegistrationError(
				profile.profileName,
				'Registry is sealed, no new profiles can be registered'
			);
		}

		// Validate profile instance first
		if (!profile || typeof profile.profileName !== 'string') {
			throw new ProfileRegistrationError(
				'unknown',
				'Invalid profile instance - must have profileName property'
			);
		}

		if (this._profiles.has(profile.profileName)) {
			throw new ProfileRegistrationError(
				profile.profileName,
				'Profile already registered'
			);
		}

		this._profiles.set(profile.profileName, profile);
	}

	/**
	 * Get a profile by name
	 *
	 * @param {string} name - Profile name to lookup
	 * @returns {import('./Profile.js').default|null} Profile instance or null if not found
	 */
	get(name) {
		return this._profiles.get(name) || null;
	}

	/**
	 * Get a profile by name, throwing if not found
	 *
	 * @param {string} name - Profile name to lookup
	 * @returns {import('./Profile.js').default} Profile instance
	 * @throws {ProfileNotFoundError} If profile is not found
	 */
	getRequired(name) {
		const profile = this.get(name);
		if (!profile) {
			throw new ProfileNotFoundError(name, this.names());
		}
		return profile;
	}

	/**
	 * Check if a profile is registered
	 *
	 * @param {string} name - Profile name to check
	 * @returns {boolean} True if profile exists
	 */
	has(name) {
		return this._profiles.has(name);
	}

	/**
	 * Get all registered profiles
	 *
	 * @returns {import('./Profile.js').default[]} Array of all profile instances
	 */
	all() {
		return Array.from(this._profiles.values());
	}

	/**
	 * Get all registered profile names
	 *
	 * @returns {string[]} Array of profile names
	 */
	names() {
		return Array.from(this._profiles.keys()).sort();
	}

	/**
	 * Get the number of registered profiles
	 *
	 * @returns {number} Number of registered profiles
	 */
	size() {
		return this._profiles.size;
	}

	/**
	 * Check if the registry is empty
	 *
	 * @returns {boolean} True if no profiles are registered
	 */
	isEmpty() {
		return this._profiles.size === 0;
	}

	/**
	 * Clear all registered profiles (for testing)
	 * Only available when registry is not sealed
	 *
	 * @throws {ProfileError} If registry is sealed
	 */
	reset() {
		if (this._sealed) {
			throw new ProfileError('Cannot reset sealed registry');
		}
		this._profiles.clear();
	}

	/**
	 * Seal the registry to prevent further modifications
	 * Once sealed, no new profiles can be registered and reset() is disabled
	 * This is useful for production environments
	 */
	seal() {
		this._sealed = true;
		Object.freeze(this);
	}

	/**
	 * Check if the registry is sealed
	 *
	 * @returns {boolean} True if registry is sealed
	 */
	isSealed() {
		return this._sealed;
	}

	/**
	 * Bulk register multiple profiles
	 *
	 * @param {import('./Profile.js').default[]} profiles - Array of profiles to register
	 * @returns {{success: number, failed: Array<{profile: string, error: string}>}} Registration results
	 */
	registerAll(profiles) {
		const results = {
			success: 0,
			failed: []
		};

		for (const profile of profiles) {
			try {
				this.register(profile);
				results.success++;
			} catch (error) {
				results.failed.push({
					profile: profile?.profileName || 'unknown',
					error: error.message
				});
			}
		}

		return results;
	}

	/**
	 * Find profiles matching a predicate function
	 *
	 * @param {function(import('./Profile.js').default): boolean} predicate - Function to test profiles
	 * @returns {import('./Profile.js').default[]} Array of matching profiles
	 */
	filter(predicate) {
		return this.all().filter(predicate);
	}

	/**
	 * Get profiles that have MCP configuration enabled
	 *
	 * @returns {import('./Profile.js').default[]} Profiles with MCP config
	 */
	getMcpEnabledProfiles() {
		return this.filter((profile) => profile.hasMcpConfig());
	}

	/**
	 * Get profiles that include default rules
	 *
	 * @returns {import('./Profile.js').default[]} Profiles with default rules
	 */
	getDefaultRuleProfiles() {
		return this.filter((profile) => profile.hasDefaultRules());
	}

	/**
	 * Get profiles that have lifecycle hooks
	 *
	 * @returns {import('./Profile.js').default[]} Profiles with hooks
	 */
	getProfilesWithHooks() {
		return this.filter((profile) => profile.hasHooks());
	}

	/**
	 * Get profile statistics
	 *
	 * @returns {Object} Registry statistics
	 */
	getStats() {
		const profiles = this.all();
		return {
			total: profiles.length,
			withMcp: profiles.filter((p) => p.hasMcpConfig()).length,
			withDefaultRules: profiles.filter((p) => p.hasDefaultRules()).length,
			withHooks: profiles.filter((p) => p.hasHooks()).length,
			sealed: this._sealed
		};
	}

	/**
	 * Export registry state for debugging/inspection
	 *
	 * @returns {Object} Registry state information
	 */
	debug() {
		return {
			profileCount: this.size(),
			profileNames: this.names(),
			sealed: this._sealed,
			stats: this.getStats()
		};
	}
}

// Create and export singleton instance
export const profileRegistry = new ProfileRegistry();

// Export the class for testing purposes
export { ProfileRegistry };
