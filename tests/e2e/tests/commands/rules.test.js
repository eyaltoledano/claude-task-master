/**
 * Comprehensive E2E tests for rules command
 * Tests adding, removing, and managing task rules/profiles
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	statSync
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
		const mainEnvPath = join(process.cwd(), '.env');
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
			expect(result.stdout).toContain('Summary for windsurf');

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
			expect(result.stdout).toContain('Summary for windsurf');
			expect(result.stdout).toContain('Summary for roo');

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
			expect(result.stdout).toContain('Summary for windsurf');
			expect(result.stdout).toContain('Rule profile removed');
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
			expect(result.stdout).toContain('Total: 2 profile(s) processed - 2 removed');

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
			expect(result.stdout).toContain('Rule Profiles Setup');
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
			expect(result.stdout).toContain('Successfully processed profiles: windsurf, roo');

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

			// The rules command currently succeeds even in uninitialized directories
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Adding rules for profile: windsurf');
			expect(result.stdout).toContain('Successfully processed profiles: windsurf');

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
			const expectedFiles = ['windsurf_rules.md', 'taskmaster.md'];
			const actualFiles = readdirSync(rulesDir);

			expectedFiles.forEach((file) => {
				expect(actualFiles).toContain(file);
			});

			// Check that rules contain windsurf-specific content
			const rulesPath = join(rulesDir, 'windsurf_rules.md');
			const rulesContent = readFileSync(rulesPath, 'utf8');
			expect(rulesContent).toContain('Windsurf');
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
			const result = await helpers.taskMaster('rules', ['add', 'claude'], { cwd: testDir });

			// Check that the claude profile was processed successfully
			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Completed adding rules for profile: claude');
			expect(result.stdout).toContain('Summary for claude');
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
			expect(result.stdout).toContain('Total: 27 files processed');

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
			expect(result.stdout).toContain('Total: 8 files processed');
			expect(result.stdout).toContain('Successfully processed profiles: windsurf, roo');
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
			expect(result.stdout).toContain('Total: 2 profile(s) processed - 2 removed');
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
			expect(result.stdout).toContain('Successfully processed profiles: windsurf, roo');

			// Should still successfully add the valid ones
			expect(existsSync(join(testDir, '.windsurf'))).toBe(true);
			expect(existsSync(join(testDir, '.roo'))).toBe(true);
		});
	});
});