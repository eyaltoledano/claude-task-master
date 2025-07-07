/**
 * Local Merge Manager for Task Master Flow
 * Handles local git merges when GitHub remotes don't exist or PR creation isn't desired
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class LocalMergeManager {
	constructor(projectRoot, options = {}) {
		this.projectRoot = projectRoot;
		this.options = {
			autoCleanupAfterMerge: true,
			validateBeforeMerge: true,
			requireCleanWorkingDirectory: true,
			defaultTargetBranch: 'main',
			...options
		};
	}

	/**
	 * Present merge options based on repository state and worktree info
	 * @param {Object} worktreeInfo - Worktree information
	 * @param {Object} repoInfo - Repository information from BranchAwarenessManager
	 * @returns {Promise<Object>} Available merge options
	 */
	async offerMergeOptions(worktreeInfo, repoInfo) {
		try {
			const validation = await this.validateMergeReadiness(worktreeInfo);

			const options = {
				canCreatePR: repoInfo.isGitHub && repoInfo.canCreatePR,
				canMergeLocal: true,
				canKeepWorking: true,
				validation,
				recommendations: []
			};

			// Add recommendations based on state
			if (!validation.ready) {
				options.recommendations.push({
					type: 'warning',
					message: 'Uncommitted changes detected',
					action: 'commit-first'
				});
			}

			if (repoInfo.isGitHub && !repoInfo.canCreatePR) {
				options.recommendations.push({
					type: 'info',
					message: 'GitHub CLI not available for PR creation',
					action: 'install-gh-cli'
				});
			}

			if (!repoInfo.hasRemote) {
				options.recommendations.push({
					type: 'info',
					message: 'No remote repository detected - local merge only',
					action: 'local-merge-only'
				});
			}

			return options;
		} catch (error) {
			return {
				canCreatePR: false,
				canMergeLocal: false,
				canKeepWorking: true,
				error: error.message
			};
		}
	}

	/**
	 * Perform local merge of worktree branch
	 * @param {Object} worktreeInfo - Worktree information
	 * @param {string} targetBranch - Target branch to merge into
	 * @returns {Promise<Object>} Merge result
	 */
	async performLocalMerge(worktreeInfo, targetBranch = null) {
		try {
			const target = targetBranch || this.options.defaultTargetBranch;
			const sourceBranch = worktreeInfo.branch;

			// Step 1: Validate merge readiness
			const validation = await this.validateMergeReadiness(worktreeInfo);
			if (!validation.ready) {
				return {
					success: false,
					reason: 'validation-failed',
					validation
				};
			}

			// Step 2: Ensure all changes are committed in worktree
			const commitStatus = await this.ensureChangesCommitted(worktreeInfo);
			if (!commitStatus.success) {
				return {
					success: false,
					reason: 'uncommitted-changes',
					details: commitStatus
				};
			}

			// Step 3: Switch to target branch in main repository
			const originalBranch = await this.getCurrentBranch();
			await this.switchToTargetBranch(target);

			try {
				// Step 4: Pull latest changes from remote (if exists)
				await this.pullLatestChanges(target);

				// Step 5: Merge worktree branch
				const mergeResult = await this.executeMerge(sourceBranch, target);

				if (!mergeResult.success) {
					// Restore original branch on merge failure
					await this.switchToTargetBranch(originalBranch);
					return mergeResult;
				}

				// Step 6: Clean up after successful merge
				const cleanup = await this.cleanupAfterMerge(worktreeInfo, {
					targetBranch: target,
					sourceBranch,
					originalBranch
				});

				return {
					success: true,
					mergeCommit: mergeResult.commitHash,
					targetBranch: target,
					sourceBranch,
					filesChanged: mergeResult.filesChanged,
					cleanup
				};
			} catch (error) {
				// Restore original branch on any error
				try {
					await this.switchToTargetBranch(originalBranch);
				} catch {
					// Ignore restoration errors
				}
				throw error;
			}
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Validate if worktree is ready for merge
	 * @param {Object} worktreeInfo - Worktree information
	 * @returns {Promise<Object>} Validation result
	 */
	async validateMergeReadiness(worktreeInfo) {
		try {
			const issues = [];
			const warnings = [];

			// Check if worktree exists
			try {
				await fs.access(worktreeInfo.path);
			} catch {
				issues.push('Worktree directory does not exist');
			}

			// Check git status in worktree
			try {
				const status = execSync('git status --porcelain', {
					cwd: worktreeInfo.path,
					encoding: 'utf8'
				}).trim();

				if (status && this.options.requireCleanWorkingDirectory) {
					issues.push('Worktree has uncommitted changes');
				} else if (status) {
					warnings.push(
						'Worktree has uncommitted changes that will be included'
					);
				}
			} catch (error) {
				issues.push(`Cannot check git status: ${error.message}`);
			}

			// Check if branch exists
			try {
				execSync(
					`git show-ref --verify --quiet refs/heads/${worktreeInfo.branch}`,
					{
						cwd: this.projectRoot,
						stdio: 'ignore'
					}
				);
			} catch {
				issues.push(`Source branch '${worktreeInfo.branch}' does not exist`);
			}

			// Check if target branch exists
			const targetBranch = this.options.defaultTargetBranch;
			try {
				execSync(`git show-ref --verify --quiet refs/heads/${targetBranch}`, {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});
			} catch {
				warnings.push(
					`Target branch '${targetBranch}' does not exist - will be created`
				);
			}

			return {
				ready: issues.length === 0,
				issues,
				warnings,
				worktreePath: worktreeInfo.path,
				sourceBranch: worktreeInfo.branch,
				targetBranch
			};
		} catch (error) {
			return {
				ready: false,
				issues: [`Validation failed: ${error.message}`],
				warnings: []
			};
		}
	}

	/**
	 * Ensure all changes in worktree are committed
	 * @param {Object} worktreeInfo - Worktree information
	 * @returns {Promise<Object>} Commit status
	 */
	async ensureChangesCommitted(worktreeInfo) {
		try {
			const status = execSync('git status --porcelain', {
				cwd: worktreeInfo.path,
				encoding: 'utf8'
			}).trim();

			if (!status) {
				return {
					success: true,
					message: 'No uncommitted changes'
				};
			}

			// If there are uncommitted changes and we're not auto-committing
			if (this.options.requireCleanWorkingDirectory) {
				return {
					success: false,
					reason: 'uncommitted-changes',
					message:
						'Worktree has uncommitted changes that must be committed first',
					uncommittedFiles: status.split('\n')
				};
			}

			// Auto-commit if allowed (this would typically be handled by GitWorkflowManager)
			return {
				success: true,
				message: 'Uncommitted changes will be included in merge',
				warning: true
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get current branch in main repository
	 * @returns {Promise<string>} Current branch name
	 */
	async getCurrentBranch() {
		try {
			const branch = execSync('git rev-parse --abbrev-ref HEAD', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			}).trim();

			return branch === 'HEAD' ? null : branch;
		} catch (error) {
			throw new Error(`Failed to get current branch: ${error.message}`);
		}
	}

	/**
	 * Switch to target branch in main repository
	 * @param {string} targetBranch - Branch to switch to
	 * @returns {Promise<void>}
	 */
	async switchToTargetBranch(targetBranch) {
		try {
			// Check if branch exists
			try {
				execSync(`git show-ref --verify --quiet refs/heads/${targetBranch}`, {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});

				// Branch exists, switch to it
				execSync(`git checkout ${targetBranch}`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			} catch {
				// Branch doesn't exist, create it
				execSync(`git checkout -b ${targetBranch}`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			}
		} catch (error) {
			throw new Error(
				`Failed to switch to branch '${targetBranch}': ${error.message}`
			);
		}
	}

	/**
	 * Pull latest changes from remote
	 * @param {string} branch - Branch to pull
	 * @returns {Promise<void>}
	 */
	async pullLatestChanges(branch) {
		try {
			// Check if remote exists
			try {
				execSync('git remote get-url origin', {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});

				// Remote exists, try to pull
				execSync(`git pull origin ${branch}`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			} catch {
				// No remote or pull failed, continue without pulling
			}
		} catch (error) {
			// Don't fail the merge if pull fails
			console.debug(`Failed to pull latest changes: ${error.message}`);
		}
	}

	/**
	 * Execute the actual merge
	 * @param {string} sourceBranch - Branch to merge from
	 * @param {string} targetBranch - Branch to merge into
	 * @returns {Promise<Object>} Merge result
	 */
	async executeMerge(sourceBranch, targetBranch) {
		try {
			// Create merge commit
			execSync(
				`git merge ${sourceBranch} --no-ff -m "Merge branch '${sourceBranch}' into ${targetBranch}"`,
				{
					cwd: this.projectRoot,
					stdio: 'pipe'
				}
			);

			// Get merge commit hash
			const commitHash = execSync('git rev-parse HEAD', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			}).trim();

			// Get number of files changed
			const diffStat = execSync(`git diff --stat HEAD~1 HEAD`, {
				cwd: this.projectRoot,
				encoding: 'utf8'
			});

			const filesChanged =
				diffStat.match(/\d+ files? changed/)?.[0] || '0 files changed';

			return {
				success: true,
				commitHash,
				filesChanged,
				mergeMessage: `Merged ${sourceBranch} into ${targetBranch}`
			};
		} catch (error) {
			// Check if it's a merge conflict
			if (
				error.message.includes('CONFLICT') ||
				error.message.includes('conflict')
			) {
				return {
					success: false,
					reason: 'merge-conflict',
					message: 'Merge conflicts detected - manual resolution required',
					error: error.message
				};
			}

			return {
				success: false,
				reason: 'merge-failed',
				error: error.message
			};
		}
	}

	/**
	 * Clean up after successful merge
	 * @param {Object} worktreeInfo - Worktree information
	 * @param {Object} mergeInfo - Merge information
	 * @returns {Promise<Object>} Cleanup result
	 */
	async cleanupAfterMerge(worktreeInfo, mergeInfo) {
		const cleanup = {
			actions: [],
			warnings: []
		};

		try {
			if (this.options.autoCleanupAfterMerge) {
				// Remove worktree
				try {
					execSync(`git worktree remove ${worktreeInfo.path}`, {
						cwd: this.projectRoot,
						stdio: 'pipe'
					});
					cleanup.actions.push('worktree-removed');
				} catch (error) {
					cleanup.warnings.push(`Failed to remove worktree: ${error.message}`);
				}

				// Delete source branch
				try {
					execSync(`git branch -d ${mergeInfo.sourceBranch}`, {
						cwd: this.projectRoot,
						stdio: 'pipe'
					});
					cleanup.actions.push('source-branch-deleted');
				} catch (error) {
					cleanup.warnings.push(
						`Failed to delete source branch: ${error.message}`
					);
				}
			} else {
				cleanup.actions.push('manual-cleanup-required');
			}

			return cleanup;
		} catch (error) {
			cleanup.warnings.push(`Cleanup error: ${error.message}`);
			return cleanup;
		}
	}

	/**
	 * Check if local merge is possible
	 * @param {Object} worktreeInfo - Worktree information
	 * @returns {Promise<boolean>} True if local merge is possible
	 */
	async canPerformLocalMerge(worktreeInfo) {
		try {
			const validation = await this.validateMergeReadiness(worktreeInfo);
			return validation.ready || validation.issues.length === 0;
		} catch {
			return false;
		}
	}

	/**
	 * Get merge preview information
	 * @param {Object} worktreeInfo - Worktree information
	 * @param {string} targetBranch - Target branch
	 * @returns {Promise<Object>} Merge preview
	 */
	async getMergePreview(worktreeInfo, targetBranch = null) {
		try {
			const target = targetBranch || this.options.defaultTargetBranch;

			// Get diff between branches
			const diffOutput = execSync(
				`git diff ${target}..${worktreeInfo.branch} --stat`,
				{
					cwd: this.projectRoot,
					encoding: 'utf8'
				}
			);

			// Get commit count
			const commitCount = execSync(
				`git rev-list --count ${target}..${worktreeInfo.branch}`,
				{
					cwd: this.projectRoot,
					encoding: 'utf8'
				}
			).trim();

			return {
				targetBranch: target,
				sourceBranch: worktreeInfo.branch,
				commitsAhead: parseInt(commitCount, 10),
				diffStat: diffOutput.trim(),
				canMerge: await this.canPerformLocalMerge(worktreeInfo)
			};
		} catch (error) {
			return {
				error: error.message,
				canMerge: false
			};
		}
	}
}
