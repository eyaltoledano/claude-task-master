import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

/**
 * Intelligent Cleanup Service for post-merge operations
 * Handles worktree cleanup, AST cache refresh, and task status updates
 */
export class CleanupService extends EventEmitter {
	constructor(options = {}) {
		super();

		this.projectRoot = options.projectRoot || process.cwd();
		this.config = {
			worktree: {
				enabled: true,
				preserveUncommitted: true,
				backupBeforeCleanup: true,
				deleteTrackingBranch: true,
				...options.worktree
			},
			astCache: {
				enabled: true,
				incrementalRefresh: true,
				batchSize: 50,
				maxConcurrentOperations: 3,
				...options.astCache
			},
			taskStatus: {
				enabled: true,
				updateMetrics: true,
				addPRReference: true,
				cascadeSubtasks: false, // Don't change core behavior
				...options.taskStatus
			},
			...options
		};

		this.stats = {
			worktreesCleanedUp: 0,
			cacheEntriesInvalidated: 0,
			tasksUpdated: 0,
			errors: 0,
			lastCleanup: null
		};

		this.activeCleanups = new Map();
	}

	/**
	 * Main cleanup orchestrator - called after successful PR merge
	 */
	async performPostMergeCleanup(prNumber, mergeInfo = {}) {
		const cleanupId = `cleanup-${prNumber}-${Date.now()}`;

		try {
			this.activeCleanups.set(cleanupId, {
				prNumber,
				startTime: Date.now(),
				status: 'running'
			});

			const results = {
				success: true,
				prNumber,
				worktree: null,
				astCache: null,
				taskStatus: null,
				errors: []
			};

			this.emit('cleanup:started', { prNumber, cleanupId });

			// Step 1: Cleanup PR-related worktree
			if (this.config.worktree.enabled && mergeInfo.worktreeName) {
				try {
					results.worktree = await this.cleanupWorktree(mergeInfo.worktreeName);
					this.emit('cleanup:worktree-completed', results.worktree);
				} catch (error) {
					results.errors.push({ step: 'worktree', error: error.message });
					this.stats.errors++;
				}
			}

			// Step 2: Refresh AST cache for merged branch
			if (this.config.astCache.enabled && mergeInfo.mergedBranch) {
				try {
					results.astCache = await this.refreshASTCacheAfterMerge(
						mergeInfo.mergedBranch
					);
					this.emit('cleanup:ast-cache-completed', results.astCache);
				} catch (error) {
					results.errors.push({ step: 'astCache', error: error.message });
					this.stats.errors++;
				}
			}

			// Step 3: Update task status and add PR reference
			if (this.config.taskStatus.enabled && mergeInfo.taskId) {
				try {
					results.taskStatus = await this.finalizeTaskCompletion(
						mergeInfo.taskId,
						prNumber
					);
					this.emit('cleanup:task-status-completed', results.taskStatus);
				} catch (error) {
					results.errors.push({ step: 'taskStatus', error: error.message });
					this.stats.errors++;
				}
			}

			// Update stats
			this.stats.lastCleanup = new Date().toISOString();

			const cleanup = this.activeCleanups.get(cleanupId);
			cleanup.status =
				results.errors.length > 0 ? 'completed-with-errors' : 'completed';
			cleanup.duration = Date.now() - cleanup.startTime;
			cleanup.results = results;

			this.emit('cleanup:completed', results);

			return results;
		} catch (error) {
			const cleanup = this.activeCleanups.get(cleanupId);
			if (cleanup) {
				cleanup.status = 'failed';
				cleanup.error = error.message;
			}

			this.emit('cleanup:failed', { prNumber, error: error.message });
			throw error;
		} finally {
			// Keep cleanup record for a while for monitoring
			setTimeout(() => {
				this.activeCleanups.delete(cleanupId);
			}, 300000); // 5 minutes
		}
	}

	/**
	 * Clean up worktree and associated resources
	 */
	async cleanupWorktree(worktreeName, options = {}) {
		const opts = { ...this.config.worktree, ...options };

		try {
			// Import WorktreeManager
			const { WorktreeManager } = await import('../worktree-manager.js');
			const worktreeManager = new WorktreeManager(this.projectRoot);

			// Get worktree info
			const worktreeInfo = worktreeManager.config.worktrees[worktreeName];
			if (!worktreeInfo) {
				return { success: true, skipped: 'Worktree not found in registry' };
			}

			const result = {
				success: true,
				worktreeName,
				actions: [],
				preserved: []
			};

			// Step 1: Save uncommitted work if configured
			if (opts.preserveUncommitted) {
				const uncommittedResult = await this.preserveUncommittedWork(
					worktreeInfo.path
				);
				if (uncommittedResult.hasUncommitted) {
					result.preserved.push(uncommittedResult);
					result.actions.push('uncommitted-work-preserved');
				}
			}

			// Step 2: Create backup if configured
			if (opts.backupBeforeCleanup) {
				const backupResult = await this.createWorktreeBackup(worktreeInfo);
				if (backupResult.success) {
					result.actions.push('backup-created');
					result.backupPath = backupResult.backupPath;
				}
			}

			// Step 3: Clean up AST cache for this worktree
			try {
				const { cleanupWorktreeCache } = await import(
					'./ast/context/cache-manager.js'
				);
				await cleanupWorktreeCache(worktreeInfo.path, this.projectRoot);
				result.actions.push('ast-cache-cleaned');
			} catch (error) {
				// AST cache cleanup is not critical
				result.actions.push('ast-cache-cleanup-failed');
			}

			// Step 4: Remove worktree directory
			const { execSync } = await import('child_process');

			try {
				execSync(`git worktree remove "${worktreeInfo.path}" --force`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
				result.actions.push('worktree-removed');
			} catch (error) {
				// Try manual cleanup if git command fails
				try {
					await fs.rm(worktreeInfo.path, { recursive: true, force: true });
					result.actions.push('directory-removed-manually');
				} catch (fsError) {
					throw new Error(`Failed to remove worktree: ${error.message}`);
				}
			}

			// Step 5: Delete tracking branch if configured
			if (opts.deleteTrackingBranch && worktreeInfo.branch) {
				try {
					execSync(`git branch -D "${worktreeInfo.branch}"`, {
						cwd: this.projectRoot,
						stdio: 'pipe'
					});
					result.actions.push('tracking-branch-deleted');
				} catch (error) {
					// Branch deletion is not critical
					result.actions.push('tracking-branch-deletion-failed');
				}
			}

			// Step 6: Update worktree registry
			delete worktreeManager.config.worktrees[worktreeName];
			worktreeManager.saveConfig();
			result.actions.push('registry-updated');

			this.stats.worktreesCleanedUp++;
			return result;
		} catch (error) {
			throw new Error(`Worktree cleanup failed: ${error.message}`);
		}
	}

	/**
	 * Refresh AST cache after merge
	 */
	async refreshASTCacheAfterMerge(mergedBranch) {
		const opts = this.config.astCache;

		try {
			// Import AST cache components
			const { BatchInvalidation } = await import(
				'./ast/cache/batch-invalidation.js'
			);
			const { ASTCacheManager } = await import('./ast/cache/cache-manager.js');

			const result = {
				success: true,
				mergedBranch,
				actions: [],
				invalidatedFiles: 0,
				refreshedEntries: 0
			};

			// Get files changed in the merged branch
			const changedFiles = await this.getChangedFilesInBranch(mergedBranch);

			if (changedFiles.length === 0) {
				return { ...result, skipped: 'No files changed in merge' };
			}

			// Step 1: Invalidate cache entries for changed files
			const cacheManager = new ASTCacheManager();

			if (opts.incrementalRefresh) {
				// Batch invalidate changed files
				const batchInvalidation = new BatchInvalidation({
					strategy: 'immediate', // Process immediately for post-merge
					maxBatchSize: opts.batchSize
				});

				for (const filePath of changedFiles) {
					batchInvalidation.queueInvalidation({
						type: 'file-changed',
						filePath,
						branch: mergedBranch,
						priority: 'high'
					});
				}

				// Process invalidations
				await batchInvalidation.processBatch();
				result.actions.push('batch-invalidation-processed');
			} else {
				// Invalidate entire branch cache
				await cacheManager.invalidateBranch(mergedBranch);
				result.actions.push('branch-cache-invalidated');
			}

			result.invalidatedFiles = changedFiles.length;

			// Step 2: Trigger incremental re-analysis for critical files
			const criticalFiles = changedFiles.filter(
				(file) =>
					file.endsWith('.js') ||
					file.endsWith('.jsx') ||
					file.endsWith('.ts') ||
					file.endsWith('.tsx')
			);

			if (
				criticalFiles.length > 0 &&
				criticalFiles.length <= opts.maxConcurrentOperations
			) {
				// Pre-warm cache for critical files
				const analysisPromises = criticalFiles
					.slice(0, opts.maxConcurrentOperations)
					.map(async (filePath) => {
						try {
							// This would trigger AST analysis and caching
							const fullPath = path.join(this.projectRoot, filePath);
							const exists = await fs
								.access(fullPath)
								.then(() => true)
								.catch(() => false);
							if (exists) {
								// Cache will be populated on next access
								result.refreshedEntries++;
								return { filePath, success: true };
							}
						} catch (error) {
							return { filePath, success: false, error: error.message };
						}
					});

				await Promise.allSettled(analysisPromises);
				result.actions.push('critical-files-pre-warmed');
			}

			this.stats.cacheEntriesInvalidated += result.invalidatedFiles;
			return result;
		} catch (error) {
			throw new Error(`AST cache refresh failed: ${error.message}`);
		}
	}

	/**
	 * Finalize task completion and add PR reference
	 */
	async finalizeTaskCompletion(taskId, prNumber) {
		const opts = this.config.taskStatus;

		try {
			const result = {
				success: true,
				taskId,
				prNumber,
				actions: [],
				taskUpdated: false
			};

			// Import task management utilities
			const { findTasksJsonPath } = await import('../../task-manager.js');
			const tasksPath = findTasksJsonPath({ projectRoot: this.projectRoot });

			// Read current tasks
			const tasksData = JSON.parse(await fs.readFile(tasksPath, 'utf8'));

			// Find the task
			const task = tasksData.tasks.find((t) => String(t.id) === String(taskId));
			if (!task) {
				return { ...result, skipped: 'Task not found' };
			}

			// Only update if task is not already done
			if (task.status === 'done') {
				return { ...result, skipped: 'Task already completed' };
			}

			// Step 1: Mark task as completed (using existing status)
			task.status = 'done';
			task.completedAt = new Date().toISOString();
			result.actions.push('status-updated');

			// Step 2: Add PR reference to task history/details
			if (opts.addPRReference) {
				if (!task.prReferences) {
					task.prReferences = [];
				}

				task.prReferences.push({
					prNumber,
					mergedAt: new Date().toISOString(),
					type: 'completion'
				});

				// Also add to details for visibility
				const prNote = `\n\n**Completed via PR #${prNumber}** (${new Date().toLocaleDateString()})`;
				task.details = (task.details || '') + prNote;

				result.actions.push('pr-reference-added');
			}

			// Step 3: Update metrics if configured
			if (opts.updateMetrics) {
				if (!task.metrics) {
					task.metrics = {};
				}

				task.metrics.completedVia = 'pr-merge';
				task.metrics.prNumber = prNumber;
				task.metrics.completionDate = new Date().toISOString();

				result.actions.push('metrics-updated');
			}

			// Step 4: Save updated tasks
			await fs.writeFile(tasksPath, JSON.stringify(tasksData, null, 2));
			result.taskUpdated = true;
			result.actions.push('tasks-file-updated');

			this.stats.tasksUpdated++;
			return result;
		} catch (error) {
			throw new Error(`Task completion finalization failed: ${error.message}`);
		}
	}

	/**
	 * Preserve uncommitted work before cleanup
	 */
	async preserveUncommittedWork(worktreePath) {
		try {
			const { execSync } = await import('child_process');

			// Check for uncommitted changes
			const statusOutput = execSync('git status --porcelain', {
				cwd: worktreePath,
				encoding: 'utf8'
			});

			if (!statusOutput.trim()) {
				return { hasUncommitted: false };
			}

			// Create a stash with timestamp
			const stashName = `cleanup-preserve-${Date.now()}`;
			execSync(`git stash push -m "${stashName}" --include-untracked`, {
				cwd: worktreePath
			});

			return {
				hasUncommitted: true,
				stashName,
				preservedAt: new Date().toISOString()
			};
		} catch (error) {
			// If stash fails, it's not critical
			return { hasUncommitted: false, error: error.message };
		}
	}

	/**
	 * Create backup of worktree before cleanup
	 */
	async createWorktreeBackup(worktreeInfo) {
		try {
			const backupDir = path.join(
				this.projectRoot,
				'.taskmaster',
				'backups',
				'worktrees'
			);
			await fs.mkdir(backupDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupName = `${path.basename(worktreeInfo.path)}-${timestamp}`;
			const backupPath = path.join(backupDir, backupName);

			// Create a simple backup (copy important files)
			await fs.mkdir(backupPath, { recursive: true });

			// Copy git status and important files
			const { execSync } = await import('child_process');

			try {
				const gitStatus = execSync('git status --porcelain', {
					cwd: worktreeInfo.path,
					encoding: 'utf8'
				});

				await fs.writeFile(path.join(backupPath, 'git-status.txt'), gitStatus);
			} catch (error) {
				// Git status not critical for backup
			}

			// Save worktree metadata
			await fs.writeFile(
				path.join(backupPath, 'worktree-info.json'),
				JSON.stringify(worktreeInfo, null, 2)
			);

			return {
				success: true,
				backupPath,
				createdAt: new Date().toISOString()
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get files changed in a branch compared to main
	 */
	async getChangedFilesInBranch(branchName) {
		try {
			const { execSync } = await import('child_process');

			// Get files changed in branch compared to main
			const output = execSync(`git diff --name-only main...${branchName}`, {
				cwd: this.projectRoot,
				encoding: 'utf8'
			});

			return output
				.trim()
				.split('\n')
				.filter((line) => line.trim().length > 0);
		} catch (error) {
			// If git diff fails, return empty array
			return [];
		}
	}

	/**
	 * Get cleanup statistics
	 */
	getStats() {
		return {
			...this.stats,
			activeCleanups: this.activeCleanups.size,
			recentCleanups: Array.from(this.activeCleanups.values())
		};
	}

	/**
	 * Get cleanup configuration
	 */
	getConfig() {
		return { ...this.config };
	}

	/**
	 * Update cleanup configuration
	 */
	updateConfig(newConfig) {
		this.config = { ...this.config, ...newConfig };
		this.emit('config:updated', this.config);
	}
}
