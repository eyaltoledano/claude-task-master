import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addShellExport,
	enableDeferredMcpLoading,
	getShellConfigPath
} from './shell-utils.js';

// Mock fs and os modules
vi.mock('fs');
vi.mock('os');

describe('shell-utils', () => {
	const mockHomeDir = '/home/testuser';

	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getShellConfigPath', () => {
		it('should return .zshrc for zsh shell', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(path.join(mockHomeDir, '.zshrc'));

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should return .bashrc for bash shell on Linux', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPlatform = process.platform;
			process.env.SHELL = '/bin/bash';
			Object.defineProperty(process, 'platform', { value: 'linux' });
			vi.mocked(fs.existsSync).mockReturnValue(false);

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(path.join(mockHomeDir, '.bashrc'));

			// Cleanup
			process.env.SHELL = originalShell;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should return .bash_profile for bash shell on macOS if it exists', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPlatform = process.platform;
			process.env.SHELL = '/bin/bash';
			Object.defineProperty(process, 'platform', { value: 'darwin' });
			vi.mocked(fs.existsSync).mockReturnValue(true);

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(path.join(mockHomeDir, '.bash_profile'));

			// Cleanup
			process.env.SHELL = originalShell;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should return .config/fish/config.fish for fish shell', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/usr/bin/fish';

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(
				path.join(mockHomeDir, '.config', 'fish', 'config.fish')
			);

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should fallback to .zshrc if it exists when shell is unknown', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/unknown';
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				String(p).includes('.zshrc')
			);

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(path.join(mockHomeDir, '.zshrc'));

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should return null if no shell config is found', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/unknown';
			vi.mocked(fs.existsSync).mockReturnValue(false);

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBeNull();

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should return PowerShell profile on Windows with PSModulePath', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPSModulePath = process.env.PSModulePath;
			const originalPlatform = process.platform;
			process.env.SHELL = '';
			process.env.PSModulePath = 'C:\\some\\path';
			Object.defineProperty(process, 'platform', { value: 'win32' });
			vi.mocked(fs.existsSync).mockReturnValue(false);

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(
				path.join(
					mockHomeDir,
					'Documents',
					'PowerShell',
					'Microsoft.PowerShell_profile.ps1'
				)
			);

			// Cleanup
			process.env.SHELL = originalShell;
			process.env.PSModulePath = originalPSModulePath;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should return Git Bash .bashrc on Windows without PSModulePath', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPSModulePath = process.env.PSModulePath;
			const originalPlatform = process.platform;
			process.env.SHELL = '';
			delete process.env.PSModulePath;
			Object.defineProperty(process, 'platform', { value: 'win32' });
			vi.mocked(fs.existsSync).mockImplementation((p) =>
				String(p).includes('.bashrc')
			);

			// Act
			const result = getShellConfigPath();

			// Assert
			expect(result).toBe(path.join(mockHomeDir, '.bashrc'));

			// Cleanup
			process.env.SHELL = originalShell;
			process.env.PSModulePath = originalPSModulePath;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});
	});

	describe('addShellExport', () => {
		it('should add export to shell config file', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			const shellConfigPath = path.join(mockHomeDir, '.zshrc');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('# existing content\n');
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = addShellExport('MY_VAR', 'my_value', 'My comment');

			// Assert
			expect(result.success).toBe(true);
			expect(result.shellConfigFile).toBe(shellConfigPath);
			expect(result.alreadyExists).toBeUndefined();
			expect(fs.appendFileSync).toHaveBeenCalledWith(
				shellConfigPath,
				'\n# My comment\nexport MY_VAR=my_value\n'
			);

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should skip if export already exists', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				'# existing\nexport MY_VAR=old_value\n'
			);

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBe(true);
			expect(fs.appendFileSync).not.toHaveBeenCalled();

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should NOT skip when variable name only appears in a comment', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			const shellConfigPath = path.join(mockHomeDir, '.zshrc');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				'# MY_VAR is mentioned here but not exported\n# Another comment about MY_VAR\n'
			);
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBeUndefined();
			expect(fs.appendFileSync).toHaveBeenCalledWith(
				shellConfigPath,
				'\nexport MY_VAR=my_value\n'
			);

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should NOT skip when variable name is a substring of another variable', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			const shellConfigPath = path.join(mockHomeDir, '.zshrc');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				'export MY_VAR_EXTENDED=some_value\nexport OTHER_MY_VAR=another\n'
			);
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBeUndefined();
			expect(fs.appendFileSync).toHaveBeenCalledWith(
				shellConfigPath,
				'\nexport MY_VAR=my_value\n'
			);

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should detect existing export with leading whitespace', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('  export MY_VAR=old_value\n');

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBe(true);
			expect(fs.appendFileSync).not.toHaveBeenCalled();

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should return failure if shell config not found', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			vi.mocked(fs.existsSync).mockReturnValue(false);

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(false);
			expect(result.message).toContain('not found');

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should return failure if shell type cannot be determined', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/unknown';
			vi.mocked(fs.existsSync).mockReturnValue(false);

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(false);
			expect(result.message).toContain('Could not determine shell type');

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should use PowerShell syntax for .ps1 files', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPSModulePath = process.env.PSModulePath;
			const originalPlatform = process.platform;
			process.env.SHELL = '';
			process.env.PSModulePath = 'C:\\some\\path';
			Object.defineProperty(process, 'platform', { value: 'win32' });
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('# existing content\n');
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = addShellExport('MY_VAR', 'my_value', 'My comment');

			// Assert
			expect(result.success).toBe(true);
			expect(fs.appendFileSync).toHaveBeenCalledWith(
				expect.stringContaining('.ps1'),
				'\n# My comment\n$env:MY_VAR = "my_value"\n'
			);

			// Cleanup
			process.env.SHELL = originalShell;
			process.env.PSModulePath = originalPSModulePath;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should NOT skip PowerShell when variable name only appears in a comment', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPSModulePath = process.env.PSModulePath;
			const originalPlatform = process.platform;
			process.env.SHELL = '';
			process.env.PSModulePath = 'C:\\some\\path';
			Object.defineProperty(process, 'platform', { value: 'win32' });
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				'# MY_VAR is mentioned here but not set\n# $env:MY_VAR in a comment\n'
			);
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBeUndefined();
			expect(fs.appendFileSync).toHaveBeenCalledWith(
				expect.stringContaining('.ps1'),
				'\n$env:MY_VAR = "my_value"\n'
			);

			// Cleanup
			process.env.SHELL = originalShell;
			process.env.PSModulePath = originalPSModulePath;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should detect existing PowerShell export', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPSModulePath = process.env.PSModulePath;
			const originalPlatform = process.platform;
			process.env.SHELL = '';
			process.env.PSModulePath = 'C:\\some\\path';
			Object.defineProperty(process, 'platform', { value: 'win32' });
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('$env:MY_VAR = "old_value"\n');

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBe(true);
			expect(fs.appendFileSync).not.toHaveBeenCalled();

			// Cleanup
			process.env.SHELL = originalShell;
			process.env.PSModulePath = originalPSModulePath;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should create PowerShell profile and directory if they do not exist', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			const originalPSModulePath = process.env.PSModulePath;
			const originalPlatform = process.platform;
			process.env.SHELL = '';
			process.env.PSModulePath = 'C:\\some\\path';
			Object.defineProperty(process, 'platform', { value: 'win32' });

			// Nothing exists initially
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.readFileSync).mockReturnValue('');
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = addShellExport('MY_VAR', 'my_value');

			// Assert
			expect(result.success).toBe(true);
			// Should create the profile directory
			expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
				recursive: true
			});
			// Should create the empty profile file
			expect(fs.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining('.ps1'),
				''
			);

			// Cleanup
			process.env.SHELL = originalShell;
			process.env.PSModulePath = originalPSModulePath;
			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});
	});

	describe('enableDeferredMcpLoading', () => {
		it('should add ENABLE_EXPERIMENTAL_MCP_CLI export', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			const shellConfigPath = path.join(mockHomeDir, '.zshrc');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('# existing content\n');
			vi.mocked(fs.appendFileSync).mockImplementation(() => {});

			// Act
			const result = enableDeferredMcpLoading();

			// Assert
			expect(result.success).toBe(true);
			expect(result.shellConfigFile).toBe(shellConfigPath);
			expect(fs.appendFileSync).toHaveBeenCalledWith(
				shellConfigPath,
				'\n# Claude Code deferred MCP loading (added by Taskmaster)\nexport ENABLE_EXPERIMENTAL_MCP_CLI=true\n'
			);

			// Cleanup
			process.env.SHELL = originalShell;
		});

		it('should skip if already configured', () => {
			// Arrange
			const originalShell = process.env.SHELL;
			process.env.SHELL = '/bin/zsh';
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				'export ENABLE_EXPERIMENTAL_MCP_CLI=true\n'
			);

			// Act
			const result = enableDeferredMcpLoading();

			// Assert
			expect(result.success).toBe(true);
			expect(result.alreadyExists).toBe(true);
			expect(fs.appendFileSync).not.toHaveBeenCalled();

			// Cleanup
			process.env.SHELL = originalShell;
		});
	});
});
