/**
 * @fileoverview Preflight Checker Service
 * Validates environment and prerequisites for autopilot execution
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getLogger } from '../../../common/logger/factory.js';
import {
	isGitRepository,
	isGhCliAvailable,
	getDefaultBranch
} from '../../../common/utils/git-utils.js';

const logger = getLogger('PreflightChecker');

/**
 * Result of a single preflight check
 */
export interface CheckResult {
	/** Whether the check passed */
	success: boolean;
	/** The value detected/validated */
	value?: any;
	/** Error or warning message */
	message?: string;
}

/**
 * Complete preflight validation results
 */
export interface PreflightResult {
	/** Overall success - all checks passed */
	success: boolean;
	/** Test command detection result */
	testCommand: CheckResult;
	/** Git working tree status */
	gitWorkingTree: CheckResult;
	/** Required tools availability */
	requiredTools: CheckResult;
	/** Default branch detection */
	defaultBranch: CheckResult;
	/** Summary message */
	summary: string;
}

/**
 * Tool validation result
 */
interface ToolCheck {
	name: string;
	available: boolean;
	version?: string;
	message?: string;
}

/**
 * PreflightChecker validates environment for autopilot execution
 */
export class PreflightChecker {
	private projectRoot: string;

	constructor(projectRoot: string) {
		if (!projectRoot) {
			throw new Error('projectRoot is required for PreflightChecker');
		}
		this.projectRoot = projectRoot;
	}

	/**
	 * Detect test command from package.json
	 */
	async detectTestCommand(): Promise<CheckResult> {
		try {
			const packageJsonPath = join(this.projectRoot, 'package.json');
			const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
			const packageJson = JSON.parse(packageJsonContent);

			if (!packageJson.scripts || !packageJson.scripts.test) {
				return {
					success: false,
					message:
						'No test script found in package.json. Please add a "test" script.'
				};
			}

			const testCommand = packageJson.scripts.test;

			return {
				success: true,
				value: testCommand,
				message: `Test command: ${testCommand}`
			};
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return {
					success: false,
					message: 'package.json not found in project root'
				};
			}

			return {
				success: false,
				message: `Failed to read package.json: ${error.message}`
			};
		}
	}

	/**
	 * Check git working tree status
	 */
	async checkGitWorkingTree(): Promise<CheckResult> {
		try {
			// Check if it's a git repository
			const isRepo = await isGitRepository(this.projectRoot);
			if (!isRepo) {
				return {
					success: false,
					message: 'Not a git repository. Initialize git first.'
				};
			}

			// Check for changes (staged/unstaged/untracked) without requiring HEAD
			const status = execSync('git status --porcelain', {
				cwd: this.projectRoot,
				encoding: 'utf-8',
				timeout: 5000
			});
			if (status.trim().length > 0) {
				return {
					success: false,
					value: 'dirty',
					message:
						'Working tree has uncommitted or untracked changes. Please commit or stash them.'
				};
			}
			return {
				success: true,
				value: 'clean',
				message: 'Working tree is clean'
			};
		} catch (error: any) {
			return {
				success: false,
				message: `Git check failed: ${error.message}`
			};
		}
	}

	/**
	 * Detect project types based on common configuration files
	 */
	private detectProjectTypes(): string[] {
		const types: string[] = [];

		if (existsSync(join(this.projectRoot, 'package.json'))) types.push('node');
		if (
			existsSync(join(this.projectRoot, 'requirements.txt')) ||
			existsSync(join(this.projectRoot, 'setup.py')) ||
			existsSync(join(this.projectRoot, 'pyproject.toml'))
		)
			types.push('python');
		if (
			existsSync(join(this.projectRoot, 'pom.xml')) ||
			existsSync(join(this.projectRoot, 'build.gradle'))
		)
			types.push('java');
		if (existsSync(join(this.projectRoot, 'go.mod'))) types.push('go');
		if (existsSync(join(this.projectRoot, 'Cargo.toml'))) types.push('rust');
		if (existsSync(join(this.projectRoot, 'composer.json'))) types.push('php');
		if (existsSync(join(this.projectRoot, 'Gemfile'))) types.push('ruby');
		const files = readdirSync(this.projectRoot);
		if (files.some((f) => f.endsWith('.csproj') || f.endsWith('.sln')))
			types.push('dotnet');

		return types;
	}

	/**
	 * Get required tools for a project type
	 */
	private getToolsForProjectType(
		type: string
	): Array<{ command: string; args: string[] }> {
		const toolMap: Record<
			string,
			Array<{ command: string; args: string[] }>
		> = {
			node: [
				{ command: 'node', args: ['--version'] },
				{ command: 'npm', args: ['--version'] }
			],
			python: [
				{ command: 'python3', args: ['--version'] },
				{ command: 'pip3', args: ['--version'] }
			],
			java: [{ command: 'java', args: ['--version'] }],
			go: [{ command: 'go', args: ['version'] }],
			rust: [{ command: 'cargo', args: ['--version'] }],
			php: [
				{ command: 'php', args: ['--version'] },
				{ command: 'composer', args: ['--version'] }
			],
			ruby: [
				{ command: 'ruby', args: ['--version'] },
				{ command: 'bundle', args: ['--version'] }
			],
			dotnet: [{ command: 'dotnet', args: ['--version'] }]
		};

		return toolMap[type] || [];
	}

	/**
	 * Validate required tools availability
	 */
	async validateRequiredTools(): Promise<CheckResult> {
		const tools: ToolCheck[] = [];

		// Always check git and gh CLI
		tools.push(this.checkTool('git', ['--version']));
		tools.push(await this.checkGhCli());

		// Detect project types and check their tools
		const projectTypes = this.detectProjectTypes();

		if (projectTypes.length === 0) {
			logger.warn('No recognized project type detected');
		} else {
			logger.info(`Detected project types: ${projectTypes.join(', ')}`);
		}

		for (const type of projectTypes) {
			const typeTools = this.getToolsForProjectType(type);
			for (const tool of typeTools) {
				tools.push(this.checkTool(tool.command, tool.args));
			}
		}

		// Determine overall success
		const allAvailable = tools.every((tool) => tool.available);
		const missingTools = tools
			.filter((tool) => !tool.available)
			.map((tool) => tool.name);

		if (!allAvailable) {
			return {
				success: false,
				value: tools,
				message: `Missing required tools: ${missingTools.join(', ')}`
			};
		}

		return {
			success: true,
			value: tools,
			message: 'All required tools are available'
		};
	}

	/**
	 * Check if a command-line tool is available
	 */
	private checkTool(command: string, versionArgs: string[]): ToolCheck {
		try {
			const version = execSync(`${command} ${versionArgs.join(' ')}`, {
				cwd: this.projectRoot,
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 5000
			})
				.trim()
				.split('\n')[0];

			return {
				name: command,
				available: true,
				version,
				message: `${command} ${version}`
			};
		} catch (error) {
			return {
				name: command,
				available: false,
				message: `${command} not found`
			};
		}
	}

	/**
	 * Check GitHub CLI installation and authentication status
	 */
	private async checkGhCli(): Promise<ToolCheck> {
		try {
			const version = execSync('gh --version', {
				cwd: this.projectRoot,
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 5000
			})
				.trim()
				.split('\n')[0];
			const authed = await isGhCliAvailable(this.projectRoot);
			return {
				name: 'gh',
				available: true,
				version,
				message: authed
					? 'GitHub CLI installed (authenticated)'
					: 'GitHub CLI installed (not authenticated)'
			};
		} catch {
			return { name: 'gh', available: false, message: 'GitHub CLI not found' };
		}
	}

	/**
	 * Detect default branch
	 */
	async detectDefaultBranch(): Promise<CheckResult> {
		try {
			const defaultBranch = await getDefaultBranch(this.projectRoot);

			if (!defaultBranch) {
				return {
					success: false,
					message:
						'Could not determine default branch. Make sure remote is configured.'
				};
			}

			return {
				success: true,
				value: defaultBranch,
				message: `Default branch: ${defaultBranch}`
			};
		} catch (error: any) {
			return {
				success: false,
				message: `Failed to detect default branch: ${error.message}`
			};
		}
	}

	/**
	 * Run all preflight checks
	 */
	async runAllChecks(): Promise<PreflightResult> {
		logger.info('Running preflight checks...');

		const testCommand = await this.detectTestCommand();
		const gitWorkingTree = await this.checkGitWorkingTree();
		const requiredTools = await this.validateRequiredTools();
		const defaultBranch = await this.detectDefaultBranch();

		const allSuccess =
			testCommand.success &&
			gitWorkingTree.success &&
			requiredTools.success &&
			defaultBranch.success;

		// Build summary
		const passed: string[] = [];
		const failed: string[] = [];

		if (testCommand.success) passed.push('Test command');
		else failed.push('Test command');

		if (gitWorkingTree.success) passed.push('Git working tree');
		else failed.push('Git working tree');

		if (requiredTools.success) passed.push('Required tools');
		else failed.push('Required tools');

		if (defaultBranch.success) passed.push('Default branch');
		else failed.push('Default branch');

		const total = passed.length + failed.length;
		const summary = allSuccess
			? `All preflight checks passed (${passed.length}/${total})`
			: `Preflight checks failed: ${failed.join(', ')} (${passed.length}/${total} passed)`;

		logger.info(summary);

		return {
			success: allSuccess,
			testCommand,
			gitWorkingTree,
			requiredTools,
			defaultBranch,
			summary
		};
	}
}
