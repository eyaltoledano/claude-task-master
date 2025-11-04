/**
 * Package Manager Detection Utilities
 * 
 * Provides utilities to detect which package manager is being used
 * and return appropriate commands for the detected package manager.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Detects the package manager being used in the current project
 * @param {string} [projectDir] - Project directory to check (defaults to cwd)
 * @returns {string} - 'pnpm', 'yarn', or 'npm'
 */
export function detectPackageManager(projectDir = process.cwd()) {
	// Check for lockfiles in order of preference
	const lockFiles = [
		{ file: 'pnpm-lock.yaml', manager: 'pnpm' },
		{ file: 'yarn.lock', manager: 'yarn' },
		{ file: 'package-lock.json', manager: 'npm' }
	];

	for (const { file, manager } of lockFiles) {
		if (fs.existsSync(path.join(projectDir, file))) {
			return manager;
		}
	}

	// Check for packageManager field in package.json
	const packageJsonPath = path.join(projectDir, 'package.json');
	if (fs.existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			if (packageJson.packageManager) {
				const packageManager = packageJson.packageManager.toLowerCase();
				if (packageManager.includes('pnpm')) return 'pnpm';
				if (packageManager.includes('yarn')) return 'yarn';
				if (packageManager.includes('npm')) return 'npm';
			}
		} catch (error) {
			// If package.json can't be parsed, continue with other detection methods
		}
	}

	// Check for pnpm workspace file
	if (fs.existsSync(path.join(projectDir, 'pnpm-workspace.yaml'))) {
		return 'pnpm';
	}

	// Check if pnpm is available and project has node_modules/.pnpm
	const nodeModulesDir = path.join(projectDir, 'node_modules');
	if (fs.existsSync(path.join(nodeModulesDir, '.pnpm'))) {
		return 'pnpm';
	}

	// Default to npm if no other indicators found
	return 'npm';
}

/**
 * Gets the appropriate package manager command
 * @param {string} [projectDir] - Project directory to check (defaults to cwd)
 * @returns {string} - 'pnpm', 'yarn', or 'npm'
 */
export function getPackageManagerCommand(projectDir = process.cwd()) {
	return detectPackageManager(projectDir);
}

/**
 * Gets the appropriate package manager executable command (npx equivalent)
 * @param {string} [projectDir] - Project directory to check (defaults to cwd)
 * @returns {string} - 'pnpx', 'yarn', or 'npx'
 */
export function getPackageManagerExecutor(projectDir = process.cwd()) {
	const manager = detectPackageManager(projectDir);
	switch (manager) {
		case 'pnpm':
			return 'pnpx';
		case 'yarn':
			return 'yarn';
		case 'npm':
		default:
			return 'npx';
	}
}

/**
 * Gets the appropriate install command for the detected package manager
 * @param {string} [projectDir] - Project directory to check (defaults to cwd)
 * @returns {string} - Install command like 'pnpm install', 'yarn install', or 'npm install'
 */
export function getInstallCommand(projectDir = process.cwd()) {
	const manager = detectPackageManager(projectDir);
	switch (manager) {
		case 'pnpm':
			return 'pnpm install';
		case 'yarn':
			return 'yarn install';
		case 'npm':
		default:
			return 'npm install';
	}
}

/**
 * Gets the appropriate global install command for the detected package manager
 * @param {string} packageName - Package name to install globally
 * @param {string} [projectDir] - Project directory to check (defaults to cwd)
 * @returns {string} - Global install command
 */
export function getGlobalInstallCommand(packageName, projectDir = process.cwd()) {
	const manager = detectPackageManager(projectDir);
	switch (manager) {
		case 'pnpm':
			return `pnpm add -g ${packageName}`;
		case 'yarn':
			return `yarn global add ${packageName}`;
		case 'npm':
		default:
			return `npm install -g ${packageName}`;
	}
}

/**
 * Checks if a specific package manager is available on the system
 * @param {string} manager - Package manager name ('npm', 'pnpm', 'yarn')
 * @returns {boolean} - True if the package manager is available
 */
export function isPackageManagerAvailable(manager) {
	try {
		execSync(`${manager} --version`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Gets an appropriate fallback install command suggestion
 * @param {string} packageName - Package name
 * @param {boolean} [global=false] - Whether this is for global installation
 * @returns {string} - Suggested install command
 */
export function getSuggestedInstallCommand(packageName, global = false) {
	const availableManagers = ['pnpm', 'yarn', 'npm'].filter(isPackageManagerAvailable);
	
	if (availableManagers.length === 0) {
		return global ? `npm install -g ${packageName}` : `npm install ${packageName}`;
	}

	const preferredManager = availableManagers[0]; // Use first available
	
	switch (preferredManager) {
		case 'pnpm':
			return global ? `pnpm add -g ${packageName}` : `pnpm add ${packageName}`;
		case 'yarn':
			return global ? `yarn global add ${packageName}` : `yarn add ${packageName}`;
		case 'npm':
		default:
			return global ? `npm install -g ${packageName}` : `npm install ${packageName}`;
	}
}