/**
 * Branch Awareness Manager for Task Master Flow
 * Simple branch tracking without complex UI - follows git workflow patterns
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export class BranchAwarenessManager extends EventEmitter {
	constructor(projectRoot, options = {}) {
		super();
		
		this.projectRoot = projectRoot;
		this.configPath = path.join(projectRoot, 'scripts/modules/flow/flow-config.json');
		
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
				// Load saved state
				await this.loadSavedState();
				
				// Detect current branch
				await this.detectCurrentBranch();
				
				// Save initial state
				await this.saveState();
				
				this.emit('initialized', {
					currentBranch: this.currentBranch,
					lastWorkingBranch: this.lastWorkingBranch
				});
			}
		} catch (error) {
			console.debug('Branch awareness initialization failed:', error.message);
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
	 * Detect current branch
	 */
	async detectCurrentBranch() {
		if (!this.isGitRepo) return null;

		try {
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
			return null;
		}
	}

	/**
	 * Get current branch information with metadata
	 */
	async getCurrentBranchInfo() {
		if (!this.isGitRepo || !this.currentBranch) {
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

			// Check if detached HEAD
			if (!this.currentBranch) {
				info.isDetached = true;
				return info;
			}

			// Get tracking branch info
			try {
				const trackingBranch = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();
				info.trackingBranch = trackingBranch;

				// Get ahead/behind counts
				const revListOutput = execSync('git rev-list --left-right --count HEAD...@{u}', {
					cwd: this.projectRoot,
					encoding: 'utf8'
				}).trim();
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
		this.branchHistory = this.branchHistory.filter(b => b.name !== branchName);
		
		// Add to front
		this.branchHistory.unshift({
			name: branchName,
			lastUsed: new Date().toISOString()
		});

		// Trim to max size
		if (this.branchHistory.length > this.options.maxHistorySize) {
			this.branchHistory = this.branchHistory.slice(0, this.options.maxHistorySize);
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
			const configData = await fs.readFile(this.configPath, 'utf8');
			const config = JSON.parse(configData);
			const branchConfig = config.branchAwareness;

			if (branchConfig) {
				this.lastWorkingBranch = branchConfig.lastWorkingBranch;
				this.branchHistory = branchConfig.branchHistory || [];
			}
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
			const configData = await fs.readFile(this.configPath, 'utf8');
			const config = JSON.parse(configData);

			if (!config.branchAwareness) {
				config.branchAwareness = {};
			}

			config.branchAwareness = {
				...config.branchAwareness,
				currentBranch: this.currentBranch,
				lastWorkingBranch: this.lastWorkingBranch,
				branchHistory: this.branchHistory,
				lastUpdated: new Date().toISOString()
			};

			await fs.writeFile(this.configPath, JSON.stringify(config, null, '\t'));
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
			currentBranch: this.currentBranch,
			lastWorkingBranch: this.lastWorkingBranch,
			recentBranches: this.branchHistory.slice(0, 3).map(b => b.name),
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
} 