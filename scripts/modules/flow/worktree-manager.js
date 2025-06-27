import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { getLogger } from '../../ui.js';

const logger = getLogger();

export class WorktreeManager {
	constructor(projectRoot) {
		this.projectRoot = projectRoot;
		this.configPath = path.join(projectRoot, '.taskmaster/worktrees.json');
		this.config = this.loadConfig();
	}

	loadConfig() {
		try {
			if (fs.existsSync(this.configPath)) {
				return fs.readJsonSync(this.configPath);
			}
		} catch (error) {
			logger.debug('Failed to load worktrees config:', error);
		}

		// Default config
		return {
			config: {
				worktreesRoot: '../claude-task-master-worktrees',
				defaultSourceBranch: 'main',
				autoCreateOnLaunch: true
			},
			worktrees: {}
		};
	}

	saveConfig() {
		fs.ensureDirSync(path.dirname(this.configPath));
		fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
	}

	async getOrCreateWorktreeForSubtask(taskId, subtaskId, options = {}) {
		const worktreeName = `task-${taskId}.${subtaskId}`;
		const existing = this.config.worktrees[worktreeName];

		if (existing && fs.existsSync(existing.path)) {
			// Update last accessed
			existing.lastAccessed = new Date().toISOString();
			this.saveConfig();

			return {
				exists: true,
				worktree: existing,
				created: false
			};
		}

		// Determine source branch
		const sourceBranch =
			options.sourceBranch || this.config.config.defaultSourceBranch || 'main';
		const worktreePath = this.getWorktreePath(worktreeName);

		logger.info(`Creating worktree for subtask ${taskId}.${subtaskId}...`);

		try {
			// Create worktree with new branch
			await this.createWorktree(worktreeName, worktreePath, sourceBranch);

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
			logger.error('Failed to create worktree:', error);
			throw error;
		}
	}

	async createWorktree(name, worktreePath, sourceBranch) {
		// Ensure worktrees root exists
		const worktreesRoot = path.dirname(worktreePath);
		await fs.ensureDir(worktreesRoot);

		// Check if branch already exists
		try {
			execSync(`git show-ref --verify --quiet refs/heads/${name}`, {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});
			// Branch exists, create worktree without -b flag
			execSync(`git worktree add "${worktreePath}" ${name}`, {
				cwd: this.projectRoot
			});
		} catch {
			// Branch doesn't exist, create with -b flag
			execSync(
				`git worktree add -b ${name} "${worktreePath}" ${sourceBranch}`,
				{ cwd: this.projectRoot }
			);
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

				// Create PR using gh cli
				const prTitle =
					options.prTitle ||
					`Task ${worktree.linkedSubtask.fullId}: ${worktree.linkedSubtask.title}`;
				const prBody =
					options.prBody ||
					`Completes subtask ${worktree.linkedSubtask.fullId}\n\n${options.prDescription || ''}`;

				const result = execSync(
					`gh pr create --title "${prTitle}" --body "${prBody}" --base ${worktree.sourceBranch}`,
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
				invalidWorktrees.push(name);
			}
		}

		invalidWorktrees.forEach((name) => {
			delete this.config.worktrees[name];
		});

		if (invalidWorktrees.length > 0) {
			this.saveConfig();
			logger.info(`Pruned ${invalidWorktrees.length} invalid worktree entries`);
		}

		return invalidWorktrees.length;
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
}
