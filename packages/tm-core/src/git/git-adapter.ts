/**
 * GitAdapter - Safe git operations wrapper with validation and safety checks.
 * Handles all git operations (branching, committing, pushing) with built-in safety gates.
 *
 * @module git-adapter
 */

import simpleGit, { SimpleGit, GitError } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';

/**
 * GitAdapter class for safe git operations
 */
export class GitAdapter {
	public projectPath: string;
	public git: SimpleGit;

	/**
	 * Creates a new GitAdapter instance.
	 *
	 * @param {string} projectPath - Absolute path to the project directory
	 * @throws {Error} If projectPath is invalid or not absolute
	 *
	 * @example
	 * const git = new GitAdapter('/path/to/project');
	 * await git.ensureGitRepository();
	 */
	constructor(projectPath: string) {
		// Validate project path
		if (!projectPath) {
			throw new Error('Project path is required');
		}

		if (!path.isAbsolute(projectPath)) {
			throw new Error('Project path must be an absolute path');
		}

		// Normalize path
		this.projectPath = path.normalize(projectPath);

		// Initialize simple-git
		this.git = simpleGit(this.projectPath);
	}

	/**
	 * Checks if the current directory is a git repository.
	 * Looks for .git directory or file (worktree/submodule).
	 *
	 * @returns {Promise<boolean>} True if in a git repository
	 *
	 * @example
	 * const isRepo = await git.isGitRepository();
	 * if (!isRepo) {
	 *   console.log('Not a git repository');
	 * }
	 */
	async isGitRepository(): Promise<boolean> {
		try {
			// Check if .git exists (directory or file for submodules/worktrees)
			const gitPath = path.join(this.projectPath, '.git');

			if (await fs.pathExists(gitPath)) {
				return true;
			}

			// Try to find git root from subdirectory
			try {
				await this.git.revparse(['--git-dir']);
				return true;
			} catch {
				return false;
			}
		} catch (error) {
			return false;
		}
	}

	/**
	 * Validates that git is installed and accessible.
	 * Checks git binary availability and version.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} If git is not installed or not accessible
	 *
	 * @example
	 * await git.validateGitInstallation();
	 * console.log('Git is installed');
	 */
	async validateGitInstallation(): Promise<void> {
		try {
			await this.git.version();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Git is not installed or not accessible: ${errorMessage}`);
		}
	}

	/**
	 * Gets the git version information.
	 *
	 * @returns {Promise<{major: number, minor: number, patch: number, agent: string}>}
	 *
	 * @example
	 * const version = await git.getGitVersion();
	 * console.log(`Git version: ${version.major}.${version.minor}.${version.patch}`);
	 */
	async getGitVersion(): Promise<{ major: number; minor: number; patch: number; agent: string }> {
		const versionResult = await this.git.version();
		return {
			major: versionResult.major,
			minor: versionResult.minor,
			patch: typeof versionResult.patch === 'string' ? parseInt(versionResult.patch) : (versionResult.patch || 0),
			agent: versionResult.agent
		};
	}

	/**
	 * Gets the repository root path.
	 * Works even when called from a subdirectory.
	 *
	 * @returns {Promise<string>} Absolute path to repository root
	 * @throws {Error} If not in a git repository
	 *
	 * @example
	 * const root = await git.getRepositoryRoot();
	 * console.log(`Repository root: ${root}`);
	 */
	async getRepositoryRoot(): Promise<string> {
		try {
			const result = await this.git.revparse(['--show-toplevel']);
			return path.normalize(result.trim());
		} catch (error) {
			throw new Error(`not a git repository: ${this.projectPath}`);
		}
	}

	/**
	 * Validates the repository state.
	 * Checks for corruption and basic integrity.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} If repository is corrupted or invalid
	 *
	 * @example
	 * await git.validateRepository();
	 * console.log('Repository is valid');
	 */
	async validateRepository(): Promise<void> {
		// Check if it's a git repository
		const isRepo = await this.isGitRepository();
		if (!isRepo) {
			throw new Error(`not a git repository: ${this.projectPath}`);
		}

		// Try to get repository status to verify it's not corrupted
		try {
			await this.git.status();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Repository validation failed: ${errorMessage}`);
		}
	}

	/**
	 * Ensures we're in a valid git repository before performing operations.
	 * Convenience method that throws descriptive errors.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} If not in a valid git repository
	 *
	 * @example
	 * await git.ensureGitRepository();
	 * // Safe to perform git operations after this
	 */
	async ensureGitRepository(): Promise<void> {
		const isRepo = await this.isGitRepository();
		if (!isRepo) {
			throw new Error(
				`not a git repository: ${this.projectPath}\n` +
					`Please run this command from within a git repository, or initialize one with 'git init'.`
			);
		}
	}
}
