/**
 * Branch Awareness Manager for Task Master Flow
 * Simple branch tracking without complex UI - follows git workflow patterns
 */

import { execSync } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { flowConfig } from '../config/flow-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BranchAwarenessManager extends EventEmitter {
	constructor(projectRoot, options = {}) {
		super();

		this.projectRoot = projectRoot;
		this.flowConfig = flowConfig;

		this.options = {
			enabled: true,
			rememberLastBranch: true,
			autoDetectBranchSwitch: true,
			maxHistorySize: 10,
			...options
		};

		this.currentBranch = null;
		this.lastWorkingBranch = null;
		this.branchHistory = [];
		this.isGitRepo = false;
		this.repositoryName = null;

		// Initialize on creation
		this.initialize();
	}

	/**
	 * Initialize branch awareness system
	 */
	async initialize() {
		try {
			// Check if we're in a git repository
			this.isGitRepo = await this.checkIsGitRepository();

			if (this.isGitRepo) {
				// Detect repository name
				await this.detectRepositoryName();

				// Load saved state
				await this.loadSavedState();

				// Detect current branch
				await this.detectCurrentBranch();

				// Save initial state
				await this.saveState();

				this.emit('initialized', {
					currentBranch: this.currentBranch,
					repositoryName: this.repositoryName,
					lastWorkingBranch: this.lastWorkingBranch
				});
			} else {
				this.emit('initialized', {
					currentBranch: null,
					repositoryName: null,
					lastWorkingBranch: null
				});
			}
		} catch (error) {
			console.debug('Branch awareness initialization failed:', error.message);
			this.emit('initialized', {
				currentBranch: null,
				repositoryName: null,
				lastWorkingBranch: null
			});
		}
	}

	/**
	 * Check if current directory is a git repository
	 */
	async checkIsGitRepository() {
		try {
			execSync('git rev-parse --git-dir', {
				cwd: this.projectRoot,
				stdio: 'ignore'
			});
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Detect repository name from remote origin or directory name
	 */
	async detectRepositoryName() {
		if (!this.isGitRepo) {
			this.repositoryName = null;
			return;
		}

		try {
			// Try to get repository name from remote origin URL
			try {
				const remoteUrl = execSync('git remote get-url origin', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();

				// Parse repository name from various URL formats
				// Examples:
				// https://github.com/user/repo.git -> repo
				// git@github.com:user/repo.git -> repo
				// https://github.com/user/repo -> repo
				let repoName = remoteUrl;

				// Remove .git suffix
				if (repoName.endsWith('.git')) {
					repoName = repoName.slice(0, -4);
				}

				// Extract repo name from URL
				const urlMatch = repoName.match(/[\/:]([^\/]+)$/);
				if (urlMatch) {
					this.repositoryName = urlMatch[1];
					return;
				}
			} catch {
				// No remote origin, fall back to directory name
			}

			// Fallback: use directory name
			const projectName = path.basename(this.projectRoot);
			this.repositoryName = projectName;
		} catch (error) {
			console.debug('Failed to detect repository name:', error.message);
			// Final fallback: use directory name
			this.repositoryName = path.basename(this.projectRoot);
		}
	}

	/**
	 * Detect current branch
	 */
	async detectCurrentBranch() {
		if (!this.isGitRepo) return null;

		try {
			// First check if we have any commits at all
			try {
				execSync('git rev-parse HEAD', {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});
			} catch {
				// No commits yet, try to get the default branch name
				try {
					const branch = execSync('git branch --show-current', {
						cwd: this.projectRoot,
						encoding: 'utf8'
					}).trim();

					if (branch) {
						this.currentBranch = branch;
						return this.currentBranch;
					}
				} catch {
					// Fallback to checking symbolic-ref
					try {
						const ref = execSync('git symbolic-ref HEAD', {
							cwd: this.projectRoot,
							encoding: 'utf8'
						}).trim();

						const branch = ref.replace('refs/heads/', '');
						if (branch) {
							this.currentBranch = branch;
							return this.currentBranch;
						}
					} catch {
						// Still no luck, repository might be in initial state
						console.debug(
							'Repository appears to be in initial state with no commits'
						);
						this.currentBranch = null;
						return null;
					}
				}
			}

			// Normal case: repository has commits
			const branch = execSync('git rev-parse --abbrev-ref HEAD', {
				cwd: this.projectRoot,
				encoding: 'utf8'
			}).trim();

			const previousBranch = this.currentBranch;
			this.currentBranch = branch === 'HEAD' ? null : branch;

			// If branch changed, update history
			if (previousBranch && previousBranch !== this.currentBranch) {
				this.addToHistory(previousBranch);
				this.emit('branchChanged', {
					from: previousBranch,
					to: this.currentBranch
				});
			}

			return this.currentBranch;
		} catch (error) {
			console.debug('Failed to detect current branch:', error.message);
			this.currentBranch = null;
			return null;
		}
	}

	/**
	 * Get current branch information with metadata
	 */
	async getCurrentBranchInfo() {
		if (!this.isGitRepo) {
			return null;
		}

		try {
			const info = {
				name: this.currentBranch,
				isDetached: false,
				ahead: 0,
				behind: 0,
				trackingBranch: null,
				hasUncommittedChanges: false,
				lastCommit: null
			};

			// Check if detached HEAD or no current branch
			if (!this.currentBranch) {
				info.isDetached = true;
				return info;
			}

			// Check if repository has any commits
			try {
				execSync('git rev-parse HEAD', {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});
			} catch {
				// No commits yet, return basic info
				return info;
			}

			// Get tracking branch info
			try {
				const trackingBranch = execSync(
					'git rev-parse --abbrev-ref --symbolic-full-name @{u}',
					{
						cwd: this.projectRoot,
						encoding: 'utf8'
					}
				).trim();
				info.trackingBranch = trackingBranch;

				// Get ahead/behind counts
				const revListOutput = execSync(
					'git rev-list --left-right --count HEAD...@{u}',
					{
						cwd: this.projectRoot,
						encoding: 'utf8'
					}
				).trim();
				const [ahead, behind] = revListOutput.split('\t').map(Number);
				info.ahead = ahead || 0;
				info.behind = behind || 0;
			} catch {
				// No tracking branch
			}

			// Check for uncommitted changes
			try {
				const status = execSync('git status --porcelain', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();
				info.hasUncommittedChanges = status.length > 0;
			} catch {
				// Error checking status
			}

			// Get last commit info
			try {
				const lastCommit = execSync('git log -1 --format="%h %s" HEAD', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();
				info.lastCommit = lastCommit;
			} catch {
				// No commits or error
			}

			return info;
		} catch (error) {
			console.debug('Failed to get branch info:', error.message);
			return null;
		}
	}

	/**
	 * Add branch to history
	 */
	addToHistory(branchName) {
		if (!branchName || branchName === this.currentBranch) return;

		// Remove if already in history
		this.branchHistory = this.branchHistory.filter(
			(b) => b.name !== branchName
		);

		// Add to front
		this.branchHistory.unshift({
			name: branchName,
			lastUsed: new Date().toISOString()
		});

		// Trim to max size
		if (this.branchHistory.length > this.options.maxHistorySize) {
			this.branchHistory = this.branchHistory.slice(
				0,
				this.options.maxHistorySize
			);
		}
	}

	/**
	 * Update last working branch
	 */
	setLastWorkingBranch(branchName) {
		if (branchName && branchName !== this.lastWorkingBranch) {
			this.lastWorkingBranch = branchName;
			this.addToHistory(branchName);
		}
	}

	/**
	 * Load saved state from flow config
	 */
	async loadSavedState() {
		try {
			await this.flowConfig.initialize(this.projectRoot);

			this.lastWorkingBranch = await this.flowConfig.getValue(
				'branchAwareness.lastWorkingBranch'
			);
			this.branchHistory = await this.flowConfig.getValue(
				'branchAwareness.branchHistory',
				[]
			);
		} catch (error) {
			console.debug('Failed to load branch awareness state:', error.message);
		}
	}

	/**
	 * Save state to flow config
	 */
	async saveState() {
		if (!this.options.rememberLastBranch) return;

		try {
			await this.flowConfig.initialize(this.projectRoot);

			await this.flowConfig.setValue(
				'branchAwareness.currentBranch',
				this.currentBranch
			);
			await this.flowConfig.setValue(
				'branchAwareness.lastWorkingBranch',
				this.lastWorkingBranch
			);
			await this.flowConfig.setValue(
				'branchAwareness.branchHistory',
				this.branchHistory
			);
			await this.flowConfig.setValue(
				'branchAwareness.lastUpdated',
				new Date().toISOString()
			);

			await this.flowConfig.saveConfig();
		} catch (error) {
			console.debug('Failed to save branch awareness state:', error.message);
		}
	}

	/**
	 * Get branch summary for display
	 */
	getBranchSummary() {
		return {
			isGitRepo: this.isGitRepo,
			repositoryName: this.repositoryName,
			currentBranch: this.currentBranch,
			lastWorkingBranch: this.lastWorkingBranch,
			recentBranches: this.branchHistory.slice(0, 3).map((b) => b.name),
			hasHistory: this.branchHistory.length > 0
		};
	}

	/**
	 * Refresh branch detection (call periodically or on focus)
	 */
	async refresh() {
		if (!this.isGitRepo) return;

		await this.detectCurrentBranch();
		await this.saveState();
	}

	/**
	 * Get worktree-compatible source branch
	 * This is what the existing worktree system should use
	 */
	getSourceBranchForWorktree() {
		// Return current branch if available, fallback to last working branch, then 'main'
		return this.currentBranch || this.lastWorkingBranch || 'main';
	}

	/**
	 * Mark current branch as actively being worked on
	 */
	async markBranchAsWorking() {
		if (this.currentBranch) {
			this.setLastWorkingBranch(this.currentBranch);
			await this.saveState();
		}
	}

	/**
	 * Detect remote repository information
	 * @returns {Promise<Object>} Remote repository information
	 */
	async detectRemoteRepository() {
		if (!this.isGitRepo) {
			return {
				hasRemote: false,
				provider: null,
				url: null,
				isGitHub: false,
				canCreatePR: false
			};
		}

		try {
			// Check for origin remote
			const remoteUrl = execSync('git remote get-url origin', {
				cwd: this.projectRoot,
				encoding: 'utf8',
				stdio: 'pipe'
			}).trim();

			// Parse URL to determine provider
			const provider = this.parseRemoteProvider(remoteUrl);
			const isGitHub = provider === 'github';

			// Check if GitHub CLI is available for PR creation
			let canCreatePR = false;
			if (isGitHub) {
				try {
					execSync('gh --version', { stdio: 'ignore' });
					canCreatePR = true;
				} catch {
					canCreatePR = false;
				}
			}

			return {
				hasRemote: true,
				provider,
				url: remoteUrl,
				isGitHub,
				canCreatePR,
				repositoryName: this.repositoryName
			};
		} catch (error) {
			// No remote origin
			return {
				hasRemote: false,
				provider: null,
				url: null,
				isGitHub: false,
				canCreatePR: false,
				error: error.message
			};
		}
	}

	/**
	 * Check if repository is GitHub
	 * @returns {Promise<boolean>} True if repository is GitHub
	 */
	async isGitHubRepository() {
		const remoteInfo = await this.detectRemoteRepository();
		return remoteInfo.isGitHub;
	}

	/**
	 * Get detailed remote information
	 * @returns {Promise<Object>} Detailed remote information
	 */
	async getRemoteInfo() {
		const remoteInfo = await this.detectRemoteRepository();

		if (!remoteInfo.hasRemote) {
			return remoteInfo;
		}

		try {
			// Get all remotes
			const remotesOutput = execSync('git remote -v', {
				cwd: this.projectRoot,
				encoding: 'utf8',
				stdio: 'pipe'
			});

			const remotes = remotesOutput
				.trim()
				.split('\n')
				.map((line) => {
					const [name, url, type] = line.split(/\s+/);
					return { name, url, type: type?.replace(/[()]/g, '') };
				});

			// Check if we can push to origin
			let canPush = false;
			try {
				execSync('git push --dry-run origin HEAD', {
					cwd: this.projectRoot,
					stdio: 'ignore'
				});
				canPush = true;
			} catch {
				canPush = false;
			}

			return {
				...remoteInfo,
				remotes,
				canPush,
				defaultBranch: await this.getDefaultBranch()
			};
		} catch (error) {
			return {
				...remoteInfo,
				error: error.message
			};
		}
	}

	/**
	 * Check if can create pull requests
	 * @returns {Promise<boolean>} True if PR creation is possible
	 */
	async canCreatePullRequests() {
		const remoteInfo = await this.detectRemoteRepository();
		return remoteInfo.canCreatePR;
	}

	/**
	 * Parse remote URL to determine provider
	 * @param {string} url - Remote URL
	 * @returns {string} Provider name
	 */
	parseRemoteProvider(url) {
		if (!url) return null;

		const lowerUrl = url.toLowerCase();

		if (lowerUrl.includes('github.com')) {
			return 'github';
		} else if (lowerUrl.includes('gitlab.com') || lowerUrl.includes('gitlab')) {
			return 'gitlab';
		} else if (
			lowerUrl.includes('bitbucket.org') ||
			lowerUrl.includes('bitbucket')
		) {
			return 'bitbucket';
		} else if (
			lowerUrl.includes('azure.com') ||
			lowerUrl.includes('visualstudio.com')
		) {
			return 'azure';
		} else {
			return 'unknown';
		}
	}

	/**
	 * Get default branch of the repository
	 * @returns {Promise<string>} Default branch name
	 */
	async getDefaultBranch() {
		try {
			// Try to get default branch from remote
			const output = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
				cwd: this.projectRoot,
				encoding: 'utf8',
				stdio: 'pipe'
			}).trim();

			const branch = output.replace('refs/remotes/origin/', '');
			return branch;
		} catch {
			// Fallback: check common default branches
			const commonDefaults = ['main', 'master', 'develop'];

			for (const branch of commonDefaults) {
				try {
					execSync(
						`git show-ref --verify --quiet refs/remotes/origin/${branch}`,
						{
							cwd: this.projectRoot,
							stdio: 'ignore'
						}
					);
					return branch;
				} catch {
					// Branch doesn't exist, try next one
				}
			}

			// Final fallback
			return 'main';
		}
	}

	/**
	 * Check if GitHub CLI is available and authenticated
	 * @returns {Promise<Object>} GitHub CLI status
	 */
	async checkGitHubCLIStatus() {
		try {
			// Check if gh is installed
			execSync('gh --version', { stdio: 'ignore' });

			// Check if authenticated
			try {
				const authStatus = execSync('gh auth status', {
					encoding: 'utf8',
					stdio: 'pipe'
				});

				return {
					installed: true,
					authenticated: authStatus.includes('Logged in'),
					canCreatePR: true
				};
			} catch {
				return {
					installed: true,
					authenticated: false,
					canCreatePR: false
				};
			}
		} catch {
			return {
				installed: false,
				authenticated: false,
				canCreatePR: false
			};
		}
	}
}
