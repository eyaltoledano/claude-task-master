/**
 * Claude Code Stop Hook - handles post-session cleanup and PR creation
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default class ClaudeCodeStopHook {
	constructor() {
		this.version = '2.0.0';
		this.description = 'Handles Claude Code session completion with enhanced safety checks and PR creation';
		this.events = ['claude-code-stop'];
		this.timeout = 300000; // 5 minutes
	}

	/**
	 * Handle Claude Code session stop
	 */
	async onClaudeCodeStop(context) {
		const { config, task, worktree, services, sessionResult } = context;

		try {
			// Get effective safety mode and configuration
			const safetyMode = this.getSafetyMode(config);
			const effectiveConfig = this.getEffectiveConfig(config, safetyMode);

			console.log(`\n🛡️  Claude Code Stop Hook (Safety Mode: ${safetyMode})`);

			// Step 1: Detect repository type for workflow decision
			const repoInfo = await this.detectRepositoryType(services);
			console.log(`📍 Repository type: ${repoInfo.type} (${repoInfo.hasRemote ? 'remote' : 'local'})`);

			// Step 2: Use WorktreeManager.completeSubtask() for comprehensive workflow
			const workflowResult = await this.executeWorkflow(task, worktree, services, effectiveConfig, safetyMode, repoInfo);

			return {
				success: true,
				safetyMode,
				repositoryType: repoInfo.type,
				workflow: workflowResult,
				timestamp: new Date().toISOString()
			};

		} catch (error) {
			console.error('❌ Claude Code Stop Hook failed:', error.message);
			return {
				success: false,
				error: error.message,
				timestamp: new Date().toISOString()
			};
		}
	}

	/**
	 * Get effective safety mode
	 */
	getSafetyMode(config) {
		// Try hook-specific config first
		if (config.hooks?.builtIn?.claudeCodeStop?.safetyMode) {
			return config.hooks.builtIn.claudeCodeStop.safetyMode;
		}
		
		// Try flow config
		if (config.safety?.mode) {
			return config.safety.mode;
		}

		// Default to standard
		return 'standard';
	}

	/**
	 * Get effective configuration based on safety mode
	 */
	getEffectiveConfig(config, safetyMode) {
		const baseConfig = config.hooks?.builtIn?.claudeCodeStop || {};
		const modeConfig = baseConfig.modes?.[safetyMode] || {};

		// Merge configurations with mode-specific overrides
		return {
			...baseConfig,
			...modeConfig,
			safetyMode
		};
	}

	/**
	 * Run safety checks based on configuration
	 */
	async runSafetyChecks(config, worktree, services) {
		const results = {
			git: { status: 'skipped' },
			build: { status: 'skipped' },
			lint: { status: 'skipped' },
			tests: { status: 'skipped' },
			conflicts: { status: 'skipped' },
			overall: 'pending'
		};

		console.log('🔍 Running safety checks...');

		// Git status check
		if (config.safetyChecks?.gitStatus) {
			results.git = await this.checkGitStatus(worktree);
		}

		// Build validation
		if (config.safetyChecks?.build) {
			results.build = await this.runBuildValidation(config);
		}

		// Lint validation
		if (config.safetyChecks?.linting) {
			results.lint = await this.runLintValidation(config);
		}

		// Test validation
		if (config.safetyChecks?.tests) {
			results.tests = await this.runTestValidation(config);
		}

		// Conflict detection
		if (config.safetyChecks?.conflictDetection) {
			results.conflicts = await this.checkConflicts(worktree);
		}

		// Determine overall status
		const hasErrors = Object.values(results).some(r => r.status === 'failed');
		const hasWarnings = Object.values(results).some(r => r.status === 'warning');
		
		results.overall = hasErrors ? 'failed' : hasWarnings ? 'warning' : 'passed';

		console.log(`✅ Safety checks completed with status: ${results.overall}`);
		return results;
	}

	/**
	 * Check Git status
	 */
	async checkGitStatus(worktree) {
		try {
			console.log('  📋 Checking git status...');
			
			if (!worktree?.path) {
				return { status: 'skipped', reason: 'no-worktree' };
			}

			const originalCwd = process.cwd();
			process.chdir(worktree.path);

			try {
				// Check for uncommitted changes
				const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
				const hasChanges = statusOutput.trim().length > 0;

				if (hasChanges) {
					console.log('    ⚠️  Uncommitted changes detected');
					return { 
						status: 'warning', 
						message: 'Uncommitted changes detected',
						changes: statusOutput.trim().split('\n')
					};
				}

				console.log('    ✅ Git status clean');
				return { status: 'passed', message: 'No uncommitted changes' };

			} finally {
				process.chdir(originalCwd);
			}

		} catch (error) {
			console.log(`    ❌ Git status check failed: ${error.message}`);
			return { status: 'failed', error: error.message };
		}
	}

	/**
	 * Run build validation
	 */
	async runBuildValidation(config) {
		try {
			console.log('  🔨 Running build validation...');

			// Detect build command
			const buildInfo = await this.detectBuildCommand();
			
			if (!buildInfo.hasPackageJson) {
				console.log('    ⏭️  No package.json found, skipping build');
				return { status: 'skipped', reason: 'no-package-json' };
			}

			if (!buildInfo.hasBuildScript) {
				console.log('    ⏭️  No build script found, skipping build');
				return { status: 'skipped', reason: 'no-build-script' };
			}

			// Run build
			const startTime = Date.now();
			console.log(`    🚀 Running: ${buildInfo.command}`);

			try {
				const output = execSync(buildInfo.command, {
					encoding: 'utf8',
					timeout: config.buildValidation?.timeout || 120000,
					stdio: 'pipe'
				});

				const duration = Date.now() - startTime;
				console.log(`    ✅ Build completed in ${duration}ms`);

				return {
					status: 'passed',
					command: buildInfo.command,
					duration,
					output: output.trim()
				};

			} catch (error) {
				const duration = Date.now() - startTime;
				console.log(`    ❌ Build failed after ${duration}ms`);

				const shouldFail = config.buildValidation?.failOnError || config.safetyMode === 'strict';
				
				return {
					status: shouldFail ? 'failed' : 'warning',
					command: buildInfo.command,
					duration,
					error: error.message,
					output: error.stdout || error.stderr || 'No output'
				};
			}

		} catch (error) {
			console.log(`    ❌ Build validation error: ${error.message}`);
			return { status: 'failed', error: error.message };
		}
	}

	/**
	 * Run lint validation
	 */
	async runLintValidation(config) {
		try {
			console.log('  🧹 Running lint validation...');

			// Detect linting tools
			const lintTools = await this.detectLintingTools();
			
			if (lintTools.length === 0) {
				console.log('    ⏭️  No linting tools detected');
				return { status: 'skipped', reason: 'no-lint-tools' };
			}

			const results = [];
			let hasErrors = false;
			let hasWarnings = false;

			for (const tool of lintTools) {
				// Check if tool is enabled in config
				const toolEnabled = config.lintValidation?.tools?.[tool.name]?.enabled !== false;
				if (!toolEnabled) {
					console.log(`    ⏭️  ${tool.name} disabled in configuration`);
					continue;
				}

				console.log(`    🔍 Running ${tool.name}...`);

				try {
					const output = execSync(tool.command, {
						encoding: 'utf8',
						timeout: config.lintValidation?.timeout || 30000,
						stdio: 'pipe'
					});

					console.log(`    ✅ ${tool.name} passed`);
					results.push({
						tool: tool.name,
						status: 'passed',
						command: tool.command,
						output: output.trim()
					});

				} catch (error) {
					console.log(`    ⚠️  ${tool.name} found issues`);

					// Try auto-fix if enabled
					if (config.lintValidation?.autoFix) {
						const fixCommand = config.lintValidation.tools?.[tool.name]?.fixCommand;
						if (fixCommand) {
							try {
								console.log(`    🔧 Auto-fixing with: ${fixCommand}`);
								execSync(fixCommand, { encoding: 'utf8', stdio: 'pipe' });
								console.log(`    ✅ ${tool.name} auto-fixed`);
							} catch (fixError) {
								console.log(`    ❌ Auto-fix failed: ${fixError.message}`);
							}
						}
					}

					const shouldFail = config.lintValidation?.failOnError || config.safetyMode === 'strict';
					if (shouldFail) {
						hasErrors = true;
					} else {
						hasWarnings = true;
					}

					results.push({
						tool: tool.name,
						status: shouldFail ? 'failed' : 'warning',
						command: tool.command,
						error: error.message,
						output: error.stdout || error.stderr || 'No output'
					});
				}
			}

			const overallStatus = hasErrors ? 'failed' : hasWarnings ? 'warning' : 'passed';
			console.log(`    📊 Lint validation completed: ${overallStatus}`);

			return {
				status: overallStatus,
				tools: results,
				summary: {
					total: results.length,
					passed: results.filter(r => r.status === 'passed').length,
					warnings: results.filter(r => r.status === 'warning').length,
					failed: results.filter(r => r.status === 'failed').length
				}
			};

		} catch (error) {
			console.log(`    ❌ Lint validation error: ${error.message}`);
			return { status: 'failed', error: error.message };
		}
	}

	/**
	 * Run test validation
	 */
	async runTestValidation(config) {
		try {
			console.log('  🧪 Running test validation...');

			// Detect test command
			const testInfo = await this.detectTestCommand();
			
			if (!testInfo.hasTestScript) {
				const message = 'No test script found in package.json';
				console.log(`    ⚠️  ${message}`);
				
				// In strict mode, missing tests is an error
				if (config.safetyMode === 'strict') {
					return { status: 'failed', reason: 'no-test-script', message };
				} else {
					return { status: 'warning', reason: 'no-test-script', message };
				}
			}

			// Run tests
			const startTime = Date.now();
			console.log(`    🧪 Running: ${testInfo.command}`);

			try {
				const output = execSync(testInfo.command, {
					encoding: 'utf8',
					timeout: config.testValidation?.timeout || 180000, // 3 minutes
					stdio: 'pipe'
				});

				const duration = Date.now() - startTime;
				console.log(`    ✅ Tests passed in ${duration}ms`);

				return {
					status: 'passed',
					command: testInfo.command,
					duration,
					output: output.trim()
				};

			} catch (error) {
				const duration = Date.now() - startTime;
				console.log(`    ❌ Tests failed after ${duration}ms`);

				return {
					status: 'failed',
					command: testInfo.command,
					duration,
					error: error.message,
					output: error.stdout || error.stderr || 'No output'
				};
			}

		} catch (error) {
			console.log(`    ❌ Test validation error: ${error.message}`);
			return { status: 'failed', error: error.message };
		}
	}

	/**
	 * Check for conflicts
	 */
	async checkConflicts(worktree) {
		try {
			console.log('  🔍 Checking for conflicts...');
			
			if (!worktree?.path) {
				return { status: 'skipped', reason: 'no-worktree' };
			}

			const originalCwd = process.cwd();
			process.chdir(worktree.path);

			try {
				// Check for merge conflicts
				const conflictFiles = [];
				
				// Look for conflict markers in tracked files
				try {
					const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
						.trim().split('\n').filter(Boolean);

					for (const file of trackedFiles) {
						if (fs.existsSync(file)) {
							const content = fs.readFileSync(file, 'utf8');
							if (content.includes('<<<<<<<') || content.includes('>>>>>>>')) {
								conflictFiles.push(file);
							}
						}
					}
				} catch (error) {
					// Ignore errors reading files
				}

				if (conflictFiles.length > 0) {
					console.log(`    ❌ Conflict markers found in ${conflictFiles.length} files`);
					return {
						status: 'failed',
						message: `Conflict markers found in ${conflictFiles.length} files`,
						conflicts: conflictFiles
					};
				}

				console.log('    ✅ No conflicts detected');
				return { status: 'passed', message: 'No conflicts detected' };

			} finally {
				process.chdir(originalCwd);
			}

		} catch (error) {
			console.log(`    ❌ Conflict check failed: ${error.message}`);
			return { status: 'failed', error: error.message };
		}
	}

	/**
	 * Determine if PR should be created
	 */
	shouldCreatePR(safetyResults, config, safetyMode) {
		// Check if auto-create PR is enabled
		if (!config.autoCreatePR) {
			console.log('📝 Auto-create PR is disabled');
			return false;
		}

		// In strict mode, require manual approval if there are any failures
		if (safetyMode === 'strict' && safetyResults.overall !== 'passed') {
			console.log('🔒 Strict mode: Manual approval required due to safety check issues');
			return false;
		}

		// In other modes, only block on failures (not warnings)
		if (safetyResults.overall === 'failed') {
			console.log('❌ Safety checks failed, blocking PR creation');
			return false;
		}

		return true;
	}

	/**
	 * Create PR
	 */
	async createPR(task, worktree, services, config, safetyResults) {
		try {
			console.log('🚀 Creating PR...');

			if (!worktree?.path) {
				throw new Error('No worktree available for PR creation');
			}

			let prResult;
			// Use existing completeSubtaskWithPR for subtasks, direct GitHub CLI for main tasks
			if (task?.isSubtask || String(task?.id).includes('.')) {
				console.log('  📝 Creating PR for subtask...');
				prResult = await services.backend?.completeSubtaskWithPR?.(task.id, worktree);
			} else {
				console.log('  📝 Creating PR for main task...');
				prResult = await this.createMainTaskPR(task, worktree, safetyResults);
			}

			console.log('✅ PR created successfully');
			return {
				success: true,
				message: 'PR created successfully',
				prResult
			};

		} catch (error) {
			console.error('❌ Failed to create PR:', error.message);
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Create PR for main task
	 */
	async createMainTaskPR(task, worktree, safetyResults) {
		const originalCwd = process.cwd();
		process.chdir(worktree.path);

		try {
			// Push the branch (changes already committed in commitSessionChanges)
			console.log(`  📤 Pushing branch ${worktree.branch}...`);
			execSync(`git push origin ${worktree.branch}`, { stdio: 'inherit' });

			// Create PR with safety results in description
			const safetyReport = this.generateSafetyReport(safetyResults);
			const prTitle = `Task ${task.id}: ${task.title}`;
			const prBody = `${task.description || ''}\n\n## Safety Check Results\n\n${safetyReport}`;

			console.log('  📋 Creating GitHub PR...');
			const prOutput = execSync(
				`gh pr create --title "${prTitle}" --body "${prBody}" --head ${worktree.branch}`,
				{ encoding: 'utf8' }
			);

			// Extract PR URL from output
			const prUrlMatch = prOutput.match(/https:\/\/github\.com\/[^\s]+/);
			const prUrl = prUrlMatch ? prUrlMatch[0] : null;

			return {
				success: true,
				prUrl,
				title: prTitle,
				description: prBody,
				branch: worktree.branch
			};

		} finally {
			process.chdir(originalCwd);
		}
	}

	/**
	 * Generate safety report for PR description
	 */
	generateSafetyReport(safetyResults) {
		const statusIcon = (status) => {
			switch (status) {
				case 'passed': return '✅';
				case 'warning': return '⚠️';
				case 'failed': return '❌';
				case 'skipped': return '⏭️';
				default: return '❓';
			}
		};

		let report = '';
		
		if (safetyResults.git.status !== 'skipped') {
			report += `${statusIcon(safetyResults.git.status)} **Git Status**: ${safetyResults.git.message || safetyResults.git.status}\n`;
		}
		
		if (safetyResults.build.status !== 'skipped') {
			report += `${statusIcon(safetyResults.build.status)} **Build**: ${safetyResults.build.command || 'Build check'} - ${safetyResults.build.status}\n`;
		}
		
		if (safetyResults.lint.status !== 'skipped') {
			const lintSummary = safetyResults.lint.summary || { total: 0, passed: 0, warnings: 0, failed: 0 };
			report += `${statusIcon(safetyResults.lint.status)} **Lint**: ${lintSummary.passed}/${lintSummary.total} tools passed\n`;
		}
		
		if (safetyResults.tests.status !== 'skipped') {
			report += `${statusIcon(safetyResults.tests.status)} **Tests**: ${safetyResults.tests.message || safetyResults.tests.status}\n`;
		}
		
		if (safetyResults.conflicts.status !== 'skipped') {
			report += `${statusIcon(safetyResults.conflicts.status)} **Conflicts**: ${safetyResults.conflicts.message || safetyResults.conflicts.status}\n`;
		}

		return report || 'No safety checks performed.';
	}

	/**
	 * Helper methods (reusing from pre-launch validation)
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

	async detectTestCommand() {
		const hasPackageJson = fs.existsSync('package.json');
		if (!hasPackageJson) {
			return { hasPackageJson: false, hasTestScript: false };
		}

		const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
		const hasTestScript = packageJson.scripts && packageJson.scripts.test;

		// Detect package manager
		let packageManager = 'npm';
		if (fs.existsSync('yarn.lock')) {
			packageManager = 'yarn';
		} else if (fs.existsSync('pnpm-lock.yaml')) {
			packageManager = 'pnpm';
		}

		return {
			hasPackageJson,
			hasTestScript,
			packageManager,
			testScript: packageJson.scripts?.test,
			command: hasTestScript ? `${packageManager} run test` : null
		};
	}

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
	 * Commit session changes immediately after Claude completion
	 */
	async commitSessionChanges(task, worktree, services) {
		try {
			console.log('💾 Committing session changes...');
			
			if (!worktree?.path) {
				return { success: false, error: 'No worktree available' };
			}

			const originalCwd = process.cwd();
			process.chdir(worktree.path);

			try {
				// Check if there are any changes to commit
				let hasChanges = false;
				try {
					const status = execSync('git status --porcelain', { encoding: 'utf8' });
					hasChanges = status.trim().length > 0;
				} catch (error) {
					return { success: false, error: `Git status check failed: ${error.message}` };
				}

				if (!hasChanges) {
					console.log('  ℹ️  No changes to commit');
					return { success: true, message: 'No changes to commit', hasChanges: false };
				}

				// Stage all changes
				try {
					execSync('git add .', { stdio: 'inherit' });
					console.log('  ✅ Changes staged');
				} catch (error) {
					return { success: false, error: `Failed to stage changes: ${error.message}` };
				}

				// Create commit message
				const commitMessage = task?.isSubtask || String(task?.id).includes('.')
					? `Complete subtask ${task.id}: ${task.title || 'Claude Code session'}`
					: `Complete task ${task.id}: ${task.title || 'Claude Code session'}`;

				// Commit changes
				try {
					execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
					console.log(`  ✅ Changes committed: ${commitMessage}`);
				} catch (error) {
					return { success: false, error: `Failed to commit changes: ${error.message}` };
				}

				// Get commit hash for reference
				let commitHash;
				try {
					commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
				} catch (error) {
					// Not critical if we can't get the hash
					commitHash = 'unknown';
				}

				return {
					success: true,
					message: 'Changes committed successfully',
					hasChanges: true,
					commitMessage,
					commitHash: commitHash.substring(0, 8) // Short hash
				};

			} finally {
				process.chdir(originalCwd);
			}

		} catch (error) {
			console.error('❌ Failed to commit session changes:', error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Update task status to 'done' after successful session
	 */
	async updateTaskStatus(task, services) {
		try {
			console.log('📝 Updating task status to done...');
			
			if (!task?.id) {
				return { success: false, error: 'No task ID available' };
			}

			if (!services?.backend) {
				return { success: false, error: 'Backend service not available' };
			}

			// Update task status to 'done'
			const result = await services.backend.setTaskStatus({
				id: task.id,
				status: 'done'
			});

			if (result?.success) {
				console.log(`  ✅ Task ${task.id} marked as done`);
				return {
					success: true,
					message: `Task ${task.id} marked as done`,
					taskId: task.id,
					previousStatus: task.status,
					newStatus: 'done'
				};
			} else {
				return { 
					success: false, 
					error: result?.error || 'Failed to update task status' 
				};
			}

		} catch (error) {
			console.error('❌ Failed to update task status:', error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Detect repository type and capabilities
	 */
	async detectRepositoryType(services) {
		try {
			// Use backend's repository detection if available
			if (services.backend?.detectRemoteRepository) {
				const repoInfo = await services.backend.detectRemoteRepository();
				return {
					type: repoInfo.isGitHub ? 'github' : (repoInfo.hasRemote ? 'remote' : 'local'),
					hasRemote: repoInfo.hasRemote,
					isGitHub: repoInfo.isGitHub,
					canCreatePR: repoInfo.hasGitHubCLI || false,
					provider: repoInfo.provider || 'unknown',
					url: repoInfo.url || null
				};
			}

			// Fallback detection
			try {
				const remoteUrl = execSync('git remote get-url origin', { 
					encoding: 'utf8', 
					stdio: 'pipe' 
				}).trim();
				
				const isGitHub = remoteUrl.includes('github.com');
				
				// Check GitHub CLI availability
				let hasGitHubCLI = false;
				try {
					execSync('gh --version', { stdio: 'ignore' });
					hasGitHubCLI = true;
				} catch {
					hasGitHubCLI = false;
				}

				return {
					type: isGitHub ? 'github' : 'remote',
					hasRemote: true,
					isGitHub,
					canCreatePR: isGitHub && hasGitHubCLI,
					provider: isGitHub ? 'GitHub' : 'Unknown',
					url: remoteUrl
				};
			} catch {
				// No remote found
				return {
					type: 'local',
					hasRemote: false,
					isGitHub: false,
					canCreatePR: false,
					provider: 'local',
					url: null
				};
			}
		} catch (error) {
			console.warn('Repository detection failed:', error.message);
			return {
				type: 'unknown',
				hasRemote: false,
				isGitHub: false,
				canCreatePR: false,
				provider: 'unknown',
				url: null,
				error: error.message
			};
		}
	}

	/**
	 * Execute the appropriate workflow based on repository type and configuration
	 */
	async executeWorkflow(task, worktree, services, config, safetyMode, repoInfo) {
		try {
			console.log('🔄 Executing integrated workflow...');

			// For subtasks, use the existing WorktreeManager workflow
			if (task?.isSubtask || String(task?.id).includes('.')) {
				return await this.executeSubtaskWorkflow(task, worktree, services, config, safetyMode, repoInfo);
			} else {
				return await this.executeTaskWorkflow(task, worktree, services, config, safetyMode, repoInfo);
			}

		} catch (error) {
			console.error('❌ Workflow execution failed:', error.message);
			return {
				success: false,
				error: error.message,
				phase: 'workflow-execution'
			};
		}
	}

	/**
	 * Execute subtask workflow using WorktreeManager.completeSubtask()
	 */
	async executeSubtaskWorkflow(task, worktree, services, config, safetyMode, repoInfo) {
		try {
			console.log('📋 Executing subtask workflow...');

			const workflowChoice = this.determineWorkflowChoice(repoInfo, config, safetyMode);
			console.log(`🔀 Workflow choice: ${workflowChoice}`);

			// For PR workflow, do NOT mark task as done yet - wait for PR merge
			// For local merge workflow, mark as done after merge completes
			const shouldMarkDoneNow = workflowChoice === 'merge-local';

			// Prepare options for WorktreeManager.completeSubtask()
			const options = {
				autoCommit: true,
				commitMessage: `Complete subtask ${task.id}: ${task.title || 'Claude Code session'}`,
				commitType: 'feat',
				workflowChoice,
				// Don't auto-mark as done if we're creating a PR
				autoMarkDone: shouldMarkDoneNow
			};

			// Use the worktree name to call completeSubtask
			const worktreeName = worktree.name || `task-${task.id}`;
			
			if (!services.backend?.completeSubtask) {
				throw new Error('Backend completeSubtask method not available');
			}

			const result = await services.backend.completeSubtask(worktreeName, options);

			if (result.success) {
				console.log('✅ Subtask workflow completed successfully');
				
				// Handle task status updates based on workflow choice
				const statusResult = await this.handleTaskStatusAfterWorkflow(
					task, services, workflowChoice, result
				);

				return {
					success: true,
					workflowType: 'subtask',
					workflowChoice,
					taskStatusUpdated: statusResult.updated,
					parentTaskChecked: statusResult.parentChecked,
					result
				};
			} else if (result.reason === 'workflow-choice-needed') {
				// Handle case where user choice is needed
				console.log('🤔 Workflow choice needed, applying automatic decision...');
				
				// Make automatic choice based on repository type and safety mode
				const autoChoice = this.makeAutomaticWorkflowChoice(repoInfo, config, safetyMode);
				const autoShouldMarkDone = autoChoice === 'merge-local';
				
				const retryOptions = { 
					...options, 
					workflowChoice: autoChoice,
					autoMarkDone: autoShouldMarkDone
				};

				const retryResult = await services.backend.completeSubtask(worktreeName, retryOptions);
				
				// Handle status updates for retry case
				const statusResult = await this.handleTaskStatusAfterWorkflow(
					task, services, autoChoice, retryResult
				);
				
				return {
					success: retryResult.success,
					workflowType: 'subtask',
					workflowChoice: autoChoice,
					automaticChoice: true,
					taskStatusUpdated: statusResult.updated,
					parentTaskChecked: statusResult.parentChecked,
					result: retryResult
				};
			} else {
				console.log('⚠️ Subtask workflow completed with issues:', result.reason);
				return {
					success: false,
					workflowType: 'subtask',
					error: result.error || result.reason,
					result
				};
			}

		} catch (error) {
			console.error('❌ Subtask workflow failed:', error.message);
			
			// Fallback to manual commit and status update
			console.log('🔄 Falling back to manual workflow...');
			return await this.executeFallbackWorkflow(task, worktree, services, config, safetyMode, repoInfo);
		}
	}

	/**
	 * Execute task workflow (for main tasks, not subtasks)
	 */
	async executeTaskWorkflow(task, worktree, services, config, safetyMode, repoInfo) {
		try {
			console.log('📄 Executing main task workflow...');

			// For main tasks, use the manual workflow since WorktreeManager.completeSubtask() 
			// is specifically for subtasks
			const result = await this.executeFallbackWorkflow(task, worktree, services, config, safetyMode, repoInfo);
			
			// Add workflow type for consistency
			result.workflowType = 'task';
			result.isMainTask = true;
			
			return result;

		} catch (error) {
			console.error('❌ Task workflow failed:', error.message);
			return {
				success: false,
				workflowType: 'task',
				error: error.message,
				phase: 'task-workflow'
			};
		}
	}

	/**
	 * Execute fallback workflow with manual steps
	 */
	async executeFallbackWorkflow(task, worktree, services, config, safetyMode, repoInfo) {
		const results = {
			success: true,
			workflowType: 'fallback',
			steps: {}
		};

		try {
			// Step 1: Commit changes
			console.log('💾 Step 1: Committing changes...');
			results.steps.commit = await this.commitSessionChanges(task, worktree, services);
			
			if (!results.steps.commit.success) {
				console.log('⚠️ Commit failed, but continuing...');
			}

			// Step 2: Run safety checks if configured
			if (config.runSafetyChecks !== false) {
				console.log('🔍 Step 2: Running safety checks...');
				results.steps.safetyChecks = await this.runSafetyChecks(config, worktree, services);
			}

			// Step 3: Handle repository workflow
			const workflowChoice = this.determineWorkflowChoice(repoInfo, config, safetyMode);
			console.log(`🔀 Step 3: Executing ${workflowChoice} workflow...`);

			if (workflowChoice === 'create-pr' && repoInfo.canCreatePR) {
				results.steps.pr = await this.createPR(task, worktree, services, config, results.steps.safetyChecks);
				// For PR workflow, do NOT mark task as done - it will be done when PR merges
				console.log('📝 PR created - task status will be updated when PR is merged');
				results.steps.taskStatusDeferred = true;
			} else if (workflowChoice === 'merge-local') {
				results.steps.merge = await this.executeLocalMerge(task, worktree, services);
				
				// For local merge, mark task as done after merge completes
				if (results.steps.merge.success) {
					console.log('📝 Step 4: Updating task status after local merge...');
					const statusResult = await this.handleTaskStatusAfterWorkflow(
						task, services, workflowChoice, { success: true }
					);
					results.steps.taskStatus = statusResult;
				}
			} else {
				console.log('ℹ️ No additional workflow steps required');
				results.steps.workflow = { 
					success: true, 
					message: 'No additional workflow steps required',
					choice: workflowChoice 
				};
				
				// If no special workflow, mark task as done now
				console.log('📝 Step 4: Updating task status...');
				const statusResult = await this.handleTaskStatusAfterWorkflow(
					task, services, workflowChoice, { success: true }
				);
				results.steps.taskStatus = statusResult;
			}

			return results;

		} catch (error) {
			console.error('❌ Fallback workflow failed:', error.message);
			results.success = false;
			results.error = error.message;
			return results;
		}
	}

	/**
	 * Determine the appropriate workflow choice based on repository type and configuration
	 */
	determineWorkflowChoice(repoInfo, config, safetyMode) {
		// Force local merge for local repositories
		if (!repoInfo.hasRemote) {
			return 'merge-local';
		}

		// Check if PR creation is disabled
		if (config.enableAutoPR === false) {
			return 'merge-local';
		}

		// For GitHub repositories with CLI, prefer PR creation
		if (repoInfo.isGitHub && repoInfo.canCreatePR) {
			return 'create-pr';
		}

		// For other remote repositories, use local merge
		if (repoInfo.hasRemote) {
			return 'merge-local';
		}

		// Default to local merge
		return 'merge-local';
	}

	/**
	 * Make automatic workflow choice when WorktreeManager needs a decision
	 */
	makeAutomaticWorkflowChoice(repoInfo, config, safetyMode) {
		const choice = this.determineWorkflowChoice(repoInfo, config, safetyMode);
		console.log(`🤖 Automatic workflow choice: ${choice}`);
		return choice;
	}

	/**
	 * Execute local merge workflow
	 */
	async executeLocalMerge(task, worktree, services) {
		try {
			console.log('🔗 Executing local merge...');
			
			// This would integrate with LocalMergeManager if available
			// For now, just return success since changes are already committed
			return {
				success: true,
				message: 'Changes committed and ready for manual merge',
				type: 'local-merge',
				branch: worktree.branch || worktree.name
			};

		} catch (error) {
			console.error('❌ Local merge failed:', error.message);
			return {
				success: false,
				error: error.message,
				type: 'local-merge'
			};
		}
	}

	/**
	 * Handle task status updates based on workflow choice and completion status
	 */
	async handleTaskStatusAfterWorkflow(task, services, workflowChoice, workflowResult) {
		try {
			const result = {
				updated: false,
				parentChecked: false,
				parentUpdated: false,
				taskId: task.id,
				workflowChoice
			};

			// For PR workflows, do NOT mark as done - wait for PR merge
			if (workflowChoice === 'create-pr') {
				console.log(`📝 Deferring status update for ${task.id} - waiting for PR merge`);
				result.deferred = true;
				result.reason = 'waiting-for-pr-merge';
				return result;
			}

			// For other workflows, mark as done if workflow was successful
			if (!workflowResult?.success) {
				console.log(`📝 Skipping status update for ${task.id} - workflow not successful`);
				result.skipped = true;
				result.reason = 'workflow-failed';
				return result;
			}

			// Update the current task/subtask to done
			console.log(`📝 Marking ${task.id} as done...`);
			const statusResult = await this.updateTaskStatus(task, services);
			
			if (statusResult.success) {
				result.updated = true;
				console.log(`✅ Task ${task.id} marked as done`);

				// If this is a subtask, check if parent task should be marked as done
				if (task.isSubtask || String(task.id).includes('.')) {
					const parentResult = await this.checkAndUpdateParentTask(task, services);
					result.parentChecked = true;
					result.parentUpdated = parentResult.updated;
					result.parentTaskId = parentResult.parentTaskId;
					
					if (parentResult.updated) {
						console.log(`✅ Parent task ${parentResult.parentTaskId} also marked as done`);
					}
				}
			} else {
				console.log(`⚠️ Failed to mark ${task.id} as done:`, statusResult.error);
				result.error = statusResult.error;
			}

			return result;

		} catch (error) {
			console.error('❌ Error handling task status after workflow:', error.message);
			return {
				updated: false,
				parentChecked: false,
				taskId: task.id,
				error: error.message
			};
		}
	}

	/**
	 * Check if all subtasks are complete and update parent task if so
	 */
	async checkAndUpdateParentTask(subtask, services) {
		try {
			const subtaskId = String(subtask.id);
			const parentTaskId = subtaskId.includes('.') ? subtaskId.split('.')[0] : null;
			
			if (!parentTaskId) {
				return { updated: false, reason: 'not-a-subtask' };
			}

			console.log(`🔍 Checking parent task ${parentTaskId} completion status...`);

			// Get the parent task to check all its subtasks
			if (!services.backend?.getTask) {
				console.log('⚠️ Backend getTask method not available');
				return { updated: false, parentTaskId, reason: 'backend-unavailable' };
			}

			const parentTask = await services.backend.getTask({ id: parentTaskId });
			
			if (!parentTask || !parentTask.subtasks || parentTask.subtasks.length === 0) {
				console.log(`⚠️ Parent task ${parentTaskId} not found or has no subtasks`);
				return { updated: false, parentTaskId, reason: 'parent-not-found' };
			}

			// Check if all subtasks are done
			const allSubtasksDone = parentTask.subtasks.every(st => 
				st.status === 'done' || st.status === 'completed'
			);

			if (allSubtasksDone && parentTask.status !== 'done' && parentTask.status !== 'completed') {
				console.log(`🎯 All subtasks of task ${parentTaskId} are complete - marking parent as done`);
				
				const parentStatusResult = await services.backend.setTaskStatus({
					id: parentTaskId,
					status: 'done'
				});

				if (parentStatusResult?.success) {
					return { 
						updated: true, 
						parentTaskId,
						message: `Parent task ${parentTaskId} marked as done` 
					};
				} else {
					return { 
						updated: false, 
						parentTaskId,
						error: parentStatusResult?.error || 'Failed to update parent status'
					};
				}
			} else {
				const remainingSubtasks = parentTask.subtasks.filter(st => 
					st.status !== 'done' && st.status !== 'completed'
				).length;
				
				console.log(`📊 Parent task ${parentTaskId} status: ${parentTask.status}, remaining subtasks: ${remainingSubtasks}`);
				return { 
					updated: false, 
					parentTaskId,
					reason: remainingSubtasks > 0 ? 'subtasks-remaining' : 'parent-already-done',
					remainingSubtasks
				};
			}

		} catch (error) {
			console.error('❌ Error checking parent task:', error.message);
			return { 
				updated: false, 
				parentTaskId: parentTaskId || 'unknown',
				error: error.message 
			};
		}
	}

	/**
	 * TODO: Phase 3 - PR Merge Monitoring
	 * This method will be implemented to monitor PR status and update task status when merged
	 */
	async handlePRMergeMonitoring(task, prResult, services) {
		// Future implementation will:
		// 1. Set up periodic monitoring of PR status
		// 2. Detect when PR is merged successfully  
		// 3. Call handleTaskStatusAfterWorkflow with 'pr-merged' workflow choice
		// 4. Clean up associated worktrees and branches
		// 5. Handle parent task completion checking for subtasks
		
		console.log(`📝 TODO: Set up PR merge monitoring for task ${task.id}, PR: ${prResult.prUrl}`);
		return {
			monitoringSetup: false,
			reason: 'phase-3-not-implemented',
			prUrl: prResult.prUrl,
			taskId: task.id
		};
	}
} 