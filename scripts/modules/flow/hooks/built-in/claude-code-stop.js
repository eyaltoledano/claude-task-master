/**
 * Claude Code Stop Hook - handles automatic PR creation when Claude Code sessions complete
 * Integrates with existing hook system and supports multiple safety modes
 */
export default class ClaudeCodeStopHook {
	constructor() {
		this.name = 'claude-code-stop';
		this.version = '1.0.0';
		this.description = 'Automatically creates PRs when Claude Code sessions complete';
		this.events = ['session-completed', 'session-failed'];
		this.timeout = 60000; // 1 minute timeout for PR creation
		
		// Safety mode configurations
		this.safetyModes = {
			vibe: {
				autoLint: false,
				autoBuild: false,
				requireTests: false,
				skipConflictCheck: true,
				autoCommit: true,
				autoPR: true,
				description: 'Fast mode - minimal checks, just commit and create PR'
			},
			standard: {
				autoLint: true,
				autoBuild: false,
				requireTests: false,
				skipConflictCheck: false,
				autoCommit: true,
				autoPR: true,
				description: 'Balanced mode - basic safety checks before PR creation'
			},
			strict: {
				autoLint: true,
				autoBuild: true,
				requireTests: true,
				skipConflictCheck: false,
				autoCommit: true,
				autoPR: false, // Require manual approval in strict mode
				description: 'Safe mode - comprehensive checks, manual PR approval'
			}
		};
	}

	/**
	 * Handle session completion - main entry point for Claude Code Stop
	 */
	async onSessionCompleted(context) {
		const { session, task, worktree, config, services } = context;

		if (!session || !task || !worktree) {
			return {
				success: false,
				error: 'Missing required context (session, task, or worktree)'
			};
		}

		try {
			// Determine safety mode
			const safetyMode = this.determineSafetyMode(context);
			const safetyConfig = this.safetyModes[safetyMode];

			console.log(`🎯 [Claude Code Stop] Processing completion in ${safetyMode} mode`);

			// Check if auto-PR is enabled for this mode
			if (!safetyConfig.autoPR) {
				return {
					success: true,
					action: 'manual-approval-required',
					safetyMode,
					message: `${safetyMode} mode requires manual PR creation`
				};
			}

			// Run safety checks based on mode
			const safetyResult = await this.runSafetyChecks(
				safetyMode,
				safetyConfig,
				context
			);

			if (!safetyResult.passed && safetyMode !== 'vibe') {
				return {
					success: false,
					action: 'safety-checks-failed',
					safetyMode,
					errors: safetyResult.errors,
					warnings: safetyResult.warnings
				};
			}

			// Create PR automatically
			const prResult = await this.createAutomaticPR(
				safetyMode,
				safetyConfig,
				context,
				safetyResult
			);

			return {
				success: prResult.success,
				action: 'pr-created',
				safetyMode,
				prResult,
				safetyChecks: safetyResult
			};

		} catch (error) {
			console.error('❌ [Claude Code Stop] Error processing completion:', error);
			return {
				success: false,
				error: error.message,
				action: 'error'
			};
		}
	}

	/**
	 * Handle session failure - cleanup and notification
	 */
	async onSessionFailed(context) {
		const { session, task, worktree, error } = context;

		console.log(`❌ [Claude Code Stop] Session failed for task ${task?.id}:`, error?.message);

		// In the future, this could:
		// - Notify via configured channels
		// - Clean up partial work
		// - Update task status
		// - Create issue for investigation

		return {
			success: true,
			action: 'session-failed-handled',
			message: 'Session failure processed'
		};
	}

	/**
	 * Determine safety mode from context
	 */
	determineSafetyMode(context) {
		// Priority order: metadata > config > task settings > default
		const { config, task, session } = context;

		// Check session metadata first (highest priority)
		if (session?.metadata?.safetyMode) {
			return session.metadata.safetyMode;
		}

		// Check global config
		if (config?.claudeCodeStop?.defaultSafetyMode) {
			return config.claudeCodeStop.defaultSafetyMode;
		}

		// Check task-specific settings
		if (task?.metadata?.safetyMode) {
			return task.metadata.safetyMode;
		}

		// Default to standard mode
		return 'standard';
	}

	/**
	 * Run safety checks based on mode
	 */
	async runSafetyChecks(safetyMode, safetyConfig, context) {
		const { worktree, services } = context;
		const result = {
			passed: true,
			errors: [],
			warnings: [],
			checks: {}
		};

		console.log(`🔍 [Claude Code Stop] Running ${safetyMode} mode safety checks`);

		try {
			// Git status check (always run)
			result.checks.gitStatus = await this.checkGitStatus(worktree, services);
			if (!result.checks.gitStatus.hasChanges) {
				result.warnings.push('No changes detected in worktree');
			}

			// Linting check
			if (safetyConfig.autoLint) {
				result.checks.lint = await this.runLintCheck(worktree, services);
				if (!result.checks.lint.passed) {
					result.errors.push('Linting failed');
					result.passed = false;
				}
			}

			// Build check
			if (safetyConfig.autoBuild) {
				result.checks.build = await this.runBuildCheck(worktree, services);
				if (!result.checks.build.passed) {
					result.errors.push('Build failed');
					result.passed = false;
				}
			}

			// Test check
			if (safetyConfig.requireTests) {
				result.checks.tests = await this.runTestCheck(worktree, services);
				if (!result.checks.tests.passed) {
					result.errors.push('Tests failed or missing');
					result.passed = false;
				}
			}

			// Conflict check
			if (!safetyConfig.skipConflictCheck) {
				result.checks.conflicts = await this.checkConflicts(worktree, services);
				if (!result.checks.conflicts.passed) {
					result.errors.push('Merge conflicts detected');
					result.passed = false;
				}
			}

		} catch (error) {
			result.errors.push(`Safety check error: ${error.message}`);
			result.passed = false;
		}

		return result;
	}

	/**
	 * Create automatic PR
	 */
	async createAutomaticPR(safetyMode, safetyConfig, context, safetyResult) {
		const { task, worktree, services } = context;

		try {
			console.log(`🚀 [Claude Code Stop] Creating automatic PR in ${safetyMode} mode`);

			// Generate PR title and description
			const prTitle = this.generatePRTitle(task, safetyMode);
			const prDescription = this.generatePRDescription(task, safetyMode, safetyResult);

			// Use existing PR creation infrastructure
			if (task.parentId) {
				// This is a subtask - use existing completeSubtaskWithPR
				return await services.backend.completeSubtaskWithPR(worktree.name, {
					createPR: true,
					prTitle,
					prDescription,
					safetyMode,
					autoGenerated: true
				});
			} else {
				// This is a main task - use direct GitHub CLI
				return await this.createMainTaskPR(
					worktree,
					prTitle,
					prDescription,
					safetyMode,
					services
				);
			}

		} catch (error) {
			console.error('❌ [Claude Code Stop] PR creation failed:', error);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Generate PR title
	 */
	generatePRTitle(task, safetyMode) {
		const modePrefix = safetyMode === 'vibe' ? '⚡' : safetyMode === 'strict' ? '🔒' : '🤖';
		
		if (task.parentId) {
			return `${modePrefix} Subtask ${task.id}: ${task.title}`;
		} else {
			return `${modePrefix} Task ${task.id}: ${task.title}`;
		}
	}

	/**
	 * Generate PR description
	 */
	generatePRDescription(task, safetyMode, safetyResult) {
		const lines = [];
		
		lines.push(`## 🤖 Auto-generated PR (${safetyMode} mode)`);
		lines.push('');
		
		if (task.parentId) {
			lines.push(`**Subtask:** ${task.id} - ${task.title}`);
			lines.push(`**Parent Task:** ${task.parentId}`);
		} else {
			lines.push(`**Task:** ${task.id} - ${task.title}`);
		}
		
		if (task.description) {
			lines.push('');
			lines.push('**Description:**');
			lines.push(task.description);
		}

		// Add safety check results
		lines.push('');
		lines.push('## 🔍 Safety Checks');
		
		if (safetyResult.checks) {
			for (const [checkName, result] of Object.entries(safetyResult.checks)) {
				const status = result.passed ? '✅' : '❌';
				lines.push(`- ${status} ${checkName}: ${result.message || 'OK'}`);
			}
		}

		if (safetyResult.warnings.length > 0) {
			lines.push('');
			lines.push('**Warnings:**');
			safetyResult.warnings.forEach(warning => lines.push(`- ⚠️ ${warning}`));
		}

		lines.push('');
		lines.push('---');
		lines.push(`*Generated by Claude Code Stop Hook v${this.version}*`);

		return lines.join('\n');
	}

	/**
	 * Create PR for main task using GitHub CLI
	 */
	async createMainTaskPR(worktree, prTitle, prDescription, safetyMode, services) {
		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);

			// Commit changes first
			const branchName = worktree.branch || worktree.name;
			await execAsync('git add .', { cwd: worktree.path });
			await execAsync(`git commit -m "${prTitle}"`, { cwd: worktree.path });
			
			// Push branch
			await execAsync(`git push --set-upstream origin "${branchName}"`, { 
				cwd: worktree.path 
			});

			// Create PR with explicit head flag
			const sourceBranch = worktree.sourceBranch || 'main';
			const prCommand = `gh pr create --title "${prTitle}" --body "${prDescription}" --base ${sourceBranch} --head ${branchName}`;
			
			const prResult = await execAsync(prCommand, {
				cwd: worktree.path,
				encoding: 'utf8'
			});

			// Extract PR URL from output
			const prUrl = prResult.stdout.trim().split('\n').pop();
			const prNumber = prUrl.split('/').pop();

			return {
				success: true,
				prUrl,
				prNumber,
				prTitle,
				prDescription,
				safetyMode,
				autoGenerated: true
			};

		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	// Safety check implementations
	async checkGitStatus(worktree, services) {
		try {
			const { execSync } = await import('child_process');
			const statusOutput = execSync('git status --porcelain', {
				cwd: worktree.path,
				encoding: 'utf8'
			});

			return {
				passed: true,
				hasChanges: statusOutput.trim().length > 0,
				message: statusOutput.trim() ? 'Changes detected' : 'No changes'
			};
		} catch (error) {
			return {
				passed: false,
				hasChanges: false,
				message: `Git status check failed: ${error.message}`
			};
		}
	}

	async runLintCheck(worktree, services) {
		try {
			const { execSync } = await import('child_process');
			
			// Try biome first, then eslint
			try {
				execSync('npx biome check --reporter=summary', {
					cwd: worktree.path,
					stdio: 'pipe'
				});
				return { passed: true, message: 'Biome linting passed' };
			} catch (biomeError) {
				try {
					execSync('npx eslint .', {
						cwd: worktree.path,
						stdio: 'pipe'
					});
					return { passed: true, message: 'ESLint passed' };
				} catch (eslintError) {
					return { 
						passed: false, 
						message: 'Linting failed (tried biome and eslint)' 
					};
				}
			}
		} catch (error) {
			return {
				passed: false,
				message: `Lint check error: ${error.message}`
			};
		}
	}

	async runBuildCheck(worktree, services) {
		try {
			const { execSync } = await import('child_process');
			
			// Try common build commands
			const buildCommands = ['npm run build', 'yarn build', 'pnpm build'];
			
			for (const cmd of buildCommands) {
				try {
					execSync(cmd, {
						cwd: worktree.path,
						stdio: 'pipe'
					});
					return { passed: true, message: `Build passed (${cmd})` };
				} catch (cmdError) {
					// Try next command
				}
			}

			return { passed: false, message: 'No working build command found' };
		} catch (error) {
			return {
				passed: false,
				message: `Build check error: ${error.message}`
			};
		}
	}

	async runTestCheck(worktree, services) {
		try {
			const { execSync } = await import('child_process');
			
			// Try common test commands
			const testCommands = ['npm test', 'yarn test', 'pnpm test'];
			
			for (const cmd of testCommands) {
				try {
					execSync(cmd, {
						cwd: worktree.path,
						stdio: 'pipe'
					});
					return { passed: true, message: `Tests passed (${cmd})` };
				} catch (cmdError) {
					// Try next command
				}
			}

			return { passed: false, message: 'No working test command found or tests failed' };
		} catch (error) {
			return {
				passed: false,
				message: `Test check error: ${error.message}`
			};
		}
	}

	async checkConflicts(worktree, services) {
		try {
			const { execSync } = await import('child_process');
			
			// Fetch latest changes
			execSync('git fetch origin', { cwd: worktree.path, stdio: 'pipe' });
			
			// Check for conflicts with base branch
			const sourceBranch = worktree.sourceBranch || 'main';
			const mergeBase = execSync(`git merge-base HEAD origin/${sourceBranch}`, {
				cwd: worktree.path,
				encoding: 'utf8'
			}).trim();

			// Try a test merge
			execSync(`git merge-tree ${mergeBase} HEAD origin/${sourceBranch}`, {
				cwd: worktree.path,
				stdio: 'pipe'
			});

			return { passed: true, message: 'No merge conflicts detected' };
		} catch (error) {
			return {
				passed: false,
				message: 'Potential merge conflicts detected'
			};
		}
	}
} 