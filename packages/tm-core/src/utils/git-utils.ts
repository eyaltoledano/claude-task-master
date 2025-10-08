/**
 * @fileoverview Git utilities for Task Master
 * Git integration utilities using raw git commands and gh CLI
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GitHub repository information
 */
export interface GitHubRepoInfo {
	name: string;
	owner: { login: string };
	defaultBranchRef: { name: string };
}

/**
 * Check if the specified directory is inside a git repository
 */
export async function isGitRepository(projectRoot: string): Promise<boolean> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isGitRepository');
	}

	try {
		await execAsync('git rev-parse --git-dir', { cwd: projectRoot });
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Synchronous check if directory is in a git repository
 */
export function isGitRepositorySync(projectRoot: string): boolean {
	if (!projectRoot) {
		return false;
	}

	try {
		execSync('git rev-parse --git-dir', {
			cwd: projectRoot,
			stdio: 'ignore'
		});
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Get the current git branch name
 */
export async function getCurrentBranch(
	projectRoot: string
): Promise<string | null> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getCurrentBranch');
	}

	try {
		const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
			cwd: projectRoot
		});
		return stdout.trim();
	} catch (error) {
		return null;
	}
}

/**
 * Synchronous get current git branch name
 */
export function getCurrentBranchSync(projectRoot: string): string | null {
	if (!projectRoot) {
		return null;
	}

	try {
		const stdout = execSync('git rev-parse --abbrev-ref HEAD', {
			cwd: projectRoot,
			encoding: 'utf8'
		});
		return stdout.trim();
	} catch (error) {
		return null;
	}
}

/**
 * Get list of all local git branches
 */
export async function getLocalBranches(projectRoot: string): Promise<string[]> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getLocalBranches');
	}

	try {
		const { stdout } = await execAsync(
			'git branch --format="%(refname:short)"',
			{ cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
		);
		return stdout
			.trim()
			.split('\n')
			.filter((branch) => branch.length > 0)
			.map((branch) => branch.trim());
	} catch (error) {
		return [];
	}
}

/**
 * Get list of all remote branches
 */
export async function getRemoteBranches(
	projectRoot: string
): Promise<string[]> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getRemoteBranches');
	}

	try {
		const { stdout } = await execAsync(
			'git branch -r --format="%(refname:short)"',
			{ cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
		);
		const names = stdout
			.trim()
			.split('\n')
			.filter((branch) => branch.length > 0 && !branch.includes('HEAD'))
			.map((branch) => branch.replace(/^[^/]+\//, '').trim());
		return Array.from(new Set(names));
	} catch (error) {
		return [];
	}
}

/**
 * Check if gh CLI is available and authenticated
 */
export async function isGhCliAvailable(projectRoot?: string): Promise<boolean> {
	try {
		const options = projectRoot ? { cwd: projectRoot } : {};
		await execAsync('gh auth status', options);
		return true;
	} catch (error) {
		return false;
	}
}

/**
 * Get GitHub repository information using gh CLI
 */
export async function getGitHubRepoInfo(
	projectRoot: string
): Promise<GitHubRepoInfo | null> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getGitHubRepoInfo');
	}

	try {
		const { stdout } = await execAsync(
			'gh repo view --json name,owner,defaultBranchRef',
			{ cwd: projectRoot }
		);
		return JSON.parse(stdout) as GitHubRepoInfo;
	} catch (error) {
		return null;
	}
}

/**
 * Get git repository root directory
 */
export async function getGitRepositoryRoot(
	projectRoot: string
): Promise<string | null> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getGitRepositoryRoot');
	}

	try {
		const { stdout } = await execAsync('git rev-parse --show-toplevel', {
			cwd: projectRoot
		});
		return stdout.trim();
	} catch (error) {
		return null;
	}
}

/**
 * Get the default branch name for the repository
 */
export async function getDefaultBranch(
	projectRoot: string
): Promise<string | null> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getDefaultBranch');
	}

	try {
		// Try to get from GitHub first (if gh CLI is available)
		if (await isGhCliAvailable(projectRoot)) {
			const repoInfo = await getGitHubRepoInfo(projectRoot);
			if (repoInfo && repoInfo.defaultBranchRef) {
				return repoInfo.defaultBranchRef.name;
			}
		}

		// Fallback to git remote info (support non-origin remotes)
		const remotesRaw = await execAsync('git remote', { cwd: projectRoot });
		const remotes = remotesRaw.stdout.trim().split('\n').filter(Boolean);
		if (remotes.length > 0) {
			const primary = remotes.includes('origin') ? 'origin' : remotes[0];
			// Parse `git remote show` (preferred)
			try {
				const { stdout } = await execAsync(`git remote show ${primary}`, {
					cwd: projectRoot,
					maxBuffer: 10 * 1024 * 1024
				});
				const m = stdout.match(/HEAD branch:\s+([^\s]+)/);
				if (m) return m[1].trim();
			} catch {}
			// Fallback to symbolic-ref of remote HEAD
			try {
				const { stdout } = await execAsync(
					`git symbolic-ref refs/remotes/${primary}/HEAD`,
					{ cwd: projectRoot }
				);
				return stdout.replace(`refs/remotes/${primary}/`, '').trim();
			} catch {}
		}
		// If we couldn't determine, throw to trigger final fallbacks
		throw new Error('default-branch-not-found');
	} catch (error) {
		// Final fallback - common default branch names
		const commonDefaults = ['main', 'master'];
		const branches = await getLocalBranches(projectRoot);
		const remoteBranches = await getRemoteBranches(projectRoot);

		for (const defaultName of commonDefaults) {
			if (
				branches.includes(defaultName) ||
				remoteBranches.includes(defaultName)
			) {
				return defaultName;
			}
		}

		return null;
	}
}

/**
 * Check if we're currently on the default branch
 */
export async function isOnDefaultBranch(projectRoot: string): Promise<boolean> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isOnDefaultBranch');
	}

	try {
		const [currentBranch, defaultBranch] = await Promise.all([
			getCurrentBranch(projectRoot),
			getDefaultBranch(projectRoot)
		]);
		return (
			currentBranch !== null &&
			defaultBranch !== null &&
			currentBranch === defaultBranch
		);
	} catch (error) {
		return false;
	}
}

/**
 * Check if the current working directory is inside a Git work-tree
 */
export function insideGitWorkTree(): boolean {
	try {
		execSync('git rev-parse --is-inside-work-tree', {
			stdio: 'ignore',
			cwd: process.cwd()
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Sanitize branch name to be a valid tag name
 */
export function sanitizeBranchNameForTag(branchName: string): string {
	if (!branchName || typeof branchName !== 'string') {
		return 'unknown-branch';
	}

	// Replace invalid characters with hyphens and clean up
	return branchName
		.replace(/[^a-zA-Z0-9_.-]/g, '-') // Replace invalid chars with hyphens (allow dots)
		.replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
		.replace(/-+/g, '-') // Collapse multiple hyphens
		.toLowerCase() // Convert to lowercase
		.substring(0, 50); // Limit length
}

/**
 * Check if a branch name would create a valid tag name
 */
export function isValidBranchForTag(branchName: string): boolean {
	if (!branchName || typeof branchName !== 'string') {
		return false;
	}

	// Check if it's a reserved branch name that shouldn't become tags
	const reservedBranches = ['main', 'master', 'develop', 'dev', 'head'];
	if (reservedBranches.includes(branchName.toLowerCase())) {
		return false;
	}

	// Check if sanitized name would be meaningful
	const sanitized = sanitizeBranchNameForTag(branchName);
	return sanitized.length > 0 && sanitized !== 'unknown-branch';
}

/**
 * Git worktree information
 */
export interface GitWorktree {
	path: string;
	branch: string | null;
	head: string;
}

/**
 * Get list of all git worktrees
 */
export async function getWorktrees(
	projectRoot: string
): Promise<GitWorktree[]> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for getWorktrees');
	}

	try {
		const { stdout } = await execAsync('git worktree list --porcelain', {
			cwd: projectRoot
		});

		const worktrees: GitWorktree[] = [];
		const lines = stdout.trim().split('\n');
		let current: Partial<GitWorktree> = {};

		for (const line of lines) {
			if (line.startsWith('worktree ')) {
				// flush previous entry if present
				if (current.path) {
					worktrees.push({
						path: current.path,
						branch: current.branch || null,
						head: current.head || ''
					});
					current = {};
				}
				current.path = line.substring(9);
			} else if (line.startsWith('HEAD ')) {
				current.head = line.substring(5);
			} else if (line.startsWith('branch ')) {
				current.branch = line.substring(7).replace('refs/heads/', '');
			} else if (line === '' && current.path) {
				worktrees.push({
					path: current.path,
					branch: current.branch || null,
					head: current.head || ''
				});
				current = {};
			}
		}

		// Handle last entry if no trailing newline
		if (current.path) {
			worktrees.push({
				path: current.path,
				branch: current.branch || null,
				head: current.head || ''
			});
		}

		return worktrees;
	} catch (error) {
		return [];
	}
}

/**
 * Check if a branch is checked out in any worktree
 * Returns the worktree path if found, null otherwise
 */
export async function isBranchCheckedOut(
	projectRoot: string,
	branchName: string
): Promise<string | null> {
	if (!projectRoot) {
		throw new Error('projectRoot is required for isBranchCheckedOut');
	}
	if (!branchName) {
		throw new Error('branchName is required for isBranchCheckedOut');
	}

	const worktrees = await getWorktrees(projectRoot);
	const worktree = worktrees.find((wt) => wt.branch === branchName);
	return worktree ? worktree.path : null;
}
