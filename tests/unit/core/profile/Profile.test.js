/**
 * @fileoverview Unit tests for Profile class
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import Profile from '../../../../src/profile/Profile.js';
import { ProfileOperationError } from '../../../../src/profile/ProfileError.js';

describe('Profile', () => {
	describe('constructor', () => {
		it('should create a profile with required fields', () => {
			const config = {
				profileName: 'test-profile',
				rulesDir: '.test/rules',
				profileDir: '.test'
			};

			const profile = new Profile(config);

			expect(profile.profileName).toBe('test-profile');
			expect(profile.rulesDir).toBe('.test/rules');
			expect(profile.profileDir).toBe('.test');
		});

		it('should set default values for optional fields', () => {
			const config = {
				profileName: 'test-profile',
				rulesDir: '.test/rules',
				profileDir: '.test'
			};

			const profile = new Profile(config);

			expect(profile.displayName).toBe('test-profile'); // defaults to profileName
			expect(profile.fileMap).toEqual({});
			expect(profile.conversionConfig).toEqual({});
			expect(profile.globalReplacements).toEqual([]);
			expect(profile.hooks).toEqual({});
			expect(profile.includeDefaultRules).toBe(true);
			expect(profile.supportsRulesSubdirectories).toBe(false);
		});

		it('should use provided displayName over profileName', () => {
			const config = {
				profileName: 'test-profile',
				displayName: 'Test Profile Display',
				rulesDir: '.test/rules',
				profileDir: '.test'
			};

			const profile = new Profile(config);

			expect(profile.displayName).toBe('Test Profile Display');
		});

		it('should freeze the profile object for immutability', () => {
			const config = {
				profileName: 'test-profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				fileMap: { 'source.mdc': 'target.md' },
				globalReplacements: [{ from: 'old', to: 'new' }]
			};

			const profile = new Profile(config);

			expect(Object.isFrozen(profile)).toBe(true);
			expect(Object.isFrozen(profile.fileMap)).toBe(true);
			expect(Object.isFrozen(profile.globalReplacements)).toBe(true);
			expect(Object.isFrozen(profile.hooks)).toBe(true);
		});

		it('should compute MCP config properties correctly', () => {
			const profile1 = new Profile({
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: '.test',
				mcpConfig: true
			});

			expect(profile1.mcpConfigName).toBe('mcp.json');
			expect(profile1.mcpConfigPath).toBe('.test/mcp.json');

			const profile2 = new Profile({
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: '.test',
				mcpConfig: { configName: 'custom.json' }
			});

			expect(profile2.mcpConfigName).toBe('custom.json');
			expect(profile2.mcpConfigPath).toBe('.test/custom.json');

			const profile3 = new Profile({
				profileName: 'test',
				rulesDir: '.test/rules',
				profileDir: '.test',
				mcpConfig: false
			});

			expect(profile3.mcpConfigName).toBeNull();
			expect(profile3.mcpConfigPath).toBeNull();
		});
	});

	describe('lifecycle methods', () => {
		let profile;
		let mockOnAdd;
		let mockOnRemove;
		let mockOnPost;

		beforeEach(() => {
			mockOnAdd = jest.fn();
			mockOnRemove = jest.fn();
			mockOnPost = jest.fn();

			profile = new Profile({
				profileName: 'test-profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				fileMap: { 'a.mdc': 'a.md', 'b.mdc': 'b.md' },
				hooks: {
					onAdd: mockOnAdd,
					onRemove: mockOnRemove,
					onPost: mockOnPost
				}
			});
		});

		describe('install', () => {
			it('should call onAdd hook and return success result', async () => {
				const result = await profile.install('/project', '/assets');

				expect(mockOnAdd).toHaveBeenCalledWith('/project', '/assets');
				expect(result).toEqual({
					success: true,
					filesProcessed: 2
				});
			});

			it('should return success without calling hook if no onAdd hook', async () => {
				const profileWithoutHook = new Profile({
					profileName: 'test',
					rulesDir: '.test/rules',
					profileDir: '.test',
					fileMap: { 'a.mdc': 'a.md' }
				});

				const result = await profileWithoutHook.install('/project', '/assets');

				expect(result).toEqual({
					success: true,
					filesProcessed: 1
				});
			});

			it('should wrap hook errors in ProfileOperationError', async () => {
				const error = new Error('Hook failed');
				mockOnAdd.mockRejectedValue(error);

				await expect(profile.install('/project', '/assets'))
					.rejects.toThrow(ProfileOperationError);
				
				try {
					await profile.install('/project', '/assets');
				} catch (e) {
					expect(e.operation).toBe('install');
					expect(e.profileName).toBe('test-profile');
					expect(e.cause).toBe(error);
				}
			});

			it('should handle sync hooks by wrapping with Promise.resolve', async () => {
				mockOnAdd.mockReturnValue('sync result');

				const result = await profile.install('/project', '/assets');

				expect(result.success).toBe(true);
				expect(mockOnAdd).toHaveBeenCalled();
			});
		});

		describe('remove', () => {
			it('should call onRemove hook and return success result', async () => {
				const result = await profile.remove('/project');

				expect(mockOnRemove).toHaveBeenCalledWith('/project');
				expect(result).toEqual({
					success: true
				});
			});

			it('should return success without calling hook if no onRemove hook', async () => {
				const profileWithoutHook = new Profile({
					profileName: 'test',
					rulesDir: '.test/rules',
					profileDir: '.test'
				});

				const result = await profileWithoutHook.remove('/project');

				expect(result).toEqual({
					success: true
				});
			});

			it('should wrap hook errors in ProfileOperationError', async () => {
				const error = new Error('Remove failed');
				mockOnRemove.mockRejectedValue(error);

				await expect(profile.remove('/project'))
					.rejects.toThrow(ProfileOperationError);
			});
		});

		describe('postConvert', () => {
			it('should call onPost hook and return success result', async () => {
				const result = await profile.postConvert('/project', '/assets');

				expect(mockOnPost).toHaveBeenCalledWith('/project', '/assets');
				expect(result).toEqual({
					success: true
				});
			});

			it('should wrap hook errors in ProfileOperationError', async () => {
				const error = new Error('Post convert failed');
				mockOnPost.mockRejectedValue(error);

				await expect(profile.postConvert('/project', '/assets'))
					.rejects.toThrow(ProfileOperationError);
			});
		});
	});

	describe('summary', () => {
		it('should generate summary for add operation with default rules', () => {
			const profile = new Profile({
				profileName: 'test',
				displayName: 'Test Profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				includeDefaultRules: true
			});

			const result = { success: true, filesProcessed: 5, filesSkipped: 2 };
			const summary = profile.summary('add', result);

			expect(summary).toBe('Test Profile: 5 files processed, 2 skipped');
		});

		it('should generate summary for add operation without skipped files', () => {
			const profile = new Profile({
				profileName: 'test',
				displayName: 'Test Profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				includeDefaultRules: true
			});

			const result = { success: true, filesProcessed: 3 };
			const summary = profile.summary('add', result);

			expect(summary).toBe('Test Profile: 3 files processed');
		});

		it('should generate summary for add operation for integration guide profile', () => {
			const profile = new Profile({
				profileName: 'test',
				displayName: 'Test Integration',
				rulesDir: '.test/rules',
				profileDir: '.test',
				includeDefaultRules: false
			});

			const result = { success: true };
			const summary = profile.summary('add', result);

			expect(summary).toBe('Test Integration: Integration guide installed');
		});

		it('should generate summary for remove operation', () => {
			const profile = new Profile({
				profileName: 'test',
				displayName: 'Test Profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				includeDefaultRules: true
			});

			const result = { success: true, notice: 'Preserved 2 existing files' };
			const summary = profile.summary('remove', result);

			expect(summary).toBe('Test Profile: Rule profile removed (Preserved 2 existing files)');
		});

		it('should generate summary for failed operation', () => {
			const profile = new Profile({
				profileName: 'test',
				displayName: 'Test Profile',
				rulesDir: '.test/rules',
				profileDir: '.test'
			});

			const result = { success: false, error: 'File not found' };
			const summary = profile.summary('add', result);

			expect(summary).toBe('Test Profile: Failed - File not found');
		});

		it('should generate summary for convert operation', () => {
			const profile = new Profile({
				profileName: 'test',
				displayName: 'Test Profile',
				rulesDir: '.test/rules',
				profileDir: '.test'
			});

			const result = { success: true };
			const summary = profile.summary('convert', result);

			expect(summary).toBe('Test Profile: Rules converted successfully');
		});
	});

	describe('helper methods', () => {
		let profile;

		beforeEach(() => {
			profile = new Profile({
				profileName: 'test-profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				fileMap: { 'a.mdc': 'a.md', 'b.mdc': 'b.md' },
				mcpConfig: true,
				includeDefaultRules: true,
				hooks: { onAdd: () => {}, onRemove: () => {} }
			});
		});

		describe('hasHooks', () => {
			it('should return true when profile has hooks', () => {
				expect(profile.hasHooks()).toBe(true);
			});

			it('should return false when profile has no hooks', () => {
				const profileWithoutHooks = new Profile({
					profileName: 'test',
					rulesDir: '.test/rules',
					profileDir: '.test'
				});

				expect(profileWithoutHooks.hasHooks()).toBe(false);
			});
		});

		describe('hasDefaultRules', () => {
			it('should return true when includeDefaultRules is true', () => {
				expect(profile.hasDefaultRules()).toBe(true);
			});

			it('should return false when includeDefaultRules is false', () => {
				const profileWithoutRules = new Profile({
					profileName: 'test',
					rulesDir: '.test/rules',
					profileDir: '.test',
					includeDefaultRules: false
				});

				expect(profileWithoutRules.hasDefaultRules()).toBe(false);
			});
		});

		describe('hasMcpConfig', () => {
			it('should return true when mcpConfig is truthy', () => {
				expect(profile.hasMcpConfig()).toBe(true);
			});

			it('should return false when mcpConfig is false', () => {
				const profileWithoutMcp = new Profile({
					profileName: 'test',
					rulesDir: '.test/rules',
					profileDir: '.test',
					mcpConfig: false
				});

				expect(profileWithoutMcp.hasMcpConfig()).toBe(false);
			});
		});

		describe('getFileCount', () => {
			it('should return number of files in fileMap', () => {
				expect(profile.getFileCount()).toBe(2);
			});

			it('should return 0 for empty fileMap', () => {
				const profileWithoutFiles = new Profile({
					profileName: 'test',
					rulesDir: '.test/rules',
					profileDir: '.test'
				});

				expect(profileWithoutFiles.getFileCount()).toBe(0);
			});
		});
	});

	describe('toLegacyFormat', () => {
		it('should convert Profile instance to legacy object format', () => {
			const hooks = {
				onAdd: () => {},
				onRemove: () => {},
				onPost: () => {}
			};

			const profile = new Profile({
				profileName: 'test-profile',
				displayName: 'Test Profile',
				rulesDir: '.test/rules',
				profileDir: '.test',
				fileMap: { 'a.mdc': 'a.md' },
				conversionConfig: { test: true },
				globalReplacements: [{ from: 'old', to: 'new' }],
				mcpConfig: true,
				includeDefaultRules: true,
				supportsRulesSubdirectories: false,
				hooks
			});

			const legacy = profile.toLegacyFormat();

			expect(legacy).toEqual({
				profileName: 'test-profile',
				displayName: 'Test Profile',
				profileDir: '.test',
				rulesDir: '.test/rules',
				mcpConfig: true,
				mcpConfigName: 'mcp.json',
				mcpConfigPath: '.test/mcp.json',
				supportsRulesSubdirectories: false,
				includeDefaultRules: true,
				fileMap: { 'a.mdc': 'a.md' },
				globalReplacements: [{ from: 'old', to: 'new' }],
				conversionConfig: { test: true },
				onAddRulesProfile: hooks.onAdd,
				onRemoveRulesProfile: hooks.onRemove,
				onPostConvertRulesProfile: hooks.onPost
			});
		});

		it('should omit lifecycle hooks if not present', () => {
			const profile = new Profile({
				profileName: 'test-profile',
				rulesDir: '.test/rules',
				profileDir: '.test'
			});

			const legacy = profile.toLegacyFormat();

			expect(legacy).not.toHaveProperty('onAddRulesProfile');
			expect(legacy).not.toHaveProperty('onRemoveRulesProfile');
			expect(legacy).not.toHaveProperty('onPostConvertRulesProfile');
		});
	});
}); 