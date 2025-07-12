import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';
import path from 'path';

// Helper function to normalize path separators to forward slashes for comparison
const normalizePath = (p) => (p ? p.replace(/\\/g, '/') : p);

describe('MCP Configuration Validation', () => {
	describe('Profile MCP Configuration Properties', () => {
		// Define base configurations
		const baseMcpConfigurations = {
			cline: {
				shouldHaveMcp: false,
				expectedDir: '.clinerules',
				expectedConfigName: null,
				expectedPath: null
			},
			cursor: {
				shouldHaveMcp: true,
				expectedDir: '.cursor',
				expectedConfigName: 'mcp.json'
			},
			gemini: {
				shouldHaveMcp: true,
				expectedDir: '.gemini',
				expectedConfigName: 'settings.json',
				expectedPath: '.gemini/settings.json'
			},
			roo: {
				shouldHaveMcp: true,
				expectedDir: '.roo',
				expectedConfigName: 'mcp.json'
			},
			trae: {
				shouldHaveMcp: false,
				expectedDir: '.trae',
				expectedConfigName: null,
				expectedPath: null
			},
			vscode: {
				shouldHaveMcp: true,
				expectedDir: '.vscode',
				expectedConfigName: 'mcp.json'
			},
			windsurf: {
				shouldHaveMcp: true,
				expectedDir: '.windsurf',
				expectedConfigName: 'mcp.json'
			}
		};

		// Generate expectedPath for each configuration using path.join
		const expectedMcpConfigurations = Object.entries(
			baseMcpConfigurations
		).reduce((acc, [profileName, config]) => {
			acc[profileName] = {
				...config,
				expectedPath:config.expectedConfigName
					? path.join(config.expectedDir, config.expectedConfigName)
					: null
			};
			return acc;
		}, {});

		Object.entries(expectedMcpConfigurations).forEach(
			([profileName, expected]) => {
				test(`should have correct MCP configuration for ${profileName} profile`, () => {
					const profile = getRulesProfile(profileName);
					expect(profile).toBeDefined();
					expect(profile.mcpConfig).toBe(expected.shouldHaveMcp);
					expect(profile.profileDir).toBe(expected.expectedDir);
					expect(profile.mcpConfigName).toBe(expected.expectedConfigName);
					expect(normalizePath(profile.mcpConfigPath)).toBe(normalizePath(expected.expectedPath));
				});
			}
		);
	});

	describe('MCP Configuration Path Consistency', () => {
		test('should ensure all profiles have consistent mcpConfigPath construction', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					const expectedPath = path.join(
						profile.profileDir,
						profile.mcpConfigName
					);
					expect(normalizePath(profile.mcpConfigPath)).toBe(normalizePath(expectedPath));
				}
			});
		});

		test('should ensure no two profiles have the same MCP config path', () => {
			const mcpPaths = new Set();
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				// Only consider profiles that actually have an MCP config path
				if (profile.mcpConfigPath) {
					expect(mcpPaths.has(profile.mcpConfigPath)).toBe(false);
					mcpPaths.add(profile.mcpConfigPath);
				}
			});
		});

		test('should ensure all MCP-enabled profiles use proper directory structure', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Check 1: profileDir starts with a dot (unless it's the root dir for simple profiles)
					if (profile.profileDir !== '.') {
						expect(profile.profileDir.startsWith('.')).toBe(true);
					}
					// Check 2: mcpConfigName is a non-empty string and looks like a filename
					expect(typeof profile.mcpConfigName).toBe('string');
					expect(profile.mcpConfigName.length).toBeGreaterThan(0);
					expect(profile.mcpConfigName).toMatch(/^[\w_.-]+$/); // Basic filename check

					// Check 3: mcpConfigPath is correctly formed from profileDir and mcpConfigName
					const expectedConfigPath = path.join(
						profile.profileDir,
						profile.mcpConfigName
					);
					expect(normalizePath(profile.mcpConfigPath)).toBe(normalizePath(expectedConfigPath));
				}
			});
		});

		test('should ensure all profiles have required MCP properties', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toHaveProperty('mcpConfig');
				expect(profile).toHaveProperty('profileDir');
				expect(profile).toHaveProperty('mcpConfigName');
				expect(profile).toHaveProperty('mcpConfigPath');
			});
		});
	});

	describe('MCP Configuration File Names', () => {
		test('should use standard mcp.json for MCP-enabled profiles', () => {
			const standardMcpProfiles = ['cursor', 'roo', 'vscode', 'windsurf'];
			standardMcpProfiles.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile.mcpConfigName).toBe('mcp.json');
			});
		});

		test('should use custom settings.json for Gemini profile', () => {
			const profile = getRulesProfile('gemini');
			expect(profile.mcpConfigName).toBe('settings.json');
		});

		test('should have null config name for non-MCP profiles', () => {
			const clineProfile = getRulesProfile('cline');
			expect(clineProfile.mcpConfigName).toBe(null);

			const traeProfile = getRulesProfile('trae');
			expect(traeProfile.mcpConfigName).toBe(null);

			const claudeProfile = getRulesProfile('claude');
			expect(claudeProfile.mcpConfigName).toBe(null);

			const codexProfile = getRulesProfile('codex');
			expect(codexProfile.mcpConfigName).toBe(null);
		});
	});

	describe('Profile Directory Structure', () => {
		test('should ensure each profile has a unique directory', () => {
			const profileDirs = new Set();
			// Profiles that use root directory (can share the same directory)
			const rootProfiles = ['claude', 'codex', 'gemini'];

			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);

				// Root profiles can share the root directory for rules
				if (rootProfiles.includes(profileName) && profile.rulesDir === '.') {
					expect(profile.rulesDir).toBe('.');
				}

				// Profile directories should be unique (except for root profiles)
				if (!rootProfiles.includes(profileName) || profile.profileDir !== '.') {
					expect(profileDirs.has(profile.profileDir)).toBe(false);
					profileDirs.add(profile.profileDir);
				}
			});
		});

		test('should ensure profile directories follow expected naming convention', () => {
			// Profiles that use root directory for rules
			const rootRulesProfiles = ['claude', 'codex', 'gemini'];

			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);

				// Some profiles use root directory for rules
				if (
					rootRulesProfiles.includes(profileName) &&
					profile.rulesDir === '.'
				) {
					expect(profile.rulesDir).toBe('.');
				}

				// Profile directories (not rules directories) should follow the .name pattern
				// unless they are root profiles with profileDir = '.'
				if (profile.profileDir !== '.') {
					expect(profile.profileDir).toMatch(/^\.[\w-]+$/);
				}
			});
		});
	});

	describe('MCP Configuration Creation Logic', () => {
		test('should indicate which profiles require MCP configuration creation', () => {
			const mcpEnabledProfiles = RULE_PROFILES.filter((profileName) => {
				const profile = getRulesProfile(profileName);
				return profile.mcpConfig !== false;
			});

			expect(mcpEnabledProfiles).toContain('cursor');
			expect(mcpEnabledProfiles).toContain('gemini');
			expect(mcpEnabledProfiles).toContain('roo');
			expect(mcpEnabledProfiles).toContain('vscode');
			expect(mcpEnabledProfiles).toContain('windsurf');
			expect(mcpEnabledProfiles).not.toContain('claude');
			expect(mcpEnabledProfiles).not.toContain('cline');
			expect(mcpEnabledProfiles).not.toContain('codex');
			expect(mcpEnabledProfiles).not.toContain('trae');
		});

		test('should provide all necessary information for MCP config creation', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					expect(profile.mcpConfigPath).toBeDefined();
					expect(typeof profile.mcpConfigPath).toBe('string');
					expect(profile.mcpConfigPath.length).toBeGreaterThan(0);
				}
			});
		});
	});

	describe('MCP Configuration Path Usage Verification', () => {
		test('should verify that rule transformer functions use mcpConfigPath correctly', () => {
			// This test verifies that the mcpConfigPath property exists and is properly formatted
			// for use with the setupMCPConfiguration function
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Verify the path is properly formatted for path.join usage
					expect(normalizePath(profile.mcpConfigPath).startsWith('/')).toBe(false); // It's a relative path (after normalization)
					// Check if it contains a forward slash, as paths are normalized
					expect(normalizePath(profile.mcpConfigPath)).toMatch(/\//);

					// Verify it matches the expected pattern: profileDir/configName
					const expectedPath = path.join(
						profile.profileDir,
						profile.mcpConfigName
					);
					expect(normalizePath(profile.mcpConfigPath)).toBe(normalizePath(expectedPath));
				}
			});
		});

		test('should verify that mcpConfigPath is properly constructed for path.join usage', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Test that path.join works correctly with the mcpConfigPath
					// Use an OS-neutral root for testing purposes if possible, or accept that results vary.
					// For this test, we're verifying that path.join(root, relativePath) works as expected.
					const testProjectRoot = 'test_project_root_dir'; // A simple relative root
					// Since profile.mcpConfigPath is always using '/', path.join will handle it correctly.
					const fullPath = path.join(testProjectRoot, profile.mcpConfigPath);
					const expectedFullPath = path.join(
						testProjectRoot,
						profile.profileDir,
						profile.mcpConfigName
					);

					// Should result in a proper path
					expect(normalizePath(fullPath)).toBe(normalizePath(expectedFullPath));
					// These assertions are implicitly covered by the above if profile.mcpConfigPath is correct
					// expect(fullPath).toContain(profile.profileDir);
					// expect(fullPath).toContain(profile.mcpConfigName);
				}
			});
		});
	});

	describe('MCP Configuration Function Integration', () => {
		test('should verify that setupMCPConfiguration receives the correct mcpConfigPath parameter', () => {
			// This test verifies the integration between rule transformer and mcp-utils
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Verify that the mcpConfigPath can be used directly with setupMCPConfiguration
					// The function signature is: setupMCPConfiguration(projectDir, mcpConfigPath)
					expect(profile.mcpConfigPath).toBeDefined();
					expect(typeof profile.mcpConfigPath).toBe('string');

					// Verify the path structure is correct for the new function signature
					// It should be equivalent to path.join(profileDir, mcpConfigName)
					const expectedStructure = path.join(
						profile.profileDir,
						profile.mcpConfigName
					);
					expect(normalizePath(profile.mcpConfigPath)).toBe(normalizePath(expectedStructure));
				}
			});
		});
	});

	describe('MCP configuration validation', () => {
		const mcpProfiles = ['cursor', 'gemini', 'roo', 'windsurf', 'vscode'];
		const nonMcpProfiles = ['claude', 'codex', 'cline', 'trae'];

		test.each(mcpProfiles)(
			'should have valid MCP config for %s profile',
			(profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toBeDefined();
				expect(profile.mcpConfig).toBe(true);
				expect(profile.mcpConfigPath).toBeDefined();
				expect(typeof profile.mcpConfigPath).toBe('string');
			}
		);

		test.each(nonMcpProfiles)(
			'should not require MCP config for %s profile',
			(profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toBeDefined();
				expect(profile.mcpConfig).toBe(false);
			}
		);
	});

	describe('Profile structure validation', () => {
		const mcpProfiles = [
			'cursor',
			'gemini',
			'roo',
			'windsurf',
			'cline',
			'trae',
			'vscode'
		];
		const profilesWithLifecycle = ['claude'];
		const profilesWithoutLifecycle = ['codex'];

		test.each(mcpProfiles)(
			'should have file mappings for %s profile',
			(profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toBeDefined();
				expect(profile.fileMap).toBeDefined();
				expect(typeof profile.fileMap).toBe('object');
				expect(Object.keys(profile.fileMap).length).toBeGreaterThan(0);
			}
		);

		test.each(profilesWithLifecycle)(
			'should have file mappings and lifecycle functions for %s profile',
			(profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toBeDefined();
				// Claude profile has both fileMap and lifecycle functions
				expect(profile.fileMap).toBeDefined();
				expect(typeof profile.fileMap).toBe('object');
				expect(Object.keys(profile.fileMap).length).toBeGreaterThan(0);
				expect(typeof profile.onAddRulesProfile).toBe('function');
				expect(typeof profile.onRemoveRulesProfile).toBe('function');
				expect(typeof profile.onPostConvertRulesProfile).toBe('function');
			}
		);

		test.each(profilesWithoutLifecycle)(
			'should have file mappings without lifecycle functions for %s profile',
			(profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toBeDefined();
				// Codex profile has fileMap but no lifecycle functions (simplified)
				expect(profile.fileMap).toBeDefined();
				expect(typeof profile.fileMap).toBe('object');
				expect(Object.keys(profile.fileMap).length).toBeGreaterThan(0);
				expect(profile.onAddRulesProfile).toBeUndefined();
				expect(profile.onRemoveRulesProfile).toBeUndefined();
				expect(profile.onPostConvertRulesProfile).toBeUndefined();
			}
		);
	});
});
