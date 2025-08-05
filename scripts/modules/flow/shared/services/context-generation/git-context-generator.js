/**
 * Git Context Generator - Gathers git-related context from the project
 *
 * This service collects git information including recent commits, branch info,
 * and current status to provide context for content generation.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitContextGenerator {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
	}

	async generateGitContext() {
		try {
			const [recentCommits, currentStatus, branchInfo, remoteInfo] =
				await Promise.all([
					this.getRecentCommits(),
					this.getCurrentStatus(),
					this.getBranchInfo(),
					this.getRemoteInfo()
				]);

			return {
				recentCommits,
				currentStatus,
				branchInfo,
				remoteInfo,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			console.warn('Failed to generate git context:', error.message);
			return {
				error: error.message,
				timestamp: new Date().toISOString()
			};
		}
	}

	async getRecentCommits(count = 10) {
		try {
			const { stdout } = await execAsync(
				`git log --oneline -${count} --no-merges`,
				{ cwd: this.projectRoot }
			);

			return stdout
				.trim()
				.split('\n')
				.filter((line) => line.trim())
				.map((line) => {
					const [hash, ...messageParts] = line.split(' ');
					return {
						hash: hash.trim(),
						message: messageParts.join(' ').trim()
					};
				});
		} catch (error) {
			return [];
		}
	}

	async getCurrentStatus() {
		try {
			const { stdout: status } = await execAsync('git status --porcelain', {
				cwd: this.projectRoot
			});

			const { stdout: staged } = await execAsync(
				'git diff --cached --name-only',
				{ cwd: this.projectRoot }
			);

			const { stdout: modified } = await execAsync('git diff --name-only', {
				cwd: this.projectRoot
			});

			return {
				hasUncommittedChanges: !!status.trim(),
				stagedFiles: staged
					.trim()
					.split('\n')
					.filter((f) => f),
				modifiedFiles: modified
					.trim()
					.split('\n')
					.filter((f) => f),
				statusSummary: this.parseGitStatus(status)
			};
		} catch (error) {
			return {
				error: error.message
			};
		}
	}

	parseGitStatus(status) {
		const lines = status
			.trim()
			.split('\n')
			.filter((line) => line.trim());
		const summary = {
			modified: [],
			added: [],
			deleted: [],
			renamed: [],
			untracked: []
		};

		lines.forEach((line) => {
			const statusCode = line.substring(0, 2);
			const filename = line.substring(3);

			switch (statusCode.trim()) {
				case 'M':
				case 'MM':
					summary.modified.push(filename);
					break;
				case 'A':
					summary.added.push(filename);
					break;
				case 'D':
					summary.deleted.push(filename);
					break;
				case 'R':
					summary.renamed.push(filename);
					break;
				case '??':
					summary.untracked.push(filename);
					break;
				default:
					if (statusCode.includes('M')) {
						summary.modified.push(filename);
					}
			}
		});

		return summary;
	}

	async getBranchInfo() {
		try {
			// Current branch
			const { stdout: currentBranch } = await execAsync(
				'git rev-parse --abbrev-ref HEAD',
				{ cwd: this.projectRoot }
			);

			// All branches
			const { stdout: allBranches } = await execAsync('git branch -a', {
				cwd: this.projectRoot
			});

			// Check if ahead/behind remote
			let aheadBehind = null;
			try {
				const { stdout } = await execAsync(
					'git rev-list --left-right --count HEAD...@{upstream}',
					{ cwd: this.projectRoot }
				);
				const [ahead, behind] = stdout.trim().split('\t').map(Number);
				aheadBehind = { ahead, behind };
			} catch {
				// No upstream configured
			}

			return {
				current: currentBranch.trim(),
				all: allBranches
					.split('\n')
					.map((branch) => branch.replace(/^\*?\s*/, '').trim())
					.filter(
						(branch) => branch && !branch.startsWith('remotes/origin/HEAD')
					),
				aheadBehind
			};
		} catch (error) {
			return {
				error: error.message
			};
		}
	}

	async getRemoteInfo() {
		try {
			// Get all remotes
			const { stdout: remotes } = await execAsync('git remote -v', {
				cwd: this.projectRoot
			});

			// Get origin URL
			let originUrl = null;
			try {
				const { stdout } = await execAsync(
					'git config --get remote.origin.url',
					{ cwd: this.projectRoot }
				);
				originUrl = stdout.trim();
			} catch {
				// No origin configured
			}

			return {
				originUrl,
				allRemotes: remotes
					.trim()
					.split('\n')
					.map((line) => {
						const [name, url, type] = line.split(/\s+/);
						return { name, url, type: type?.replace(/[()]/g, '') };
					})
			};
		} catch (error) {
			return {
				error: error.message
			};
		}
	}

	/**
	 * Get diff context for recent changes
	 */
	async getRecentDiffs(commitCount = 3) {
		try {
			const commits = await this.getRecentCommits(commitCount);
			const diffs = await Promise.all(
				commits.map(async (commit) => {
					try {
						const { stdout } = await execAsync(
							`git show --stat ${commit.hash}`,
							{ cwd: this.projectRoot }
						);
						return {
							commit: commit.hash,
							message: commit.message,
							diff: stdout
						};
					} catch {
						return null;
					}
				})
			);

			return diffs.filter(Boolean);
		} catch (error) {
			return [];
		}
	}

	/**
	 * Format git context for display in CLAUDE.md
	 */
	formatForMarkdown(gitContext) {
		if (gitContext.error) {
			return `## Git Context\n\nError: ${gitContext.error}\n`;
		}

		let markdown = '## Git Context\n\n';

		// Branch info
		if (gitContext.branchInfo && !gitContext.branchInfo.error) {
			markdown += `**Current Branch:** ${gitContext.branchInfo.current}\n\n`;

			if (gitContext.branchInfo.aheadBehind) {
				const { ahead, behind } = gitContext.branchInfo.aheadBehind;
				if (ahead > 0) markdown += `⬆️ ${ahead} commits ahead of remote\n`;
				if (behind > 0) markdown += `⬇️ ${behind} commits behind remote\n`;
				markdown += '\n';
			}
		}

		// Remote info
		if (gitContext.remoteInfo && gitContext.remoteInfo.originUrl) {
			markdown += `**Remote:** ${gitContext.remoteInfo.originUrl}\n\n`;
		}

		// Current status
		if (gitContext.currentStatus && !gitContext.currentStatus.error) {
			const status = gitContext.currentStatus;
			if (status.hasUncommittedChanges) {
				markdown += '**Uncommitted Changes:**\n';
				if (status.statusSummary.modified.length > 0) {
					markdown += `- Modified: ${status.statusSummary.modified.join(', ')}\n`;
				}
				if (status.statusSummary.added.length > 0) {
					markdown += `- Added: ${status.statusSummary.added.join(', ')}\n`;
				}
				if (status.statusSummary.untracked.length > 0) {
					markdown += `- Untracked: ${status.statusSummary.untracked.join(', ')}\n`;
				}
				markdown += '\n';
			}
		}

		// Recent commits
		if (gitContext.recentCommits && gitContext.recentCommits.length > 0) {
			markdown += '**Recent Commits:**\n';
			gitContext.recentCommits.forEach((commit) => {
				markdown += `- \`${commit.hash}\` ${commit.message}\n`;
			});
			markdown += '\n';
		}

		return markdown;
	}
}
