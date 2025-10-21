/**
 * @fileoverview Git Domain Facade
 * Public API for Git operations
 */

import { GitAdapter } from './adapters/git-adapter.js';
import { CommitMessageGenerator } from './services/commit-message-generator.js';
import type { CommitMessageOptions } from './services/commit-message-generator.js';
import type { StatusResult } from 'simple-git';

/**
 * Git Domain - Unified API for Git operations
 */
export class GitDomain {
	private gitAdapter: GitAdapter;
	private commitGenerator: CommitMessageGenerator;

	constructor(projectPath: string) {
		this.gitAdapter = new GitAdapter(projectPath);
		this.commitGenerator = new CommitMessageGenerator();
	}

	// ========== Repository Validation ==========

	/**
	 * Check if directory is a git repository
	 */
	async isGitRepository(): Promise<boolean> {
		return this.gitAdapter.isGitRepository();
	}

	/**
	 * Ensure we're in a valid git repository
	 */
	async ensureGitRepository(): Promise<void> {
		return this.gitAdapter.ensureGitRepository();
	}

	/**
	 * Get repository root path
	 */
	async getRepositoryRoot(): Promise<string> {
		return this.gitAdapter.getRepositoryRoot();
	}

	// ========== Working Tree Status ==========

	/**
	 * Check if working tree is clean
	 */
	async isWorkingTreeClean(): Promise<boolean> {
		return this.gitAdapter.isWorkingTreeClean();
	}

	/**
	 * Get git status
	 */
	async getStatus(): Promise<StatusResult> {
		return this.gitAdapter.getStatus();
	}

	/**
	 * Get status summary
	 */
	async getStatusSummary(): Promise<{
		isClean: boolean;
		staged: number;
		modified: number;
		deleted: number;
		untracked: number;
		totalChanges: number;
	}> {
		return this.gitAdapter.getStatusSummary();
	}

	/**
	 * Check if there are uncommitted changes
	 */
	async hasUncommittedChanges(): Promise<boolean> {
		return this.gitAdapter.hasUncommittedChanges();
	}

	/**
	 * Check if there are staged changes
	 */
	async hasStagedChanges(): Promise<boolean> {
		return this.gitAdapter.hasStagedChanges();
	}

	// ========== Branch Operations ==========

	/**
	 * Get current branch name
	 */
	async getCurrentBranch(): Promise<string> {
		return this.gitAdapter.getCurrentBranch();
	}

	/**
	 * List all local branches
	 */
	async listBranches(): Promise<string[]> {
		return this.gitAdapter.listBranches();
	}

	/**
	 * Check if a branch exists
	 */
	async branchExists(branchName: string): Promise<boolean> {
		return this.gitAdapter.branchExists(branchName);
	}

	/**
	 * Create a new branch
	 */
	async createBranch(
		branchName: string,
		options?: { checkout?: boolean }
	): Promise<void> {
		return this.gitAdapter.createBranch(branchName, options);
	}

	/**
	 * Checkout an existing branch
	 */
	async checkoutBranch(
		branchName: string,
		options?: { force?: boolean }
	): Promise<void> {
		return this.gitAdapter.checkoutBranch(branchName, options);
	}

	/**
	 * Create and checkout a new branch
	 */
	async createAndCheckoutBranch(branchName: string): Promise<void> {
		return this.gitAdapter.createAndCheckoutBranch(branchName);
	}

	/**
	 * Delete a branch
	 */
	async deleteBranch(
		branchName: string,
		options?: { force?: boolean }
	): Promise<void> {
		return this.gitAdapter.deleteBranch(branchName, options);
	}

	/**
	 * Get default branch name
	 */
	async getDefaultBranch(): Promise<string> {
		return this.gitAdapter.getDefaultBranch();
	}

	/**
	 * Check if on default branch
	 */
	async isOnDefaultBranch(): Promise<boolean> {
		return this.gitAdapter.isOnDefaultBranch();
	}

	// ========== Commit Operations ==========

	/**
	 * Stage files for commit
	 */
	async stageFiles(files: string[]): Promise<void> {
		return this.gitAdapter.stageFiles(files);
	}

	/**
	 * Unstage files
	 */
	async unstageFiles(files: string[]): Promise<void> {
		return this.gitAdapter.unstageFiles(files);
	}

	/**
	 * Create a commit
	 */
	async createCommit(
		message: string,
		options?: {
			metadata?: Record<string, string>;
			allowEmpty?: boolean;
			enforceNonDefaultBranch?: boolean;
			force?: boolean;
		}
	): Promise<void> {
		return this.gitAdapter.createCommit(message, options);
	}

	/**
	 * Get commit log
	 */
	async getCommitLog(options?: { maxCount?: number }): Promise<any[]> {
		return this.gitAdapter.getCommitLog(options);
	}

	/**
	 * Get last commit
	 */
	async getLastCommit(): Promise<any> {
		return this.gitAdapter.getLastCommit();
	}

	// ========== Remote Operations ==========

	/**
	 * Check if repository has remotes
	 */
	async hasRemote(): Promise<boolean> {
		return this.gitAdapter.hasRemote();
	}

	/**
	 * Get all configured remotes
	 */
	async getRemotes(): Promise<any[]> {
		return this.gitAdapter.getRemotes();
	}

	// ========== Commit Message Generation ==========

	/**
	 * Generate a conventional commit message
	 */
	generateCommitMessage(options: CommitMessageOptions): string {
		return this.commitGenerator.generateMessage(options);
	}

	/**
	 * Validate a conventional commit message
	 */
	validateCommitMessage(message: string) {
		return this.commitGenerator.validateConventionalCommit(message);
	}

	/**
	 * Parse a commit message
	 */
	parseCommitMessage(message: string) {
		return this.commitGenerator.parseCommitMessage(message);
	}
}
