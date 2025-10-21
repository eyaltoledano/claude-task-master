/**
 * GitAdapter - Safe git operations wrapper with validation and safety checks.
 * Handles all git operations (branching, committing, pushing) with built-in safety gates.
 *
 * @module git-adapter
 */

import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git';
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
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new Error(
				`Git is not installed or not accessible: ${errorMessage}`
			);
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
	async getGitVersion(): Promise<{
		major: number;
		minor: number;
		patch: number;
		agent: string;
	}> {
		const versionResult = await this.git.version();
		return {
			major: versionResult.major,
			minor: versionResult.minor,
			patch:
				typeof versionResult.patch === 'string'
					? parseInt(versionResult.patch)
					: versionResult.patch || 0,
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
			const errorMessage =
				error instanceof Error ? error.message : String(error);
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

	/**
	 * Checks if the working tree is clean (no uncommitted changes).
	 * A clean working tree has no staged, unstaged, or untracked files.
	 *
	 * @returns {Promise<boolean>} True if working tree is clean
	 *
	 * @example
	 * const isClean = await git.isWorkingTreeClean();
	 * if (!isClean) {
	 *   console.log('Working tree has uncommitted changes');
	 * }
	 */
	async isWorkingTreeClean(): Promise<boolean> {
		const status = await this.git.status();
		return status.isClean();
	}

	/**
	 * Gets the detailed status of the working tree.
	 * Returns raw status from simple-git with all file changes.
	 *
	 * @returns {Promise<StatusResult>} Detailed status object
	 *
	 * @example
	 * const status = await git.getStatus();
	 * console.log('Modified files:', status.modified);
	 * console.log('Staged files:', status.staged);
	 */
	async getStatus(): Promise<StatusResult> {
		return await this.git.status();
	}

	/**
	 * Checks if there are any uncommitted changes in the working tree.
	 * Includes staged, unstaged, and untracked files.
	 *
	 * @returns {Promise<boolean>} True if there are uncommitted changes
	 *
	 * @example
	 * const hasChanges = await git.hasUncommittedChanges();
	 * if (hasChanges) {
	 *   console.log('Please commit your changes before proceeding');
	 * }
	 */
	async hasUncommittedChanges(): Promise<boolean> {
		const status = await this.git.status();
		return !status.isClean();
	}

	/**
	 * Checks if there are any staged changes ready to commit.
	 *
	 * @returns {Promise<boolean>} True if there are staged changes
	 *
	 * @example
	 * const hasStaged = await git.hasStagedChanges();
	 * if (hasStaged) {
	 *   console.log('Ready to commit');
	 * }
	 */
	async hasStagedChanges(): Promise<boolean> {
		const status = await this.git.status();
		return status.staged.length > 0;
	}

	/**
	 * Checks if there are any untracked files in the working tree.
	 *
	 * @returns {Promise<boolean>} True if there are untracked files
	 *
	 * @example
	 * const hasUntracked = await git.hasUntrackedFiles();
	 * if (hasUntracked) {
	 *   console.log('You have untracked files');
	 * }
	 */
	async hasUntrackedFiles(): Promise<boolean> {
		const status = await this.git.status();
		return status.not_added.length > 0;
	}

	/**
	 * Gets a summary of the working tree status with counts.
	 *
	 * @returns {Promise<{isClean: boolean, staged: number, modified: number, deleted: number, untracked: number, totalChanges: number}>}
	 *
	 * @example
	 * const summary = await git.getStatusSummary();
	 * console.log(`${summary.totalChanges} total changes`);
	 */
	async getStatusSummary(): Promise<{
		isClean: boolean;
		staged: number;
		modified: number;
		deleted: number;
		untracked: number;
		totalChanges: number;
	}> {
		const status = await this.git.status();
		const staged = status.staged.length;
		const modified = status.modified.length;
		const deleted = status.deleted.length;
		const untracked = status.not_added.length;
		const totalChanges = staged + modified + deleted + untracked;

		return {
			isClean: status.isClean(),
			staged,
			modified,
			deleted,
			untracked,
			totalChanges
		};
	}

	/**
	 * Ensures the working tree is clean before performing operations.
	 * Throws an error with details if there are uncommitted changes.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} If working tree is not clean
	 *
	 * @example
	 * await git.ensureCleanWorkingTree();
	 * // Safe to perform git operations that require clean state
	 */
	async ensureCleanWorkingTree(): Promise<void> {
		const status = await this.git.status();
		if (!status.isClean()) {
			const summary = await this.getStatusSummary();
			throw new Error(
				`working tree is not clean: ${this.projectPath}\n` +
					`Staged: ${summary.staged}, Modified: ${summary.modified}, ` +
					`Deleted: ${summary.deleted}, Untracked: ${summary.untracked}\n` +
					`Please commit or stash your changes before proceeding.`
			);
		}
	}

	/**
	 * Gets the name of the current branch.
	 *
	 * @returns {Promise<string>} Current branch name
	 * @throws {Error} If unable to determine current branch
	 *
	 * @example
	 * const branch = await git.getCurrentBranch();
	 * console.log(`Currently on: ${branch}`);
	 */
	async getCurrentBranch(): Promise<string> {
		const status = await this.git.status();
		return status.current || 'HEAD';
	}

	/**
	 * Lists all local branches in the repository.
	 *
	 * @returns {Promise<string[]>} Array of branch names
	 *
	 * @example
	 * const branches = await git.listBranches();
	 * console.log('Available branches:', branches);
	 */
	async listBranches(): Promise<string[]> {
		const branchSummary = await this.git.branchLocal();
		return Object.keys(branchSummary.branches);
	}

	/**
	 * Checks if a branch exists in the repository.
	 *
	 * @param {string} branchName - Name of branch to check
	 * @returns {Promise<boolean>} True if branch exists
	 *
	 * @example
	 * const exists = await git.branchExists('feature-branch');
	 * if (!exists) {
	 *   console.log('Branch does not exist');
	 * }
	 */
	async branchExists(branchName: string): Promise<boolean> {
		const branches = await this.listBranches();
		return branches.includes(branchName);
	}

	/**
	 * Creates a new branch without checking it out.
	 *
	 * @param {string} branchName - Name for the new branch
	 * @param {Object} options - Branch creation options
	 * @param {boolean} options.checkout - Whether to checkout after creation
	 * @returns {Promise<void>}
	 * @throws {Error} If branch already exists or working tree is dirty (when checkout=true)
	 *
	 * @example
	 * await git.createBranch('feature-branch');
	 * await git.createBranch('feature-branch', { checkout: true });
	 */
	async createBranch(
		branchName: string,
		options: { checkout?: boolean } = {}
	): Promise<void> {
		// Check if branch already exists
		const exists = await this.branchExists(branchName);
		if (exists) {
			throw new Error(`branch already exists: ${branchName}`);
		}

		// If checkout is requested, ensure working tree is clean
		if (options.checkout) {
			await this.ensureCleanWorkingTree();
		}

		// Create the branch
		await this.git.branch([branchName]);

		// Checkout if requested
		if (options.checkout) {
			await this.git.checkout(branchName);
		}
	}

	/**
	 * Checks out an existing branch.
	 *
	 * @param {string} branchName - Name of branch to checkout
	 * @param {Object} options - Checkout options
	 * @param {boolean} options.force - Force checkout even with uncommitted changes
	 * @returns {Promise<void>}
	 * @throws {Error} If branch doesn't exist or working tree is dirty (unless force=true)
	 *
	 * @example
	 * await git.checkoutBranch('feature-branch');
	 * await git.checkoutBranch('feature-branch', { force: true });
	 */
	async checkoutBranch(
		branchName: string,
		options: { force?: boolean } = {}
	): Promise<void> {
		// Check if branch exists
		const exists = await this.branchExists(branchName);
		if (!exists) {
			throw new Error(`branch does not exist: ${branchName}`);
		}

		// Ensure clean working tree unless force is specified
		if (!options.force) {
			await this.ensureCleanWorkingTree();
		}

		// Checkout the branch
		const checkoutOptions = options.force ? ['-f', branchName] : [branchName];
		await this.git.checkout(checkoutOptions);
	}

	/**
	 * Creates a new branch and checks it out.
	 * Convenience method combining createBranch and checkoutBranch.
	 *
	 * @param {string} branchName - Name for the new branch
	 * @returns {Promise<void>}
	 * @throws {Error} If branch already exists or working tree is dirty
	 *
	 * @example
	 * await git.createAndCheckoutBranch('new-feature');
	 */
	async createAndCheckoutBranch(branchName: string): Promise<void> {
		// Ensure working tree is clean
		await this.ensureCleanWorkingTree();

		// Check if branch already exists
		const exists = await this.branchExists(branchName);
		if (exists) {
			throw new Error(`branch already exists: ${branchName}`);
		}

		// Create and checkout the branch
		await this.git.checkoutLocalBranch(branchName);
	}

	/**
	 * Deletes a branch.
	 *
	 * @param {string} branchName - Name of branch to delete
	 * @param {Object} options - Delete options
	 * @param {boolean} options.force - Force delete even if unmerged
	 * @returns {Promise<void>}
	 * @throws {Error} If branch doesn't exist or is currently checked out
	 *
	 * @example
	 * await git.deleteBranch('old-feature');
	 * await git.deleteBranch('unmerged-feature', { force: true });
	 */
	async deleteBranch(
		branchName: string,
		options: { force?: boolean } = {}
	): Promise<void> {
		// Check if branch exists
		const exists = await this.branchExists(branchName);
		if (!exists) {
			throw new Error(`branch does not exist: ${branchName}`);
		}

		// Check if trying to delete current branch
		const current = await this.getCurrentBranch();
		if (current === branchName) {
			throw new Error(`cannot delete current branch: ${branchName}`);
		}

		// Delete the branch
		const deleteOptions = options.force
			? ['-D', branchName]
			: ['-d', branchName];
		await this.git.branch(deleteOptions);
	}

	/**
	 * Stages files for commit.
	 *
	 * @param {string[]} files - Array of file paths to stage
	 * @returns {Promise<void>}
	 *
	 * @example
	 * await git.stageFiles(['file1.txt', 'file2.txt']);
	 * await git.stageFiles(['.']); // Stage all changes
	 */
	async stageFiles(files: string[]): Promise<void> {
		await this.git.add(files);
	}

	/**
	 * Unstages files that were previously staged.
	 *
	 * @param {string[]} files - Array of file paths to unstage
	 * @returns {Promise<void>}
	 *
	 * @example
	 * await git.unstageFiles(['file1.txt']);
	 */
	async unstageFiles(files: string[]): Promise<void> {
		await this.git.reset(['HEAD', '--', ...files]);
	}

	/**
	 * Creates a commit with optional metadata embedding.
	 *
	 * @param {string} message - Commit message
	 * @param {Object} options - Commit options
	 * @param {Object} options.metadata - Metadata to embed in commit message
	 * @param {boolean} options.allowEmpty - Allow empty commits
	 * @param {boolean} options.enforceNonDefaultBranch - Prevent commits on default branch
	 * @param {boolean} options.force - Force commit even on default branch
	 * @returns {Promise<void>}
	 * @throws {Error} If no staged changes (unless allowEmpty), or on default branch (unless force)
	 *
	 * @example
	 * await git.createCommit('Add feature');
	 * await git.createCommit('Add feature', {
	 *   metadata: { taskId: '2.4', phase: 'implementation' }
	 * });
	 * await git.createCommit('Add feature', {
	 *   enforceNonDefaultBranch: true
	 * });
	 */
	async createCommit(
		message: string,
		options: {
			metadata?: Record<string, string>;
			allowEmpty?: boolean;
			enforceNonDefaultBranch?: boolean;
			force?: boolean;
		} = {}
	): Promise<void> {
		// Check if on default branch and enforcement is requested
		if (options.enforceNonDefaultBranch && !options.force) {
			const currentBranch = await this.getCurrentBranch();
			const defaultBranches = ['main', 'master', 'develop'];
			if (defaultBranches.includes(currentBranch)) {
				throw new Error(
					`cannot commit to default branch: ${currentBranch}\n` +
						`Please create a feature branch or use force option.`
				);
			}
		}

		// Check for staged changes unless allowEmpty
		if (!options.allowEmpty) {
			const hasStaged = await this.hasStagedChanges();
			if (!hasStaged) {
				throw new Error('no staged changes to commit');
			}
		}

		// Build commit arguments
		const commitArgs: string[] = ['commit'];

		// Add message
		commitArgs.push('-m', message);

		// Add metadata as separate commit message lines
		if (options.metadata) {
			commitArgs.push('-m', ''); // Empty line separator
			for (const [key, value] of Object.entries(options.metadata)) {
				commitArgs.push('-m', `[${key}:${value}]`);
			}
		}

		// Add flags
		commitArgs.push('--no-gpg-sign');
		if (options.allowEmpty) {
			commitArgs.push('--allow-empty');
		}

		await this.git.raw(commitArgs);
	}

	/**
	 * Gets the commit log history.
	 *
	 * @param {Object} options - Log options
	 * @param {number} options.maxCount - Maximum number of commits to return
	 * @returns {Promise<Array>} Array of commit objects
	 *
	 * @example
	 * const log = await git.getCommitLog();
	 * const recentLog = await git.getCommitLog({ maxCount: 10 });
	 */
	async getCommitLog(options: { maxCount?: number } = {}): Promise<any[]> {
		const logOptions: any = {
			format: {
				hash: '%H',
				date: '%ai',
				message: '%B', // Full commit message including body
				author_name: '%an',
				author_email: '%ae'
			}
		};
		if (options.maxCount) {
			logOptions.maxCount = options.maxCount;
		}

		const log = await this.git.log(logOptions);
		return [...log.all];
	}

	/**
	 * Gets the last commit.
	 *
	 * @returns {Promise<any>} Last commit object
	 *
	 * @example
	 * const lastCommit = await git.getLastCommit();
	 * console.log(lastCommit.message);
	 */
	async getLastCommit(): Promise<any> {
		const log = await this.git.log({
			maxCount: 1,
			format: {
				hash: '%H',
				date: '%ai',
				message: '%B', // Full commit message including body
				author_name: '%an',
				author_email: '%ae'
			}
		});
		return log.latest;
	}

	/**
	 * Detects the default branch for the repository.
	 * Returns the current branch name, assuming it's the default if it's main/master/develop.
	 *
	 * @returns {Promise<string>} Default branch name
	 *
	 * @example
	 * const defaultBranch = await git.getDefaultBranch();
	 * console.log(`Default branch: ${defaultBranch}`);
	 */
	async getDefaultBranch(): Promise<string> {
		const currentBranch = await this.getCurrentBranch();
		const defaultBranches = ['main', 'master', 'develop'];

		if (defaultBranches.includes(currentBranch)) {
			return currentBranch;
		}

		// If not on a default branch, check which default branches exist
		const branches = await this.listBranches();
		for (const defaultBranch of defaultBranches) {
			if (branches.includes(defaultBranch)) {
				return defaultBranch;
			}
		}

		// Fallback to main
		return 'main';
	}

	/**
	 * Checks if a given branch name is considered a default branch.
	 * Default branches are: main, master, develop.
	 *
	 * @param {string} branchName - Branch name to check
	 * @returns {Promise<boolean>} True if branch is a default branch
	 *
	 * @example
	 * const isDefault = await git.isDefaultBranch('main');
	 * if (isDefault) {
	 *   console.log('This is a default branch');
	 * }
	 */
	async isDefaultBranch(branchName: string): Promise<boolean> {
		const defaultBranches = ['main', 'master', 'develop'];
		return defaultBranches.includes(branchName);
	}

	/**
	 * Checks if currently on a default branch.
	 *
	 * @returns {Promise<boolean>} True if on a default branch
	 *
	 * @example
	 * const onDefault = await git.isOnDefaultBranch();
	 * if (onDefault) {
	 *   console.log('Warning: You are on a default branch');
	 * }
	 */
	async isOnDefaultBranch(): Promise<boolean> {
		const currentBranch = await this.getCurrentBranch();
		return await this.isDefaultBranch(currentBranch);
	}

	/**
	 * Ensures the current branch is not a default branch.
	 * Throws an error if on a default branch.
	 *
	 * @returns {Promise<void>}
	 * @throws {Error} If currently on a default branch
	 *
	 * @example
	 * await git.ensureNotOnDefaultBranch();
	 * // Safe to perform operations that shouldn't happen on default branches
	 */
	async ensureNotOnDefaultBranch(): Promise<void> {
		const onDefault = await this.isOnDefaultBranch();
		if (onDefault) {
			const currentBranch = await this.getCurrentBranch();
			throw new Error(
				`currently on default branch: ${currentBranch}\n` +
					`Please create a feature branch before proceeding.`
			);
		}
	}

	/**
	 * Checks if the repository has any remotes configured.
	 *
	 * @returns {Promise<boolean>} True if remotes exist
	 *
	 * @example
	 * const hasRemote = await git.hasRemote();
	 * if (!hasRemote) {
	 *   console.log('No remotes configured');
	 * }
	 */
	async hasRemote(): Promise<boolean> {
		const remotes = await this.git.getRemotes();
		return remotes.length > 0;
	}

	/**
	 * Gets all configured remotes.
	 *
	 * @returns {Promise<Array>} Array of remote objects
	 *
	 * @example
	 * const remotes = await git.getRemotes();
	 * console.log('Remotes:', remotes);
	 */
	async getRemotes(): Promise<any[]> {
		return await this.git.getRemotes(true);
	}
}
