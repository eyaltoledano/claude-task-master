import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { log } from '../utils.js';
import {
	initializeWorktreeCache,
	cleanupWorktreeCache,
	validateWorktreeCache
} from './ast/context/cache-manager.js';
import { GitWorkflowManager } from './services/GitWorkflowManager.js';
import { LocalMergeManager } from './services/LocalMergeManager.js';
import { TaskStatusManager } from './services/TaskStatusManager.js';
import { WorkflowValidator } from './services/WorkflowValidator.js';

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
		this.branchManager = null; // NEW: Will be set by Flow app

		// Initialize workflow managers
		this.gitWorkflowManager = new GitWorkflowManager(projectRoot);
		this.localMergeManager = new LocalMergeManager(projectRoot);
		this.taskStatusManager = new TaskStatusManager();
		this.workflowValidator = new WorkflowValidator();

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
					// Use dynamic project name instead of hardcoded value
					const projectName = path.basename(this.projectRoot);
					rawConfig.config.worktreesRoot = `../${projectName}-worktrees`;
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
		// Try to detect current branch more robustly for new repositories
		let defaultBranch = 'main';
		try {
			// First check if repository has any commits
			try {
				execSync('git rev-parse HEAD', {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});

				// Repository has commits, get current branch normally
				const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();

				if (currentBranch && currentBranch !== 'HEAD') {
					defaultBranch = currentBranch;
				}
			} catch {
				// No commits yet, try to detect the default branch name
				logger.debug(
					'Repository has no commits, detecting default branch name...'
				);

				try {
					// Try git branch --show-current (works even without commits)
					const currentBranch = execSync('git branch --show-current', {
						cwd: this.projectRoot,
						encoding: 'utf8'
					}).trim();

					if (currentBranch) {
						defaultBranch = currentBranch;
						logger.debug(`Detected default branch name: ${currentBranch}`);
					}
				} catch {
					// Try symbolic-ref as another fallback
					try {
						const ref = execSync('git symbolic-ref HEAD', {
							cwd: this.projectRoot,
							encoding: 'utf8'
						}).trim();

						const branchName = ref.replace('refs/heads/', '');
						if (branchName) {
							defaultBranch = branchName;
							logger.debug(`Detected branch from symbolic-ref: ${branchName}`);
						}
					} catch {
						// Final fallback to 'main'
						logger.debug(
							'Could not detect branch name, using "main" as default'
						);
						defaultBranch = 'main';
					}
				}
			}
		} catch (error) {
			logger.debug(
				'Could not detect current branch, using main as default:',
				error.message
			);
		}

		// Get project name from the project root directory
		const projectName = path.basename(this.projectRoot);
		const worktreesRoot = `../${projectName}-worktrees`;

		return {
			config: {
				worktreesRoot: worktreesRoot,
				defaultSourceBranch: defaultBranch,
				autoCreateOnLaunch: true,
				useBranchAwareness: true // Enable branch awareness integration
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
		const sourceBranch = this.getSourceBranch(options);

		logger.info(`Creating worktree for task ${taskId}...`);

		try {
			// Create worktree with new branch
			const worktreeResult = await this.createWorktree(
				worktreeName,
				worktreePath,
				sourceBranch
			);

			// Link to task
			const worktreeData = {
				path: worktreePath,
				branch: worktreeResult.branch, // Use the actual branch name returned
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
		const sourceBranch = this.getSourceBranch(options);

		logger.info(`Creating worktree for subtask ${taskId}.${subtaskId}...`);

		try {
			// Create worktree with new branch
			const worktreeResult = await this.createWorktree(
				worktreeName,
				worktreePath,
				sourceBranch
			);

			// Link to subtask
			const worktreeData = {
				path: worktreePath,
				branch: worktreeResult.branch, // Use the actual branch name returned
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
				execSync(`git worktree remove --force \"${worktreePath}\"`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
			} catch (error) {
				logger.debug('Git worktree remove failed, attempting manual cleanup');
				// Fallback to manual removal
				await fs.remove(worktreePath);
			}
		}

		// Detect if we're in a repository with no commits
		let hasCommits = false;
		let actualBranch = sourceBranch;

		try {
			execSync('git rev-parse HEAD', {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});
			hasCommits = true;
		} catch {
			hasCommits = false;
			logger.info(
				'Creating worktree in initial repository. Making initial commit first...'
			);
		}

		// If no commits, create initial commit first
		if (!hasCommits) {
			try {
				// Detect the actual current branch name (could be main, master, or custom)
				try {
					actualBranch = execSync('git branch --show-current', {
						cwd: this.projectRoot,
						encoding: 'utf8'
					}).trim();
				} catch {
					// Fallback to checking symbolic-ref
					try {
						const ref = execSync('git symbolic-ref HEAD', {
							cwd: this.projectRoot,
							encoding: 'utf8'
						}).trim();
						actualBranch = ref.replace('refs/heads/', '');
					} catch {
						// Last resort: use sourceBranch or default to main
						actualBranch = sourceBranch || 'main';
					}
				}

				// Create only minimal necessary files for git to work
				const gitignorePath = path.join(this.projectRoot, '.gitignore');

				if (!fs.existsSync(gitignorePath)) {
					await fs.writeFile(
						gitignorePath,
						'# Generated by Task Master Flow\nnode_modules/\n.env\n.taskmaster/\n*-worktrees/\n'
					);
				}

				// Create a minimal placeholder file if no files exist
				const files = await fs.readdir(this.projectRoot);
				const hasFiles = files.some(
					(file) => !file.startsWith('.') && file !== '.gitignore'
				);

				if (!hasFiles) {
					const placeholderPath = path.join(
						this.projectRoot,
						'.taskmaster-placeholder'
					);
					await fs.writeFile(
						placeholderPath,
						'This file allows git to create the initial commit. It can be safely deleted.\n'
					);

					// Add and commit the placeholder
					execSync('git add .gitignore .taskmaster-placeholder', {
						cwd: this.projectRoot,
						stdio: 'pipe'
					});
				} else {
					// Just add the .gitignore
					execSync('git add .gitignore', {
						cwd: this.projectRoot,
						stdio: 'pipe'
					});
				}

				execSync(
					'git commit -m "Initial commit (created by Task Master Flow)"',
					{
						cwd: this.projectRoot,
						stdio: 'pipe'
					}
				);

				logger.info(`Created initial commit on branch ${actualBranch}`);
			} catch (commitError) {
				throw new Error(
					`Failed to create initial commit: ${commitError.message}`
				);
			}
		}

		// Create worktree with a new branch (can't use same branch that's checked out)
		// Use the worktree name directly as the branch name for consistency
		let worktreeBranch = name;

		// Clean up any existing branch with this name first
		try {
			// Check if branch exists
			execSync(`git show-ref --verify --quiet refs/heads/${worktreeBranch}`, {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});

			// Branch exists, try to delete it
			logger.debug(
				`Branch ${worktreeBranch} already exists, attempting to delete it...`
			);

			try {
				// First try to force delete the branch
				execSync(`git branch -D ${worktreeBranch}`, {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});
				logger.debug(`Successfully deleted existing branch ${worktreeBranch}`);
			} catch (deleteError) {
				// If deletion fails, try a different branch name with timestamp
				const timestamp = Date.now();
				worktreeBranch = `${name}-${timestamp}`;
				logger.debug(
					`Could not delete existing branch, using ${worktreeBranch} instead`
				);
			}
		} catch {
			// Branch doesn't exist, which is good
			logger.debug(
				`Branch ${worktreeBranch} doesn't exist, proceeding with creation`
			);
		}

		try {
			logger.debug(
				`Creating worktree at ${worktreePath} with branch ${worktreeBranch} from ${actualBranch}`
			);

			const output = execSync(
				`git worktree add -b \"${worktreeBranch}\" \"${worktreePath}\" \"${actualBranch}\"`,
				{
					cwd: this.projectRoot,
					encoding: 'utf8',
					stdio: 'pipe'
				}
			);

			logger.info(`Created worktree ${name} at ${worktreePath}`);
			logger.debug(`Git worktree output: ${output}`);

			return {
				name,
				path: worktreePath,
				branch: worktreeBranch,
				sourceBranch: actualBranch,
				created: true
			};
		} catch (error) {
			const errorMessage = error.message || error.toString();

			if (
				errorMessage.includes('already exists') ||
				errorMessage.includes('already checked out')
			) {
				throw new Error(
					`Failed to create worktree: A branch named '${worktreeBranch}' already exists or '${actualBranch}' is already checked out. This may indicate a git state issue - try cleaning up existing worktrees manually.`
				);
			} else if (
				errorMessage.includes('not a valid object name') ||
				errorMessage.includes('invalid reference')
			) {
				throw new Error(
					`Failed to create worktree: The source branch "${actualBranch}" does not exist or has no commits. This often happens in new repositories. Please make sure the source branch exists and has at least one commit.`
				);
			} else {
				throw new Error(`Failed to create worktree: ${errorMessage}`);
			}
		}
	}

	async completeSubtask(worktreeName, options = {}) {
		const worktree = this.config.worktrees[worktreeName];
		if (!worktree) throw new Error('Worktree not found');

		try {
			// Step 1: Check git status using GitWorkflowManager
			const gitStatus = await this.gitWorkflowManager.validateCommitReadiness(
				worktree.path
			);

			if (gitStatus.hasUncommittedChanges && !options.autoCommit) {
				return {
					success: false,
					reason: 'uncommitted-changes',
					gitStatus,
					message:
						'Worktree has uncommitted changes that must be committed first',
					actions: ['commit-changes', 'auto-commit', 'discard-changes']
				};
			}

			// Step 2: Auto-commit if requested and there are changes
			if (gitStatus.hasUncommittedChanges && options.autoCommit) {
				const subtaskInfo = {
					id: worktree.linkedSubtask?.fullId || worktreeName,
					title: worktree.linkedSubtask?.title || 'Completed subtask',
					details: options.commitDetails || 'Implementation completed'
				};

				const commitResult =
					await this.gitWorkflowManager.commitSubtaskProgress(
						worktree.path,
						subtaskInfo,
						{
							customMessage: options.commitMessage,
							commitType: options.commitType || 'feat'
						}
					);

				if (!commitResult.success) {
					return {
						success: false,
						reason: 'commit-failed',
						error: commitResult.error,
						message: 'Failed to commit changes automatically'
					};
				}

				logger.success(`Committed changes: ${commitResult.commitHash}`);
			}

			// Step 3: Detect remote repository type
			let repoInfo = null;
			if (this.branchManager) {
				repoInfo = await this.branchManager.detectRemoteRepository();
			} else {
				// Fallback detection
				repoInfo = {
					hasRemote: false,
					isGitHub: false,
					canCreatePR: false
				};
			}

			// Step 4: Validate workflow readiness
			let validationResults = null;
			if (worktree.linkedSubtask) {
				validationResults = await this.workflowValidator.validateTaskReadyForPR(
					worktree.linkedSubtask.fullId
				);
			}

			// Step 5: Handle workflow choice
			if (
				options.workflowChoice === 'create-pr' &&
				repoInfo.isGitHub &&
				repoInfo.canCreatePR
			) {
				return await this.createPRWorkflow(
					worktreeName,
					worktree,
					options,
					repoInfo,
					validationResults
				);
			} else if (options.workflowChoice === 'merge-local') {
				return await this.localMergeWorkflow(worktreeName, worktree, options);
			} else if (options.createPR) {
				// Legacy support - if createPR is true, try PR creation
				if (repoInfo.isGitHub && repoInfo.canCreatePR) {
					return await this.createPRWorkflow(
						worktreeName,
						worktree,
						options,
						repoInfo,
						validationResults
					);
				} else {
					return {
						success: false,
						reason: 'pr-not-available',
						message: repoInfo.hasRemote
							? 'GitHub CLI not available for PR creation'
							: 'No GitHub remote detected',
						repoInfo
					};
				}
			} else {
				// No specific workflow choice - return options for user to choose
				const mergeOptions = await this.localMergeManager.offerMergeOptions(
					worktree,
					repoInfo
				);

				return {
					success: false,
					reason: 'workflow-choice-needed',
					options: mergeOptions,
					repoInfo,
					validation: validationResults,
					worktree: {
						name: worktreeName,
						path: worktree.path,
						branch: worktree.branch,
						linkedSubtask: worktree.linkedSubtask
					}
				};
			}
		} catch (error) {
			logger.error('Failed to complete subtask:', error);
			return {
				success: false,
				error: error.message,
				reason: 'workflow-error'
			};
		}
	}

	/**
	 * Handle PR creation workflow
	 */
	async createPRWorkflow(
		worktreeName,
		worktree,
		options,
		repoInfo,
		validationResults = null
	) {
		try {
			// Push the branch to remote
			const branchName = worktree.branch || worktreeName;
			logger.debug(`Pushing branch ${branchName} from ${worktree.path}`);

			try {
				execSync(`git push origin "${branchName}"`, {
					cwd: worktree.path,
					stdio: 'pipe'
				});
				logger.debug(`Successfully pushed branch ${branchName}`);
			} catch (pushError) {
				// Try to set upstream and push
				try {
					execSync(`git push --set-upstream origin "${branchName}"`, {
						cwd: worktree.path,
						stdio: 'pipe'
					});
					logger.debug(
						`Successfully pushed branch ${branchName} with --set-upstream`
					);
				} catch (upstreamError) {
					return {
						success: false,
						reason: 'push-failed',
						error: upstreamError.message,
						message: 'Failed to push branch to remote'
					};
				}
			}

			// Create PR using gh cli
			const prTitle =
				options.prTitle ||
				`Task ${worktree.linkedSubtask?.fullId || worktreeName}: ${worktree.linkedSubtask?.title || 'Completed'}`;
			const prBody =
				options.prBody ||
				`Completes subtask ${worktree.linkedSubtask?.fullId || worktreeName}\n\n${options.prDescription || ''}`;

			logger.debug(
				`Creating PR from branch ${branchName} to ${worktree.sourceBranch}`
			);

			const result = execSync(
				`gh pr create --title "${prTitle}" --body "${prBody}" --base ${worktree.sourceBranch} --head ${branchName}`,
				{ cwd: worktree.path, encoding: 'utf8' }
			);

			// Extract PR URL from output
			const prUrl = result.trim().split('\n').pop();

			// Update worktree status
			worktree.status = 'completed';
			worktree.completedAt = new Date().toISOString();
			worktree.prUrl = prUrl;
			this.saveConfig();

			// Update task status using TaskStatusManager
			if (worktree.linkedSubtask) {
				await this.taskStatusManager.updateStatusForWorkflowStep(
					worktree.linkedSubtask.fullId,
					'pr-created',
					{ prUrl, branch: branchName, commitHash: gitStatus.lastCommit }
				);
			}

			logger.success(`PR created: ${prUrl}`);

			return {
				success: true,
				workflowType: 'pr-created',
				prUrl,
				worktree,
				validation: validationResults,
				message: 'Pull request created successfully'
			};
		} catch (error) {
			if (error.message.includes('gh: command not found')) {
				return {
					success: false,
					reason: 'gh-cli-missing',
					message:
						'GitHub CLI (gh) is not installed. Please install it to create PRs automatically.',
					error: error.message
				};
			}

			return {
				success: false,
				reason: 'pr-creation-failed',
				error: error.message,
				message: 'Failed to create pull request'
			};
		}
	}

	/**
	 * Handle local merge workflow
	 */
	async localMergeWorkflow(worktreeName, worktree, options) {
		try {
			const targetBranch = options.targetBranch || 'main';

			// Perform local merge
			const mergeResult = await this.localMergeManager.performLocalMerge(
				worktree,
				targetBranch
			);

			if (!mergeResult.success) {
				return {
					success: false,
					reason: mergeResult.reason,
					details: mergeResult,
					message: mergeResult.error || 'Local merge failed'
				};
			}

			// Update worktree status
			worktree.status = 'completed';
			worktree.completedAt = new Date().toISOString();

			// Update task status using TaskStatusManager
			if (worktree.linkedSubtask) {
				await this.taskStatusManager.updateStatusForWorkflowStep(
					worktree.linkedSubtask.fullId,
					'merged',
					{
						branch: worktree.branch,
						targetBranch: mergeResult.targetBranch,
						mergeType: 'local'
					}
				);
			}

			// Remove from config if cleanup was successful
			if (mergeResult.cleanup.actions.includes('worktree-removed')) {
				delete this.config.worktrees[worktreeName];
			}

			this.saveConfig();

			logger.success(`Local merge completed: ${mergeResult.mergeCommit}`);

			return {
				success: true,
				workflowType: 'merged-locally',
				mergeCommit: mergeResult.mergeCommit,
				targetBranch: mergeResult.targetBranch,
				cleanup: mergeResult.cleanup,
				message: 'Changes merged locally and worktree cleaned up'
			};
		} catch (error) {
			return {
				success: false,
				reason: 'local-merge-failed',
				error: error.message,
				message: 'Failed to perform local merge'
			};
		}
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

	/**
	 * Set the branch awareness manager (called by Flow app)
	 */
	setBranchManager(branchManager) {
		this.branchManager = branchManager;
	}

	/**
	 * Set the direct backend (called by Flow app)
	 */
	setDirectBackend(directBackend) {
		this.directBackend = directBackend;
	}

	/**
	 * Get source branch using branch awareness if available
	 */
	getSourceBranch(options = {}) {
		// If specific source branch provided, use it
		if (options.sourceBranch) {
			return options.sourceBranch;
		}

		// If branch awareness is enabled and available, use it
		if (this.config.config.useBranchAwareness && this.branchManager) {
			const sourceBranch = this.branchManager.getSourceBranchForWorktree();
			if (sourceBranch) {
				logger.debug(`Using branch awareness source branch: ${sourceBranch}`);
				return sourceBranch;
			}
		}

		// Try to detect current branch if branch awareness is not available
		let detectedBranch = null;
		try {
			// Check if repository has any commits first
			try {
				execSync('git rev-parse HEAD', {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});

				// Repository has commits, get current branch
				const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();

				if (currentBranch && currentBranch !== 'HEAD') {
					detectedBranch = currentBranch;
					logger.debug(
						`Detected current branch for worktree source: ${detectedBranch}`
					);
				}
			} catch {
				// No commits yet, try to detect the default branch name
				logger.debug(
					'Repository has no commits, detecting default branch name for worktree...'
				);

				try {
					const currentBranch = execSync('git branch --show-current', {
						cwd: this.projectRoot,
						encoding: 'utf8'
					}).trim();

					if (currentBranch) {
						detectedBranch = currentBranch;
						logger.debug(
							`Detected default branch name for worktree: ${detectedBranch}`
						);
					}
				} catch {
					// Try symbolic-ref as fallback
					try {
						const ref = execSync('git symbolic-ref HEAD', {
							cwd: this.projectRoot,
							encoding: 'utf8'
						}).trim();

						const branchName = ref.replace('refs/heads/', '');
						if (branchName) {
							detectedBranch = branchName;
							logger.debug(
								`Detected branch from symbolic-ref for worktree: ${branchName}`
							);
						}
					} catch {
						logger.debug(
							'Could not detect any branch name for worktree source'
						);
					}
				}
			}
		} catch (error) {
			logger.debug(
				'Failed to detect current branch for worktree:',
				error.message
			);
		}

		// Use detected branch if available
		if (detectedBranch) {
			return detectedBranch;
		}

		// Fallback to configured default or 'main'
		const fallbackBranch = this.config.config.defaultSourceBranch || 'main';
		logger.debug(`Using fallback source branch: ${fallbackBranch}`);
		return fallbackBranch;
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
			const worktreeResult = await this.createWorktree(
				worktreeName,
				worktreePath,
				sourceBranch,
				true
			);

			// Link to subtask
			const worktreeData = {
				path: worktreePath,
				branch: worktreeResult.branch,
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

	/**
	 * Enhanced auto-cleanup integration for Phase 5
	 * Integrates with CleanupService for comprehensive lifecycle management
	 */
	async performIntelligentCleanup(worktreeName, options = {}) {
		const opts = {
			preserveUncommitted: true,
			backupBeforeCleanup: true,
			updateASTCache: true,
			updateTaskStatus: true,
			...options
		};

		try {
			// Import CleanupService for comprehensive cleanup
			const { CleanupService } = await import('./services/CleanupService.js');

			const cleanupService = new CleanupService({
				projectRoot: this.projectRoot,
				worktree: opts,
				astCache: { enabled: opts.updateASTCache },
				taskStatus: { enabled: opts.updateTaskStatus }
			});

			// Get worktree info
			const worktreeInfo = this.config.worktrees[worktreeName];
			if (!worktreeInfo) {
				return { success: true, skipped: 'Worktree not found in registry' };
			}

			// Prepare merge info for cleanup service
			const mergeInfo = {
				worktreeName,
				mergedBranch: worktreeInfo.branch,
				taskId: this.extractTaskIdFromWorktree(worktreeInfo),
				...options.mergeInfo
			};

			// Perform comprehensive cleanup
			const cleanupResult = await cleanupService.performPostMergeCleanup(
				options.prNumber || 'manual',
				mergeInfo
			);

			// Update worktree status in our config
			if (cleanupResult.success) {
				worktreeInfo.status = 'cleaned';
				worktreeInfo.cleanedAt = new Date().toISOString();
				worktreeInfo.cleanupResult = {
					actions: cleanupResult.worktree?.actions || [],
					astCacheInvalidated: cleanupResult.astCache?.invalidatedFiles || 0,
					taskStatusUpdated: !!cleanupResult.taskStatus?.actions?.length
				};
				this.saveConfig();
			}

			return cleanupResult;
		} catch (error) {
			logger.error('Intelligent cleanup failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Extract task ID from worktree info
	 */
	extractTaskIdFromWorktree(worktreeInfo) {
		// Check linkedSubtask first
		if (worktreeInfo.linkedSubtask?.fullId) {
			return worktreeInfo.linkedSubtask.fullId;
		}

		// Check linkedTask
		if (worktreeInfo.linkedTask?.fullId) {
			return worktreeInfo.linkedTask.fullId;
		}

		// Fallback to linkedTasks array
		if (worktreeInfo.linkedTasks?.length > 0) {
			return worktreeInfo.linkedTasks[0].id;
		}

		return null;
	}

	/**
	 * Enhanced worktree lifecycle management
	 */
	async manageWorktreeLifecycle(worktreeName, event, options = {}) {
		const worktreeInfo = this.config.worktrees[worktreeName];
		if (!worktreeInfo) {
			return { success: false, error: 'Worktree not found' };
		}

		const lifecycle = {
			event,
			timestamp: new Date().toISOString(),
			worktreeName,
			...options
		};

		try {
			switch (event) {
				case 'pr-created':
					return await this.handlePRCreated(worktreeInfo, lifecycle);
				case 'pr-merged':
					return await this.handlePRMerged(worktreeInfo, lifecycle);
				case 'session-completed':
					return await this.handleSessionCompleted(worktreeInfo, lifecycle);
				case 'cleanup-requested':
					return await this.handleCleanupRequested(worktreeInfo, lifecycle);
				default:
					return { success: false, error: `Unknown lifecycle event: ${event}` };
			}
		} catch (error) {
			logger.error(`Lifecycle management failed for ${event}:`, error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Handle PR created event
	 */
	async handlePRCreated(worktreeInfo, lifecycle) {
		worktreeInfo.prUrl = lifecycle.prUrl;
		worktreeInfo.prNumber = lifecycle.prNumber;
		worktreeInfo.status = 'pr-created';
		worktreeInfo.prCreatedAt = lifecycle.timestamp;

		this.saveConfig();

		return {
			success: true,
			action: 'pr-created',
			worktree: worktreeInfo
		};
	}

	/**
	 * Handle PR merged event with intelligent cleanup
	 */
	async handlePRMerged(worktreeInfo, lifecycle) {
		worktreeInfo.status = 'pr-merged';
		worktreeInfo.prMergedAt = lifecycle.timestamp;
		worktreeInfo.completedAt = lifecycle.timestamp;

		// Trigger intelligent cleanup if configured
		if (lifecycle.autoCleanup !== false) {
			const cleanupResult = await this.performIntelligentCleanup(
				lifecycle.worktreeName,
				{
					prNumber: lifecycle.prNumber,
					mergeInfo: lifecycle.mergeInfo || {}
				}
			);

			worktreeInfo.cleanupResult = cleanupResult;
		}

		this.saveConfig();

		return {
			success: true,
			action: 'pr-merged',
			worktree: worktreeInfo,
			cleanup: worktreeInfo.cleanupResult
		};
	}

	/**
	 * Handle session completed event
	 */
	async handleSessionCompleted(worktreeInfo, lifecycle) {
		worktreeInfo.lastSessionAt = lifecycle.timestamp;
		worktreeInfo.sessionResult = lifecycle.sessionResult || {};

		// Update status if session was successful
		if (lifecycle.sessionResult?.success) {
			worktreeInfo.status = 'session-completed';
		}

		this.saveConfig();

		return {
			success: true,
			action: 'session-completed',
			worktree: worktreeInfo
		};
	}

	/**
	 * Handle cleanup requested event
	 */
	async handleCleanupRequested(worktreeInfo, lifecycle) {
		const cleanupResult = await this.performIntelligentCleanup(
			lifecycle.worktreeName,
			lifecycle.cleanupOptions || {}
		);

		return {
			success: true,
			action: 'cleanup-requested',
			cleanup: cleanupResult
		};
	}

	/**
	 * Get worktree lifecycle status
	 */
	getWorktreeLifecycleStatus(worktreeName) {
		const worktreeInfo = this.config.worktrees[worktreeName];
		if (!worktreeInfo) {
			return null;
		}

		return {
			name: worktreeName,
			status: worktreeInfo.status,
			createdAt: worktreeInfo.createdAt,
			lastAccessed: worktreeInfo.lastAccessed,
			prCreatedAt: worktreeInfo.prCreatedAt,
			prMergedAt: worktreeInfo.prMergedAt,
			completedAt: worktreeInfo.completedAt,
			cleanedAt: worktreeInfo.cleanedAt,
			prUrl: worktreeInfo.prUrl,
			prNumber: worktreeInfo.prNumber,
			linkedTask: worktreeInfo.linkedTask || worktreeInfo.linkedSubtask,
			cleanupResult: worktreeInfo.cleanupResult
		};
	}
}
