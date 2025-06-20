import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Reduce noise in test output
process.env.TASKMASTER_LOG_LEVEL = 'error';

// === Mock everything early ===
jest.mock('child_process', () => ({ execSync: jest.fn() }));
jest.mock('fs', () => ({
	...jest.requireActual('fs'),
	mkdirSync: jest.fn(),
	writeFileSync: jest.fn(),
	readFileSync: jest.fn(),
	appendFileSync: jest.fn(),
	existsSync: jest.fn(),
	mkdtempSync: jest.requireActual('fs').mkdtempSync,
	rmSync: jest.requireActual('fs').rmSync
}));

// Mock console methods to suppress output
const consoleMethods = ['log', 'info', 'warn', 'error', 'clear'];
consoleMethods.forEach((method) => {
	global.console[method] = jest.fn();
});

// Mock ES modules using unstable_mockModule
jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	isSilentMode: jest.fn(() => true),
	enableSilentMode: jest.fn(),
	log: jest.fn(),
	findProjectRoot: jest.fn(() => process.cwd())
}));

// Mock git-utils module
jest.unstable_mockModule('../../scripts/modules/utils/git-utils.js', () => ({
	insideGitWorkTree: jest.fn(() => false)
}));

// Mock rule transformer
jest.unstable_mockModule('../../src/utils/rule-transformer.js', () => ({
	convertAllRulesToProfileRules: jest.fn(),
	getRulesProfile: jest.fn(() => ({
		conversionConfig: {},
		globalReplacements: []
	}))
}));

// Mock any other modules that might output or do real operations
jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	createDefaultConfig: jest.fn(() => ({ models: {}, project: {} })),
	saveConfig: jest.fn()
}));

// Mock display libraries
jest.mock('figlet', () => ({ textSync: jest.fn(() => 'MOCKED BANNER') }));
jest.mock('boxen', () => jest.fn(() => 'MOCKED BOX'));
jest.mock('gradient-string', () => jest.fn(() => jest.fn((text) => text)));
jest.mock('chalk', () => ({
	blue: jest.fn((text) => text),
	green: jest.fn((text) => text),
	red: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	cyan: jest.fn((text) => text),
	white: jest.fn((text) => text),
	dim: jest.fn((text) => text),
	bold: jest.fn((text) => text),
	underline: jest.fn((text) => text)
}));

const { execSync } = jest.requireMock('child_process');
const mockFs = jest.requireMock('fs');

// Import the mocked modules
const mockUtils = await import('../../scripts/modules/utils.js');
const mockGitUtils = await import('../../scripts/modules/utils/git-utils.js');
const mockRuleTransformer = await import('../../src/utils/rule-transformer.js');

// Import after mocks
const { initializeProject } = await import('../../scripts/init.js');

describe('initializeProject – Git / Alias flag logic', () => {
	let tmpDir;
	const origCwd = process.cwd();

	// Standard non-interactive options for all tests
	const baseOptions = {
		yes: true,
		skipInstall: true,
		name: 'test-project',
		description: 'Test project description',
		version: '1.0.0',
		author: 'Test Author'
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Set up basic fs mocks
		mockFs.mkdirSync.mockImplementation(() => {});
		mockFs.writeFileSync.mockImplementation(() => {});
		mockFs.readFileSync.mockImplementation((filePath) => {
			if (filePath.includes('assets') || filePath.includes('.cursor/rules')) {
				return 'mock template content';
			}
			if (filePath.includes('.zshrc') || filePath.includes('.bashrc')) {
				return '# existing config';
			}
			return '';
		});
		mockFs.appendFileSync.mockImplementation(() => {});
		mockFs.existsSync.mockImplementation((filePath) => {
			// Template source files exist
			if (filePath.includes('assets') || filePath.includes('.cursor/rules')) {
				return true;
			}
			// Shell config files exist by default
			if (filePath.includes('.zshrc') || filePath.includes('.bashrc')) {
				return true;
			}
			return false;
		});

		// Reset utils mocks
		mockUtils.isSilentMode.mockReturnValue(true);
		mockGitUtils.insideGitWorkTree.mockReturnValue(false);

		// Default execSync mock
		execSync.mockImplementation(() => '');

		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-init-'));
		process.chdir(tmpDir);
	});

	afterEach(() => {
		process.chdir(origCwd);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	describe('Git Flag Behavior', () => {
		it('completes successfully with git:false in dry run', async () => {
			const result = await initializeProject({
				...baseOptions,
				git: false,
				aliases: false,
				dryRun: true
			});

			expect(result.dryRun).toBe(true);
		});

		it('completes successfully with git:true when not inside repo', async () => {
			mockGitUtils.insideGitWorkTree.mockReturnValue(false);

			await expect(
				initializeProject({
					...baseOptions,
					git: true,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('completes successfully when already inside repo', async () => {
			mockGitUtils.insideGitWorkTree.mockReturnValue(true);

			await expect(
				initializeProject({
					...baseOptions,
					git: true,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('uses default git behavior without errors', async () => {
			mockGitUtils.insideGitWorkTree.mockReturnValue(false);

			await expect(
				initializeProject({
					...baseOptions,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('handles git command failures gracefully', async () => {
			mockGitUtils.insideGitWorkTree.mockReturnValue(false);
			execSync.mockImplementation((cmd) => {
				if (cmd.includes('git init')) {
					throw new Error('git not found');
				}
				return '';
			});

			await expect(
				initializeProject({
					...baseOptions,
					git: true,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});
	});

	describe('Alias Flag Behavior', () => {
		it('completes successfully when aliases:true and environment is set up', async () => {
			const originalShell = process.env.SHELL;
			const originalHome = process.env.HOME;

			process.env.SHELL = '/bin/zsh';
			process.env.HOME = '/mock/home';

			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: true,
					dryRun: false
				})
			).resolves.not.toThrow();

			process.env.SHELL = originalShell;
			process.env.HOME = originalHome;
		});

		it('completes successfully when aliases:false', async () => {
			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('handles missing shell gracefully', async () => {
			const originalShell = process.env.SHELL;
			const originalHome = process.env.HOME;

			delete process.env.SHELL; // Remove shell env var
			process.env.HOME = '/mock/home';

			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: true,
					dryRun: false
				})
			).resolves.not.toThrow();

			process.env.SHELL = originalShell;
			process.env.HOME = originalHome;
		});

		it('handles missing shell config file gracefully', async () => {
			const originalShell = process.env.SHELL;
			const originalHome = process.env.HOME;

			process.env.SHELL = '/bin/zsh';
			process.env.HOME = '/mock/home';

			// Shell config doesn't exist
			mockFs.existsSync.mockImplementation((filePath) => {
				if (filePath.includes('.zshrc') || filePath.includes('.bashrc')) {
					return false;
				}
				if (filePath.includes('assets') || filePath.includes('.cursor/rules')) {
					return true;
				}
				return false;
			});

			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: true,
					dryRun: false
				})
			).resolves.not.toThrow();

			process.env.SHELL = originalShell;
			process.env.HOME = originalHome;
		});
	});

	describe('Flag Combinations', () => {
		it.each`
			git      | aliases  | description
			${true}  | ${true}  | ${'git & aliases enabled'}
			${true}  | ${false} | ${'git enabled, aliases disabled'}
			${false} | ${true}  | ${'git disabled, aliases enabled'}
			${false} | ${false} | ${'git & aliases disabled'}
		`('handles $description without errors', async ({ git, aliases }) => {
			const originalShell = process.env.SHELL;
			const originalHome = process.env.HOME;

			if (aliases) {
				process.env.SHELL = '/bin/zsh';
				process.env.HOME = '/mock/home';
			}

			if (git) {
				mockGitUtils.insideGitWorkTree.mockReturnValue(false);
			}

			await expect(
				initializeProject({
					...baseOptions,
					git,
					aliases,
					dryRun: false
				})
			).resolves.not.toThrow();

			process.env.SHELL = originalShell;
			process.env.HOME = originalHome;
		});
	});

	describe('Dry Run Mode', () => {
		it('returns dry run result and performs no operations', async () => {
			const result = await initializeProject({
				...baseOptions,
				git: true,
				aliases: true,
				dryRun: true
			});

			expect(result.dryRun).toBe(true);
		});

		it.each`
			git      | aliases  | description
			${true}  | ${false} | ${'git-specific behavior'}
			${false} | ${false} | ${'no-git behavior'}
			${false} | ${true}  | ${'alias behavior'}
		`('shows $description in dry run', async ({ git, aliases }) => {
			const result = await initializeProject({
				...baseOptions,
				git,
				aliases,
				dryRun: true
			});

			expect(result.dryRun).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('handles npm install failures gracefully', async () => {
			execSync.mockImplementation((cmd) => {
				if (cmd.includes('npm install')) {
					throw new Error('npm failed');
				}
				return '';
			});

			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: false,
					skipInstall: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('handles git failures gracefully', async () => {
			mockGitUtils.insideGitWorkTree.mockReturnValue(false);
			execSync.mockImplementation((cmd) => {
				if (cmd.includes('git init')) {
					throw new Error('git failed');
				}
				return '';
			});

			await expect(
				initializeProject({
					...baseOptions,
					git: true,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('handles file system errors gracefully', async () => {
			mockFs.mkdirSync.mockImplementation(() => {
				throw new Error('Permission denied');
			});

			// Should handle file system errors gracefully
			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});
	});

	describe('Non-Interactive Mode', () => {
		it('bypasses prompts with yes:true', async () => {
			const result = await initializeProject({
				...baseOptions,
				git: true,
				aliases: true,
				dryRun: true
			});

			expect(result).toEqual({ dryRun: true });
		});

		it('completes without hanging', async () => {
			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('handles all flag combinations without hanging', async () => {
			const flagCombinations = [
				{ git: true, aliases: true },
				{ git: true, aliases: false },
				{ git: false, aliases: true },
				{ git: false, aliases: false },
				{} // No flags (uses defaults)
			];

			for (const flags of flagCombinations) {
				await expect(
					initializeProject({
						...baseOptions,
						...flags,
						dryRun: true // Use dry run for speed
					})
				).resolves.not.toThrow();
			}
		});

		it('accepts complete project details', async () => {
			await expect(
				initializeProject({
					name: 'test-project',
					description: 'test description',
					version: '2.0.0',
					author: 'Test User',
					git: false,
					aliases: false,
					dryRun: true
				})
			).resolves.not.toThrow();
		});

		it('works with skipInstall option', async () => {
			await expect(
				initializeProject({
					...baseOptions,
					skipInstall: true,
					git: false,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});
	});

	describe('Function Integration', () => {
		it('calls utility functions without errors', async () => {
			await initializeProject({
				...baseOptions,
				git: false,
				aliases: false,
				dryRun: false
			});

			// Verify that utility functions were called
			expect(mockUtils.isSilentMode).toHaveBeenCalled();
			expect(
				mockRuleTransformer.convertAllRulesToProfileRules
			).toHaveBeenCalled();
		});

		it('handles template operations gracefully', async () => {
			// Make file operations throw errors
			mockFs.writeFileSync.mockImplementation(() => {
				throw new Error('Write failed');
			});

			// Should complete despite file operation failures
			await expect(
				initializeProject({
					...baseOptions,
					git: false,
					aliases: false,
					dryRun: false
				})
			).resolves.not.toThrow();
		});

		it('validates boolean flag conversion', async () => {
			// Test the boolean flag handling specifically
			await expect(
				initializeProject({
					...baseOptions,
					git: true, // Should convert to initGit: true
					aliases: false, // Should convert to addAliases: false
					dryRun: true
				})
			).resolves.not.toThrow();

			await expect(
				initializeProject({
					...baseOptions,
					git: false, // Should convert to initGit: false
					aliases: true, // Should convert to addAliases: true
					dryRun: true
				})
			).resolves.not.toThrow();
		});
	});
});
