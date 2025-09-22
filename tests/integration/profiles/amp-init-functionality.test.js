import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';
import { convertAllRulesToProfileRules } from '../../../src/utils/rule-transformer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Amp Profile Init Functionality', () => {
	let tempDir;
	let ampProfile;

	beforeEach(() => {
		// Create temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-amp-'));

		// Get the Amp profile
		ampProfile = getRulesProfile('amp');
	});

	afterEach(() => {
		// Clean up temporary directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('Profile Configuration', () => {
		test('should have correct profile metadata', () => {
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
			expect(ampProfile.fileMap).toBeDefined();
			expect(ampProfile.fileMap['AGENTS.md']).toBe('.taskmaster/AGENT.md');
		});

		test('should have lifecycle functions', () => {
			expect(typeof ampProfile.onAddRulesProfile).toBe('function');
			expect(typeof ampProfile.onRemoveRulesProfile).toBe('function');
			expect(typeof ampProfile.onPostConvertRulesProfile).toBe('function');
		});
	});

	describe('AGENT.md Handling', () => {
		test('should create AGENT.md with import when none exists', () => {
			// Create mock AGENTS.md source
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			fs.writeFileSync(
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Call onAddRulesProfile
			ampProfile.onAddRulesProfile(tempDir, assetsDir);

			// Check that AGENT.md was created with import
			const agentFile = path.join(tempDir, 'AGENT.md');
			expect(fs.existsSync(agentFile)).toBe(true);

			const content = fs.readFileSync(agentFile, 'utf8');
			expect(content).toContain('# Amp Instructions');
			expect(content).toContain('## Task Master AI Instructions');
			expect(content).toContain('@./.taskmaster/AGENT.md');

			// Check that .taskmaster/AGENT.md was created
			const taskMasterAgent = path.join(tempDir, '.taskmaster', 'AGENT.md');
			expect(fs.existsSync(taskMasterAgent)).toBe(true);
		});

		test('should append import to existing AGENT.md', () => {
			// Create existing AGENT.md
			const existingContent =
				'# My Existing Amp Instructions\n\nSome content here.';
			fs.writeFileSync(path.join(tempDir, 'AGENT.md'), existingContent);

			// Create mock AGENTS.md source
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			fs.writeFileSync(
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Call onAddRulesProfile
			ampProfile.onAddRulesProfile(tempDir, assetsDir);

			// Check that import was appended
			const agentFile = path.join(tempDir, 'AGENT.md');
			const content = fs.readFileSync(agentFile, 'utf8');
			expect(content).toContain('# My Existing Amp Instructions');
			expect(content).toContain('Some content here.');
			expect(content).toContain('## Task Master AI Instructions');
			expect(content).toContain('@./.taskmaster/AGENT.md');
		});

		test('should not duplicate import if already exists', () => {
			// Create AGENT.md with existing import
			const existingContent =
				"# My Amp Instructions\n\n## Task Master AI Instructions\n**Import Task Master's development workflow commands and guidelines, treat as if import is in the main AGENT.md file.**\n@./.taskmaster/AGENT.md";
			fs.writeFileSync(path.join(tempDir, 'AGENT.md'), existingContent);

			// Create mock AGENTS.md source
			const assetsDir = path.join(tempDir, 'assets');
			fs.mkdirSync(assetsDir, { recursive: true });
			fs.writeFileSync(
				path.join(assetsDir, 'AGENTS.md'),
				'Task Master instructions'
			);

			// Call onAddRulesProfile
			ampProfile.onAddRulesProfile(tempDir, assetsDir);

			// Check that import was not duplicated
			const agentFile = path.join(tempDir, 'AGENT.md');
			const content = fs.readFileSync(agentFile, 'utf8');
			const importCount = (content.match(/@\.\/.taskmaster\/AGENT\.md/g) || [])
				.length;
			expect(importCount).toBe(1);
		});
	});

	describe('MCP Configuration', () => {
		test('should rename mcpServers to amp.mcpServers', () => {
			// Create .vscode directory and settings.json with mcpServers
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });

			const initialConfig = {
				mcpServers: {
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

			// Call onPostConvertRulesProfile (which should transform mcpServers to amp.mcpServers)
			ampProfile.onPostConvertRulesProfile(
				tempDir,
				path.join(tempDir, 'assets')
			);

			// Check that mcpServers was renamed to amp.mcpServers
			const settingsFile = path.join(vscodeDirPath, 'settings.json');
			const content = fs.readFileSync(settingsFile, 'utf8');
			const config = JSON.parse(content);

			expect(config.mcpServers).toBeUndefined();
			expect(config['amp.mcpServers']).toBeDefined();
			expect(config['amp.mcpServers']['task-master-ai']).toBeDefined();
		});

		test('should not rename if amp.mcpServers already exists', () => {
			// Create .vscode directory and settings.json with both mcpServers and amp.mcpServers
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });

			const initialConfig = {
				mcpServers: {
					'some-other-server': {
						command: 'other-command'
					}
				},
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

			// Call onAddRulesProfile
			ampProfile.onAddRulesProfile(tempDir, path.join(tempDir, 'assets'));

			// Check that both sections remain unchanged
			const settingsFile = path.join(vscodeDirPath, 'settings.json');
			const content = fs.readFileSync(settingsFile, 'utf8');
			const config = JSON.parse(content);

			expect(config.mcpServers).toBeDefined();
			expect(config.mcpServers['some-other-server']).toBeDefined();
			expect(config['amp.mcpServers']).toBeDefined();
			expect(config['amp.mcpServers']['task-master-ai']).toBeDefined();
		});
	});

	describe('Removal Functionality', () => {
		test('should remove AGENT.md import and clean up files', () => {
			// Setup: Create AGENT.md with import and .taskmaster/AGENT.md
			const agentContent =
				"# My Amp Instructions\n\nSome content.\n\n## Task Master AI Instructions\n**Import Task Master's development workflow commands and guidelines, treat as if import is in the main AGENT.md file.**\n@./.taskmaster/AGENT.md\n";
			fs.writeFileSync(path.join(tempDir, 'AGENT.md'), agentContent);

			fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });
			fs.writeFileSync(
				path.join(tempDir, '.taskmaster', 'AGENT.md'),
				'Task Master instructions'
			);

			// Call onRemoveRulesProfile
			ampProfile.onRemoveRulesProfile(tempDir);

			// Check that .taskmaster/AGENT.md was removed
			expect(fs.existsSync(path.join(tempDir, '.taskmaster', 'AGENT.md'))).toBe(
				false
			);

			// Check that import was removed from AGENT.md
			const remainingContent = fs.readFileSync(
				path.join(tempDir, 'AGENT.md'),
				'utf8'
			);
			expect(remainingContent).not.toContain('## Task Master AI Instructions');
			expect(remainingContent).not.toContain('@./.taskmaster/AGENT.md');
			expect(remainingContent).toContain('# My Amp Instructions');
			expect(remainingContent).toContain('Some content.');
		});

		test('should remove empty AGENT.md if only contained import', () => {
			// Setup: Create AGENT.md with only import
			const agentContent =
				"# Amp Instructions\n\n## Task Master AI Instructions\n**Import Task Master's development workflow commands and guidelines, treat as if import is in the main AGENT.md file.**\n@./.taskmaster/AGENT.md";
			fs.writeFileSync(path.join(tempDir, 'AGENT.md'), agentContent);

			fs.mkdirSync(path.join(tempDir, '.taskmaster'), { recursive: true });
			fs.writeFileSync(
				path.join(tempDir, '.taskmaster', 'AGENT.md'),
				'Task Master instructions'
			);

			// Call onRemoveRulesProfile
			ampProfile.onRemoveRulesProfile(tempDir);

			// Check that AGENT.md was removed
			expect(fs.existsSync(path.join(tempDir, 'AGENT.md'))).toBe(false);
		});

		test('should remove amp.mcpServers section from settings.json', () => {
			// Setup: Create .vscode/settings.json with amp.mcpServers and other settings
			const vscodeDirPath = path.join(tempDir, '.vscode');
			fs.mkdirSync(vscodeDirPath, { recursive: true });

			const initialConfig = {
				'amp.mcpServers': {
					'task-master-ai': {
						command: 'npx',
						args: ['-y', 'task-master-ai']
					}
				},
				'other.setting': 'value'
			};

			fs.writeFileSync(
				path.join(vscodeDirPath, 'settings.json'),
				JSON.stringify(initialConfig, null, '\t')
			);

			// Call onRemoveRulesProfile
			ampProfile.onRemoveRulesProfile(tempDir);

			// Check that amp.mcpServers was removed but other settings remain
			const settingsFile = path.join(vscodeDirPath, 'settings.json');
			expect(fs.existsSync(settingsFile)).toBe(true);

			const content = fs.readFileSync(settingsFile, 'utf8');
			const config = JSON.parse(content);

			expect(config['amp.mcpServers']).toBeUndefined();
			expect(config['other.setting']).toBe('value');
		});

		test('should remove settings.json and .vscode directory if empty after removal', () => {
			// Setup: Create .vscode/settings.json with only amp.mcpServers
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

			// Call onRemoveRulesProfile
			ampProfile.onRemoveRulesProfile(tempDir);

			// Check that settings.json and .vscode directory were removed
			expect(fs.existsSync(path.join(vscodeDirPath, 'settings.json'))).toBe(
				false
			);
			expect(fs.existsSync(vscodeDirPath)).toBe(false);
		});
	});

	describe('Full Integration', () => {
		test('should work with convertAllRulesToProfileRules', () => {
			// This test ensures the profile works with the full rule transformer
			const result = convertAllRulesToProfileRules(tempDir, ampProfile);

			expect(result.success).toBeGreaterThan(0);
			expect(result.failed).toBe(0);

			// Check that .taskmaster/AGENT.md was created
			expect(fs.existsSync(path.join(tempDir, '.taskmaster', 'AGENT.md'))).toBe(
				true
			);

			// Check that AGENT.md was created with import
			expect(fs.existsSync(path.join(tempDir, 'AGENT.md'))).toBe(true);
			const agentContent = fs.readFileSync(
				path.join(tempDir, 'AGENT.md'),
				'utf8'
			);
			expect(agentContent).toContain('@./.taskmaster/AGENT.md');
		});
	});
});
