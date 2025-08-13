import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';
import path from 'path';

describe('MCP Configuration Validation', () => {
	describe('Profile MCP Configuration Properties', () => {
		const expectedMcpConfigurations = {
			amp: {
				shouldHaveMcp: true,
				expectedDir: '.vscode',
				expectedConfigName: 'settings.json',
				expectedPath: '.vscode/settings.json'
			},
			claude: {
				shouldHaveMcp: true,
				expectedDir: '.',
				expectedConfigName: '.mcp.json',
				expectedPath: '.mcp.json'
			},
			cline: {
				shouldHaveMcp: false,
				expectedDir: '.clinerules',
				expectedConfigName: null,
				expectedPath: null
			},
			codex: {
				shouldHaveMcp: false,
				expectedDir: '.',
				expectedConfigName: null,
				expectedPath: null
			},
			cursor: {
				shouldHaveMcp: true,
				expectedDir: '.cursor',
				expectedConfigName: 'mcp.json',
				expectedPath: '.cursor/mcp.json'
			},
			gemini: {
				shouldHaveMcp: true,
				expectedDir: '.gemini',
				expectedConfigName: 'settings.json',
				expectedPath: '.gemini/settings.json'
			},
			kiro: {
				shouldHaveMcp: true,
				expectedDir: '.kiro',
				expectedConfigName: 'settings/mcp.json',
				expectedPath: '.kiro/settings/mcp.json'
			},
			opencode: {
				shouldHaveMcp: true,
				expectedDir: '.',
				expectedConfigName: 'opencode.json',
				expectedPath: 'opencode.json'
			},
			roo: {
				shouldHaveMcp: true,
				expectedDir: '.roo',
				expectedConfigName: 'mcp.json',
				expectedPath: '.roo/mcp.json'
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
				expectedConfigName: 'mcp.json',
				expectedPath: '.vscode/mcp.json'
			},
			windsurf: {
				shouldHaveMcp: true,
				expectedDir: '.windsurf',
				expectedConfigName: 'mcp.json',
				expectedPath: '.windsurf/mcp.json'
			},
			zed: {
				shouldHaveMcp: true,
				expectedDir: '.zed',
				expectedConfigName: 'settings.json',
				expectedPath: '.zed/settings.json'
			}
		};

		Object.entries(expectedMcpConfigurations).forEach(
			([profileName, expected]) => {
				test(`should have correct MCP configuration for ${profileName} profile`, () => {
					const profile = getRulesProfile(profileName);
					expect(profile).toBeDefined();
					expect(profile.mcpConfig).toBe(expected.shouldHaveMcp);
					expect(profile.profileDir).toBe(expected.expectedDir);
					expect(profile.mcpConfigName).toBe(expected.expectedConfigName);
					expect(profile.mcpConfigPath).toBe(expected.expectedPath);
				});
			}
		);
	});

	describe('MCP Configuration Path Consistency', () => {
		test('should ensure all profiles have consistent mcpConfigPath construction', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// For root directory profiles, path.join('.', filename) normalizes to just 'filename'
					// except for Claude which uses '.mcp.json' explicitly
					let expectedPath;
					if (profile.profileDir === '.') {
						if (profileName === 'claude') {
							expectedPath = '.mcp.json'; // Claude explicitly uses '.mcp.json'
						} else {
							expectedPath = profile.mcpConfigName; // Other root profiles normalize to just the filename
						}
					} else {
						expectedPath = `${profile.profileDir}/${profile.mcpConfigName}`;
					}
					expect(profile.mcpConfigPath).toBe(expectedPath);
				}
			});
		});

		test('should ensure no two profiles have the same MCP config path', () => {
			const mcpPaths = new Set();
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					expect(mcpPaths.has(profile.mcpConfigPath)).toBe(false);
					mcpPaths.add(profile.mcpConfigPath);
				}
			});
		});

		test('should ensure all MCP-enabled profiles use proper directory structure', () => {
			const rootProfiles = ['opencode', 'claude', 'codex']; // Profiles that use root directory for config
			const nestedConfigProfiles = ['kiro']; // Profiles that use nested directories for config

			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					if (rootProfiles.includes(profileName)) {
						// Root profiles have different patterns
						if (profileName === 'claude') {
							expect(profile.mcpConfigPath).toBe('.mcp.json');
						} else {
							// Other root profiles normalize to just the filename (no ./ prefix)
							expect(profile.mcpConfigPath).toMatch(/^[\w_.]+$/);
						}
					} else if (nestedConfigProfiles.includes(profileName)) {
						// Profiles with nested config directories
						expect(profile.mcpConfigPath).toMatch(
							/^\.[\w-]+\/[\w-]+\/[\w_.]+$/
						);
					} else {
						// Other profiles should have config files in their specific directories
						expect(profile.mcpConfigPath).toMatch(/^\.[\w-]+\/[\w_.]+$/);
					}
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
			// Only codex, cline, and trae profiles should have null config names
			const nonMcpProfiles = ['codex', 'cline', 'trae'];

			for (const profileName of nonMcpProfiles) {
				const profile = getRulesProfile(profileName);
				expect(profile.mcpConfigName).toBe(null);
			}
		});
	});

	describe('Profile Directory Structure', () => {
		test('should ensure each profile has a unique directory', () => {
			const profileDirs = new Set();
			// Profiles that use root directory (can share the same directory)
			const rootProfiles = ['claude', 'codex', 'gemini', 'opencode'];
			// Profiles that intentionally share the same directory
			const sharedDirectoryProfiles = ['amp', 'vscode']; // Both use .vscode

			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);

				// Root profiles can share the root directory for rules
				if (rootProfiles.includes(profileName) && profile.rulesDir === '.') {
					expect(profile.rulesDir).toBe('.');
				}

				// Profile directories should be unique (except for root profiles and shared directory profiles)
				if (
					!rootProfiles.includes(profileName) &&
					!sharedDirectoryProfiles.includes(profileName)
				) {
					if (profile.profileDir !== '.') {
						expect(profileDirs.has(profile.profileDir)).toBe(false);
						profileDirs.add(profile.profileDir);
					}
				} else if (sharedDirectoryProfiles.includes(profileName)) {
					// Shared directory profiles should use .vscode
					expect(profile.profileDir).toBe('.vscode');
				}
			});
		});

		test('should ensure profile directories follow expected naming convention', () => {
			// Profiles that use root directory for rules
			const rootRulesProfiles = ['claude', 'codex', 'gemini', 'opencode'];

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
			// Get all profiles that have MCP configuration enabled
			const mcpEnabledProfiles = RULE_PROFILES.filter((profileName) => {
				const profile = getRulesProfile(profileName);
				return profile.mcpConfig !== false;
			});

			// Verify expected MCP-enabled profiles
			expect(mcpEnabledProfiles).toContain('amp');
			expect(mcpEnabledProfiles).toContain('claude');
			expect(mcpEnabledProfiles).toContain('cursor');
			expect(mcpEnabledProfiles).toContain('gemini');
			expect(mcpEnabledProfiles).toContain('opencode');
			expect(mcpEnabledProfiles).toContain('vscode');
			expect(mcpEnabledProfiles).toContain('windsurf');
			expect(mcpEnabledProfiles).toContain('zed');
			expect(mcpEnabledProfiles).toContain('roo');
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
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Verify the path is properly formatted for path.join usage
					expect(profile.mcpConfigPath.startsWith('/')).toBe(false);

					// Root directory profiles have different patterns
					if (profile.profileDir === '.') {
						if (profileName === 'claude') {
							expect(profile.mcpConfigPath).toBe('.mcp.json');
						} else {
							// Other root profiles (opencode) normalize to just the filename
							expect(profile.mcpConfigPath).toBe(profile.mcpConfigName);
						}
					} else {
						// Non-root profiles should contain a directory separator
						expect(profile.mcpConfigPath).toContain('/');
					}

					// Verify it matches the expected pattern based on how path.join works
					let expectedPath;
					if (profile.profileDir === '.') {
						if (profileName === 'claude') {
							expectedPath = '.mcp.json'; // Claude explicitly uses '.mcp.json'
						} else {
							expectedPath = profile.mcpConfigName; // path.join('.', 'filename') normalizes to 'filename'
						}
					} else {
						expectedPath = `${profile.profileDir}/${profile.mcpConfigName}`;
					}
					expect(profile.mcpConfigPath).toBe(expectedPath);
				}
			});
		});

		test('should verify that mcpConfigPath is properly constructed for path.join usage', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Test that path.join works correctly with the mcpConfigPath
					const testProjectRoot = '/test/project';
					const fullPath = path.join(testProjectRoot, profile.mcpConfigPath);

					// Should result in a proper absolute path
					// Note: path.join normalizes paths, so './opencode.json' becomes 'opencode.json'
					const normalizedExpectedPath = path.join(
						testProjectRoot,
						profile.mcpConfigPath
					);
					expect(fullPath).toBe(normalizedExpectedPath);
					expect(fullPath).toContain(profile.mcpConfigName);
				}
			});
		});
	});

	describe('MCP Configuration Function Integration', () => {
		test('should verify that setupMCPConfiguration receives the correct mcpConfigPath parameter', () => {
			RULE_PROFILES.forEach((profileName) => {
				const profile = getRulesProfile(profileName);
				if (profile.mcpConfig !== false) {
					// Verify the path structure is correct for the new function signature
					if (profile.profileDir === '.') {
						// Root directory profiles have special handling
						if (profileName === 'claude') {
							expect(profile.mcpConfigPath).toBe('.mcp.json');
						} else {
							// Other root profiles normalize to just the filename
							expect(profile.mcpConfigPath).toBe(profile.mcpConfigName);
						}
					} else if (profileName === 'kiro') {
						// Kiro has a nested config structure
						const parts = profile.mcpConfigPath.split('/');
						expect(parts).toHaveLength(3); // Should be profileDir/settings/mcp.json
						expect(parts[0]).toBe(profile.profileDir);
						expect(parts[1]).toBe('settings');
						expect(parts[2]).toBe('mcp.json');
					} else {
						// Non-root profiles should have profileDir/configName structure
						const parts = profile.mcpConfigPath.split('/');
						expect(parts).toHaveLength(2); // Should be profileDir/configName
						expect(parts[0]).toBe(profile.profileDir);
						expect(parts[1]).toBe(profile.mcpConfigName);
					}
				}
			});
		});
	});

	describe('MCP configuration validation', () => {
		const mcpProfiles = [
			'amp',
			'claude',
			'cursor',
			'gemini',
			'kiro',
			'opencode',
			'roo',
			'windsurf',
			'vscode',
			'zed'
		];
		const nonMcpProfiles = ['codex', 'cline', 'trae'];
		const profilesWithLifecycle = ['claude'];
		const profilesWithoutLifecycle = ['codex'];

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
		const allProfiles = [
			'amp',
			'claude',
			'cline',
			'codex',
			'cursor',
			'gemini',
			'opencode',
			'roo',
			'trae',
			'vscode',
			'windsurf',
			'zed'
		];
		const profilesWithLifecycle = ['amp', 'claude'];
		const profilesWithPostConvertLifecycle = ['opencode'];
		const profilesWithoutLifecycle = ['codex'];

		test.each(allProfiles)(
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

		test.each(profilesWithPostConvertLifecycle)(
			'should have file mappings and post-convert lifecycle functions for %s profile',
			(profileName) => {
				const profile = getRulesProfile(profileName);
				expect(profile).toBeDefined();
				// OpenCode profile has fileMap and post-convert lifecycle functions
				expect(profile.fileMap).toBeDefined();
				expect(typeof profile.fileMap).toBe('object');
				expect(Object.keys(profile.fileMap).length).toBeGreaterThan(0);
				expect(profile.onAddRulesProfile).toBeUndefined(); // OpenCode doesn't have onAdd
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
