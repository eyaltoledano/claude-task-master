/**
 * @fileoverview Shell configuration utilities for tm-profiles
 * Provides functions to modify shell configuration files (bashrc, zshrc, etc.)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ShellConfigResult {
	success: boolean;
	shellConfigFile?: string;
	message: string;
	alreadyExists?: boolean;
}

/**
 * Detects the user's shell configuration file path
 * Supports: zsh, bash, fish, PowerShell (Windows)
 * @returns The path to the shell config file, or null if not detected
 */
export function getShellConfigPath(): string | null {
	const homeDir = os.homedir();
	const shell = process.env.SHELL || '';

	// Unix-like shells (Linux, macOS, WSL, Git Bash)
	if (shell.includes('zsh')) {
		return path.join(homeDir, '.zshrc');
	}

	if (shell.includes('bash')) {
		// macOS uses .bash_profile for login shells
		const bashProfile = path.join(homeDir, '.bash_profile');
		if (process.platform === 'darwin' && fs.existsSync(bashProfile)) {
			return bashProfile;
		}
		return path.join(homeDir, '.bashrc');
	}

	if (shell.includes('fish')) {
		return path.join(homeDir, '.config', 'fish', 'config.fish');
	}

	// Windows PowerShell - check $PROFILE env var or use default location
	if (process.platform === 'win32') {
		// PowerShell sets PSModulePath when running
		if (process.env.PSModulePath) {
			// Use $PROFILE if set, otherwise use default PowerShell profile path
			const psProfile =
				process.env.PROFILE ||
				path.join(
					homeDir,
					'Documents',
					'WindowsPowerShell',
					'Microsoft.PowerShell_profile.ps1'
				);
			// Also check PowerShell Core location
			const pwshProfile = path.join(
				homeDir,
				'Documents',
				'PowerShell',
				'Microsoft.PowerShell_profile.ps1'
			);

			if (fs.existsSync(pwshProfile)) return pwshProfile;
			if (fs.existsSync(psProfile)) return psProfile;

			// Return PowerShell Core path as default (more modern)
			return pwshProfile;
		}

		// Git Bash on Windows - check for .bashrc
		const bashrc = path.join(homeDir, '.bashrc');
		if (fs.existsSync(bashrc)) return bashrc;
	}

	// Fallback - check what exists (covers WSL and other edge cases)
	const zshrc = path.join(homeDir, '.zshrc');
	if (fs.existsSync(zshrc)) return zshrc;

	const bashrc = path.join(homeDir, '.bashrc');
	if (fs.existsSync(bashrc)) return bashrc;

	return null;
}

/**
 * Checks if a shell config file is a PowerShell profile
 */
function isPowerShellProfile(filePath: string): boolean {
	return filePath.endsWith('.ps1');
}

/**
 * Adds an export statement to the user's shell configuration file
 * Handles both Unix-style shells (bash, zsh, fish) and PowerShell
 * @param envVar - The environment variable name
 * @param value - The value to set
 * @param comment - Optional comment to add above the export
 * @returns Result object with success status and details
 */
export function addShellExport(
	envVar: string,
	value: string,
	comment?: string
): ShellConfigResult {
	const shellConfigFile = getShellConfigPath();

	if (!shellConfigFile) {
		return {
			success: false,
			message: 'Could not determine shell type (zsh, bash, fish, or PowerShell)'
		};
	}

	try {
		// For PowerShell, create the profile directory if it doesn't exist
		const profileDir = path.dirname(shellConfigFile);
		if (isPowerShellProfile(shellConfigFile) && !fs.existsSync(profileDir)) {
			fs.mkdirSync(profileDir, { recursive: true });
		}

		// Check if file exists, create empty if it doesn't (common for PowerShell)
		if (!fs.existsSync(shellConfigFile)) {
			if (isPowerShellProfile(shellConfigFile)) {
				// Create empty PowerShell profile
				fs.writeFileSync(shellConfigFile, '');
			} else {
				return {
					success: false,
					shellConfigFile,
					message: `Shell config file ${shellConfigFile} not found`
				};
			}
		}

		const content = fs.readFileSync(shellConfigFile, 'utf8');

		// Check if the export already exists using precise regex patterns
		// This avoids false positives from comments or partial matches
		const alreadyExists = isPowerShellProfile(shellConfigFile)
			? new RegExp(`^\\s*\\$env:${envVar}\\s*=`, 'm').test(content)
			: new RegExp(`^\\s*export\\s+${envVar}\\s*=`, 'm').test(content);

		if (alreadyExists) {
			return {
				success: true,
				shellConfigFile,
				message: `${envVar} already configured`,
				alreadyExists: true
			};
		}

		// Build the export block based on shell type
		let exportLine: string;
		let commentPrefix: string;

		if (isPowerShellProfile(shellConfigFile)) {
			// PowerShell syntax
			exportLine = `$env:${envVar} = "${value}"`;
			commentPrefix = '#';
		} else {
			// Unix shell syntax (bash, zsh, fish)
			exportLine = `export ${envVar}=${value}`;
			commentPrefix = '#';
		}

		const commentLine = comment ? `${commentPrefix} ${comment}\n` : '';
		const block = `\n${commentLine}${exportLine}\n`;

		fs.appendFileSync(shellConfigFile, block);

		return {
			success: true,
			shellConfigFile,
			message: `Added ${envVar} to ${shellConfigFile}`
		};
	} catch (error) {
		return {
			success: false,
			shellConfigFile,
			message: `Failed to modify shell config: ${(error as Error).message}`
		};
	}
}

/**
 * Enables Claude Code deferred MCP loading by adding the required env var
 * @returns Result object with success status and details
 */
export function enableDeferredMcpLoading(): ShellConfigResult {
	return addShellExport(
		'ENABLE_EXPERIMENTAL_MCP_CLI',
		'true',
		'Claude Code deferred MCP loading (added by Taskmaster)'
	);
}
