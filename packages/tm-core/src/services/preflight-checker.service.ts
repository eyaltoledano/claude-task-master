/**
 * @fileoverview Preflight Checker Service
 * Validates environment and prerequisites for autopilot execution
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getLogger } from '../logger/factory.js';

// Import git utilities (JS module without type definitions)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gitUtils = require('../../../../scripts/modules/utils/git-utils.js');
const isGitRepository = gitUtils.isGitRepository as (
	projectRoot: string
) => Promise<boolean>;
const isGhCliAvailable = gitUtils.isGhCliAvailable as (
	projectRoot: string
) => Promise<boolean>;
const getDefaultBranch = gitUtils.getDefaultBranch as (
	projectRoot: string
) => Promise<string | null>;

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

			// Check for uncommitted changes
			try {
				execSync('git diff-index --quiet HEAD --', {
					cwd: this.projectRoot,
					stdio: 'pipe'
				});

				// Also check for untracked files
				const status = execSync('git status --porcelain', {
					cwd: this.projectRoot,
					encoding: 'utf-8'
				});

				if (status.trim().length > 0) {
					return {
						success: false,
						value: 'dirty',
						message:
							'Working tree has uncommitted changes. Please commit or stash them.'
					};
				}

				return {
					success: true,
					value: 'clean',
					message: 'Working tree is clean'
				};
			} catch (error: any) {
				// git diff-index returns non-zero if there are changes
				return {
					success: false,
					value: 'dirty',
					message:
						'Working tree has uncommitted changes. Please commit or stash them.'
				};
			}
		} catch (error: any) {
			return {
				success: false,
				message: `Git check failed: ${error.message}`
			};
		}
	}

	/**
	 * Validate required tools availability
	 */
	async validateRequiredTools(): Promise<CheckResult> {
		const tools: ToolCheck[] = [];

		// Check git
		tools.push(this.checkTool('git', ['--version']));

		// Check gh CLI
		const ghAvailable = await isGhCliAvailable(this.projectRoot);
		tools.push({
			name: 'gh',
			available: ghAvailable,
			message: ghAvailable ? 'GitHub CLI available' : 'GitHub CLI not available'
		});

		// Check node
		tools.push(this.checkTool('node', ['--version']));

		// Check npm
		tools.push(this.checkTool('npm', ['--version']));

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
				stdio: 'pipe'
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

		const summary = allSuccess
			? `All preflight checks passed (${passed.length}/4)`
			: `Preflight checks failed: ${failed.join(', ')} (${passed.length}/4 passed)`;

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
