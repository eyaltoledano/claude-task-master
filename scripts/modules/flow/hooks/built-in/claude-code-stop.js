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

			// Run safety checks based on mode
			const safetyResults = await this.runSafetyChecks(effectiveConfig, worktree, services);

			// Determine if we should proceed with PR creation
			const shouldCreatePR = this.shouldCreatePR(safetyResults, effectiveConfig, safetyMode);

			if (shouldCreatePR) {
				await this.createPR(task, worktree, services, effectiveConfig, safetyResults);
			} else {
				console.log('❌ PR creation skipped due to safety check failures or configuration');
			}

			return {
				success: true,
				safetyMode,
				safetyResults,
				prCreated: shouldCreatePR,
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

			// Use existing completeSubtaskWithPR for subtasks, direct GitHub CLI for main tasks
			if (task?.isSubtask || String(task?.id).includes('.')) {
				console.log('  📝 Creating PR for subtask...');
				await services.backend?.completeSubtaskWithPR?.(task.id, worktree);
			} else {
				console.log('  📝 Creating PR for main task...');
				await this.createMainTaskPR(task, worktree, safetyResults);
			}

			console.log('✅ PR created successfully');

		} catch (error) {
			console.error('❌ Failed to create PR:', error.message);
			throw error;
		}
	}

	/**
	 * Create PR for main task
	 */
	async createMainTaskPR(task, worktree, safetyResults) {
		const originalCwd = process.cwd();
		process.chdir(worktree.path);

		try {
			// Commit any remaining changes
			try {
				execSync('git add .', { stdio: 'pipe' });
				execSync(`git commit -m "Complete task ${task.id}: ${task.title}"`, { stdio: 'pipe' });
			} catch (error) {
				// Ignore if nothing to commit
			}

			// Push the branch
			execSync(`git push origin ${worktree.branch}`, { stdio: 'pipe' });

			// Create PR with safety results in description
			const safetyReport = this.generateSafetyReport(safetyResults);
			const prTitle = `Task ${task.id}: ${task.title}`;
			const prBody = `${task.description || ''}\n\n## Safety Check Results\n\n${safetyReport}`;

			execSync(
				`gh pr create --title "${prTitle}" --body "${prBody}" --head ${worktree.branch}`,
				{ stdio: 'pipe' }
			);

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
} 