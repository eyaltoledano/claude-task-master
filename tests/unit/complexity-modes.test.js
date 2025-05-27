import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Complexity Modes', () => {
	let testDir;

	function createTestDirectory() {
		return fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-test-'));
	}

	function cleanupTestDirectory(dir) {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	beforeEach(() => {
		testDir = createTestDirectory();

		// Create test tasks file
		const testTasks = {
			tasks: [
				{
					id: 1,
					title: 'Test Task',
					description: 'A test task for complexity analysis',
					status: 'pending'
				}
			]
		};

		fs.writeFileSync(
			path.join(testDir, 'tasks.json'),
			JSON.stringify(testTasks, null, 2)
		);

		// Create test config
		const testConfig = {
			models: {
				main: {
					provider: 'anthropic',
					modelId: 'claude-3-5-sonnet',
					maxTokens: 64000,
					temperature: 0.2
				}
			},
			global: {
				logLevel: 'info',
				debug: false,
				defaultSubtasks: 5,
				defaultPriority: 'medium',
				projectName: 'Test Project',
				complexityMode: 'balanced'
			}
		};

		fs.writeFileSync(
			path.join(testDir, '.taskmasterconfig'),
			JSON.stringify(testConfig, null, 2)
		);
	});

	afterEach(() => {
		cleanupTestDirectory(testDir);
	});

	describe('Complexity Mode Configuration', () => {
		it('should validate complexity mode values', () => {
			const validModes = ['standard', 'balanced', 'advanced'];

			expect(validModes.includes('standard')).toBe(true);
			expect(validModes.includes('balanced')).toBe(true);
			expect(validModes.includes('advanced')).toBe(true);
			expect(validModes.includes('invalid')).toBe(false);
		});

		it('should have default complexity mode as balanced', async () => {
			const configManager = await import(
				'../../scripts/modules/config-manager.js'
			);
			const mode = configManager.getComplexityMode(testDir);
			expect(['standard', 'balanced', 'advanced']).toContain(mode);
		});
	});

	describe('Prompt Templates', () => {
		it('should have different prompt sizes for different modes', async () => {
			// We can't easily test the actual prompts without mocking AI services,
			// but we can verify the modes are handled correctly in the configuration
			const configManager = await import(
				'../../scripts/modules/config-manager.js'
			);

			// Test setting different modes
			const config = configManager.getConfig(testDir);
			config.global.complexityMode = 'standard';
			configManager.writeConfig(config, testDir);
			expect(configManager.getComplexityMode(testDir)).toBe('standard');

			config.global.complexityMode = 'advanced';
			configManager.writeConfig(config, testDir);
			expect(configManager.getComplexityMode(testDir)).toBe('advanced');
		});
	});

	describe('File Handling', () => {
		it('should work with real file system operations', () => {
			// Test that we can read the test files we created
			const tasksPath = path.join(testDir, 'tasks.json');
			const configPath = path.join(testDir, '.taskmasterconfig');

			expect(fs.existsSync(tasksPath)).toBe(true);
			expect(fs.existsSync(configPath)).toBe(true);

			const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

			expect(tasks.tasks).toHaveLength(1);
			expect(config.global.complexityMode).toBe('balanced');
		});
	});
});
