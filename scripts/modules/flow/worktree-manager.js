import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { log } from '../utils.js';
import { 
	initializeWorktreeCache, 
	cleanupWorktreeCache, 
	validateWorktreeCache 
} from './ast/context/cache-manager.js';

const logger = {
	info: (msg) => log('info', msg),
	error: (msg) => log('error', msg),
	debug: (msg) => log('debug', msg),
	success: (msg) => log('success', msg)
};

export class WorktreeManager {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.configPath = path.join(projectRoot, '.taskmaster/worktrees.json');
		this.config = this.loadConfig();

		// Ensure the config file exists on disk
		if (!fs.existsSync(this.configPath)) {
			this.saveConfig();
		}
	}

	loadConfig() {
		try {
			if (fs.existsSync(this.configPath)) {
				const rawConfig = fs.readJsonSync(this.configPath);

				// Check if this is the old structure with version field
				if (rawConfig.version && !rawConfig.config) {
					logger.debug('Migrating old worktrees config format to new format');
					const newConfig = this.getDefaultConfig();
					// Preserve any existing worktrees
					newConfig.worktrees = rawConfig.worktrees || {};
					// Save the migrated config
					this.config = newConfig;
					this.saveConfig();
					return newConfig;
				}

				// Validate the config structure
				if (!rawConfig.config || typeof rawConfig.config !== 'object') {
					logger.debug('Invalid config structure, using defaults');
					return this.getDefaultConfig();
				}

				// Ensure all required fields exist
				if (!rawConfig.config.worktreesRoot) {
					rawConfig.config.worktreesRoot = '../claude-task-master-worktrees';
				}
				if (!rawConfig.config.defaultSourceBranch) {
					rawConfig.config.defaultSourceBranch = 'main';
				}
				if (rawConfig.config.autoCreateOnLaunch === undefined) {
					rawConfig.config.autoCreateOnLaunch = true;
				}
				if (!rawConfig.worktrees) {
					rawConfig.worktrees = {};
				}

				return rawConfig;
			}
		} catch (error) {
			logger.debug('Failed to load worktrees config:', error);
		}

		// Return default config
		return this.getDefaultConfig();
	}

	getDefaultConfig() {
		// Try to detect current branch
		let defaultBranch = 'main';
		try {
			const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			}).trim();
			if (currentBranch && currentBranch !== 'HEAD') {
				defaultBranch = currentBranch;
			}
		} catch (error) {
			logger.debug('Could not detect current branch, using main as default');
		}

		return {
			config: {
				worktreesRoot: '../claude-task-master-worktrees',
				defaultSourceBranch: defaultBranch,
				autoCreateOnLaunch: true
			},
			worktrees: {}
		};
	}

	saveConfig() {
		fs.ensureDirSync(path.dirname(this.configPath));
		fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
	}

	async getOrCreateWorktreeForTask(taskId, options = {}) {
		const worktreeName = `task-${taskId}`;
		const existing = this.config.worktrees[worktreeName];
		const worktreePath = this.getWorktreePath(worktreeName);

		// Check if worktree exists in our config and on disk
		if (existing && fs.existsSync(existing.path)) {
			// Update last accessed
			existing.lastAccessed = new Date().toISOString();
			this.saveConfig();

			// Validate AST cache for the existing worktree
			try {
				await validateWorktreeCache(existing.path, this.projectRoot);
			} catch (error) {
				logger.debug(
					'Failed to validate AST cache for worktree:',
					error.message
				);
			}

			return {
				exists: true,
				worktree: existing,
				created: false
			};
		}

		// Check if branch exists in git
		let branchExists = false;
		let branchInUseByOtherWorktree = null;

		try {
			execSync(`git show-ref --verify --quiet refs/heads/${worktreeName}`, {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});
			branchExists = true;

			// Check if branch is used by another worktree
			const worktreeList = execSync('git worktree list --porcelain', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			});

			const lines = worktreeList.split('\n');
			let currentPath = '';
			for (const line of lines) {
				if (line.startsWith('worktree ')) {
					currentPath = line.substring(9);
				} else if (
					line.startsWith('branch refs/heads/') &&
					line.includes(worktreeName)
				) {
					if (currentPath !== worktreePath) {
						branchInUseByOtherWorktree = currentPath;
						break;
					}
				}
			}
		} catch {
			// Branch doesn't exist, this is fine
		}

		// If branch exists but is in use by another worktree, return conflict info
		if (branchExists && branchInUseByOtherWorktree) {
			return {
				exists: false,
				branchExists: true,
				branchName: worktreeName,
				branchInUseAt: branchInUseByOtherWorktree,
				worktreePath: worktreePath,
				worktreeName: worktreeName,
				needsUserDecision: true
			};
		}

		// If branch exists but is orphaned (not in use), we'll reuse it automatically
		if (branchExists && !branchInUseByOtherWorktree) {
			logger.info(`Found orphaned branch ${worktreeName}, reusing it...`);
		}

		// Check if worktree directory already exists on disk (but not in our config)
		if (fs.existsSync(worktreePath)) {
			logger.info(
				`Worktree directory already exists at ${worktreePath}, cleaning up...`
			);
			try {
				// Try to remove the existing worktree directory
				await fs.remove(worktreePath);
			} catch (error) {
				logger.error(
					`Failed to clean up existing worktree directory: ${error.message}`
				);
				throw new Error(
					`Worktree directory already exists at ${worktreePath} and could not be cleaned up`
				);
			}
		}

		// Create new worktree
		const sourceBranch =
			options.sourceBranch || this.config.config.defaultSourceBranch || 'main';

		logger.info(`Creating worktree for task ${taskId}...`);

		try {
			// Create worktree with new branch
			const actualBranchName = await this.createWorktree(
				worktreeName,
				worktreePath,
				sourceBranch
			);

			// Link to task
			const worktreeData = {
				path: worktreePath,
				branch: actualBranchName, // Use the actual branch name returned
				sourceBranch,
				linkedTask: {
					taskId,
					fullId: `${taskId}`,
					title: options.taskTitle || ''
				},
				// Also include linkedTasks array for backwards compatibility
				linkedTasks: [
					{
						id: `${taskId}`,
						type: 'task',
						tag: options.tag || 'master'
					}
				],
				status: 'active',
				createdAt: new Date().toISOString(),
				lastAccessed: new Date().toISOString(),
				completedAt: null,
				prUrl: null
			};

			this.config.worktrees[worktreeName] = worktreeData;
			this.saveConfig();

			// Initialize AST cache for the new worktree
			try {
				await initializeWorktreeCache(worktreePath, this.projectRoot);
			} catch (error) {
				logger.debug(
					'Failed to initialize AST cache for worktree:',
					error.message
				);
			}

			return {
				exists: false,
				worktree: worktreeData,
				created: true
			};
		} catch (error) {
			logger.error('Failed to create worktree:', error);
			throw error;
		}
	}

	async getOrCreateWorktreeForSubtask(taskId, subtaskId, options = {}) {
		const worktreeName = `task-${taskId}.${subtaskId}`;
		const existing = this.config.worktrees[worktreeName];
		const worktreePath = this.getWorktreePath(worktreeName);

		// Check if worktree exists in our config and on disk
		if (existing && fs.existsSync(existing.path)) {
			// Update last accessed
			existing.lastAccessed = new Date().toISOString();
			this.saveConfig();

			// Validate AST cache for the existing worktree
			try {
				await validateWorktreeCache(existing.path, this.projectRoot);
			} catch (error) {
				logger.debug(
					'Failed to validate AST cache for worktree:',
					error.message
				);
			}

			return {
				exists: true,
				worktree: existing,
				created: false
			};
		}

		// Check if branch exists in git
		let branchExists = false;
		let branchInUseByOtherWorktree = null;

		try {
			execSync(`git show-ref --verify --quiet refs/heads/${worktreeName}`, {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});
			branchExists = true;

			// Check if branch is used by another worktree
			const worktreeList = execSync('git worktree list --porcelain', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			});

			const lines = worktreeList.split('\n');
			let currentPath = '';
			for (const line of lines) {
				if (line.startsWith('worktree ')) {
					currentPath = line.substring(9);
				} else if (
					line.startsWith('branch refs/heads/') &&
					line.includes(worktreeName)
				) {
					if (currentPath !== worktreePath) {
						branchInUseByOtherWorktree = currentPath;
						break;
					}
				}
			}
		} catch {
			// Branch doesn't exist, this is fine
		}

		// If branch exists but is in use by another worktree, return conflict info
		if (branchExists && branchInUseByOtherWorktree) {
			return {
				exists: false,
				branchExists: true,
				branchName: worktreeName,
				branchInUseAt: branchInUseByOtherWorktree,
				worktreePath: worktreePath,
				worktreeName: worktreeName,
				needsUserDecision: true
			};
		}

		// If branch exists but is orphaned (not in use), we'll reuse it automatically
		if (branchExists && !branchInUseByOtherWorktree) {
			logger.info(`Found orphaned branch ${worktreeName}, reusing it...`);
		}

		// Check if worktree directory already exists on disk (but not in our config)
		if (fs.existsSync(worktreePath)) {
			logger.info(
				`Worktree directory already exists at ${worktreePath}, cleaning up...`
			);
			try {
				// Try to remove the existing worktree directory
				await fs.remove(worktreePath);
			} catch (error) {
				logger.error(
					`Failed to clean up existing worktree directory: ${error.message}`
				);
				throw new Error(
					`Worktree directory already exists at ${worktreePath} and could not be cleaned up`
				);
			}
		}

		// Create new worktree
		const sourceBranch =
			options.sourceBranch || this.config.config.defaultSourceBranch || 'main';

		logger.info(`Creating worktree for subtask ${taskId}.${subtaskId}...`);

		try {
			// Create worktree with new branch
			const actualBranchName = await this.createWorktree(
				worktreeName,
				worktreePath,
				sourceBranch
			);

			// Link to subtask
			const worktreeData = {
				path: worktreePath,
				branch: actualBranchName, // Use the actual branch name returned
				sourceBranch,
				linkedSubtask: {
					taskId,
					subtaskId,
					fullId: `${taskId}.${subtaskId}`,
					title: options.subtaskTitle || ''
				},
				// Also include linkedTasks array for backwards compatibility
				linkedTasks: [
					{
						id: `${taskId}.${subtaskId}`,
						type: 'subtask',
						tag: options.tag || 'master'
					}
				],
				status: 'active',
				createdAt: new Date().toISOString(),
				lastAccessed: new Date().toISOString(),
				completedAt: null,
				prUrl: null
			};

			this.config.worktrees[worktreeName] = worktreeData;
			this.saveConfig();

			// Initialize AST cache for the new worktree
			try {
				await initializeWorktreeCache(worktreePath, this.projectRoot);
			} catch (error) {
				logger.debug(
					'Failed to initialize AST cache for worktree:',
					error.message
				);
			}

			return {
				exists: false,
				worktree: worktreeData,
				created: true
			};
		} catch (error) {
			logger.error('Failed to create worktree:', error);
			throw error;
		}
	}

	async createWorktree(name, worktreePath, sourceBranch, forceCreate = false) {
		// Ensure worktrees root exists
		const worktreesRoot = path.dirname(worktreePath);
		await fs.ensureDir(worktreesRoot);

		// Check if worktree directory already exists and clean it up
		if (fs.existsSync(worktreePath)) {
			logger.info(
				`Worktree directory ${worktreePath} already exists, cleaning up...`
			);
			try {
				// Try to remove via git first
				execSync(`git worktree remove --force "${worktreePath}"`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			} catch (error) {
				logger.debug('Git worktree remove failed, attempting manual cleanup');
				try {
					await fs.remove(worktreePath);
				} catch (fsError) {
					logger.error(
						`Failed to clean up existing worktree directory: ${fsError.message}`
					);
					throw new Error(
						`Worktree directory already exists at ${worktreePath} and could not be cleaned up`
					);
				}
			}
		}

		// Simple creation - the calling method handles any cleanup if needed
		try {
			if (forceCreate) {
				// Force create with -b flag
				execSync(
					`git worktree add -b ${name} "${worktreePath}" ${sourceBranch}`,
					{
						cwd: this.projectRoot,
						stdio: 'pipe'
					}
				);
			} else {
				// Check if branch exists
				let branchExists = false;
				try {
					execSync(`git show-ref --verify --quiet refs/heads/${name}`, {
						cwd: this.projectRoot,
						stdio: 'ignore'
					});
					branchExists = true;
				} catch {
					branchExists = false;
				}

				if (branchExists) {
					// Branch exists, create worktree without -b flag
					execSync(`git worktree add "${worktreePath}" ${name}`, {
						cwd: this.projectRoot,
						stdio: 'pipe'
					});
				} else {
					// Branch doesn't exist, create with -b flag
					execSync(
						`git worktree add -b ${name} "${worktreePath}" ${sourceBranch}`,
						{
							cwd: this.projectRoot,
							stdio: 'pipe'
						}
					);
				}
			}

			return name;
		} catch (error) {
			logger.error(`Failed to create worktree: ${error.message}`);
			throw error;
		}
	}

	async completeSubtask(worktreeName, options = {}) {
		const worktree = this.config.worktrees[worktreeName];
		if (!worktree) throw new Error('Worktree not found');

		worktree.status = 'completed';
		worktree.completedAt = new Date().toISOString();

		if (options.createPR) {
			try {
				// Check if gh cli is available
				execSync('gh --version', { stdio: 'ignore' });

				// First, commit any uncommitted changes
				try {
					// Check if there are changes to commit
					const statusOutput = execSync('git status --porcelain', { 
						cwd: worktree.path, 
						encoding: 'utf8' 
					});
					
					if (statusOutput.trim()) {
						logger.debug(`Found uncommitted changes: ${statusOutput.split('\n').length} files`);
						
						// Stage all changes
						execSync('git add -A', { cwd: worktree.path, stdio: 'pipe' });
						
						const prTitle =
							options.prTitle ||
							`Task ${worktree.linkedSubtask.fullId}: ${worktree.linkedSubtask.title}`;
						
						// Commit with a proper message
						const commitMessage = prTitle.replace(/"/g, '\\"'); // Escape quotes
						execSync(`git commit -m "${commitMessage}"`, { cwd: worktree.path, stdio: 'pipe' });
						logger.debug('Successfully committed changes');
					} else {
						logger.debug('No changes to commit');
					}
				} catch (commitError) {
					// Check if it's actually an error or just no changes
					if (commitError.message.includes('nothing to commit')) {
						logger.debug('Nothing to commit, working tree clean');
					} else {
						logger.warn('Commit failed:', commitError.message);
						// Don't throw here, as we might still be able to create a PR
					}
				}

				// Push the branch to remote (this handles the "must first push" error)
				const branchName = worktree.branch || worktreeName;
				logger.debug(`Pushing branch ${branchName} from ${worktree.path}`);
				
				// First check current branch
				try {
					const currentBranch = execSync('git branch --show-current', { 
						cwd: worktree.path, 
						encoding: 'utf8' 
					}).trim();
					logger.debug(`Current branch in worktree: ${currentBranch}`);
					
					// Make sure we're on the right branch
					if (currentBranch !== branchName) {
						logger.warn(`Branch mismatch: expected ${branchName}, got ${currentBranch}`);
					}
				} catch (e) {
					logger.debug('Could not determine current branch:', e.message);
				}
				
				try {
					execSync(`git push origin "${branchName}"`, { cwd: worktree.path, stdio: 'pipe' });
					logger.debug(`Successfully pushed branch ${branchName}`);
				} catch (pushError) {
					// Try to set upstream and push
					try {
						execSync(`git push --set-upstream origin "${branchName}"`, { cwd: worktree.path, stdio: 'pipe' });
						logger.debug(`Successfully pushed branch ${branchName} with --set-upstream`);
					} catch (upstreamError) {
						logger.error('Failed to push branch:', upstreamError.message);
						throw new Error(`Failed to push branch to remote: ${upstreamError.message}`);
					}
				}

				// Create PR using gh cli
				const prTitle =
					options.prTitle ||
					`Task ${worktree.linkedSubtask.fullId}: ${worktree.linkedSubtask.title}`;
				const prBody =
					options.prBody ||
					`Completes subtask ${worktree.linkedSubtask.fullId}\n\n${options.prDescription || ''}`;

				// Always use --head flag to explicitly specify the branch
				// This avoids issues with uncommitted changes or git state
				logger.debug(`Creating PR from branch ${branchName} to ${worktree.sourceBranch}`);

				const result = execSync(
					`gh pr create --title "${prTitle}" --body "${prBody}" --base ${worktree.sourceBranch} --head ${branchName}`,
					{ cwd: worktree.path, encoding: 'utf8' }
				);

				// Extract PR URL from output
				const prUrl = result.trim().split('\n').pop();
				worktree.prUrl = prUrl;

				logger.success(`PR created: ${prUrl}`);
			} catch (error) {
				if (error.message.includes('gh: command not found')) {
					throw new Error(
						'GitHub CLI (gh) is not installed. Please install it to create PRs automatically.'
					);
				}
				throw error;
			}
		}

		this.saveConfig();
		return worktree;
	}

	getWorktreePath(name) {
		const worktreesRoot = path.resolve(
			this.projectRoot,
			this.config.config.worktreesRoot
		);
		return path.join(worktreesRoot, name);
	}

	getWorktreeForSubtask(taskId, subtaskId) {
		const worktreeName = `task-${taskId}.${subtaskId}`;
		return this.config.worktrees[worktreeName];
	}

	getAllWorktrees() {
		return Object.values(this.config.worktrees);
	}

	getSubtaskWorktrees(taskId) {
		return Object.values(this.config.worktrees).filter(
			(w) => w.linkedSubtask && w.linkedSubtask.taskId === taskId
		);
	}

	updateConfig(updates) {
		this.config.config = { ...this.config.config, ...updates };
		this.saveConfig();
	}

	async pruneInvalidWorktrees() {
		const invalidWorktrees = [];

		for (const [name, worktree] of Object.entries(this.config.worktrees)) {
			if (!fs.existsSync(worktree.path)) {
				invalidWorktrees.push({ name, worktree });
			}
		}

		// Clean up AST cache for invalid worktrees
		for (const { name, worktree } of invalidWorktrees) {
			try {
				await cleanupWorktreeCache(worktree.path, this.projectRoot);
			} catch (error) {
				logger.debug(`Failed to cleanup AST cache for ${name}:`, error.message);
			}
			delete this.config.worktrees[name];
		}

		if (invalidWorktrees.length > 0) {
			this.saveConfig();
			logger.info(`Pruned ${invalidWorktrees.length} invalid worktree entries`);
		}

		return invalidWorktrees.length;
	}

	async cleanupStaleWorktrees() {
		try {
			logger.info('Cleaning up stale worktrees...');

			// First, prune git's worktree list
			try {
				execSync('git worktree prune', {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			} catch (error) {
				logger.debug('Git worktree prune failed:', error.message);
			}

			// Get list of all worktrees from git
			const worktreeList = execSync('git worktree list --porcelain', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			});

			// Parse git worktrees
			const gitWorktrees = new Map();
			const lines = worktreeList.split('\n');
			let currentPath = '';
			for (const line of lines) {
				if (line.startsWith('worktree ')) {
					currentPath = line.substring(9);
				} else if (line.startsWith('branch refs/heads/') && currentPath) {
					const branch = line.substring(18);
					gitWorktrees.set(branch, currentPath);
				}
			}

			// Clean up our config - remove entries for non-existent worktrees
			let removedCount = 0;
			for (const [name, worktree] of Object.entries(this.config.worktrees)) {
				if (!fs.existsSync(worktree.path)) {
					logger.info(`Removing stale worktree entry: ${name}`);
					
					// Clean up AST cache for the stale worktree
					try {
						await cleanupWorktreeCache(worktree.path, this.projectRoot);
					} catch (error) {
						logger.debug(
							`Failed to cleanup AST cache for ${name}:`,
							error.message
						);
					}
					
					delete this.config.worktrees[name];
					removedCount++;
				}
			}

			if (removedCount > 0) {
				this.saveConfig();
				logger.success(`Removed ${removedCount} stale worktree entries`);
			}

			// Clean up orphaned branches (branches without worktrees)
			try {
				const allBranches = execSync('git branch --format="%(refname:short)"', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				})
					.trim()
					.split('\n');

				for (const branch of allBranches) {
					// Skip if it's a task branch pattern and has no worktree
					if (branch.match(/^task-\d+\.\d+/) && !gitWorktrees.has(branch)) {
						// Check if we have it in our config
						const hasInConfig = Object.values(this.config.worktrees).some(
							(w) => w.branch === branch
						);

						if (!hasInConfig) {
							logger.info(`Deleting orphaned branch: ${branch}`);
							try {
								execSync(`git branch -D ${branch}`, {
									cwd: this.projectRoot,
									stdio: 'ignore'
								});
							} catch (e) {
								logger.debug(`Could not delete branch ${branch}:`, e.message);
							}
						}
					}
				}
			} catch (error) {
				logger.debug('Could not clean up branches:', error.message);
			}

			return { success: true, removed: removedCount };
		} catch (error) {
			logger.error('Cleanup failed:', error);
			return { success: false, error: error.message };
		}
	}

	async switchSourceBranch(worktreeName, newSourceBranch) {
		const worktree = this.config.worktrees[worktreeName];
		if (!worktree) throw new Error('Worktree not found');

		worktree.sourceBranch = newSourceBranch;
		this.saveConfig();

		// Note: This doesn't actually change the git branch base,
		// it just updates our tracking for future PR creation
		return worktree;
	}

	async forceCreateWorktree(taskId, subtaskId, options = {}) {
		const worktreeName = `task-${taskId}.${subtaskId}`;
		const worktreePath = this.getWorktreePath(worktreeName);
		const sourceBranch =
			options.sourceBranch || this.config.config.defaultSourceBranch || 'main';

		// First clean up any existing branch/worktree
		await this.cleanupBranchAndWorktree(worktreeName, worktreePath);

		logger.info(
			`Force creating worktree for subtask ${taskId}.${subtaskId}...`
		);

		try {
			// Create fresh worktree
			const actualBranchName = await this.createWorktree(
				worktreeName,
				worktreePath,
				sourceBranch,
				true
			);

			// Link to subtask
			const worktreeData = {
				path: worktreePath,
				branch: actualBranchName,
				sourceBranch,
				linkedSubtask: {
					taskId,
					subtaskId,
					fullId: `${taskId}.${subtaskId}`,
					title: options.subtaskTitle || ''
				},
				linkedTasks: [
					{
						id: `${taskId}.${subtaskId}`,
						type: 'subtask',
						tag: options.tag || 'master'
					}
				],
				status: 'active',
				createdAt: new Date().toISOString(),
				lastAccessed: new Date().toISOString(),
				completedAt: null,
				prUrl: null
			};

			this.config.worktrees[worktreeName] = worktreeData;
			this.saveConfig();

			return {
				exists: false,
				worktree: worktreeData,
				created: true
			};
		} catch (error) {
			logger.error('Failed to force create worktree:', error);
			throw error;
		}
	}

	async useExistingBranch(taskId, subtaskId, options = {}) {
		const worktreeName = `task-${taskId}.${subtaskId}`;
		const worktreePath = this.getWorktreePath(worktreeName);

		logger.info(`Using existing branch ${worktreeName} for worktree...`);

		try {
			// Create worktree from existing branch
			await fs.ensureDir(path.dirname(worktreePath));
			execSync(`git worktree add "${worktreePath}" ${worktreeName}`, {
				cwd: this.projectRoot,
				stdio: 'pipe'
			});

			// Get source branch info
			const sourceBranch =
				options.sourceBranch ||
				this.config.config.defaultSourceBranch ||
				'main';

			// Link to subtask
			const worktreeData = {
				path: worktreePath,
				branch: worktreeName,
				sourceBranch,
				linkedSubtask: {
					taskId,
					subtaskId,
					fullId: `${taskId}.${subtaskId}`,
					title: options.subtaskTitle || ''
				},
				linkedTasks: [
					{
						id: `${taskId}.${subtaskId}`,
						type: 'subtask',
						tag: options.tag || 'master'
					}
				],
				status: 'active',
				createdAt: new Date().toISOString(),
				lastAccessed: new Date().toISOString(),
				completedAt: null,
				prUrl: null
			};

			this.config.worktrees[worktreeName] = worktreeData;
			this.saveConfig();

			return {
				exists: false,
				worktree: worktreeData,
				created: true,
				reusedBranch: true
			};
		} catch (error) {
			logger.error('Failed to use existing branch:', error);
			throw error;
		}
	}

	async cleanupBranchAndWorktree(branchName, worktreePath) {
		// Remove worktree if it exists
		if (fs.existsSync(worktreePath)) {
			try {
				execSync(`git worktree remove --force "${worktreePath}"`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			} catch (error) {
				logger.debug('Git worktree remove failed, attempting manual cleanup');
				await fs.remove(worktreePath);
			}
		}

		// Check if branch is in use by another worktree
		try {
			const worktreeList = execSync('git worktree list --porcelain', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			});

			const lines = worktreeList.split('\n');
			let currentPath = '';
			for (const line of lines) {
				if (line.startsWith('worktree ')) {
					currentPath = line.substring(9);
				} else if (
					line.startsWith('branch refs/heads/') &&
					line.includes(branchName)
				) {
					if (currentPath !== worktreePath) {
						logger.info(
							`Branch ${branchName} is in use by another worktree, removing it...`
						);
						try {
							execSync(`git worktree remove --force "${currentPath}"`, {
								cwd: this.projectRoot,
								stdio: 'pipe'
							});
						} catch (e) {
							logger.debug('Could not remove other worktree');
						}
					}
				}
			}
		} catch (error) {
			logger.debug('Could not check worktree list:', error.message);
		}

		// Delete the branch
		try {
			execSync(`git branch -D ${branchName}`, {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});
		} catch (error) {
			logger.debug(`Could not delete branch ${branchName}:`, error.message);
		}
	}
}
