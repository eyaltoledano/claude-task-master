/**
 * @fileoverview Unit tests for ProfileAdapter class
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ProfileAdapter } from '../../../../src/profile/ProfileAdapter.js';
import Profile from '../../../../src/profile/Profile.js';

describe('ProfileAdapter', () => {
	describe('adaptLegacyProfile', () => {
		it('should adapt a basic legacy profile', () => {
			const legacyProfile = {
				profileName: 'legacy-test',
				displayName: 'Legacy Test',
				rulesDir: '.legacy/rules',
				profileDir: '.legacy',
				fileMap: { 'source.mdc': 'target.md' },
				conversionConfig: { toolNames: {} },
				globalReplacements: [{ from: 'old', to: 'new' }],
				mcpConfig: true,
				includeDefaultRules: true,
				supportsRulesSubdirectories: false
			};

			const profile = ProfileAdapter.adaptLegacyProfile(legacyProfile);

			expect(profile).toBeInstanceOf(Profile);
			expect(profile.profileName).toBe('legacy-test');
			expect(profile.displayName).toBe('Legacy Test');
			expect(profile.rulesDir).toBe('.legacy/rules');
			expect(profile.profileDir).toBe('.legacy');
			expect(profile.fileMap).toEqual({ 'source.mdc': 'target.md' });
			expect(profile.conversionConfig).toEqual({ toolNames: {} });
			expect(profile.globalReplacements).toEqual([{ from: 'old', to: 'new' }]);
			expect(profile.mcpConfig).toBe(true);
			expect(profile.includeDefaultRules).toBe(true);
			expect(profile.supportsRulesSubdirectories).toBe(false);
		});

		it('should handle legacy profile with lifecycle hooks', () => {
			const onAddFn = jest.fn();
			const onRemoveFn = jest.fn();
			const onPostFn = jest.fn();

			const legacyProfile = {
				profileName: 'legacy-with-hooks',
				rulesDir: '.legacy/rules',
				profileDir: '.legacy',
				onAddRulesProfile: onAddFn,
				onRemoveRulesProfile: onRemoveFn,
				onPostConvertRulesProfile: onPostFn
			};

			const profile = ProfileAdapter.adaptLegacyProfile(legacyProfile);

			expect(profile.hooks.onAdd).toBe(onAddFn);
			expect(profile.hooks.onRemove).toBe(onRemoveFn);
			expect(profile.hooks.onPost).toBe(onPostFn);
		});

		it('should handle legacy profile with missing optional fields', () => {
			const legacyProfile = {
				profileName: 'minimal-legacy',
				rulesDir: '.minimal/rules',
				profileDir: '.minimal'
				// No optional fields
			};

			const profile = ProfileAdapter.adaptLegacyProfile(legacyProfile);

			expect(profile.profileName).toBe('minimal-legacy');
			expect(profile.fileMap).toEqual({});
			expect(profile.conversionConfig).toEqual({});
			expect(profile.globalReplacements).toEqual([]);
			expect(profile.hooks).toEqual({});
		});

		it('should return Profile instance unchanged if already a Profile', () => {
			const existingProfile = new Profile({
				profileName: 'existing',
				rulesDir: '.existing/rules',
				profileDir: '.existing'
			});

			const result = ProfileAdapter.adaptLegacyProfile(existingProfile);

			expect(result).toBe(existingProfile);
		});

		it('should throw for null or undefined input', () => {
			expect(() => ProfileAdapter.adaptLegacyProfile(null))
				.toThrow('Legacy profile cannot be null or undefined');

			expect(() => ProfileAdapter.adaptLegacyProfile(undefined))
				.toThrow('Legacy profile cannot be null or undefined');
		});

		it('should handle complex legacy profile structure', () => {
			const legacyProfile = {
				profileName: 'complex-legacy',
				displayName: 'Complex Legacy Profile',
				rulesDir: '.complex/rules',
				profileDir: '.complex',
				fileMap: {
					'rules/cursor_rules.mdc': 'complex_rules.md',
					'rules/dev_workflow.mdc': 'dev_workflow.md'
				},
				conversionConfig: {
					profileTerms: [{ from: /cursor/g, to: 'complex' }],
					toolNames: { edit_file: 'modify_file' },
					toolContexts: [],
					toolGroups: [],
					docUrls: [],
					fileReferences: {
						pathPattern: /test/,
						replacement: 'test-replacement'
					}
				},
				globalReplacements: [
					{ from: /old-pattern/g, to: 'new-pattern' },
					{ from: 'simple-replace', to: 'simple-result' }
				],
				mcpConfig: {
					configName: 'custom-mcp.json'
				},
				includeDefaultRules: false,
				supportsRulesSubdirectories: true,
				onAddRulesProfile: () => console.log('add'),
				onRemoveRulesProfile: () => console.log('remove')
			};

			const profile = ProfileAdapter.adaptLegacyProfile(legacyProfile);

			expect(profile.profileName).toBe('complex-legacy');
			expect(profile.displayName).toBe('Complex Legacy Profile');
			expect(profile.fileMap).toEqual(legacyProfile.fileMap);
			expect(profile.conversionConfig).toEqual(legacyProfile.conversionConfig);
			expect(profile.globalReplacements).toEqual(legacyProfile.globalReplacements);
			expect(profile.mcpConfig).toEqual({ configName: 'custom-mcp.json' });
			expect(profile.includeDefaultRules).toBe(false);
			expect(profile.supportsRulesSubdirectories).toBe(true);
			expect(typeof profile.hooks.onAdd).toBe('function');
			expect(typeof profile.hooks.onRemove).toBe('function');
		});
	});

	describe('adaptLegacyProfiles', () => {
		it('should adapt multiple valid legacy profiles', () => {
			const legacyProfiles = [
				{
					profileName: 'legacy1',
					rulesDir: '.legacy1/rules',
					profileDir: '.legacy1'
				},
				{
					profileName: 'legacy2',
					rulesDir: '.legacy2/rules',
					profileDir: '.legacy2'
				}
			];

			const result = ProfileAdapter.adaptLegacyProfiles(legacyProfiles);

			expect(result.profiles).toHaveLength(2);
			expect(result.errors).toHaveLength(0);
			expect(result.profiles[0]).toBeInstanceOf(Profile);
			expect(result.profiles[1]).toBeInstanceOf(Profile);
			expect(result.profiles[0].profileName).toBe('legacy1');
			expect(result.profiles[1].profileName).toBe('legacy2');
		});

		it('should handle mixed valid and invalid profiles', () => {
			const legacyProfiles = [
				{
					profileName: 'valid',
					rulesDir: '.valid/rules',
					profileDir: '.valid'
				},
				null, // Invalid
				{
					profileName: 'another-valid',
					rulesDir: '.another/rules',
					profileDir: '.another'
				}
			];

			const result = ProfileAdapter.adaptLegacyProfiles(legacyProfiles);

			expect(result.profiles).toHaveLength(2);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].name).toBe('unknown');
			expect(result.errors[0].error).toContain('Legacy profile cannot be null');
		});

		it('should handle all invalid profiles', () => {
			const legacyProfiles = [null, undefined, {}];

			const result = ProfileAdapter.adaptLegacyProfiles(legacyProfiles);

			expect(result.profiles).toHaveLength(0);
			expect(result.errors).toHaveLength(3);
		});

		it('should handle empty array', () => {
			const result = ProfileAdapter.adaptLegacyProfiles([]);

			expect(result.profiles).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('isLegacyProfile', () => {
		it('should return true for valid legacy profile objects', () => {
			const legacyProfile = {
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: '.test'
			};

			expect(ProfileAdapter.isLegacyProfile(legacyProfile)).toBe(true);
		});

		it('should return false for Profile instances', () => {
			const profile = new Profile({
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: '.test'
			});

			expect(ProfileAdapter.isLegacyProfile(profile)).toBe(false);
		});

		it('should return false for objects missing required fields', () => {
			expect(ProfileAdapter.isLegacyProfile({})).toBe(false);
			expect(ProfileAdapter.isLegacyProfile({ profileName: 'test' })).toBe(false);
			expect(ProfileAdapter.isLegacyProfile({ 
				profileName: 'test', 
				rulesDir: '.test/rules' 
			})).toBe(false);
		});

		it('should return false for null, undefined, or non-objects', () => {
			expect(ProfileAdapter.isLegacyProfile(null)).toBe(false);
			expect(ProfileAdapter.isLegacyProfile(undefined)).toBe(false);
			expect(ProfileAdapter.isLegacyProfile('string')).toBe(false);
			expect(ProfileAdapter.isLegacyProfile(123)).toBe(false);
			expect(ProfileAdapter.isLegacyProfile([])).toBe(false);
		});

		it('should return false for objects with non-string required fields', () => {
			expect(ProfileAdapter.isLegacyProfile({
				profileName: 123,
				rulesDir: '.test/rules',
				profileDir: '.test'
			})).toBe(false);

			expect(ProfileAdapter.isLegacyProfile({
				profileName: 'test',
				rulesDir: 123,
				profileDir: '.test'
			})).toBe(false);

			expect(ProfileAdapter.isLegacyProfile({
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: 123
			})).toBe(false);
		});
	});

	describe('createBridgeLookup', () => {
		it('should create a lookup function that adapts legacy profiles', () => {
			const legacyProfiles = {
				'test1': {
					profileName: 'test1',
					rulesDir: '.test1/rules',
					profileDir: '.test1'
				},
				'test2': {
					profileName: 'test2',
					rulesDir: '.test2/rules',
					profileDir: '.test2'
				}
			};

			const legacyLookup = (name) => legacyProfiles[name] || null;
			const bridgeLookup = ProfileAdapter.createBridgeLookup(legacyLookup);

			const profile1 = bridgeLookup('test1');
			const profile2 = bridgeLookup('test2');
			const profile3 = bridgeLookup('nonexistent');

			expect(profile1).toBeInstanceOf(Profile);
			expect(profile1.profileName).toBe('test1');
			expect(profile2).toBeInstanceOf(Profile);
			expect(profile2.profileName).toBe('test2');
			expect(profile3).toBeNull();
		});

		it('should cache lookup results', () => {
			const mockLegacyLookup = jest.fn((name) => {
				if (name === 'test') {
					return {
						profileName: 'test',
						rulesDir: '.test/rules',
						profileDir: '.test'
					};
				}
				return null;
			});

			const bridgeLookup = ProfileAdapter.createBridgeLookup(mockLegacyLookup);

			// First call
			const profile1 = bridgeLookup('test');
			// Second call
			const profile2 = bridgeLookup('test');

			expect(profile1).toBe(profile2); // Same instance from cache
			expect(mockLegacyLookup).toHaveBeenCalledTimes(1); // Only called once
		});

		it('should cache null results', () => {
			const mockLegacyLookup = jest.fn(() => null);
			const bridgeLookup = ProfileAdapter.createBridgeLookup(mockLegacyLookup);

			bridgeLookup('nonexistent');
			bridgeLookup('nonexistent');

			expect(mockLegacyLookup).toHaveBeenCalledTimes(1);
		});

		it('should handle legacy lookup errors gracefully', () => {
			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
			const mockLegacyLookup = jest.fn(() => ({
				profileName: 'invalid',
				// Missing required fields
			}));

			const bridgeLookup = ProfileAdapter.createBridgeLookup(mockLegacyLookup);
			const result = bridgeLookup('invalid');

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Failed to adapt legacy profile 'invalid'"),
				expect.any(String)
			);

			consoleSpy.mockRestore();
		});
	});

	describe('validateLegacyProfile', () => {
		it('should validate a correct legacy profile', () => {
			const legacyProfile = {
				profileName: 'valid',
				rulesDir: '.valid/rules',
				profileDir: '.valid',
				fileMap: { 'source.mdc': 'target.md' },
				globalReplacements: [{ from: 'old', to: 'new' }],
				conversionConfig: { toolNames: {} },
				onAddRulesProfile: () => {}
			};

			const result = ProfileAdapter.validateLegacyProfile(legacyProfile);

			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should detect null or undefined profile', () => {
			const result1 = ProfileAdapter.validateLegacyProfile(null);
			const result2 = ProfileAdapter.validateLegacyProfile(undefined);

			expect(result1.valid).toBe(false);
			expect(result1.errors).toContain('Profile is null or undefined');
			expect(result2.valid).toBe(false);
			expect(result2.errors).toContain('Profile is null or undefined');
		});

		it('should detect missing required fields', () => {
			const result = ProfileAdapter.validateLegacyProfile({});

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Missing or invalid profileName');
			expect(result.errors).toContain('Missing or invalid rulesDir');
			expect(result.errors).toContain('Missing or invalid profileDir');
		});

		it('should detect invalid field types', () => {
			const legacyProfile = {
				profileName: 123, // Should be string
				rulesDir: [], // Should be string
				profileDir: {}, // Should be string
				fileMap: 'invalid', // Should be object
				globalReplacements: 'invalid', // Should be array
				conversionConfig: 'invalid', // Should be object
				onAddRulesProfile: 'invalid' // Should be function
			};

			const result = ProfileAdapter.validateLegacyProfile(legacyProfile);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Missing or invalid profileName');
			expect(result.errors).toContain('Missing or invalid rulesDir');
			expect(result.errors).toContain('Missing or invalid profileDir');
			expect(result.errors).toContain('Invalid fileMap - must be object');
			expect(result.errors).toContain('Invalid globalReplacements - must be array');
			expect(result.errors).toContain('Invalid conversionConfig - must be object');
			expect(result.errors).toContain('Invalid onAddRulesProfile - must be function');
		});

		it('should allow missing optional fields', () => {
			const legacyProfile = {
				profileName: 'minimal',
				rulesDir: '.minimal/rules',
				profileDir: '.minimal'
				// No optional fields
			};

			const result = ProfileAdapter.validateLegacyProfile(legacyProfile);

			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('should validate all lifecycle hooks', () => {
			const legacyProfile = {
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: '.test',
				onAddRulesProfile: 'invalid',
				onRemoveRulesProfile: 123,
				onPostConvertRulesProfile: []
			};

			const result = ProfileAdapter.validateLegacyProfile(legacyProfile);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Invalid onAddRulesProfile - must be function');
			expect(result.errors).toContain('Invalid onRemoveRulesProfile - must be function');
			expect(result.errors).toContain('Invalid onPostConvertRulesProfile - must be function');
		});
	});
}); 