import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Amp Profile Integration', () => {
	let tempDir;
	let ampProfile;

	beforeEach(() => {
		// Create temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-amp-unit-'));

		// Get the Amp profile
		ampProfile = getRulesProfile('amp');
	});

	afterEach(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('Profile Structure', () => {
		test('should have expected profile structure', () => {
			expect(ampProfile).toBeDefined();
			expect(ampProfile.profileName).toBe('amp');
			expect(ampProfile.displayName).toBe('Amp');
			expect(ampProfile.profileDir).toBe('.vscode');
			expect(ampProfile.rulesDir).toBe('.');
			expect(ampProfile.mcpConfig).toBe(true);
			expect(ampProfile.mcpConfigName).toBe('settings.json');
			expect(ampProfile.mcpConfigPath).toBe('.vscode/settings.json');
			expect(ampProfile.includeDefaultRules).toBe(false);
		});

		test('should have correct file mapping', () => {
			expect(ampProfile.fileMap).toEqual({
				'AGENTS.md': '.taskmaster/AGENT.md'
			});
		});

		test('should not create unnecessary directories', () => {
			// Unlike profiles that copy entire directories, Amp should only create what's needed
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			fs.writeFileSync(
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Call onAddRulesProfile
			ampProfile.onAddRulesProfile(tempDir, assetsDir);

			// Should only have created .taskmaster directory and AGENT.md
			expect(fs.existsSync(path.join(tempDir, '.taskmaster'))).toBe(true);
			expect(fs.existsSync(path.join(tempDir, 'AGENT.md'))).toBe(true);

			// Should not have created any other directories (like .claude)
			expect(fs.existsSync(path.join(tempDir, '.amp'))).toBe(false);
			expect(fs.existsSync(path.join(tempDir, '.claude'))).toBe(false);
		});
	});

	describe('AGENT.md Import Logic', () => {
		test('should handle missing source file gracefully', () => {
			// Call onAddRulesProfile without creating source file
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });

			// Should not throw error
			expect(() => {
				ampProfile.onAddRulesProfile(tempDir, assetsDir);
			}).not.toThrow();

			// Should not create any files
			expect(fs.existsSync(path.join(tempDir, 'AGENT.md'))).toBe(false);
			expect(fs.existsSync(path.join(tempDir, '.taskmaster', 'AGENT.md'))).toBe(
				false
			);
		});

		test('should preserve existing content when adding import', () => {
			// Create existing AGENT.md with specific content
			const existingContent =
				'# My Custom Amp Setup\n\nThis is my custom configuration.\n\n## Custom Section\n\nSome custom rules here.';
			fs.writeFileSync(path.join(tempDir, 'AGENT.md'), existingContent);

			// Create mock source
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			fs.writeFileSync(
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Call onAddRulesProfile
			ampProfile.onAddRulesProfile(tempDir, assetsDir);

			// Check that existing content is preserved
			const updatedContent = fs.readFileSync(
				path.join(tempDir, 'AGENT.md'),
				'utf8'
			);
			expect(updatedContent).toContain('# My Custom Amp Setup');
			expect(updatedContent).toContain('This is my custom configuration.');
			expect(updatedContent).toContain('## Custom Section');
			expect(updatedContent).toContain('Some custom rules here.');
			expect(updatedContent).toContain('@./.taskmaster/AGENT.md');
		});
	});

	describe('MCP Configuration Handling', () => {
		test('should handle missing .vscode directory gracefully', () => {
			// Call onAddRulesProfile without .vscode directory
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });

			// Should not throw error
			expect(() => {
				ampProfile.onAddRulesProfile(tempDir, assetsDir);
			}).not.toThrow();
		});

		test('should handle malformed JSON gracefully', () => {
			// Create .vscode directory with malformed JSON
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });
			fs.writeFileSync(
				path.join(vscodeDirPath, 'settings.json'),
				'{ malformed json'
			);

			// Should not throw error
			expect(() => {
				ampProfile.onAddRulesProfile(tempDir, path.join(tempDir, 'assets'));
			}).not.toThrow();
		});

		test('should preserve other VS Code settings when renaming', () => {
			// Create .vscode/settings.json with various settings
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });

			const initialConfig = {
				'editor.fontSize': 14,
				'editor.tabSize': 2,
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['-y', 'task-master-ai']
					}
				},
				'workbench.colorTheme': 'Dark+'
			};

			fs.writeFileSync(
				path.join(vscodeDirPath, 'settings.json'),
				JSON.stringify(initialConfig, null, '\t')
			);

			// Call onPostConvertRulesProfile (which handles MCP transformation)
			ampProfile.onPostConvertRulesProfile(
				tempDir,
				path.join(tempDir, 'assets')
			);

			// Check that other settings are preserved
			const settingsFile = path.join(vscodeDirPath, 'settings.json');
			const content = fs.readFileSync(settingsFile, 'utf8');
			const config = JSON.parse(content);

			expect(config['editor.fontSize']).toBe(14);
			expect(config['editor.tabSize']).toBe(2);
			expect(config['workbench.colorTheme']).toBe('Dark+');
			expect(config['amp.mcpServers']).toBeDefined();
			expect(config.mcpServers).toBeUndefined();
		});
	});

	describe('Removal Logic', () => {
		test('should handle missing files gracefully during removal', () => {
			// Should not throw error when removing non-existent files
			expect(() => {
				ampProfile.onRemoveRulesProfile(tempDir);
			}).not.toThrow();
		});

		test('should handle malformed JSON gracefully during removal', () => {
			// Create .vscode directory with malformed JSON
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });
			fs.writeFileSync(
				path.join(vscodeDirPath, 'settings.json'),
				'{ malformed json'
			);

			// Should not throw error
			expect(() => {
				ampProfile.onRemoveRulesProfile(tempDir);
			}).not.toThrow();
		});

		test('should preserve .vscode directory if it contains other files', () => {
			// Create .vscode directory with amp.mcpServers and other files
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });

			const initialConfig = {
				'amp.mcpServers': {
					'task-master-ai': {
						command: 'npx',
						args: ['-y', 'task-master-ai']
					}
				}
			};

			fs.writeFileSync(
				path.join(vscodeDirPath, 'settings.json'),
				JSON.stringify(initialConfig, null, '\t')
			);

			// Create another file in .vscode
			fs.writeFileSync(path.join(vscodeDirPath, 'launch.json'), '{}');

			// Call onRemoveRulesProfile
			ampProfile.onRemoveRulesProfile(tempDir);

			// Check that .vscode directory is preserved
			expect(fs.existsSync(vscodeDirPath)).toBe(true);
			expect(fs.existsSync(path.join(vscodeDirPath, 'launch.json'))).toBe(true);
		});
	});

	describe('Lifecycle Function Integration', () => {
		test('should have all required lifecycle functions', () => {
			expect(typeof ampProfile.onAddRulesProfile).toBe('function');
			expect(typeof ampProfile.onRemoveRulesProfile).toBe('function');
			expect(typeof ampProfile.onPostConvertRulesProfile).toBe('function');
		});

		test('onPostConvertRulesProfile should behave like onAddRulesProfile', () => {
			// Create mock source
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			fs.writeFileSync(
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Call onPostConvertRulesProfile
			ampProfile.onPostConvertRulesProfile(tempDir, assetsDir);

			// Should have same result as onAddRulesProfile
			expect(fs.existsSync(path.join(tempDir, '.taskmaster', 'AGENT.md'))).toBe(
				true
			);
			expect(fs.existsSync(path.join(tempDir, 'AGENT.md'))).toBe(true);

			const agentContent = fs.readFileSync(
				path.join(tempDir, 'AGENT.md'),
				'utf8'
			);
			expect(agentContent).toContain('@./.taskmaster/AGENT.md');
		});
	});

	describe('Error Handling', () => {
		test('should handle file system errors gracefully', () => {
			// Mock fs.writeFileSync to throw an error
			const originalWriteFileSync = fs.writeFileSync;
			fs.writeFileSync = jest.fn().mockImplementation(() => {
				throw new Error('Permission denied');
			});

			// Create mock source
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			originalWriteFileSync.call(
				fs,
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Should not throw error
			expect(() => {
				ampProfile.onAddRulesProfile(tempDir, assetsDir);
			}).not.toThrow();

			// Restore original function
			fs.writeFileSync = originalWriteFileSync;
		});
	});
});
