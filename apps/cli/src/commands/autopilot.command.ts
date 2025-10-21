/**
 * @fileoverview AutopilotCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 * This is a thin presentation layer over @tm/core's autopilot functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora, { type Ora } from 'ora';
import { createTmCore, type TmCore, type Task, type Subtask } from '@tm/core';
import * as ui from '../utils/ui.js';

/**
 * CLI-specific options interface for the autopilot command
 */
export interface AutopilotCommandOptions {
	format?: 'text' | 'json';
	project?: string;
	dryRun?: boolean;
}

/**
 * Preflight check result for a single check
 */
export interface PreflightCheckResult {
	success: boolean;
	message?: string;
}

/**
 * Overall preflight check results
 */
export interface PreflightResult {
	success: boolean;
	testCommand: PreflightCheckResult;
	gitWorkingTree: PreflightCheckResult;
	requiredTools: PreflightCheckResult;
	defaultBranch: PreflightCheckResult;
}

/**
 * CLI-specific result type from autopilot command
 */
export interface AutopilotCommandResult {
	success: boolean;
	taskId: string;
	task?: Task;
	error?: string;
	message?: string;
}

/**
 * AutopilotCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core's autopilot functionality
 */
export class AutopilotCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: AutopilotCommandResult;

	constructor(name?: string) {
		super(name || 'autopilot');

		// Configure the command
		this.description(
			'Execute a task autonomously using TDD workflow with git integration'
		)
			.argument('<taskId>', 'Task ID to execute autonomously')
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.option(
				'--dry-run',
				'Show what would be executed without performing actions'
			)
			.action(async (taskId: string, options: AutopilotCommandOptions) => {
				await this.executeCommand(taskId, options);
			});
	}

	/**
	 * Execute the autopilot command
	 */
	private async executeCommand(
		taskId: string,
		options: AutopilotCommandOptions
	): Promise<void> {
		let spinner: Ora | null = null;

		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Validate task ID format
			if (!this.validateTaskId(taskId)) {
				ui.displayError(`Invalid task ID format: ${taskId}`);
				process.exit(1);
			}

			// Initialize tm-core with spinner
			spinner = ora('Initializing Task Master...').start();
			await this.initializeCore(options.project || process.cwd());
			spinner.succeed('Task Master initialized');

			// Load and validate task existence
			spinner = ora(`Loading task ${taskId}...`).start();
			const task = await this.loadTask(taskId);

			if (!task) {
				spinner.fail(`Task ${taskId} not found`);
				ui.displayError(`Task with ID ${taskId} does not exist`);
				process.exit(1);
			}

			spinner.succeed(`Task ${taskId} loaded`);

			// Display task information
			this.displayTaskInfo(task, options.dryRun || false);

			// Execute autopilot logic (placeholder for now)
			const result = await this.performAutopilot(taskId, task, options);

			// Store result for programmatic access
			this.setLastResult(result);

			// Display results
			this.displayResults(result, options);
		} catch (error: unknown) {
			if (spinner) {
				spinner.fail('Operation failed');
			}
			this.handleError(error);
			process.exit(1);
		}
	}

	/**
	 * Validate command options
	 */
	private validateOptions(options: AutopilotCommandOptions): boolean {
		// Validate format
		if (options.format && !['text', 'json'].includes(options.format)) {
			console.error(chalk.red(`Invalid format: ${options.format}`));
			console.error(chalk.gray(`Valid formats: text, json`));
			return false;
		}

		return true;
	}

	/**
	 * Validate task ID format
	 */
	private validateTaskId(taskId: string): boolean {
		// Task ID should be a number or number.number format (e.g., "1" or "1.2")
		const taskIdPattern = /^\d+(\.\d+)*$/;
		return taskIdPattern.test(taskId);
	}

	/**
	 * Initialize TmCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({ projectPath: projectRoot });
		}
	}

	/**
	 * Load task from tm-core
	 */
	private async loadTask(taskId: string): Promise<Task | null> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}

		try {
			const { task } = await this.tmCore.tasks.get(taskId);
			return task;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Display task information before execution
	 */
	private displayTaskInfo(task: Task, isDryRun: boolean): void {
		const prefix = isDryRun ? '[DRY RUN] ' : '';
		console.log();
		console.log(
			boxen(
				chalk.cyan.bold(`${prefix}Autopilot Task Execution`) +
					'\n\n' +
					chalk.white(`Task ID: ${task.id}`) +
					'\n' +
					chalk.white(`Title: ${task.title}`) +
					'\n' +
					chalk.white(`Status: ${task.status}`) +
					(task.description ? '\n\n' + chalk.gray(task.description) : ''),
				{
					padding: 1,
					borderStyle: 'round',
					borderColor: 'cyan',
					width: process.stdout.columns ? process.stdout.columns * 0.95 : 100
				}
			)
		);
		console.log();
	}

	/**
	 * Perform autopilot execution using PreflightChecker and TaskLoader
	 */
	private async performAutopilot(
		taskId: string,
		task: Task,
		options: AutopilotCommandOptions
	): Promise<AutopilotCommandResult> {
		// Run preflight checks
		const preflightResult = await this.runPreflightChecks(options);
		if (!preflightResult.success) {
			return {
				success: false,
				taskId,
				task,
				error: 'Preflight checks failed',
				message: 'Please resolve the issues above before running autopilot'
			};
		}

		// Validate task structure and get execution order
		const validationResult = await this.validateTaskStructure(taskId, task);
		if (!validationResult.success) {
			return validationResult;
		}

		// Display execution plan
		this.displayExecutionPlan(
			validationResult.task!,
			validationResult.orderedSubtasks!,
			options
		);

		return {
			success: true,
			taskId,
			task: validationResult.task,
			message: options.dryRun
				? 'Dry run completed successfully'
				: 'Autopilot execution ready (actual execution not yet implemented)'
		};
	}

	/**
	 * Run preflight checks and display results
	 */
	private async runPreflightChecks(
		options: AutopilotCommandOptions
	): Promise<PreflightResult> {
		const { PreflightChecker } = await import('@tm/core');

		console.log();
		console.log(chalk.cyan.bold('Running preflight checks...'));

		const preflightChecker = new PreflightChecker(
			options.project || process.cwd()
		);
		const result = await preflightChecker.runAllChecks();

		this.displayPreflightResults(result);

		return result;
	}

	/**
	 * Validate task structure and get execution order
	 */
	private async validateTaskStructure(
		taskId: string,
		task: Task
	): Promise<AutopilotCommandResult & { orderedSubtasks?: Subtask[] }> {
		if (!this.tmCore) {
			return {
				success: false,
				taskId,
				task,
				error: 'TmCore not initialized'
			};
		}

		console.log();
		console.log(chalk.cyan.bold('Validating task structure...'));

		const validationResult = await this.tmCore.tasks.loadAndValidate(taskId);

		if (!validationResult.success) {
			return {
				success: false,
				taskId,
				task,
				error: validationResult.errorMessage,
				message: validationResult.suggestion
			};
		}

		const orderedSubtasks = this.tmCore.tasks.getExecutionOrder(
			validationResult.task!
		);

		return {
			success: true,
			taskId,
			task: validationResult.task,
			orderedSubtasks
		};
	}

	/**
	 * Display execution plan with subtasks and TDD workflow
	 */
	private displayExecutionPlan(
		task: Task,
		orderedSubtasks: Subtask[],
		options: AutopilotCommandOptions
	): void {
		console.log();
		console.log(chalk.green.bold('✓ All checks passed!'));
		console.log();
		console.log(chalk.cyan.bold('Execution Plan:'));
		console.log(chalk.white(`Task: ${task.title}`));
		console.log(
			chalk.gray(
				`${orderedSubtasks.length} subtasks will be executed in dependency order`
			)
		);
		console.log();

		// Display subtasks
		orderedSubtasks.forEach((subtask: Subtask, index: number) => {
			console.log(
				chalk.yellow(`${index + 1}. ${task.id}.${subtask.id}: ${subtask.title}`)
			);
			if (subtask.dependencies && subtask.dependencies.length > 0) {
				console.log(
					chalk.gray(`   Dependencies: ${subtask.dependencies.join(', ')}`)
				);
			}
		});

		console.log();
		console.log(
			chalk.cyan('Autopilot would execute each subtask using TDD workflow:')
		);
		console.log(chalk.gray('  1. RED phase: Write failing test'));
		console.log(chalk.gray('  2. GREEN phase: Implement code to pass test'));
		console.log(chalk.gray('  3. COMMIT phase: Commit changes'));
		console.log();

		if (options.dryRun) {
			console.log(
				chalk.yellow('This was a dry run. Use without --dry-run to execute.')
			);
		}
	}

	/**
	 * Display preflight check results
	 */
	private displayPreflightResults(result: PreflightResult): void {
		const checks = [
			{ name: 'Test command', result: result.testCommand },
			{ name: 'Git working tree', result: result.gitWorkingTree },
			{ name: 'Required tools', result: result.requiredTools },
			{ name: 'Default branch', result: result.defaultBranch }
		];

		checks.forEach((check) => {
			const icon = check.result.success ? chalk.green('✓') : chalk.red('✗');
			const status = check.result.success
				? chalk.green('PASS')
				: chalk.red('FAIL');
			console.log(`${icon} ${chalk.white(check.name)}: ${status}`);
			if (check.result.message) {
				console.log(chalk.gray(`  ${check.result.message}`));
			}
		});
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: AutopilotCommandResult,
		options: AutopilotCommandOptions
	): void {
		const format = options.format || 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'text':
			default:
				this.displayTextResult(result);
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(result: AutopilotCommandResult): void {
		console.log(JSON.stringify(result, null, 2));
	}

	/**
	 * Display result in text format
	 */
	private displayTextResult(result: AutopilotCommandResult): void {
		if (result.success) {
			console.log(
				boxen(
					chalk.green.bold('✓ Autopilot Command Completed') +
						'\n\n' +
						chalk.white(result.message || 'Execution complete'),
					{
						padding: 1,
						borderStyle: 'round',
						borderColor: 'green',
						margin: { top: 1 }
					}
				)
			);
		} else {
			console.log(
				boxen(
					chalk.red.bold('✗ Autopilot Command Failed') +
						'\n\n' +
						chalk.white(result.error || 'Unknown error'),
					{
						padding: 1,
						borderStyle: 'round',
						borderColor: 'red',
						margin: { top: 1 }
					}
				)
			);
		}
	}

	/**
	 * Handle general errors
	 */
	private handleError(error: unknown): void {
		const errorObj = error as {
			getSanitizedDetails?: () => { message: string };
			message?: string;
			stack?: string;
		};

		const msg = errorObj?.getSanitizedDetails?.() ?? {
			message: errorObj?.message ?? String(error)
		};
		console.error(chalk.red(`Error: ${msg.message || 'Unexpected error'}`));

		// Show stack trace in development mode or when DEBUG is set
		const isDevelopment = process.env.NODE_ENV !== 'production';
		if ((isDevelopment || process.env.DEBUG) && errorObj.stack) {
			console.error(chalk.gray(errorObj.stack));
		}
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: AutopilotCommandResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): AutopilotCommandResult | undefined {
		return this.lastResult;
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		if (this.tmCore) {
			this.tmCore = undefined;
		}
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): AutopilotCommand {
		const autopilotCommand = new AutopilotCommand(name);
		program.addCommand(autopilotCommand);
		return autopilotCommand;
	}
}
