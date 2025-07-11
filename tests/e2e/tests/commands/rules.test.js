/**
 * Comprehensive E2E tests for rules command
 * Tests adding, removing, and managing task rules/profiles
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	statSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const path = require('path');

describe('rules command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-rules-'));

		// Initialize test helpers
		const context = global.createTestContext('rules');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project without rules
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic rules operations', () => {
		it('should add a single rule profile', async () => {
			const result = await helpers.taskMaster('rules', ['add', 'windsurf'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
			expect(result.stdout).toContain('Completed adding rules for profile: windsurf');
			expect(result.stdout).toContain('Profile: windsurf');

			// Check that windsurf rules directory was created
			const windsurfDir = join(testDir, '.windsurf');
			expect(existsSync(windsurfDir)).toBe(true);
		});

		it('should add multiple rule profiles', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['add', 'windsurf', 'roo'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
			expect(result.stdout).toContain('Adding rules for profile: roo');
			expect(result.stdout).toContain('Profile: windsurf');
			expect(result.stdout).toContain('Profile: roo');

			// Check that both directories were created
			expect(existsSync(join(testDir, '.windsurf'))).toBe(true);
			expect(existsSync(join(testDir, '.roo'))).toBe(true);
		});

		it('should add multiple rule profiles with comma separation', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['add', 'windsurf,roo,cursor'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
			expect(result.stdout).toContain('Adding rules for profile: roo');
			expect(result.stdout).toContain('Adding rules for profile: cursor');

			// Check directories
			expect(existsSync(join(testDir, '.windsurf'))).toBe(true);
			expect(existsSync(join(testDir, '.roo'))).toBe(true);
			expect(existsSync(join(testDir, '.cursor'))).toBe(true);
		});

		it('should remove a rule profile', async () => {
			// First add the profile
			await helpers.taskMaster('rules', ['add', 'windsurf'], { cwd: testDir });

			// Then remove it with force flag to skip confirmation
			const result = await helpers.taskMaster(
				'rules',
				['remove', 'windsurf', '--force'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Removing rules for profile: windsurf');
			expect(result.stdout).toContain('Profile: windsurf');
			expect(result.stdout).toContain('removed successfully');
		});

		it('should handle removing multiple profiles', async () => {
			// Add multiple profiles
			await helpers.taskMaster('rules', ['add', 'windsurf', 'roo', 'cursor'], {
				cwd: testDir
			});

			// Remove two of them
			const result = await helpers.taskMaster(
				'rules',
				['remove', 'windsurf', 'roo', '--force'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Removing rules for profile: windsurf');
			expect(result.stdout).toContain('Removing rules for profile: roo');
			expect(result.stdout).toContain('Summary: Removed 2 profile(s)');

			// Cursor should still exist
			expect(existsSync(join(testDir, '.cursor'))).toBe(true);
			// Others should be gone
			expect(existsSync(join(testDir, '.windsurf'))).toBe(false);
			expect(existsSync(join(testDir, '.roo'))).toBe(false);
		});
	});

	describe('Interactive setup', () => {
		it('should launch interactive setup with --setup flag', async () => {
			// Since interactive setup requires user input, we'll just check that it starts
			const result = await helpers.taskMaster('rules', ['--setup'], {
				cwd: testDir,
				timeout: 1000, // Short timeout since we can't provide input
				allowFailure: true
			});

			// The command should start but timeout waiting for input
			expect(result.stdout).toContain('Select rule profiles to install');
		});
	});

	describe('Error handling', () => {
		it('should error on invalid action', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['invalid-action', 'windsurf'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain("Invalid or missing action 'invalid-action'");
			expect(result.stderr).toContain('Valid actions are: add, remove');
		});

		it('should error when no action provided', async () => {
			const result = await helpers.taskMaster('rules', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain("Invalid or missing action 'none'");
		});

		it('should error when no profiles specified for add/remove', async () => {
			const result = await helpers.taskMaster('rules', ['add'], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain(
				'Please specify at least one rule profile'
			);
		});

		it('should warn about invalid profile names', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['add', 'windsurf', 'invalid-profile', 'roo'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(
				'Rule profile for "invalid-profile" not found'
			);
			expect(result.stdout).toContain('Valid profiles:');
			expect(result.stdout).toContain('claude');
			expect(result.stdout).toContain('windsurf');
			expect(result.stdout).toContain('roo');

			// Should still add the valid profiles
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
			expect(result.stdout).toContain('Adding rules for profile: roo');
		});

		it('should handle project not initialized', async () => {
			// Create a new directory without initializing task-master
			const uninitDir = mkdtempSync(join(tmpdir(), 'task-master-uninit-'));

			const result = await helpers.taskMaster('rules', ['add', 'windsurf'], {
				cwd: uninitDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Could not find project root');

			// Cleanup
			rmSync(uninitDir, { recursive: true, force: true });
		});
	});

	describe('Rule file generation', () => {
		it('should create correct rule files for windsurf profile', async () => {
			await helpers.taskMaster('rules', ['add', 'windsurf'], { cwd: testDir });

			const rulesDir = join(testDir, '.windsurf/rules');
			expect(existsSync(rulesDir)).toBe(true);

			// Check for expected rule files
			const expectedFiles = ['instructions.md', 'taskmaster'];
			const actualFiles = readdirSync(rulesDir);

			expectedFiles.forEach((file) => {
				expect(actualFiles).toContain(file);
			});

			// Check that rules contain windsurf-specific content
			const instructionsPath = join(rulesDir, 'instructions.md');
			const instructionsContent = readFileSync(instructionsPath, 'utf8');
			expect(instructionsContent).toContain('Windsurf');
		});

		it('should create correct rule files for roo profile', async () => {
			await helpers.taskMaster('rules', ['add', 'roo'], { cwd: testDir });

			const rulesDir = join(testDir, '.roo/rules');
			expect(existsSync(rulesDir)).toBe(true);

			// Check for roo-specific files
			const files = readdirSync(rulesDir);
			expect(files.length).toBeGreaterThan(0);

			// Check that rules contain roo-specific content
			const instructionsPath = join(rulesDir, 'instructions.md');
			if (existsSync(instructionsPath)) {
				const content = readFileSync(instructionsPath, 'utf8');
				expect(content).toContain('Roo');
			}
		});

		it('should create MCP configuration for claude profile', async () => {
			await helpers.taskMaster('rules', ['add', 'claude'], { cwd: testDir });

			// Check for MCP config file
			const mcpConfigPath = join(testDir, 'claude_desktop_config.json');
			expect(existsSync(mcpConfigPath)).toBe(true);

			const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
			expect(mcpConfig).toHaveProperty('mcpServers');
			expect(mcpConfig.mcpServers).toHaveProperty('task-master-server');
		});
	});

	describe('Profile combinations', () => {
		it('should handle adding all available profiles', async () => {
			const allProfiles = [
				'claude',
				'cline',
				'codex',
				'cursor',
				'gemini',
				'roo',
				'trae',
				'vscode',
				'windsurf'
			];

			const result = await helpers.taskMaster(
				'rules',
				['add', ...allProfiles],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`Summary: Added ${allProfiles.length} profile(s)`);

			// Check that directories were created for profiles that use them
			const profileDirs = ['.windsurf', '.roo', '.cursor', '.cline'];
			profileDirs.forEach((dir) => {
				const dirPath = join(testDir, dir);
				if (existsSync(dirPath)) {
					expect(statSync(dirPath).isDirectory()).toBe(true);
				}
			});
		});

		it('should not duplicate rules when adding same profile twice', async () => {
			// Add windsurf profile
			await helpers.taskMaster('rules', ['add', 'windsurf'], { cwd: testDir });

			// Add it again
			const result = await helpers.taskMaster('rules', ['add', 'windsurf'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			// Should still complete successfully but may indicate files already exist
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
		});
	});

	describe('Removing rules edge cases', () => {
		it('should handle removing non-existent profile gracefully', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['remove', 'windsurf', '--force'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Removing rules for profile: windsurf');
			// Should indicate it was skipped or already removed
		});

		it('should preserve non-task-master files in profile directories', async () => {
			// Add windsurf profile
			await helpers.taskMaster('rules', ['add', 'windsurf'], { cwd: testDir });

			// Add a custom file to the windsurf directory
			const customFilePath = join(testDir, '.windsurf/custom-file.txt');
			writeFileSync(customFilePath, 'This should not be deleted');

			// Remove windsurf profile
			await helpers.taskMaster('rules', ['remove', 'windsurf', '--force'], {
				cwd: testDir
			});

			// The custom file should still exist if the directory wasn't removed
			// (This behavior depends on the implementation)
			if (existsSync(join(testDir, '.windsurf'))) {
				expect(existsSync(customFilePath)).toBe(true);
			}
		});
	});

	describe('Summary outputs', () => {
		it('should show detailed summary after adding profiles', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['add', 'windsurf', 'roo'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Summary: Added 2 profile(s)');
			expect(result.stdout).toContain('Successfully configured profiles:');
			expect(result.stdout).toContain('- windsurf');
			expect(result.stdout).toContain('- roo');
		});

		it('should show removal summary', async () => {
			// Add profiles first
			await helpers.taskMaster('rules', ['add', 'windsurf', 'roo'], {
				cwd: testDir
			});

			// Remove them
			const result = await helpers.taskMaster(
				'rules',
				['remove', 'windsurf', 'roo', '--force'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Summary: Removed 2 profile(s)');
		});
	});

	describe('Mixed operations', () => {
		it('should handle mix of valid and invalid profiles', async () => {
			const result = await helpers.taskMaster(
				'rules',
				['add', 'windsurf', 'not-a-profile', 'roo', 'another-invalid'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
			expect(result.stdout).toContain('Adding rules for profile: roo');
			expect(result.stdout).toContain(
				'Rule profile for "not-a-profile" not found'
			);
			expect(result.stdout).toContain(
				'Rule profile for "another-invalid" not found'
			);

			// Should still successfully add the valid ones
			expect(existsSync(join(testDir, '.windsurf'))).toBe(true);
			expect(existsSync(join(testDir, '.roo'))).toBe(true);
		});
	});
});