import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Config Manager - Complexity Mode', () => {
	let testDir;
	let testDir2;
	let getComplexityMode;
	let getConfig;
	let writeConfig;

	function createTestDirectory() {
		return fs.mkdtempSync(path.join(os.tmpdir(), 'config-complexity-test-'));
	}

	function cleanupTestDirectory(dir) {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	beforeEach(async () => {
		// Create test directories
		testDir = createTestDirectory();
		testDir2 = createTestDirectory();

		// Create test config files
		const config1 = {
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
				complexityMode: 'advanced'
			}
		};

		const config2 = {
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
				projectName: 'Test Project 2'
				// Note: complexityMode not specified, should default to 'balanced'
			}
		};

		fs.writeFileSync(
			path.join(testDir, '.taskmasterconfig'),
			JSON.stringify(config1, null, 2)
		);
		fs.writeFileSync(
			path.join(testDir2, '.taskmasterconfig'),
			JSON.stringify(config2, null, 2)
		);

		// Import config manager
		const configManager = await import(
			'../../scripts/modules/config-manager.js'
		);
		getComplexityMode = configManager.getComplexityMode;
		getConfig = configManager.getConfig;
		writeConfig = configManager.writeConfig;
	});

	afterEach(() => {
		// Clean up test directories
		cleanupTestDirectory(testDir);
		cleanupTestDirectory(testDir2);
	});

	describe('getComplexityMode', () => {
		it('should return configured complexity mode', () => {
			const mode = getComplexityMode(testDir);
			expect(mode).toBe('advanced');
		});

		it('should return default "balanced" when not configured', () => {
			const mode = getComplexityMode(testDir2);
			expect(mode).toBe('balanced');
		});

		it('should return "balanced" for invalid mode values', () => {
			// Create test directory with invalid mode
			const invalidDir = createTestDirectory();
			const invalidConfig = {
				models: {
					main: {
						provider: 'anthropic',
						modelId: 'claude-3-5-sonnet',
						maxTokens: 64000,
						temperature: 0.2
					}
				},
				global: {
					complexityMode: 'invalid-mode'
				}
			};

			fs.writeFileSync(
				path.join(invalidDir, '.taskmasterconfig'),
				JSON.stringify(invalidConfig, null, 2)
			);

			const mode = getComplexityMode(invalidDir);
			expect(mode).toBe('balanced');

			// Cleanup
			cleanupTestDirectory(invalidDir);
		});

		it('should validate all three complexity modes', () => {
			const testCases = [
				{ mode: 'standard', expected: 'standard' },
				{ mode: 'balanced', expected: 'balanced' },
				{ mode: 'advanced', expected: 'advanced' }
			];

			testCases.forEach(({ mode, expected }) => {
				const modeDir = createTestDirectory();
				const config = {
					models: {
						main: {
							provider: 'anthropic',
							modelId: 'claude-3-5-sonnet',
							maxTokens: 64000,
							temperature: 0.2
						}
					},
					global: {
						complexityMode: mode
					}
				};

				fs.writeFileSync(
					path.join(modeDir, '.taskmasterconfig'),
					JSON.stringify(config, null, 2)
				);

				const result = getComplexityMode(modeDir);
				expect(result).toBe(expected);

				// Cleanup
				cleanupTestDirectory(modeDir);
			});
		});
	});

	describe('Configuration persistence', () => {
		it('should save complexity mode when updating config', () => {
			const config = getConfig(testDir);
			config.global.complexityMode = 'standard';

			const result = writeConfig(config, testDir);
			expect(result).toBe(true);

			// Verify it was saved
			const mode = getComplexityMode(testDir);
			expect(mode).toBe('standard');
		});

		it('should preserve complexity mode through config updates', () => {
			const config = getConfig(testDir);
			expect(config.global.complexityMode).toBe('advanced');

			// Update other settings
			config.global.logLevel = 'debug';
			writeConfig(config, testDir);

			// Verify complexity mode is preserved
			const newConfig = getConfig(testDir);

			expect(newConfig.global.logLevel).toBe('debug');
			expect(newConfig.global.complexityMode).toBe('advanced');
		});
	});

	describe('Default values', () => {
		it('should include complexityMode in DEFAULTS', () => {
			// Create empty directory without config
			const emptyDir = createTestDirectory();

			const config = getConfig(emptyDir);
			expect(config.global.complexityMode).toBe('balanced');

			// Cleanup
			cleanupTestDirectory(emptyDir);
		});
	});
});
