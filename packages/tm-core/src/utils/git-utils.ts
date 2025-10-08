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
			{ cwd: projectRoot }
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
			{ cwd: projectRoot }
		);
		return stdout
			.trim()
			.split('\n')
			.filter((branch) => branch.length > 0 && !branch.includes('HEAD'))
			.map((branch) => branch.replace(/^origin\//, '').trim());
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

		// Fallback to git remote info
		const { stdout } = await execAsync(
			'git symbolic-ref refs/remotes/origin/HEAD',
			{ cwd: projectRoot }
		);
		return stdout.replace('refs/remotes/origin/', '').trim();
	} catch (error) {
		// Final fallback - common default branch names
		const commonDefaults = ['main', 'master'];
		const branches = await getLocalBranches(projectRoot);

		for (const defaultName of commonDefaults) {
			if (branches.includes(defaultName)) {
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
		const currentBranch = await getCurrentBranch(projectRoot);
		const defaultBranch = await getDefaultBranch(projectRoot);
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
		.replace(/[^a-zA-Z0-9_-]/g, '-') // Replace invalid chars with hyphens
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
	const reservedBranches = ['main', 'master', 'develop', 'dev', 'HEAD'];
	if (reservedBranches.includes(branchName.toLowerCase())) {
		return false;
	}

	// Check if sanitized name would be meaningful
	const sanitized = sanitizeBranchNameForTag(branchName);
	return sanitized.length > 0 && sanitized !== 'unknown-branch';
}
