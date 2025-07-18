/**
 * @fileoverview Unit tests for ProfileRegistry class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProfileRegistry, profileRegistry } from '../../../../src/profile/ProfileRegistry.js';
import { ProfileBuilder } from '../../../../src/profile/ProfileBuilder.js';
import { ProfileNotFoundError, ProfileRegistrationError } from '../../../../src/profile/ProfileError.js';

describe('ProfileRegistry', () => {
	let registry;

	beforeEach(() => {
		// Create a fresh registry for each test
		registry = new ProfileRegistry();
	});

	describe('constructor', () => {
		it('should initialize with empty registry', () => {
			expect(registry.size()).toBe(0);
			expect(registry.isEmpty()).toBe(true);
			expect(registry.isSealed()).toBe(false);
		});
	});

	describe('register', () => {
		it('should register a valid profile', () => {
			const profile = new ProfileBuilder()
				.withName('test-profile')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(profile);

			expect(registry.size()).toBe(1);
			expect(registry.has('test-profile')).toBe(true);
		});

		it('should throw for duplicate registration', () => {
			const profile1 = new ProfileBuilder()
				.withName('duplicate')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			const profile2 = new ProfileBuilder()
				.withName('duplicate')
				.rulesDir('.other/rules')
				.profileDir('.other')
				.build();

			registry.register(profile1);

			expect(() => registry.register(profile2))
				.toThrow(ProfileRegistrationError);
		});

		it('should throw for invalid profile instance', () => {
			expect(() => registry.register(null))
				.toThrow(ProfileRegistrationError);

			expect(() => registry.register({}))
				.toThrow(ProfileRegistrationError);

			expect(() => registry.register({ profileName: 123 }))
				.toThrow(ProfileRegistrationError);
		});

		it('should throw when registry is sealed', () => {
			const profile = new ProfileBuilder()
				.withName('test')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.seal();

			expect(() => registry.register(profile))
				.toThrow(ProfileRegistrationError);
		});
	});

	describe('get', () => {
		let testProfile;

		beforeEach(() => {
			testProfile = new ProfileBuilder()
				.withName('test-profile')
				.display('Test Profile')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(testProfile);
		});

		it('should return registered profile', () => {
			const result = registry.get('test-profile');

			expect(result).toBe(testProfile);
		});

		it('should return null for unregistered profile', () => {
			const result = registry.get('non-existent');

			expect(result).toBeNull();
		});

		it('should be case sensitive', () => {
			const result = registry.get('Test-Profile');

			expect(result).toBeNull();
		});
	});

	describe('getRequired', () => {
		let testProfile;

		beforeEach(() => {
			testProfile = new ProfileBuilder()
				.withName('test-profile')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(testProfile);
		});

		it('should return registered profile', () => {
			const result = registry.getRequired('test-profile');

			expect(result).toBe(testProfile);
		});

		it('should throw ProfileNotFoundError for unregistered profile', () => {
			expect(() => registry.getRequired('non-existent'))
				.toThrow(ProfileNotFoundError);
		});

		it('should include available profiles in error', () => {
			try {
				registry.getRequired('non-existent');
			} catch (error) {
				expect(error.availableProfiles).toEqual(['test-profile']);
			}
		});
	});

	describe('has', () => {
		beforeEach(() => {
			const profile = new ProfileBuilder()
				.withName('test-profile')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(profile);
		});

		it('should return true for registered profile', () => {
			expect(registry.has('test-profile')).toBe(true);
		});

		it('should return false for unregistered profile', () => {
			expect(registry.has('non-existent')).toBe(false);
		});
	});

	describe('all', () => {
		it('should return empty array for empty registry', () => {
			expect(registry.all()).toEqual([]);
		});

		it('should return all registered profiles', () => {
			const profile1 = new ProfileBuilder()
				.withName('profile1')
				.rulesDir('.p1/rules')
				.profileDir('.p1')
				.build();

			const profile2 = new ProfileBuilder()
				.withName('profile2')
				.rulesDir('.p2/rules')
				.profileDir('.p2')
				.build();

			registry.register(profile1);
			registry.register(profile2);

			const result = registry.all();

			expect(result).toHaveLength(2);
			expect(result).toContain(profile1);
			expect(result).toContain(profile2);
		});

		it('should return a copy of the profiles array', () => {
			const profile = new ProfileBuilder()
				.withName('test')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(profile);

			const result1 = registry.all();
			const result2 = registry.all();

			expect(result1).toEqual(result2);
			expect(result1).not.toBe(result2); // Different array instances
		});
	});

	describe('names', () => {
		it('should return empty array for empty registry', () => {
			expect(registry.names()).toEqual([]);
		});

		it('should return sorted profile names', () => {
			const profiles = ['charlie', 'alpha', 'bravo'].map(name => 
				new ProfileBuilder()
					.withName(name)
					.rulesDir(`.${name}/rules`)
					.profileDir(`.${name}`)
					.build()
			);

			profiles.forEach(profile => registry.register(profile));

			expect(registry.names()).toEqual(['alpha', 'bravo', 'charlie']);
		});
	});

	describe('size and isEmpty', () => {
		it('should track registry size correctly', () => {
			expect(registry.size()).toBe(0);
			expect(registry.isEmpty()).toBe(true);

			const profile1 = new ProfileBuilder()
				.withName('profile1')
				.rulesDir('.p1/rules')
				.profileDir('.p1')
				.build();

			registry.register(profile1);

			expect(registry.size()).toBe(1);
			expect(registry.isEmpty()).toBe(false);

			const profile2 = new ProfileBuilder()
				.withName('profile2')
				.rulesDir('.p2/rules')
				.profileDir('.p2')
				.build();

			registry.register(profile2);

			expect(registry.size()).toBe(2);
			expect(registry.isEmpty()).toBe(false);
		});
	});

	describe('reset', () => {
		it('should clear all profiles', () => {
			const profile = new ProfileBuilder()
				.withName('test')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(profile);
			expect(registry.size()).toBe(1);

			registry.reset();

			expect(registry.size()).toBe(0);
			expect(registry.isEmpty()).toBe(true);
		});

		it('should throw when registry is sealed', () => {
			registry.seal();

			expect(() => registry.reset()).toThrow();
		});
	});

	describe('seal', () => {
		it('should prevent new registrations', () => {
			const profile = new ProfileBuilder()
				.withName('test')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.seal();

			expect(registry.isSealed()).toBe(true);
			expect(() => registry.register(profile))
				.toThrow(ProfileRegistrationError);
		});

		it('should prevent reset', () => {
			registry.seal();

			expect(() => registry.reset()).toThrow();
		});

		it('should still allow read operations', () => {
			const profile = new ProfileBuilder()
				.withName('test')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			registry.register(profile);
			registry.seal();

			expect(registry.get('test')).toBe(profile);
			expect(registry.has('test')).toBe(true);
			expect(registry.size()).toBe(1);
			expect(registry.names()).toEqual(['test']);
		});
	});

	describe('registerAll', () => {
		it('should register multiple profiles successfully', () => {
			const profiles = ['profile1', 'profile2', 'profile3'].map(name =>
				new ProfileBuilder()
					.withName(name)
					.rulesDir(`.${name}/rules`)
					.profileDir(`.${name}`)
					.build()
			);

			const result = registry.registerAll(profiles);

			expect(result.success).toBe(3);
			expect(result.failed).toEqual([]);
			expect(registry.size()).toBe(3);
		});

		it('should handle partial failures gracefully', () => {
			const validProfile = new ProfileBuilder()
				.withName('valid')
				.rulesDir('.valid/rules')
				.profileDir('.valid')
				.build();

			const invalidProfile = null;

			const result = registry.registerAll([validProfile, invalidProfile]);

			expect(result.success).toBe(1);
			expect(result.failed).toHaveLength(1);
			expect(result.failed[0].profile).toBe('unknown');
			expect(registry.size()).toBe(1);
		});

		it('should track duplicate registration failures', () => {
			const profile1 = new ProfileBuilder()
				.withName('duplicate')
				.rulesDir('.dup1/rules')
				.profileDir('.dup1')
				.build();

			const profile2 = new ProfileBuilder()
				.withName('duplicate')
				.rulesDir('.dup2/rules')
				.profileDir('.dup2')
				.build();

			const result = registry.registerAll([profile1, profile2]);

			expect(result.success).toBe(1);
			expect(result.failed).toHaveLength(1);
			expect(result.failed[0].profile).toBe('duplicate');
			expect(registry.size()).toBe(1);
		});
	});

	describe('filter', () => {
		beforeEach(() => {
			const profiles = [
				new ProfileBuilder()
					.withName('mcp-enabled')
					.rulesDir('.mcp/rules')
					.profileDir('.mcp')
					.mcpConfig(true)
					.includeDefaultRules(true)
					.build(),
				new ProfileBuilder()
					.withName('no-mcp')
					.rulesDir('.nomcp/rules')
					.profileDir('.nomcp')
					.mcpConfig(false)
					.includeDefaultRules(false)
					.build(),
				new ProfileBuilder()
					.withName('with-hooks')
					.rulesDir('.hooks/rules')
					.profileDir('.hooks')
					.mcpConfig(true)  // Explicitly set mcpConfig to true
					.onAdd(() => {})
					.build()
			];

			profiles.forEach(profile => registry.register(profile));
		});

		it('should filter profiles by predicate', () => {
			const mcpProfiles = registry.filter(profile => profile.hasMcpConfig());

			expect(mcpProfiles).toHaveLength(2); // mcp-enabled and with-hooks (default mcpConfig: true)
			expect(mcpProfiles.map(p => p.profileName)).toContain('mcp-enabled');
			expect(mcpProfiles.map(p => p.profileName)).toContain('with-hooks');
		});
	});

	describe('convenience filter methods', () => {
		beforeEach(() => {
			const profiles = [
				new ProfileBuilder()
					.withName('full-profile')
					.rulesDir('.full/rules')
					.profileDir('.full')
					.mcpConfig(true)
					.includeDefaultRules(true)
					.onAdd(() => {})
					.build(),
				new ProfileBuilder()
					.withName('minimal-profile')
					.rulesDir('.minimal/rules')
					.profileDir('.minimal')
					.mcpConfig(false)
					.includeDefaultRules(false)
					.build()
			];

			profiles.forEach(profile => registry.register(profile));
		});

		describe('getMcpEnabledProfiles', () => {
			it('should return profiles with MCP config enabled', () => {
				const result = registry.getMcpEnabledProfiles();

				expect(result).toHaveLength(1);
				expect(result[0].profileName).toBe('full-profile');
			});
		});

		describe('getDefaultRuleProfiles', () => {
			it('should return profiles that include default rules', () => {
				const result = registry.getDefaultRuleProfiles();

				expect(result).toHaveLength(1);
				expect(result[0].profileName).toBe('full-profile');
			});
		});

		describe('getProfilesWithHooks', () => {
			it('should return profiles that have lifecycle hooks', () => {
				const result = registry.getProfilesWithHooks();

				expect(result).toHaveLength(1);
				expect(result[0].profileName).toBe('full-profile');
			});
		});
	});

	describe('getStats', () => {
		it('should return accurate statistics', () => {
			const profiles = [
				new ProfileBuilder()
					.withName('full')
					.rulesDir('.full/rules')
					.profileDir('.full')
					.mcpConfig(true)
					.includeDefaultRules(true)
					.onAdd(() => {})
					.build(),
				new ProfileBuilder()
					.withName('partial')
					.rulesDir('.partial/rules')
					.profileDir('.partial')
					.mcpConfig(false)
					.includeDefaultRules(true)
					.build(),
				new ProfileBuilder()
					.withName('minimal')
					.rulesDir('.minimal/rules')
					.profileDir('.minimal')
					.mcpConfig(false)
					.includeDefaultRules(false)
					.build()
			];

			profiles.forEach(profile => registry.register(profile));

			const stats = registry.getStats();

			expect(stats).toEqual({
				total: 3,
				withMcp: 1,
				withDefaultRules: 2,
				withHooks: 1,
				sealed: false
			});
		});

		it('should reflect sealed status', () => {
			registry.seal();

			const stats = registry.getStats();

			expect(stats.sealed).toBe(true);
		});
	});

	describe('debug', () => {
		it('should return debug information', () => {
			const profile = new ProfileBuilder()
				.withName('debug-test')
				.rulesDir('.debug/rules')
				.profileDir('.debug')
				.build();

			registry.register(profile);

			const debug = registry.debug();

			expect(debug.profileCount).toBe(1);
			expect(debug.profileNames).toEqual(['debug-test']);
			expect(debug.sealed).toBe(false);
			expect(debug.stats).toBeDefined();
		});
	});

	describe('singleton instance', () => {
		it('should export a singleton registry instance', () => {
			expect(profileRegistry).toBeInstanceOf(ProfileRegistry);
		});

		it('should be the same instance across imports', async () => {
			const { profileRegistry: registry2 } = await import('../../../../src/profile/ProfileRegistry.js');
			expect(profileRegistry).toBe(registry2);
		});
	});
}); 