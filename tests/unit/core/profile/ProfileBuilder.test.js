/**
 * @fileoverview Unit tests for ProfileBuilder class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProfileBuilder } from '../../../../src/profile/ProfileBuilder.js';
import Profile from '../../../../src/profile/Profile.js';
import { ProfileValidationError } from '../../../../src/profile/ProfileError.js';

describe('ProfileBuilder', () => {
	let builder;

	beforeEach(() => {
		builder = new ProfileBuilder();
	});

	describe('constructor', () => {
		it('should initialize with default config', () => {
			expect(builder._config).toEqual({
				hooks: {}
			});
		});
	});

	describe('fluent interface', () => {
		it('should support method chaining', () => {
			const result = builder
				.withName('test')
				.display('Test Display')
				.rulesDir('.test/rules')
				.profileDir('.test');

			expect(result).toBe(builder);
		});

		it('should set name correctly', () => {
			builder.withName('test-profile');
			expect(builder._config.profileName).toBe('test-profile');
		});

		it('should trim name whitespace', () => {
			builder.withName('  test-profile  ');
			expect(builder._config.profileName).toBe('test-profile');
		});

		it('should set display name correctly', () => {
			builder.display('Test Display Name');
			expect(builder._config.displayName).toBe('Test Display Name');
		});

		it('should set rules directory correctly', () => {
			builder.rulesDir('.test/rules');
			expect(builder._config.rulesDir).toBe('.test/rules');
		});

		it('should set profile directory correctly', () => {
			builder.profileDir('.test');
			expect(builder._config.profileDir).toBe('.test');
		});

		it('should set file map correctly', () => {
			const fileMap = { 'source.mdc': 'target.md' };
			builder.fileMap(fileMap);
			expect(builder._config.fileMap).toEqual(fileMap);
			expect(builder._config.fileMap).not.toBe(fileMap); // should be a copy
		});

		it('should set conversion config correctly', () => {
			const config = { profileTerms: [], toolNames: {} };
			builder.conversion(config);
			expect(builder._config.conversionConfig).toEqual(config);
			expect(builder._config.conversionConfig).not.toBe(config); // should be a copy
		});

		it('should set global replacements correctly', () => {
			const replacements = [{ from: 'old', to: 'new' }];
			builder.globalReplacements(replacements);
			expect(builder._config.globalReplacements).toEqual(replacements);
			expect(builder._config.globalReplacements).not.toBe(replacements); // should be a copy
		});

		it('should set MCP config correctly', () => {
			builder.mcpConfig(true);
			expect(builder._config.mcpConfig).toBe(true);

			builder.mcpConfig({ configName: 'custom.json' });
			expect(builder._config.mcpConfig).toEqual({ configName: 'custom.json' });
		});

		it('should set includeDefaultRules correctly', () => {
			builder.includeDefaultRules(false);
			expect(builder._config.includeDefaultRules).toBe(false);
		});

		it('should set supportsSubdirectories correctly', () => {
			builder.supportsSubdirectories(true);
			expect(builder._config.supportsRulesSubdirectories).toBe(true);
		});

		it('should set lifecycle hooks correctly', () => {
			const onAddFn = () => {};
			const onRemoveFn = () => {};
			const onPostFn = () => {};

			builder.onAdd(onAddFn).onRemove(onRemoveFn).onPost(onPostFn);

			expect(builder._config.hooks.onAdd).toBe(onAddFn);
			expect(builder._config.hooks.onRemove).toBe(onRemoveFn);
			expect(builder._config.hooks.onPost).toBe(onPostFn);
		});
	});

	describe('validation', () => {
		describe('withName', () => {
			it('should throw for empty string', () => {
				expect(() => builder.withName('')).toThrow(ProfileValidationError);
			});

			it('should throw for whitespace only', () => {
				expect(() => builder.withName('   ')).toThrow(ProfileValidationError);
			});

			it('should throw for non-string', () => {
				expect(() => builder.withName(123)).toThrow(ProfileValidationError);
				expect(() => builder.withName(null)).toThrow(ProfileValidationError);
			});
		});

		describe('display', () => {
			it('should throw for empty string', () => {
				expect(() => builder.display('')).toThrow(ProfileValidationError);
			});

			it('should throw for non-string', () => {
				expect(() => builder.display(123)).toThrow(ProfileValidationError);
			});
		});

		describe('rulesDir', () => {
			it('should throw for empty string', () => {
				expect(() => builder.rulesDir('')).toThrow(ProfileValidationError);
			});

			it('should throw for non-string', () => {
				expect(() => builder.rulesDir(123)).toThrow(ProfileValidationError);
			});
		});

		describe('profileDir', () => {
			it('should throw for empty string', () => {
				expect(() => builder.profileDir('')).toThrow(ProfileValidationError);
			});

			it('should throw for non-string', () => {
				expect(() => builder.profileDir(123)).toThrow(ProfileValidationError);
			});
		});

		describe('fileMap', () => {
			it('should throw for non-object', () => {
				expect(() => builder.fileMap('not-object')).toThrow(
					ProfileValidationError
				);
				expect(() => builder.fileMap(null)).toThrow(ProfileValidationError);
			});
		});

		describe('conversion', () => {
			it('should throw for non-object', () => {
				expect(() => builder.conversion('not-object')).toThrow(
					ProfileValidationError
				);
				expect(() => builder.conversion(null)).toThrow(ProfileValidationError);
			});
		});

		describe('globalReplacements', () => {
			it('should throw for non-array', () => {
				expect(() => builder.globalReplacements('not-array')).toThrow(
					ProfileValidationError
				);
				expect(() => builder.globalReplacements({})).toThrow(
					ProfileValidationError
				);
			});
		});

		describe('mcpConfig', () => {
			it('should throw for invalid types', () => {
				expect(() => builder.mcpConfig('string')).toThrow(
					ProfileValidationError
				);
				expect(() => builder.mcpConfig(123)).toThrow(ProfileValidationError);
			});

			it('should accept boolean and object', () => {
				expect(() => builder.mcpConfig(true)).not.toThrow();
				expect(() => builder.mcpConfig(false)).not.toThrow();
				expect(() => builder.mcpConfig({})).not.toThrow();
			});
		});

		describe('includeDefaultRules', () => {
			it('should throw for non-boolean', () => {
				expect(() => builder.includeDefaultRules('true')).toThrow(
					ProfileValidationError
				);
				expect(() => builder.includeDefaultRules(1)).toThrow(
					ProfileValidationError
				);
			});
		});

		describe('supportsSubdirectories', () => {
			it('should throw for non-boolean', () => {
				expect(() => builder.supportsSubdirectories('true')).toThrow(
					ProfileValidationError
				);
				expect(() => builder.supportsSubdirectories(1)).toThrow(
					ProfileValidationError
				);
			});
		});

		describe('lifecycle hooks', () => {
			it('should throw for non-function onAdd', () => {
				expect(() => builder.onAdd('not-function')).toThrow(
					ProfileValidationError
				);
			});

			it('should throw for non-function onRemove', () => {
				expect(() => builder.onRemove('not-function')).toThrow(
					ProfileValidationError
				);
			});

			it('should throw for non-function onPost', () => {
				expect(() => builder.onPost('not-function')).toThrow(
					ProfileValidationError
				);
			});
		});
	});

	describe('static methods', () => {
		describe('extend', () => {
			it('should create a new builder with base profile settings', () => {
				const baseProfile = new Profile({
					profileName: 'base',
					displayName: 'Base Profile',
					rulesDir: '.base/rules',
					profileDir: '.base',
					fileMap: { 'a.mdc': 'a.md' },
					conversionConfig: { test: true },
					globalReplacements: [{ from: 'old', to: 'new' }],
					mcpConfig: true,
					includeDefaultRules: false,
					supportsRulesSubdirectories: true,
					hooks: { onAdd: () => {} }
				});

				const extendedBuilder = ProfileBuilder.extend(baseProfile);

				expect(extendedBuilder._config).toEqual({
					profileName: 'base',
					displayName: 'Base Profile',
					rulesDir: '.base/rules',
					profileDir: '.base',
					fileMap: { 'a.mdc': 'a.md' },
					conversionConfig: { test: true },
					globalReplacements: [{ from: 'old', to: 'new' }],
					mcpConfig: true,
					includeDefaultRules: false,
					supportsRulesSubdirectories: true,
					hooks: { onAdd: baseProfile.hooks.onAdd }
				});
			});

			it('should create copies of arrays and objects', () => {
				const baseProfile = new Profile({
					profileName: 'base',
					rulesDir: '.base/rules',
					profileDir: '.base',
					fileMap: { 'a.mdc': 'a.md' },
					globalReplacements: [{ from: 'old', to: 'new' }]
				});

				const extendedBuilder = ProfileBuilder.extend(baseProfile);

				expect(extendedBuilder._config.fileMap).not.toBe(baseProfile.fileMap);
				expect(extendedBuilder._config.globalReplacements).not.toBe(
					baseProfile.globalReplacements
				);
			});
		});

		describe('minimal', () => {
			it('should create a builder with smart defaults', () => {
				const minimalBuilder = ProfileBuilder.minimal('testprofile');

				expect(minimalBuilder._config).toEqual({
					profileName: 'testprofile',
					displayName: 'Testprofile',
					rulesDir: '.testprofile/rules',
					profileDir: '.testprofile',
					fileMap: {},
					conversionConfig: {},
					globalReplacements: [],
					mcpConfig: true,
					includeDefaultRules: true,
					supportsRulesSubdirectories: false,
					hooks: {}
				});
			});

			it('should capitalize first letter of display name', () => {
				const builder1 = ProfileBuilder.minimal('cursor');
				expect(builder1._config.displayName).toBe('Cursor');

				const builder2 = ProfileBuilder.minimal('vscode');
				expect(builder2._config.displayName).toBe('Vscode');
			});
		});
	});

	describe('build', () => {
		it('should create a Profile instance with valid configuration', () => {
			const profile = builder
				.withName('test-profile')
				.rulesDir('.test/rules')
				.profileDir('.test')
				.build();

			expect(profile).toBeInstanceOf(Profile);
			expect(profile.profileName).toBe('test-profile');
			expect(profile.rulesDir).toBe('.test/rules');
			expect(profile.profileDir).toBe('.test');
		});

		it('should throw for missing required fields', () => {
			expect(() => builder.build()).toThrow(ProfileValidationError);

			expect(() => builder.withName('test').build()).toThrow(
				ProfileValidationError
			);

			expect(() =>
				builder.withName('test').rulesDir('.test/rules').build()
			).toThrow(ProfileValidationError);
		});

		it('should validate profile name format', () => {
			expect(() =>
				builder
					.withName('invalid name with spaces')
					.rulesDir('.test/rules')
					.profileDir('.test')
					.build()
			).toThrow(ProfileValidationError);

			expect(() =>
				builder
					.withName('invalid@name')
					.rulesDir('.test/rules')
					.profileDir('.test')
					.build()
			).toThrow(ProfileValidationError);

			// Valid names should work
			expect(() =>
				builder
					.withName('valid-name_123')
					.rulesDir('.test/rules')
					.profileDir('.test')
					.build()
			).not.toThrow();
		});

		it('should validate file map structure', () => {
			expect(() =>
				builder
					.withName('test')
					.rulesDir('.test/rules')
					.profileDir('.test')
					.fileMap({ 'source.mdc': 123 }) // invalid value type
					.build()
			).toThrow(ProfileValidationError);

			// Note: JavaScript automatically converts numeric keys to strings,
			// so { 123: 'target.md' } becomes { "123": 'target.md' }
			// This is expected JS behavior, so we only test invalid values

			// Verify numeric keys are handled correctly
			expect(() =>
				builder
					.withName('test')
					.rulesDir('.test/rules')
					.profileDir('.test')
					.fileMap({ 123: 'target.md' }) // numeric key
					.build()
			).not.toThrow();

			// Valid file map should work
			expect(() =>
				builder
					.withName('test')
					.rulesDir('.test/rules')
					.profileDir('.test')
					.fileMap({ 'source.mdc': 'target.md' })
					.build()
			).not.toThrow();
		});

		it('should include profile name in validation errors', () => {
			try {
				builder
					.withName('test-profile')
					.rulesDir('.test/rules')
					.fileMap({ 'source.mdc': 123 })
					.build();
			} catch (error) {
				expect(error.profileName).toBe('test-profile');
			}
		});
	});

	describe('integration', () => {
		it('should build a complete profile with all features', () => {
			const onAddFn = () => {};
			const onRemoveFn = () => {};
			const fileMap = { 'rules/source.mdc': 'target.md' };
			const config = { profileTerms: [], toolNames: {} };
			const replacements = [{ from: /old/g, to: 'new' }];

			const profile = builder
				.withName('complete-profile')
				.display('Complete Test Profile')
				.rulesDir('.complete/rules')
				.profileDir('.complete')
				.fileMap(fileMap)
				.conversion(config)
				.globalReplacements(replacements)
				.mcpConfig({ configName: 'custom.json' })
				.includeDefaultRules(false)
				.supportsSubdirectories(true)
				.onAdd(onAddFn)
				.onRemove(onRemoveFn)
				.build();

			expect(profile.profileName).toBe('complete-profile');
			expect(profile.displayName).toBe('Complete Test Profile');
			expect(profile.rulesDir).toBe('.complete/rules');
			expect(profile.profileDir).toBe('.complete');
			expect(profile.fileMap).toEqual(fileMap);
			expect(profile.conversionConfig).toEqual(config);
			expect(profile.globalReplacements).toEqual(replacements);
			expect(profile.mcpConfig).toBe(true); // Boolean indicating MCP is enabled
			expect(profile.mcpConfigName).toBe('custom.json'); // Derived from configuration object
			expect(profile.includeDefaultRules).toBe(false);
			expect(profile.supportsRulesSubdirectories).toBe(true);
			expect(profile.hooks.onAdd).toBe(onAddFn);
			expect(profile.hooks.onRemove).toBe(onRemoveFn);
		});

		it('should work with minimal configuration', () => {
			const profile = ProfileBuilder.minimal('simple').build();

			expect(profile.profileName).toBe('simple');
			expect(profile.displayName).toBe('Simple');
			expect(profile.rulesDir).toBe('.simple/rules');
			expect(profile.profileDir).toBe('.simple');
			expect(profile.includeDefaultRules).toBe(true);
			expect(profile.mcpConfig).toBe(true);
		});

		it('should work with extended configuration', () => {
			const baseProfile = new Profile({
				profileName: 'base',
				rulesDir: '.base/rules',
				profileDir: '.base',
				mcpConfig: false
			});

			const profile = ProfileBuilder.extend(baseProfile)
				.withName('extended')
				.display('Extended Profile')
				.mcpConfig(true)
				.build();

			expect(profile.profileName).toBe('extended');
			expect(profile.displayName).toBe('Extended Profile');
			expect(profile.mcpConfig).toBe(true);
			expect(profile.rulesDir).toBe('.base/rules'); // inherited
		});
	});
});
