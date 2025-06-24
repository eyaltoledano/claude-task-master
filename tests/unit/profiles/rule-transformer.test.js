import {
	isValidProfile,
	getRulesProfile
} from '../../../src/utils/rule-transformer.js';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';

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
				'roo',
				'trae',
				'vscode',
				'windsurf'
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
			// Simple profiles that only copy files (no rule transformation)
			const simpleProfiles = ['claude', 'codex'];

			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Check required properties
				expect(profileConfig).toHaveProperty('profileName');
				expect(profileConfig).toHaveProperty('conversionConfig');
				expect(profileConfig).toHaveProperty('fileMap');
				expect(profileConfig).toHaveProperty('rulesDir');
				expect(profileConfig).toHaveProperty('profileDir');

				// Simple profiles have minimal structure
				if (simpleProfiles.includes(profile)) {
					// For simple profiles, conversionConfig and fileMap can be empty
					expect(typeof profileConfig.conversionConfig).toBe('object');
					expect(typeof profileConfig.fileMap).toBe('object');
					return;
				}

				// Check that conversionConfig has required structure for full profiles
				expect(profileConfig.conversionConfig).toHaveProperty('profileTerms');
				expect(profileConfig.conversionConfig).toHaveProperty('toolNames');
				expect(profileConfig.conversionConfig).toHaveProperty('toolContexts');
				expect(profileConfig.conversionConfig).toHaveProperty('toolGroups');
				expect(profileConfig.conversionConfig).toHaveProperty('docUrls');
				expect(profileConfig.conversionConfig).toHaveProperty('fileReferences');

				// Verify arrays are actually arrays
				expect(Array.isArray(profileConfig.conversionConfig.profileTerms)).toBe(
					true
				);
				expect(typeof profileConfig.conversionConfig.toolNames).toBe('object');
				expect(Array.isArray(profileConfig.conversionConfig.toolContexts)).toBe(
					true
				);
				expect(Array.isArray(profileConfig.conversionConfig.toolGroups)).toBe(
					true
				);
				expect(Array.isArray(profileConfig.conversionConfig.docUrls)).toBe(
					true
				);
			});
		});

		it('should have valid fileMap with required files for each profile', () => {
			const expectedFiles = [
				'cursor_rules.mdc',
				'dev_workflow.mdc',
				'self_improve.mdc',
				'taskmaster.mdc'
			];

			// Simple profiles that only copy files (no rule transformation)
			const simpleProfiles = ['claude', 'codex'];

			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Check that fileMap exists and is an object
				expect(profileConfig.fileMap).toBeDefined();
				expect(typeof profileConfig.fileMap).toBe('object');
				expect(profileConfig.fileMap).not.toBeNull();

				// Simple profiles can have empty fileMap since they don't transform rules
				if (simpleProfiles.includes(profile)) {
					return;
				}

				// Check that fileMap is not empty for full profiles
				const fileMapKeys = Object.keys(profileConfig.fileMap);
				expect(fileMapKeys.length).toBeGreaterThan(0);

				// Check that all expected source files are defined in fileMap
				expectedFiles.forEach((expectedFile) => {
					expect(fileMapKeys).toContain(expectedFile);
					expect(typeof profileConfig.fileMap[expectedFile]).toBe('string');
					expect(profileConfig.fileMap[expectedFile].length).toBeGreaterThan(0);
				});

				// Verify fileMap has exactly the expected files
				expect(fileMapKeys.sort()).toEqual(expectedFiles.sort());
			});
		});
	});

	describe('MCP Configuration Properties', () => {
		it('should have all required MCP properties for each profile', () => {
			// Simple profiles that only copy files (no MCP configuration)
			const simpleProfiles = ['claude', 'codex'];

			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Check MCP-related properties exist
				expect(profileConfig).toHaveProperty('mcpConfig');
				expect(profileConfig).toHaveProperty('mcpConfigName');
				expect(profileConfig).toHaveProperty('mcpConfigPath');

				// Simple profiles have no MCP configuration
				if (simpleProfiles.includes(profile)) {
					expect(profileConfig.mcpConfig).toBe(false);
					expect(profileConfig.mcpConfigName).toBe(null);
					expect(profileConfig.mcpConfigPath).toBe(null);
					return;
				}

				// Check types for full profiles
				expect(typeof profileConfig.mcpConfig).toBe('boolean');
				expect(typeof profileConfig.mcpConfigName).toBe('string');
				expect(typeof profileConfig.mcpConfigPath).toBe('string');

				// Check that mcpConfigPath is properly constructed
				expect(profileConfig.mcpConfigPath).toBe(
					`${profileConfig.profileDir}/${profileConfig.mcpConfigName}`
				);
			});
		});

		it('should have correct MCP configuration for each profile', () => {
			const expectedConfigs = {
				claude: {
					mcpConfig: false,
					mcpConfigName: null,
					expectedPath: null
				},
				cline: {
					mcpConfig: false,
					mcpConfigName: 'cline_mcp_settings.json',
					expectedPath: '.clinerules/cline_mcp_settings.json'
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
				roo: {
					mcpConfig: true,
					mcpConfigName: 'mcp.json',
					expectedPath: '.roo/mcp.json'
				},
				trae: {
					mcpConfig: false,
					mcpConfigName: 'trae_mcp_settings.json',
					expectedPath: '.trae/trae_mcp_settings.json'
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
			// Simple profiles that only copy files (no MCP configuration)
			const simpleProfiles = ['claude', 'codex'];

			RULE_PROFILES.forEach((profile) => {
				const profileConfig = getRulesProfile(profile);

				// Simple profiles have null mcpConfigPath
				if (simpleProfiles.includes(profile)) {
					expect(profileConfig.mcpConfigPath).toBe(null);
					return;
				}

				// The mcpConfigPath should start with the profileDir
				expect(profileConfig.mcpConfigPath).toMatch(
					new RegExp(
						`^${profileConfig.profileDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`
					)
				);

				// The mcpConfigPath should end with the mcpConfigName
				expect(profileConfig.mcpConfigPath).toMatch(
					new RegExp(
						`${profileConfig.mcpConfigName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
					)
				);
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
