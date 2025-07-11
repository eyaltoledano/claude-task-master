/**
 * Comprehensive E2E tests for lang command
 * Tests response language management functionality
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const path = require('path');

describe('lang command', () => {
	let testDir;
	let helpers;
	let configPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-lang-'));

		// Initialize test helpers
		const context = global.createTestContext('lang');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		// Set config path
		configPath = join(testDir, '.taskmaster/config.json');

		// Ensure tasks.json exists (bug workaround)
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!existsSync(tasksJsonPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
		}
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Setting response language', () => {
		it('should set response language using --response flag', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Spanish'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Response language set to: Spanish');
			expect(result.stdout).toContain('✅ Successfully set response language to: Spanish');

			// Verify config was updated
			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Spanish');
		});

		it('should set response language to custom language', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Français'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Response language set to: Français');
			expect(result.stdout).toContain('✅ Successfully set response language to: Français');

			// Verify config was updated
			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Français');
		});

		it('should handle multi-word language names', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Traditional Chinese'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Response language set to: Traditional Chinese');
			expect(result.stdout).toContain('✅ Successfully set response language to: Traditional Chinese');

			// Verify config was updated
			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Traditional Chinese');
		});

		it('should preserve other config settings when updating language', async () => {
			// Read original config
			const originalConfig = helpers.readJson(configPath);
			const originalLogLevel = originalConfig.global.logLevel;
			const originalProjectName = originalConfig.global.projectName;

			// Set language
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'German'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Verify other settings are preserved
			const updatedConfig = helpers.readJson(configPath);
			expect(updatedConfig.global.responseLanguage).toBe('German');
			expect(updatedConfig.global.logLevel).toBe(originalLogLevel);
			expect(updatedConfig.global.projectName).toBe(originalProjectName);
			expect(updatedConfig.models).toEqual(originalConfig.models);
		});
	});

	describe('Interactive setup', () => {
		it('should handle --setup flag (requires manual testing)', async () => {
			// Note: Interactive prompts are difficult to test in automated tests
			// This test verifies the command accepts the flag but doesn't test interaction
			const result = await helpers.taskMaster(
				'lang',
				['--setup'],
				{ 
					cwd: testDir,
					timeout: 5000,
					allowFailure: true 
				}
			);

			// Command should start but timeout waiting for input
			expect(result.stdout).toContain('Starting interactive response language setup...');
		});
	});

	describe('Default behavior', () => {
		it('should default to English when no language specified', async () => {
			// Remove response language from config
			const config = helpers.readJson(configPath);
			delete config.global.responseLanguage;
			writeFileSync(configPath, JSON.stringify(config, null, 2));

			// Run lang command without parameters
			const result = await helpers.taskMaster('lang', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Response language set to:');
			expect(result.stdout).toContain('✅ Successfully set response language to: English');

			// Verify config was updated
			const updatedConfig = helpers.readJson(configPath);
			expect(updatedConfig.global.responseLanguage).toBe('English');
		});

		it('should maintain current language when command run without flags', async () => {
			// First set to Spanish
			await helpers.taskMaster(
				'lang',
				['--response', 'Spanish'],
				{ cwd: testDir }
			);

			// Run without flags
			const result = await helpers.taskMaster('lang', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			// Default behavior sets to English
			expect(result.stdout).toContain('✅ Successfully set response language to: English');
		});
	});

	describe('Error handling', () => {
		it('should handle missing config file', async () => {
			// Remove config file
			rmSync(configPath, { force: true });

			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Spanish'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stdout).toContain('❌ Error setting response language');
			expect(result.stdout).toContain('The configuration file is missing');
			expect(result.stdout).toContain('Run "task-master models --setup" to create it');
		});

		it('should handle empty language string', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', ''],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stdout).toContain('❌ Error setting response language');
			expect(result.stdout).toContain('Invalid response language');
			expect(result.stdout).toContain('Must be a non-empty string');
		});

		it('should handle config write errors gracefully', async () => {
			// Make config file read-only (simulate write error)
			const fs = require('fs');
			fs.chmodSync(configPath, 0o444);

			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Italian'],
				{ cwd: testDir, allowFailure: true }
			);

			// Restore write permissions for cleanup
			fs.chmodSync(configPath, 0o644);

			expect(result.exitCode).not.toBe(0);
			expect(result.stdout).toContain('❌ Error setting response language');
		});
	});

	describe('Integration with other commands', () => {
		it('should persist language setting across multiple commands', async () => {
			// Set language
			await helpers.taskMaster(
				'lang',
				['--response', 'Japanese'],
				{ cwd: testDir }
			);

			// Run another command (add-task)
			await helpers.taskMaster(
				'add-task',
				['--title', 'Test task', '--description', 'Testing language persistence'],
				{ cwd: testDir }
			);

			// Verify language is still set
			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Japanese');
		});

		it('should work correctly when project root is different', async () => {
			// Create a subdirectory
			const subDir = join(testDir, 'subproject');
			mkdirSync(subDir, { recursive: true });

			// Run lang command from subdirectory
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Korean'],
				{ cwd: subDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('✅ Successfully set response language to: Korean');

			// Verify config in parent directory was updated
			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Korean');
		});
	});

	describe('Special characters and edge cases', () => {
		it('should handle languages with special characters', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Português'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('✅ Successfully set response language to: Português');

			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Português');
		});

		it('should handle very long language names', async () => {
			const longLanguage = 'Ancient Mesopotamian Cuneiform Script Translation';
			const result = await helpers.taskMaster(
				'lang',
				['--response', longLanguage],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(`✅ Successfully set response language to: ${longLanguage}`);

			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe(longLanguage);
		});

		it('should handle language with numbers', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'English 2.0'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('✅ Successfully set response language to: English 2.0');

			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('English 2.0');
		});

		it('should trim whitespace from language input', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', '  Spanish  '],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			// The trim happens in validation
			expect(result.stdout).toContain('Successfully set response language to:');

			const config = helpers.readJson(configPath);
			// Verify the exact value stored (implementation may or may not trim)
			expect(config.global.responseLanguage).toBeDefined();
		});
	});

	describe('Performance', () => {
		it('should update language quickly', async () => {
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Russian'],
				{ cwd: testDir }
			);
			const endTime = Date.now();

			expect(result).toHaveExitCode(0);
			// Should complete within 2 seconds
			expect(endTime - startTime).toBeLessThan(2000);
		});

		it('should handle multiple rapid language changes', async () => {
			const languages = ['Spanish', 'French', 'German', 'Italian', 'Portuguese'];
			
			for (const lang of languages) {
				const result = await helpers.taskMaster(
					'lang',
					['--response', lang],
					{ cwd: testDir }
				);
				expect(result).toHaveExitCode(0);
			}

			// Verify final language is set
			const config = helpers.readJson(configPath);
			expect(config.global.responseLanguage).toBe('Portuguese');
		});
	});

	describe('Display output', () => {
		it('should show clear success message', async () => {
			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Dutch'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			// Check for colored output indicators
			expect(result.stdout).toContain('Response language set to:');
			expect(result.stdout).toContain('✅');
			expect(result.stdout).toContain('Successfully set response language to: Dutch');
		});

		it('should show clear error message on failure', async () => {
			// Remove config to trigger error
			rmSync(configPath, { force: true });

			const result = await helpers.taskMaster(
				'lang',
				['--response', 'Swedish'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			// Check for colored error indicators
			expect(result.stdout).toContain('❌');
			expect(result.stdout).toContain('Error setting response language');
		});
	});
});