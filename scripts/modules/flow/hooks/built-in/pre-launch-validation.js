/**
 * Pre-Launch Validation Hook - validates environment and task scope before Claude Code sessions
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default class PreLaunchValidationHook {
	constructor() {
		this.version = '1.0.0';
		this.description =
			'Validates environment and task scope before starting Claude Code sessions';
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

			// Build validation (respects safety mode)
			if (config.buildValidation?.enabled) {
				await this.validateBuild(validation, config, services);
			}

			// Lint validation (respects safety mode)
			if (config.lintValidation?.enabled) {
				await this.validateLinting(validation, config, services);
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
	 * Validate build process
	 */
	async validateBuild(validation, config, services) {
		validation.checks.build = { status: 'checking' };

		try {
			// Check if build validation should be skipped based on safety mode
			const safetyMode = this.getSafetyMode(config);
			if (config.buildValidation.respectSafetyMode && safetyMode === 'vibe') {
				validation.checks.build = { 
					status: 'skipped', 
					reason: 'vibe-mode' 
				};
				return;
			}

			// Detect package manager and build command
			const buildInfo = await this.detectBuildCommand();
			
			if (!buildInfo.hasPackageJson) {
				validation.checks.build = { 
					status: 'skipped', 
					reason: 'no-package-json' 
				};
				return;
			}

			if (!buildInfo.hasBuildScript) {
				validation.warnings.push('No build script found in package.json');
				validation.checks.build = { 
					status: 'skipped', 
					reason: 'no-build-script' 
				};
				return;
			}

			// Run build validation
			const buildResult = await this.runBuildValidation(buildInfo);
			
			if (buildResult.success) {
				validation.checks.build = {
					status: 'passed',
					command: buildResult.command,
					duration: buildResult.duration
				};
			} else {
				if (safetyMode === 'strict') {
					validation.errors.push(`Build validation failed: ${buildResult.error}`);
				} else {
					validation.warnings.push(`Build validation failed: ${buildResult.error}`);
				}
				
				validation.checks.build = {
					status: 'failed',
					command: buildResult.command,
					error: buildResult.error,
					output: buildResult.output
				};
			}
		} catch (error) {
			validation.warnings.push(`Build validation error: ${error.message}`);
			validation.checks.build = { status: 'failed', error: error.message };
		}
	}

	/**
	 * Validate linting
	 */
	async validateLinting(validation, config, services) {
		validation.checks.lint = { status: 'checking' };

		try {
			// Check if lint validation should be skipped based on safety mode
			const safetyMode = this.getSafetyMode(config);
			if (config.lintValidation.respectSafetyMode && safetyMode === 'vibe') {
				validation.checks.lint = { 
					status: 'skipped', 
					reason: 'vibe-mode' 
				};
				return;
			}

			// Detect available linting tools
			const lintTools = await this.detectLintingTools();
			
			if (lintTools.length === 0) {
				validation.warnings.push('No linting tools detected (biome, eslint)');
				validation.checks.lint = { 
					status: 'skipped', 
					reason: 'no-lint-tools' 
				};
				return;
			}

			// Run lint validation for each detected tool
			const lintResults = [];
			for (const tool of lintTools) {
				const result = await this.runLintValidation(tool);
				lintResults.push(result);
			}

			// Evaluate results
			const failedLints = lintResults.filter(r => !r.success);
			const passedLints = lintResults.filter(r => r.success);

			if (failedLints.length > 0 && safetyMode === 'strict') {
				validation.errors.push(
					`Linting failed: ${failedLints.map(f => f.tool).join(', ')}`
				);
			} else if (failedLints.length > 0) {
				validation.warnings.push(
					`Linting issues detected: ${failedLints.map(f => f.tool).join(', ')}`
				);
			}

			validation.checks.lint = {
				status: failedLints.length === 0 ? 'passed' : 'warning',
				tools: lintResults,
				passed: passedLints.length,
				failed: failedLints.length
			};
		} catch (error) {
			validation.warnings.push(`Lint validation error: ${error.message}`);
			validation.checks.lint = { status: 'failed', error: error.message };
		}
	}

	/**
	 * Detect build command based on package manager
	 */
	async detectBuildCommand() {
		const hasPackageJson = fs.existsSync('package.json');
		if (!hasPackageJson) {
			return { hasPackageJson: false, hasBuildScript: false };
		}

		const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
		const hasBuildScript = packageJson.scripts && packageJson.scripts.build;

		// Detect package manager
		let packageManager = 'npm';
		if (fs.existsSync('yarn.lock')) {
			packageManager = 'yarn';
		} else if (fs.existsSync('pnpm-lock.yaml')) {
			packageManager = 'pnpm';
		}

		return {
			hasPackageJson,
			hasBuildScript,
			packageManager,
			buildScript: packageJson.scripts?.build,
			command: hasBuildScript ? `${packageManager} run build` : null
		};
	}

	/**
	 * Run build validation
	 */
	async runBuildValidation(buildInfo) {
		const startTime = Date.now();
		
		try {
			const output = execSync(buildInfo.command, {
				encoding: 'utf8',
				timeout: 120000, // 2 minutes
				stdio: 'pipe'
			});

			return {
				success: true,
				command: buildInfo.command,
				duration: Date.now() - startTime,
				output: output.trim()
			};
		} catch (error) {
			return {
				success: false,
				command: buildInfo.command,
				duration: Date.now() - startTime,
				error: error.message,
				output: error.stdout || error.stderr || 'No output'
			};
		}
	}

	/**
	 * Detect available linting tools
	 */
	async detectLintingTools() {
		const tools = [];

		// Check for Biome
		if (fs.existsSync('biome.json') || fs.existsSync('biome.jsonc')) {
			tools.push({
				name: 'biome',
				command: 'npx biome check .',
				configFile: fs.existsSync('biome.json') ? 'biome.json' : 'biome.jsonc'
			});
		}

		// Check for ESLint
		const eslintConfigs = [
			'.eslintrc.js',
			'.eslintrc.json',
			'.eslintrc.yml',
			'.eslintrc.yaml',
			'eslint.config.js'
		];

		for (const config of eslintConfigs) {
			if (fs.existsSync(config)) {
				tools.push({
					name: 'eslint',
					command: 'npx eslint .',
					configFile: config
				});
				break;
			}
		}

		// Check package.json for eslint config
		if (tools.find(t => t.name === 'eslint') === undefined) {
			try {
				const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
				if (packageJson.eslintConfig) {
					tools.push({
						name: 'eslint',
						command: 'npx eslint .',
						configFile: 'package.json'
					});
				}
			} catch (error) {
				// Ignore errors reading package.json
			}
		}

		return tools;
	}

	/**
	 * Run lint validation for a specific tool
	 */
	async runLintValidation(tool) {
		try {
			const output = execSync(tool.command, {
				encoding: 'utf8',
				timeout: 30000, // 30 seconds
				stdio: 'pipe'
			});

			return {
				success: true,
				tool: tool.name,
				command: tool.command,
				output: output.trim(),
				configFile: tool.configFile
			};
		} catch (error) {
			return {
				success: false,
				tool: tool.name,
				command: tool.command,
				error: error.message,
				output: error.stdout || error.stderr || 'No output',
				configFile: tool.configFile
			};
		}
	}

	/**
	 * Get safety mode from configuration
	 */
	getSafetyMode(config) {
		// Try to get from claude-code-stop hook config
		if (config.hooks?.builtIn?.claudeCodeStop?.safetyMode) {
			return config.hooks.builtIn.claudeCodeStop.safetyMode;
		}
		
		// Try to get from flow config
		if (config.safety?.mode) {
			return config.safety.mode;
		}

		// Default to standard
		return 'standard';
	}

	/**
	 * Validate Git status
	 */
	async validateGitStatus(validation, services) {
		validation.checks.git = { status: 'checking' };

		try {
			// Check if we're in a git repository
			if (!services.git) {
				validation.warnings.push(
					'Git service not available - skipping git checks'
				);
				validation.checks.git = { status: 'skipped', reason: 'no-git-service' };
				return;
			}

			// Check for uncommitted changes
			const status = await this.getGitStatus(services);

			if (status.hasUncommittedChanges) {
				validation.warnings.push(
					'Uncommitted changes detected - consider committing before starting Claude Code'
				);
			}

			if (status.hasUntrackedFiles) {
				validation.warnings.push(
					'Untracked files detected - consider adding them to git'
				);
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
				validation.checks.dependencies = {
					status: 'failed',
					reason: 'no-task'
				};
				return;
			}

			// Check if task has dependencies
			if (task.dependencies && task.dependencies.length > 0) {
				const dependencyStatus = await this.checkDependencyStatus(
					task,
					services
				);

				if (dependencyStatus.hasUncompletedDependencies) {
					validation.errors.push(
						`Task has uncompleted dependencies: ${dependencyStatus.uncompletedDependencies.join(', ')}`
					);
				}

				validation.checks.dependencies = {
					status: dependencyStatus.hasUncompletedDependencies
						? 'failed'
						: 'passed',
					totalDependencies: task.dependencies.length,
					completedDependencies: dependencyStatus.completedDependencies.length,
					uncompletedDependencies: dependencyStatus.uncompletedDependencies
				};
			} else {
				validation.checks.dependencies = {
					status: 'passed',
					reason: 'no-dependencies'
				};
			}
		} catch (error) {
			validation.warnings.push(`Dependency check failed: ${error.message}`);
			validation.checks.dependencies = {
				status: 'failed',
				error: error.message
			};
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
				const isAccessible = await this.validateWorktreeAccess(
					worktree,
					services
				);

				if (!isAccessible) {
					validation.errors.push(
						`Worktree at ${worktree.path} is not accessible`
					);
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
				const { allowShellCommands, allowFileOperations, allowWebSearch } =
					config.toolRestrictions;

				if (!allowShellCommands && !allowFileOperations) {
					validation.warnings.push(
						'Both shell commands and file operations are restricted - Claude may have limited capabilities'
					);
				}
			}

			if (configIssues.length > 0) {
				validation.errors.push(...configIssues);
				validation.checks.config = { status: 'failed', issues: configIssues };
			} else {
				validation.checks.config = { status: 'passed' };
			}
		} catch (error) {
			validation.warnings.push(
				`Configuration validation failed: ${error.message}`
			);
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
