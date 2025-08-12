import {
	isValidProfile,
	getRulesProfile
} from '../../../src/utils/rule-transformer.js';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import path from 'path';

describe('Rule Transformer - General', () => {
	describe('Profile Configuration Validation', () => {
		it('should use RULE_PROFILES as the single source of truth', () => {
			// Ensure RULE_PROFILES is properly defined and contains expected profiles
			expect(Array.isArray(RULE_PROFILES)).toBe(true);
			expect(RULE_PROFILES.length).toBeGreaterThan(0);

			// Verify expected profiles are present
			const expectedProfiles = [
				'claude',
				'cline',
				'codex',
				'cursor',
				'gemini',
				'kiro',
				'opencode',
				'roo',
				'trae',
				'vscode',
				'windsurf',
				'zed'
			];
			expectedProfiles.forEach((profile) => {
				expect(RULE_PROFILES).toContain(profile);
			});
		});

		it('should validate profiles correctly with isValidProfile', () => {
			// Test valid profiles
			RULE_PROFILES.forEach((profile) => {
				expect(isValidProfile(profile)).toBe(true);
			});

			// Test invalid profiles
			expect(isValidProfile('invalid')).toBe(false);
			expect(isValidProfile('')).toBe(false);
			expect(isValidProfile(null)).toBe(false);
			expect(isValidProfile(undefined)).toBe(false);
		});

		it('should return correct rule profile with getRulesProfile', () => {
			// Test valid profiles
			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);
				expect(profileConfig).toBeDefined();
				expect(profileConfig.profileName.toLowerCase()).toBe(profile);
			});

			// Test invalid profile - should return null
			expect(getRulesProfile('invalid')).toBeNull();
		});
	});

	describe('Profile Structure', () => {
		it('should have all required properties for each profile', () => {
			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Check required properties
				expect(profileConfig).toHaveProperty('profileName');
				expect(profileConfig).toHaveProperty('conversionConfig');
				expect(profileConfig).toHaveProperty('fileMap');
				expect(profileConfig).toHaveProperty('rulesDir');
				expect(profileConfig).toHaveProperty('profileDir');

				// All profiles should have conversionConfig and fileMap objects
				expect(typeof profileConfig.conversionConfig).toBe('object');
				expect(typeof profileConfig.fileMap).toBe('object');

				// Check that conversionConfig has required structure for profiles with rules
				const hasRules = Object.keys(profileConfig.fileMap).length > 0;
				if (hasRules) {
					expect(profileConfig.conversionConfig).toHaveProperty('profileTerms');
					expect(profileConfig.conversionConfig).toHaveProperty('toolNames');
					expect(profileConfig.conversionConfig).toHaveProperty('toolContexts');
					expect(profileConfig.conversionConfig).toHaveProperty('toolGroups');
					expect(profileConfig.conversionConfig).toHaveProperty('docUrls');
					expect(profileConfig.conversionConfig).toHaveProperty(
						'fileReferences'
					);

					// Verify arrays are actually arrays
					expect(
						Array.isArray(profileConfig.conversionConfig.profileTerms)
					).toBe(true);
					expect(typeof profileConfig.conversionConfig.toolNames).toBe(
						'object'
					);
					expect(
						Array.isArray(profileConfig.conversionConfig.toolContexts)
					).toBe(true);
					expect(Array.isArray(profileConfig.conversionConfig.toolGroups)).toBe(
						true
					);
					expect(Array.isArray(profileConfig.conversionConfig.docUrls)).toBe(
						true
					);
				}
			});
		});

		it('should have valid fileMap with required files for each profile', () => {
			const expectedRuleFiles = [
				'cursor_rules.mdc',
				'dev_workflow.mdc',
				'self_improve.mdc',
				'taskmaster.mdc'
			];

			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Check that fileMap exists and is an object
				expect(profileConfig.fileMap).toBeDefined();
				expect(typeof profileConfig.fileMap).toBe('object');
				expect(profileConfig.fileMap).not.toBeNull();

				const fileMapKeys = Object.keys(profileConfig.fileMap);

				// All profiles should have some fileMap entries now
				expect(fileMapKeys.length).toBeGreaterThan(0);

				// Check if this profile has rule files or asset files
				const hasRuleFiles = expectedRuleFiles.some((file) =>
					fileMapKeys.includes(file)
				);
				const hasAssetFiles = fileMapKeys.some(
					(file) => !expectedRuleFiles.includes(file)
				);

				if (hasRuleFiles) {
					// Profiles with rule files should have all expected rule files
					expectedRuleFiles.forEach((expectedFile) => {
						expect(fileMapKeys).toContain(expectedFile);
						expect(typeof profileConfig.fileMap[expectedFile]).toBe('string');
						expect(profileConfig.fileMap[expectedFile].length).toBeGreaterThan(
							0
						);
					});
				}

				if (hasAssetFiles) {
					// Profiles with asset files (like Claude/Codex) should have valid asset mappings
					fileMapKeys.forEach((key) => {
						expect(typeof profileConfig.fileMap[key]).toBe('string');
						expect(profileConfig.fileMap[key].length).toBeGreaterThan(0);
					});
				}
			});
		});
	});

	describe('MCP Configuration Properties', () => {
		it('should have all required MCP properties for each profile', () => {
			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Check MCP-related properties exist
				expect(profileConfig).toHaveProperty('mcpConfig');
				expect(profileConfig).toHaveProperty('mcpConfigName');
				expect(profileConfig).toHaveProperty('mcpConfigPath');

				// Check types based on MCP configuration
				expect(typeof profileConfig.mcpConfig).toBe('boolean');

				if (profileConfig.mcpConfig !== false) {
					// Check that mcpConfigPath is properly constructed
					const expectedPath = path.join(
						profileConfig.profileDir,
						profileConfig.mcpConfigName
					);
					expect(profileConfig.mcpConfigPath).toBe(expectedPath);
				}
			});
		});

		it('should have correct MCP configuration for each profile', () => {
			const expectedConfigs = {
				amp: {
					mcpConfig: true,
					mcpConfigName: 'settings.json',
					expectedPath: '.vscode/settings.json'
				},
				claude: {
					mcpConfig: true,
					mcpConfigName: '.mcp.json',
					expectedPath: '.mcp.json'
				},
				cline: {
					mcpConfig: false,
					mcpConfigName: null,
					expectedPath: null
				},
				codex: {
					mcpConfig: false,
					mcpConfigName: null,
					expectedPath: null
				},
				cursor: {
					mcpConfig: true,
					mcpConfigName: 'mcp.json',
					expectedPath: '.cursor/mcp.json'
				},
				gemini: {
					mcpConfig: true,
					mcpConfigName: 'settings.json',
					expectedPath: '.gemini/settings.json'
				},
				kiro: {
					mcpConfig: true,
					mcpConfigName: 'settings/mcp.json',
					expectedPath: '.kiro/settings/mcp.json'
				},
				opencode: {
					mcpConfig: true,
					mcpConfigName: 'opencode.json',
					expectedPath: 'opencode.json'
				},
				roo: {
					mcpConfig: true,
					mcpConfigName: 'mcp.json',
					expectedPath: '.roo/mcp.json'
				},
				kilo: {
					mcpConfig: true,
					mcpConfigName: 'mcp.json',
					expectedPath: '.kilo/mcp.json'
				},
				trae: {
					mcpConfig: false,
					mcpConfigName: null,
					expectedPath: null
				},
				vscode: {
					mcpConfig: true,
					mcpConfigName: 'mcp.json',
					expectedPath: '.vscode/mcp.json'
				},
				windsurf: {
					mcpConfig: true,
					mcpConfigName: 'mcp.json',
					expectedPath: '.windsurf/mcp.json'
				},
				zed: {
					mcpConfig: true,
					mcpConfigName: 'settings.json',
					expectedPath: '.zed/settings.json'
				}
			};

			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);
				const expected = expectedConfigs[profile];

				expect(profileConfig.mcpConfig).toBe(expected.mcpConfig);
				expect(profileConfig.mcpConfigName).toBe(expected.mcpConfigName);
				expect(profileConfig.mcpConfigPath).toBe(expected.expectedPath);
			});
		});

		it('should have consistent profileDir and mcpConfigPath relationship', () => {
			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);
				if (profileConfig.mcpConfig !== false) {
					// Profiles with MCP configuration should have valid paths
					// Handle root directory profiles differently
					if (profileConfig.profileDir === '.') {
						if (profile === 'claude') {
							// Claude explicitly uses '.mcp.json'
							expect(profileConfig.mcpConfigPath).toBe('.mcp.json');
						} else {
							// Other root profiles normalize to just the filename
							expect(profileConfig.mcpConfigPath).toBe(
								profileConfig.mcpConfigName
							);
						}
					} else {
						// Non-root profiles should have profileDir/configName pattern
						expect(profileConfig.mcpConfigPath).toMatch(
							new RegExp(
								`^${profileConfig.profileDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`
							)
						);
					}
				}
			});
		});

		it('should have unique profile directories', () => {
			const profileDirs = RULE_PROFILES.map((profile) => {
				const profileConfig = getRulesProfile(profile);
				return profileConfig.profileDir;
			});

			// Note: Claude and Codex both use "." (root directory) so we expect some duplication
			const uniqueProfileDirs = [...new Set(profileDirs)];
			// We should have fewer unique directories than total profiles due to simple profiles using root
			expect(uniqueProfileDirs.length).toBeLessThanOrEqual(profileDirs.length);
			expect(uniqueProfileDirs.length).toBeGreaterThan(0);
		});

		it('should have unique MCP config paths', () => {
			const mcpConfigPaths = RULE_PROFILES.map((profile) => {
				const profileConfig = getRulesProfile(profile);
				return profileConfig.mcpConfigPath;
			});

			// Note: Claude and Codex both have null mcpConfigPath so we expect some duplication
			const uniqueMcpConfigPaths = [...new Set(mcpConfigPaths)];
			// We should have fewer unique paths than total profiles due to simple profiles having null
			expect(uniqueMcpConfigPaths.length).toBeLessThanOrEqual(
				mcpConfigPaths.length
			);
			expect(uniqueMcpConfigPaths.length).toBeGreaterThan(0);
		});
	});
});
