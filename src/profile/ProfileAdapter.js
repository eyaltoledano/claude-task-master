/**
 * @fileoverview Adapter for wrapping legacy profile objects as Profile instances
 * Enables gradual migration by allowing both old and new profile formats to coexist
 */

import Profile from './Profile.js';

/**
 * Adapter class for converting legacy profile objects to Profile instances
 * 
 * @class ProfileAdapter
 */
export class ProfileAdapter {
	/**
	 * Convert a legacy profile object to a Profile instance
	 * 
	 * @param {Object} legacyProfile - Legacy profile object
	 * @returns {Profile} Profile instance
	 */
	static adaptLegacyProfile(legacyProfile) {
		if (!legacyProfile) {
			throw new Error('Legacy profile cannot be null or undefined');
		}

		// If it's already a Profile instance, return as-is
		if (legacyProfile instanceof Profile) {
			return legacyProfile;
		}

		// Validate required fields for legacy profiles
		if (typeof legacyProfile.profileName !== 'string' || 
			typeof legacyProfile.rulesDir !== 'string' || 
			typeof legacyProfile.profileDir !== 'string') {
			throw new Error('Legacy profile missing required fields: profileName, rulesDir, profileDir');
		}

		// Extract hooks from legacy format
		const hooks = {};
		if (legacyProfile.onAddRulesProfile) {
			hooks.onAdd = legacyProfile.onAddRulesProfile;
		}
		if (legacyProfile.onRemoveRulesProfile) {
			hooks.onRemove = legacyProfile.onRemoveRulesProfile;
		}
		if (legacyProfile.onPostConvertRulesProfile) {
			hooks.onPost = legacyProfile.onPostConvertRulesProfile;
		}

		// Map legacy structure to new Profile config
		const config = {
			profileName: legacyProfile.profileName,
			displayName: legacyProfile.displayName,
			rulesDir: legacyProfile.rulesDir,
			profileDir: legacyProfile.profileDir,
			fileMap: legacyProfile.fileMap || {},
			conversionConfig: legacyProfile.conversionConfig || {},
			globalReplacements: legacyProfile.globalReplacements || [],
			mcpConfig: legacyProfile.mcpConfig,
			hooks,
			includeDefaultRules: legacyProfile.includeDefaultRules,
			supportsRulesSubdirectories: legacyProfile.supportsRulesSubdirectories
		};

		return new Profile(config);
	}

	/**
	 * Convert multiple legacy profiles to Profile instances
	 * 
	 * @param {Object[]} legacyProfiles - Array of legacy profile objects
	 * @returns {{profiles: Profile[], errors: Array<{name: string, error: string}>}} Conversion results
	 */
	static adaptLegacyProfiles(legacyProfiles) {
		const results = {
			profiles: [],
			errors: []
		};

		for (const legacyProfile of legacyProfiles) {
			try {
				const profile = this.adaptLegacyProfile(legacyProfile);
				results.profiles.push(profile);
			} catch (error) {
				results.errors.push({
					name: legacyProfile?.profileName || 'unknown',
					error: error.message
				});
			}
		}

		return results;
	}

	/**
	 * Check if an object appears to be a legacy profile
	 * 
	 * @param {*} obj - Object to check
	 * @returns {boolean} True if appears to be a legacy profile
	 */
	static isLegacyProfile(obj) {
		if (!obj || typeof obj !== 'object' || obj instanceof Profile) {
			return false;
		}
		
		return typeof obj.profileName === 'string' &&
			typeof obj.rulesDir === 'string' &&
			typeof obj.profileDir === 'string';
	}

	/**
	 * Create a bridge function that returns Profile instances from legacy lookup
	 * 
	 * @param {function(string): Object} legacyLookupFn - Legacy profile lookup function
	 * @returns {function(string): Profile|null} Profile lookup function
	 */
	static createBridgeLookup(legacyLookupFn) {
		const cache = new Map();

		return (name) => {
			// Check cache first
			if (cache.has(name)) {
				return cache.get(name);
			}

			// Get legacy profile
			const legacyProfile = legacyLookupFn(name);
			if (!legacyProfile) {
				cache.set(name, null);
				return null;
			}

			// Convert and cache
			try {
				const profile = this.adaptLegacyProfile(legacyProfile);
				cache.set(name, profile);
				return profile;
			} catch (error) {
				console.warn(`Failed to adapt legacy profile '${name}':`, error.message);
				cache.set(name, null);
				return null;
			}
		};
	}

	/**
	 * Validate that a legacy profile has the minimum required structure
	 * 
	 * @param {Object} legacyProfile - Legacy profile to validate
	 * @returns {{valid: boolean, errors: string[]}} Validation result
	 */
	static validateLegacyProfile(legacyProfile) {
		const errors = [];

		if (!legacyProfile) {
			errors.push('Profile is null or undefined');
			return { valid: false, errors };
		}

		// Check required fields
		if (!legacyProfile.profileName || typeof legacyProfile.profileName !== 'string') {
			errors.push('Missing or invalid profileName');
		}

		if (!legacyProfile.rulesDir || typeof legacyProfile.rulesDir !== 'string') {
			errors.push('Missing or invalid rulesDir');
		}

		if (!legacyProfile.profileDir || typeof legacyProfile.profileDir !== 'string') {
			errors.push('Missing or invalid profileDir');
		}

		// Check optional but important fields
		if (legacyProfile.fileMap && typeof legacyProfile.fileMap !== 'object') {
			errors.push('Invalid fileMap - must be object');
		}

		if (legacyProfile.globalReplacements && !Array.isArray(legacyProfile.globalReplacements)) {
			errors.push('Invalid globalReplacements - must be array');
		}

		if (legacyProfile.conversionConfig && typeof legacyProfile.conversionConfig !== 'object') {
			errors.push('Invalid conversionConfig - must be object');
		}

		// Check lifecycle hooks
		const hookFields = ['onAddRulesProfile', 'onRemoveRulesProfile', 'onPostConvertRulesProfile'];
		for (const field of hookFields) {
			if (legacyProfile[field] && typeof legacyProfile[field] !== 'function') {
				errors.push(`Invalid ${field} - must be function`);
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
} 