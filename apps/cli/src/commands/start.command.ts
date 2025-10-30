/**
 * @fileoverview StartCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 * This is a thin presentation layer over @tm/core's TaskExecutionService
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora, { type Ora } from 'ora';
import { spawn } from 'child_process';
import {
	createTmCore,
	type TmCore,
	type StartTaskResult as CoreStartTaskResult
} from '@tm/core';
import { displayTaskDetails } from '../ui/components/task-detail.component.js';
import * as ui from '../utils/ui.js';
import { displayError } from '../utils/error-handler.js';

/**
 * CLI-specific options interface for the start command
 */
export interface StartCommandOptions {
	id?: string;
	format?: 'text' | 'json';
	project?: string;
	dryRun?: boolean;
	force?: boolean;
	noStatusUpdate?: boolean;
}

/**
 * CLI-specific result type from start command
 * Extends the core result with CLI-specific display information
 */
export interface StartCommandResult extends CoreStartTaskResult {
	storageType?: string;
}

/**
 * StartCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core's TaskExecutionService
 */
export class StartCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: StartCommandResult;

	constructor(name?: string) {
		super(name || 'start');

		// Configure the command
		this.description(
			'Start working on a task by launching claude-code with context'
		)
			.argument('[id]', 'Task ID to start working on')
			.option('-i, --id <id>', 'Task ID to start working on')
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.option(
				'--dry-run',
				'Show what would be executed without launching claude-code'
			)
			.option(
				'--force',
				'Force start even if another task is already in-progress'
			)
			.option(
				'--no-status-update',
				'Do not automatically update task status to in-progress'
			)
			.action(
				async (taskId: string | undefined, options: StartCommandOptions) => {
					await this.executeCommand(taskId, options);
				}
			);
	}

	/**
	 * Execute the start command
	 */
	private async executeCommand(
		taskId: string | undefined,
		options: StartCommandOptions
	): Promise<void> {
		let spinner: Ora | null = null;

		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Initialize tm-core with spinner
			spinner = ora('Initializing Task Master...').start();
			await this.initializeCore(options.project || process.cwd());
			spinner.succeed('Task Master initialized');

			// Get the task ID from argument or option, or find next available task
			const idArg = taskId || options.id || null;
			let targetTaskId = idArg;

			if (!targetTaskId) {
				spinner = ora('Finding next available task...').start();
				targetTaskId = await this.performGetNextTask();
				if (targetTaskId) {
					spinner.succeed(`Found next task: #${targetTaskId}`);
				} else {
					spinner.fail('No available tasks found');
				}
			}

			if (!targetTaskId) {
				ui.displayError('No task ID provided and no available tasks found');
				process.exit(1);
			}

			// Show pre-launch message (no spinner needed, it's just display)
			if (!options.dryRun) {
				await this.showPreLaunchMessage(targetTaskId);
			}

			// Use tm-core's startTask method with spinner
			spinner = ora('Preparing task execution...').start();
			const coreResult = await this.performStartTask(targetTaskId, options);

			if (coreResult.started) {
				spinner.succeed(
					options.dryRun
						? 'Dry run completed'
						: 'Task prepared - launching Claude...'
				);
			} else {
				spinner.fail('Task execution failed');
			}

			// Execute command if we have one and it's not a dry run
			if (!options.dryRun && coreResult.command) {
				// Stop any remaining spinners before launching Claude
				if (spinner && !spinner.isSpinning) {
					// Clear the line to make room for Claude
					console.log();
				}
				await this.executeChildProcess(coreResult.command);
			}

			// Convert core result to CLI result with storage type (resolved, not config value)
			const result: StartCommandResult = {
				...coreResult,
				storageType: this.tmCore?.tasks.getStorageType()
			};

			// Store result for programmatic access
			this.setLastResult(result);

			// Display results (only for dry run or if execution failed)
			if (options.dryRun || !coreResult.started) {
				this.displayResults(result, options);
			}
		} catch (error: any) {
			if (spinner) {
				spinner.fail('Operation failed');
			}
			displayError(error);
		}
	}

	/**
	 * Validate command options
	 */
	private validateOptions(options: StartCommandOptions): boolean {
		// Validate format
		if (options.format && !['text', 'json'].includes(options.format)) {
			console.error(chalk.red(`Invalid format: ${options.format}`));
			console.error(chalk.gray(`Valid formats: text, json`));
			return false;
		}

		return true;
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
	 * Get the next available task using tm-core
	 */
	private async performGetNextTask(): Promise<string | null> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}
		return this.tmCore.tasks.getNextAvailable();
	}

	/**
	 * Show pre-launch message using tm-core data
	 */
	private async showPreLaunchMessage(targetTaskId: string): Promise<void> {
		if (!this.tmCore) return;

		const { task, isSubtask } = await this.tmCore.tasks.get(targetTaskId);
		if (task) {
			const workItemText = isSubtask
				? `Subtask #${targetTaskId} - ${task.title}`
				: `Task #${task.id} - ${task.title}`;

			console.log(
				chalk.green('🚀 Starting: ') + chalk.white.bold(workItemText)
			);
			console.log(chalk.gray('Launching Claude Code...'));
			console.log(); // Empty line
		}
	}

	/**
	 * Perform start task using tm-core business logic
	 */
	private async performStartTask(
		targetTaskId: string,
		options: StartCommandOptions
	): Promise<CoreStartTaskResult> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}

		// Show spinner for status update if enabled
		let statusSpinner: Ora | null = null;
		if (!options.noStatusUpdate && !options.dryRun) {
			statusSpinner = ora('Updating task status to in-progress...').start();
		}

		// Get execution command from tm-core (instead of executing directly)
		const result = await this.tmCore.tasks.start(targetTaskId, {
			dryRun: options.dryRun,
			force: options.force,
			updateStatus: !options.noStatusUpdate
		});

		if (statusSpinner) {
			if (result.started) {
				statusSpinner.succeed('Task status updated');
			} else {
				statusSpinner.warn('Task status update skipped');
			}
		}

		if (!result) {
			throw new Error('Failed to start task - core result is undefined');
		}

		// Don't execute here - let the main executeCommand method handle it
		return result;
	}

	/**
	 * Execute the child process directly in the main thread for better process control
	 */
	private async executeChildProcess(command: {
		executable: string;
		args: string[];
		cwd: string;
	}): Promise<void> {
		return new Promise((resolve, reject) => {
			// Don't show the full command with args as it can be very long
			console.log(chalk.green('🚀 Launching Claude Code...'));
			console.log(); // Add space before Claude takes over

			const childProcess = spawn(command.executable, command.args, {
				cwd: command.cwd,
				stdio: 'inherit', // Inherit stdio from parent process
				shell: false
			});

			childProcess.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`Process exited with code ${code}`));
				}
			});

			childProcess.on('error', (error) => {
				reject(new Error(`Failed to spawn process: ${error.message}`));
			});

			// Handle process termination signals gracefully
			const cleanup = () => {
				if (childProcess && !childProcess.killed) {
					childProcess.kill('SIGTERM');
				}
			};

			process.on('SIGINT', cleanup);
			process.on('SIGTERM', cleanup);
			process.on('exit', cleanup);
		});
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: StartCommandResult,
		options: StartCommandOptions
	): void {
		const format = options.format || 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'text':
			default:
				this.displayTextResult(result, options);
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(result: StartCommandResult): void {
		console.log(JSON.stringify(result, null, 2));
	}

	/**
	 * Display result in text format
	 */
	private displayTextResult(
		result: StartCommandResult,
		options: StartCommandOptions
	): void {
		if (!result.found || !result.task) {
			console.log(
				boxen(chalk.yellow(`Task not found!`), {
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1 }
				})
			);
			return;
		}

		const task = result.task;

		if (options.dryRun) {
			// For dry run, show full details since Claude Code won't be launched
			let headerText = `Dry Run: Starting Task #${task.id} - ${task.title}`;

			// If working on a specific subtask, highlight it in the header
			if (result.subtask && result.subtaskId) {
				headerText = `Dry Run: Starting Subtask #${task.id}.${result.subtaskId} - ${result.subtask.title}`;
			}

			displayTaskDetails(task, {
				customHeader: headerText,
				headerColor: 'yellow'
			});

			// Show claude-code prompt
			if (result.executionOutput) {
				console.log(); // Empty line for spacing
				console.log(
					boxen(
						chalk.white.bold('Claude-Code Prompt:') +
							'\n\n' +
							result.executionOutput,
						{
							padding: 1,
							borderStyle: 'round',
							borderColor: 'cyan',
							width: process.stdout.columns * 0.95 || 100
						}
					)
				);
			}

			console.log(); // Empty line for spacing
			console.log(
				boxen(
					chalk.yellow(
						'🔍 Dry run - claude-code would be launched with the above prompt'
					),
					{
						padding: { top: 0, bottom: 0, left: 1, right: 1 },
						borderColor: 'yellow',
						borderStyle: 'round'
					}
				)
			);
		} else {
			// For actual execution, show minimal info since Claude Code will clear the terminal
			if (result.started) {
				// Determine what was worked on - task or subtask
				let workItemText = `Task: #${task.id} - ${task.title}`;
				let statusTarget = task.id;

				if (result.subtask && result.subtaskId) {
					workItemText = `Subtask: #${task.id}.${result.subtaskId} - ${result.subtask.title}`;
					statusTarget = `${task.id}.${result.subtaskId}`;
				}

				// Post-execution message (shown after Claude Code exits)
				console.log(
					boxen(
						chalk.green.bold('🎉 Task Session Complete!') +
							'\n\n' +
							chalk.white(workItemText) +
							'\n\n' +
							chalk.cyan('Next steps:') +
							'\n' +
							`• Run ${chalk.yellow('tm show ' + task.id)} to review task details\n` +
							`• Run ${chalk.yellow('tm set-status --id=' + statusTarget + ' --status=done')} when complete\n` +
							`• Run ${chalk.yellow('tm next')} to find the next available task\n` +
							`• Run ${chalk.yellow('tm start')} to begin the next task`,
						{
							padding: 1,
							borderStyle: 'round',
							borderColor: 'green',
							width: process.stdout.columns * 0.95 || 100,
							margin: { top: 1 }
						}
					)
				);
			} else {
				// Error case
				console.log(
					boxen(
						chalk.red(
							'❌ Failed to launch claude-code' +
								(result.error ? `\nError: ${result.error}` : '')
						),
						{
							padding: { top: 0, bottom: 0, left: 1, right: 1 },
							borderColor: 'red',
							borderStyle: 'round'
						}
					)
				);
			}
		}

		console.log(`\n${chalk.gray('Storage: ' + result.storageType)}`);
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: StartCommandResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): StartCommandResult | undefined {
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
	static register(program: Command, name?: string): StartCommand {
		const startCommand = new StartCommand(name);
		program.addCommand(startCommand);
		return startCommand;
	}
}
