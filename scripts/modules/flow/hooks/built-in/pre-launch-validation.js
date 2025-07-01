/**
 * Pre-Launch Validation Hook - validates environment and task scope before Claude Code sessions
 */
export default class PreLaunchValidationHook {
	constructor() {
		this.version = '1.0.0';
		this.description = 'Validates environment and task scope before starting Claude Code sessions';
		this.events = ['pre-launch'];
		this.timeout = 10000; // 10 seconds
	}

	/**
	 * Pre-launch validation
	 */
	async onPreLaunch(context) {
		const { config, task, worktree, services } = context;

		const validation = {
			success: true,
			warnings: [],
			errors: [],
			checks: {}
		};

		try {
			// Validate task
			if (config.checkGitStatus) {
				await this.validateGitStatus(validation, services);
			}

			// Validate dependencies
			if (config.validateDependencies) {
				await this.validateTaskDependencies(validation, task, services);
			}

			// Check for conflicts
			if (config.checkConflicts) {
				await this.checkWorktreeConflicts(validation, worktree, task, services);
			}

			// Validate configuration
			await this.validateConfiguration(validation, config);

			return {
				validation,
				passed: validation.errors.length === 0,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			return {
				validation: {
					success: false,
					errors: [`Validation failed: ${error.message}`],
					warnings: [],
					checks: {}
				},
				passed: false,
				error: error.message
			};
		}
	}

	/**
	 * Validate Git status
	 */
	async validateGitStatus(validation, services) {
		validation.checks.git = { status: 'checking' };

		try {
			// Check if we're in a git repository
			if (!services.git) {
				validation.warnings.push('Git service not available - skipping git checks');
				validation.checks.git = { status: 'skipped', reason: 'no-git-service' };
				return;
			}

			// Check for uncommitted changes
			const status = await this.getGitStatus(services);
			
			if (status.hasUncommittedChanges) {
				validation.warnings.push('Uncommitted changes detected - consider committing before starting Claude Code');
			}

			if (status.hasUntrackedFiles) {
				validation.warnings.push('Untracked files detected - consider adding them to git');
			}

			validation.checks.git = {
				status: 'passed',
				uncommittedChanges: status.hasUncommittedChanges,
				untrackedFiles: status.hasUntrackedFiles,
				currentBranch: status.currentBranch
			};

		} catch (error) {
			validation.warnings.push(`Git status check failed: ${error.message}`);
			validation.checks.git = { status: 'failed', error: error.message };
		}
	}

	/**
	 * Validate task dependencies
	 */
	async validateTaskDependencies(validation, task, services) {
		validation.checks.dependencies = { status: 'checking' };

		try {
			if (!task) {
				validation.errors.push('No task provided for validation');
				validation.checks.dependencies = { status: 'failed', reason: 'no-task' };
				return;
			}

			// Check if task has dependencies
			if (task.dependencies && task.dependencies.length > 0) {
				const dependencyStatus = await this.checkDependencyStatus(task, services);
				
				if (dependencyStatus.hasUncompletedDependencies) {
					validation.errors.push(
						`Task has uncompleted dependencies: ${dependencyStatus.uncompletedDependencies.join(', ')}`
					);
				}

				validation.checks.dependencies = {
					status: dependencyStatus.hasUncompletedDependencies ? 'failed' : 'passed',
					totalDependencies: task.dependencies.length,
					completedDependencies: dependencyStatus.completedDependencies.length,
					uncompletedDependencies: dependencyStatus.uncompletedDependencies
				};
			} else {
				validation.checks.dependencies = { status: 'passed', reason: 'no-dependencies' };
			}

		} catch (error) {
			validation.warnings.push(`Dependency check failed: ${error.message}`);
			validation.checks.dependencies = { status: 'failed', error: error.message };
		}
	}

	/**
	 * Check for worktree conflicts
	 */
	async checkWorktreeConflicts(validation, worktree, task, services) {
		validation.checks.worktree = { status: 'checking' };

		try {
			if (!worktree) {
				// No existing worktree, check if we can create one
				const branchName = this.generateBranchName(task);
				const conflicts = await this.checkBranchConflicts(branchName, services);
				
				if (conflicts.hasConflicts) {
					validation.warnings.push(
						`Branch ${branchName} already exists - worktree creation may require user input`
					);
				}

				validation.checks.worktree = {
					status: 'passed',
					existingWorktree: false,
					branchConflicts: conflicts.hasConflicts,
					suggestedBranch: branchName
				};
			} else {
				// Existing worktree, validate it's accessible
				const isAccessible = await this.validateWorktreeAccess(worktree, services);
				
				if (!isAccessible) {
					validation.errors.push(`Worktree at ${worktree.path} is not accessible`);
				}

				validation.checks.worktree = {
					status: isAccessible ? 'passed' : 'failed',
					existingWorktree: true,
					path: worktree.path,
					branch: worktree.branch,
					accessible: isAccessible
				};
			}

		} catch (error) {
			validation.warnings.push(`Worktree validation failed: ${error.message}`);
			validation.checks.worktree = { status: 'failed', error: error.message };
		}
	}

	/**
	 * Validate configuration
	 */
	async validateConfiguration(validation, config) {
		validation.checks.config = { status: 'checking' };

		try {
			const configIssues = [];

			// Validate persona
			if (!config.persona) {
				configIssues.push('No persona selected');
			}

			// Validate max turns
			if (config.maxTurns && (config.maxTurns < 1 || config.maxTurns > 50)) {
				configIssues.push('Max turns should be between 1 and 50');
			}

			// Validate tool restrictions
			if (config.toolRestrictions) {
				const { allowShellCommands, allowFileOperations, allowWebSearch } = config.toolRestrictions;
				
				if (!allowShellCommands && !allowFileOperations) {
					validation.warnings.push('Both shell commands and file operations are restricted - Claude may have limited capabilities');
				}
			}

			if (configIssues.length > 0) {
				validation.errors.push(...configIssues);
				validation.checks.config = { status: 'failed', issues: configIssues };
			} else {
				validation.checks.config = { status: 'passed' };
			}

		} catch (error) {
			validation.warnings.push(`Configuration validation failed: ${error.message}`);
			validation.checks.config = { status: 'failed', error: error.message };
		}
	}

	/**
	 * Helper methods
	 */
	async getGitStatus(services) {
		// This would use the git service to check status
		// For now, return a mock status
		return {
			hasUncommittedChanges: false,
			hasUntrackedFiles: false,
			currentBranch: 'main'
		};
	}

	async checkDependencyStatus(task, services) {
		if (!services.backend) {
			throw new Error('Backend service not available');
		}

		const completedDependencies = [];
		const uncompletedDependencies = [];

		for (const depId of task.dependencies) {
			try {
				const depTask = await services.backend.getTask(depId);
				if (depTask && depTask.status === 'done') {
					completedDependencies.push(depId);
				} else {
					uncompletedDependencies.push(depId);
				}
			} catch (error) {
				uncompletedDependencies.push(depId);
			}
		}

		return {
			completedDependencies,
			uncompletedDependencies,
			hasUncompletedDependencies: uncompletedDependencies.length > 0
		};
	}

	generateBranchName(task) {
		if (!task) return 'task-unknown';
		
		const isSubtask = task.isSubtask || String(task.id).includes('.');
		if (isSubtask) {
			return `task-${task.id}`;
		} else {
			return `task-${task.id}`;
		}
	}

	async checkBranchConflicts(branchName, services) {
		// This would check if the branch already exists
		// For now, return no conflicts
		return {
			hasConflicts: false,
			existingBranches: []
		};
	}

	async validateWorktreeAccess(worktree, services) {
		// This would check if the worktree path is accessible
		// For now, assume it's accessible
		return true;
	}
} 