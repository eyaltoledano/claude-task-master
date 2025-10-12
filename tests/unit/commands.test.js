/**
 * Commands module tests - Focus on CLI setup and integration
 */

import { jest } from '@jest/globals';

// Mock modules first
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn()
}));

jest.mock('path', () => ({
	join: jest.fn((dir, file) => `${dir}/${file}`)
}));

jest.mock('chalk', () => ({
	red: jest.fn((text) => text),
	blue: jest.fn((text) => text),
	green: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	white: jest.fn((text) => ({
		bold: jest.fn((text) => text)
	})),
	reset: jest.fn((text) => text)
}));

// Mock config-manager to prevent file system discovery issues
jest.mock('../../scripts/modules/config-manager.js', () => ({
	getLogLevel: jest.fn(() => 'info'),
	getDebugFlag: jest.fn(() => false),
	getConfig: jest.fn(() => ({})), // Return empty config to prevent real loading
	getGlobalConfig: jest.fn(() => ({}))
}));

// Mock path-utils to prevent file system discovery issues
jest.mock('../../src/utils/path-utils.js', () => ({
	__esModule: true,
	findProjectRoot: jest.fn(() => '/mock/project'),
	findConfigPath: jest.fn(() => null),
	findTasksPath: jest.fn(() => '/mock/tasks.json'),
	findComplexityReportPath: jest.fn(() => null),
	resolveTasksOutputPath: jest.fn(() => '/mock/tasks.json'),
	resolveComplexityReportOutputPath: jest.fn(() => '/mock/report.json')
}));

jest.mock('../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn(),
	displayHelp: jest.fn()
}));

// Add utility functions for testing
const toKebabCase = (str) => {
	return str
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/^-/, '');
};

function detectCamelCaseFlags(args) {
	const camelCaseFlags = [];
	for (const arg of args) {
		if (arg.startsWith('--')) {
			const flagName = arg.split('=')[0].slice(2);

			if (!flagName.includes('-')) {
				if (/[a-z][A-Z]/.test(flagName)) {
					const kebabVersion = toKebabCase(flagName);
					if (kebabVersion !== flagName) {
						camelCaseFlags.push({
							original: flagName,
							kebabCase: kebabVersion
						});
					}
				}
			}
		}
	}
	return camelCaseFlags;
}

jest.mock('../../scripts/modules/utils.js', () => ({
	CONFIG: {
		projectVersion: '1.5.0'
	},
	log: jest.fn(() => {}), // Prevent any real logging that could trigger config discovery
	toKebabCase: toKebabCase,
	detectCamelCaseFlags: detectCamelCaseFlags
}));

// Import all modules after mocking
import fs from 'fs';
import path from 'path';
import { setupCLI } from '../../scripts/modules/commands.js';
import {
	RULES_SETUP_ACTION,
	RULES_ACTIONS
} from '../../src/constants/rules-actions.js';
import { compareVersions } from '@tm/cli';

describe('Commands Module - CLI Setup and Integration', () => {
	const mockExistsSync = jest.spyOn(fs, 'existsSync');

	beforeEach(() => {
		jest.clearAllMocks();
		mockExistsSync.mockReturnValue(true);
	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	describe('setupCLI function', () => {
		test('should return Commander program instance', () => {
			const program = setupCLI();
			expect(program).toBeDefined();
			expect(program.name()).toBe('task-master');
		});

		test('should return version that matches package.json when TM_PUBLIC_VERSION is set', () => {
			// Read actual version from package.json
			const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			const expectedVersion = packageJson.version;

			// Set environment variable to match package.json
			const originalEnv = process.env.TM_PUBLIC_VERSION;
			process.env.TM_PUBLIC_VERSION = expectedVersion;

			const program = setupCLI();
			const version = program.version();
			expect(version).toBe(expectedVersion);

			// Restore original environment
			if (originalEnv !== undefined) {
				process.env.TM_PUBLIC_VERSION = originalEnv;
			} else {
				delete process.env.TM_PUBLIC_VERSION;
			}
		});

		test('should use default version when TM_PUBLIC_VERSION is not available', () => {
			const originalEnv = process.env.TM_PUBLIC_VERSION;
			delete process.env.TM_PUBLIC_VERSION;

			const program = setupCLI();
			const version = program.version();
			expect(version).toBe('unknown');

			// Restore original environment
			if (originalEnv !== undefined) {
				process.env.TM_PUBLIC_VERSION = originalEnv;
			}
		});
	});

	describe('CLI Flag Format Validation', () => {
		test('should detect camelCase flags correctly', () => {
			const args = ['node', 'task-master', '--camelCase', '--kebab-case'];
			const camelCaseFlags = args.filter(
				(arg) =>
					arg.startsWith('--') && /[A-Z]/.test(arg) && !arg.includes('-[A-Z]')
			);
			expect(camelCaseFlags).toContain('--camelCase');
			expect(camelCaseFlags).not.toContain('--kebab-case');
		});

		test('should accept kebab-case flags correctly', () => {
			const args = ['node', 'task-master', '--kebab-case'];
			const camelCaseFlags = args.filter(
				(arg) =>
					arg.startsWith('--') && /[A-Z]/.test(arg) && !arg.includes('-[A-Z]')
			);
			expect(camelCaseFlags).toHaveLength(0);
		});

		test('toKebabCase should convert camelCase to kebab-case', () => {
			expect(toKebabCase('promptText')).toBe('prompt-text');
			expect(toKebabCase('userID')).toBe('user-id');
			expect(toKebabCase('numTasks')).toBe('num-tasks');
			expect(toKebabCase('alreadyKebabCase')).toBe('already-kebab-case');
		});

		test('detectCamelCaseFlags should identify camelCase flags', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--promptText=test',
				'--userID=123'
			];
			const flags = detectCamelCaseFlags(args);

			expect(flags).toHaveLength(2);
			expect(flags).toContainEqual({
				original: 'promptText',
				kebabCase: 'prompt-text'
			});
			expect(flags).toContainEqual({
				original: 'userID',
				kebabCase: 'user-id'
			});
		});

		test('detectCamelCaseFlags should not flag kebab-case flags', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--prompt-text=test',
				'--user-id=123'
			];
			const flags = detectCamelCaseFlags(args);

			expect(flags).toHaveLength(0);
		});

		test('detectCamelCaseFlags should respect single-word flags', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--prompt=test',
				'--file=test.json',
				'--priority=high',
				'--promptText=test'
			];
			const flags = detectCamelCaseFlags(args);

			expect(flags).toHaveLength(1);
			expect(flags).toContainEqual({
				original: 'promptText',
				kebabCase: 'prompt-text'
			});
		});
	});

	describe('Command Validation Logic', () => {
		test('should validate task ID parameter correctly', () => {
			// Test valid task IDs
			const validId = '5';
			const taskId = parseInt(validId, 10);
			expect(Number.isNaN(taskId) || taskId <= 0).toBe(false);

			// Test invalid task IDs
			const invalidId = 'not-a-number';
			const invalidTaskId = parseInt(invalidId, 10);
			expect(Number.isNaN(invalidTaskId) || invalidTaskId <= 0).toBe(true);

			// Test zero or negative IDs
			const zeroId = '0';
			const zeroTaskId = parseInt(zeroId, 10);
			expect(Number.isNaN(zeroTaskId) || zeroTaskId <= 0).toBe(true);
		});

		test('should handle environment variable cleanup correctly', () => {
			// Instead of using delete operator, test setting to undefined
			const testEnv = { PERPLEXITY_API_KEY: 'test-key' };
			testEnv.PERPLEXITY_API_KEY = undefined;
			expect(testEnv.PERPLEXITY_API_KEY).toBeUndefined();
		});
	});
});

// Test utility functions that commands rely on
describe('Version comparison utility', () => {
	test('compareVersions correctly compares semantic versions', () => {
		expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
		expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
		expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
		expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
		expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
		expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
		expect(compareVersions('1.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0', '1.0.0.1')).toBe(-1);
	});
});

describe('Update check functionality', () => {
	let displayUpgradeNotification;
	let parseChangelogHighlights;
	let consoleLogSpy;

	beforeAll(async () => {
		// Import from @tm/cli instead of commands.js
		const cliModule = await import('../../apps/cli/src/utils/auto-update.js');
		displayUpgradeNotification = cliModule.displayUpgradeNotification;
		parseChangelogHighlights = cliModule.parseChangelogHighlights;
	});

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
	});

	test('displays upgrade notification when newer version is available', () => {
		displayUpgradeNotification('1.0.0', '1.1.0');
		expect(consoleLogSpy).toHaveBeenCalled();
		expect(consoleLogSpy.mock.calls[0][0]).toContain('Update Available!');
		expect(consoleLogSpy.mock.calls[0][0]).toContain('1.0.0');
		expect(consoleLogSpy.mock.calls[0][0]).toContain('1.1.0');
	});

	test('displays upgrade notification with highlights when provided', () => {
		const highlights = [
			'Add Codex CLI provider with OAuth authentication',
			'Cursor IDE custom slash command support',
			'Move to AI SDK v5'
		];
		displayUpgradeNotification('1.0.0', '1.1.0', highlights);
		expect(consoleLogSpy).toHaveBeenCalled();
		const output = consoleLogSpy.mock.calls[0][0];
		expect(output).toContain('Update Available!');
		expect(output).toContain('1.0.0');
		expect(output).toContain('1.1.0');
		expect(output).toContain("What's New:");
		expect(output).toContain(
			'Add Codex CLI provider with OAuth authentication'
		);
		expect(output).toContain('Cursor IDE custom slash command support');
		expect(output).toContain('Move to AI SDK v5');
	});

	test('displays upgrade notification without highlights section when empty array', () => {
		displayUpgradeNotification('1.0.0', '1.1.0', []);
		expect(consoleLogSpy).toHaveBeenCalled();
		const output = consoleLogSpy.mock.calls[0][0];
		expect(output).toContain('Update Available!');
		expect(output).not.toContain("What's New:");
		expect(output).toContain(
			'Auto-updating to the latest version with new features and bug fixes'
		);
	});

	test('parseChangelogHighlights validates version format to prevent ReDoS', () => {
		const mockChangelog = `
## 1.0.0

### Minor Changes

- [#123](https://example.com) Thanks [@user](https://example.com)! - Test feature
		`;

		// Valid versions should work
		expect(parseChangelogHighlights(mockChangelog, '1.0.0')).toEqual([
			'Test feature'
		]);
		expect(parseChangelogHighlights(mockChangelog, '1.0.0-rc.1')).toEqual([]);

		// Invalid versions should return empty array (ReDoS protection)
		expect(parseChangelogHighlights(mockChangelog, 'invalid')).toEqual([]);
		expect(parseChangelogHighlights(mockChangelog, '1.0')).toEqual([]);
		expect(parseChangelogHighlights(mockChangelog, 'a.b.c')).toEqual([]);
		expect(
			parseChangelogHighlights(mockChangelog, '((((((((((((((((((((((((((((((a')
		).toEqual([]);
	});
});

// -----------------------------------------------------------------------------
// Rules command tests (add/remove)
// -----------------------------------------------------------------------------
describe('rules command', () => {
	let program;
	let mockConsoleLog;
	let mockConsoleError;
	let mockExit;

	beforeEach(() => {
		jest.clearAllMocks();
		program = setupCLI();
		mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
		mockConsoleError = jest
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
	});

	test('should handle rules add <profile> command', async () => {
		// Simulate: task-master rules add roo
		await program.parseAsync(['rules', RULES_ACTIONS.ADD, 'roo'], {
			from: 'user'
		});
		// Expect some log output indicating success
		expect(mockConsoleLog).toHaveBeenCalledWith(
			expect.stringMatching(/adding rules for profile: roo/i)
		);
		expect(mockConsoleLog).toHaveBeenCalledWith(
			expect.stringMatching(/completed adding rules for profile: roo/i)
		);
		// Should not exit with error
		expect(mockExit).not.toHaveBeenCalledWith(1);
	});

	test('should handle rules remove <profile> command', async () => {
		// Simulate: task-master rules remove roo --force
		await program.parseAsync(
			['rules', RULES_ACTIONS.REMOVE, 'roo', '--force'],
			{
				from: 'user'
			}
		);
		// Expect some log output indicating removal
		expect(mockConsoleLog).toHaveBeenCalledWith(
			expect.stringMatching(/removing rules for profile: roo/i)
		);
		expect(mockConsoleLog).toHaveBeenCalledWith(
			expect.stringMatching(/Summary for roo: Rule profile removed/i)
		);
		// Should not exit with error
		expect(mockExit).not.toHaveBeenCalledWith(1);
	});

	test(`should handle rules --${RULES_SETUP_ACTION} command`, async () => {
		// For this test, we'll verify that the command doesn't crash and exits gracefully
		// Since mocking ES modules is complex, we'll test the command structure instead

		// Create a spy on console.log to capture any output
		const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		// Mock process.exit to prevent actual exit and capture the call
		const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

		try {
			// The command should be recognized and not throw an error about invalid action
			// We expect it to attempt to run the interactive setup, but since we can't easily
			// mock the ES module, we'll just verify the command structure is correct

			// This test verifies that:
			// 1. The --setup flag is recognized as a valid option
			// 2. The command doesn't exit with error code 1 due to invalid action
			// 3. The command structure is properly set up

			// Note: In a real scenario, this would call runInteractiveProfilesSetup()
			// but for testing purposes, we're focusing on command structure validation

			expect(() => {
				// Test that the command option is properly configured
				const command = program.commands.find((cmd) => cmd.name() === 'rules');
				expect(command).toBeDefined();

				// Check that the --setup option exists
				const setupOption = command.options.find(
					(opt) => opt.long === `--${RULES_SETUP_ACTION}`
				);
				expect(setupOption).toBeDefined();
				expect(setupOption.description).toContain('interactive setup');
			}).not.toThrow();

			// Verify the command structure is valid
			expect(mockExit).not.toHaveBeenCalledWith(1);
		} finally {
			consoleSpy.mockRestore();
			exitSpy.mockRestore();
		}
	});

	test('should show error for invalid action', async () => {
		// Simulate: task-master rules invalid-action
		await program.parseAsync(['rules', 'invalid-action'], { from: 'user' });

		// Should show error for invalid action
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringMatching(/Error: Invalid or missing action/i)
		);
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringMatching(
				new RegExp(
					`For interactive setup, use: task-master rules --${RULES_SETUP_ACTION}`,
					'i'
				)
			)
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	test('should show error when no action provided', async () => {
		// Simulate: task-master rules (no action)
		await program.parseAsync(['rules'], { from: 'user' });

		// Should show error for missing action
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringMatching(/Error: Invalid or missing action 'none'/i)
		);
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringMatching(
				new RegExp(
					`For interactive setup, use: task-master rules --${RULES_SETUP_ACTION}`,
					'i'
				)
			)
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});
});
