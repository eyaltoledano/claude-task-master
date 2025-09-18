/**
 * @fileoverview StartCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createTaskMasterCore, type Task, type TaskMasterCore } from '@tm/core';
import type { StorageType } from '@tm/core/types';
import * as ui from '../utils/ui.js';

/**
 * Options interface for the start command
 */
export interface StartCommandOptions {
	id?: string;
	format?: 'text' | 'json';
	silent?: boolean;
	project?: string;
	dryRun?: boolean;
}

/**
 * Result type from start command
 */
export interface StartTaskResult {
	task: Task | null;
	found: boolean;
	started: boolean;
	storageType: Exclude<StorageType, 'auto'>;
	claudeCodePrompt?: string;
	error?: string;
}

/**
 * StartCommand extending Commander's Command class
 * This command starts working on a task by launching claude-code with a standardized prompt
 */
export class StartCommand extends Command {
	private tmCore?: TaskMasterCore;
	private lastResult?: StartTaskResult;

	constructor(name?: string) {
		super(name || 'start');

		// Configure the command
		this.description(
			'Start working on a task by launching claude-code with context'
		)
			.argument('[id]', 'Task ID to start working on')
			.option('-i, --id <id>', 'Task ID to start working on')
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.option(
				'--dry-run',
				'Show what would be executed without launching claude-code'
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
		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Initialize tm-core
			await this.initializeCore(options.project || process.cwd());

			// Get the task ID from argument or option, or find next available task
			const idArg = taskId || options.id;
			const targetTaskId = idArg || (await this.getNextAvailableTask());

			if (!targetTaskId) {
				console.error(
					chalk.red('Error: No task ID provided and no available tasks found')
				);
				process.exit(1);
			}

			// Get the task and start it
			const result = await this.startTask(targetTaskId, options);

			// Store result for programmatic access
			this.setLastResult(result);

			// Display results
			if (!options.silent) {
				this.displayResults(result, options);
			}
		} catch (error: any) {
			const msg = error?.getSanitizedDetails?.() ?? {
				message: error?.message ?? String(error)
			};
			console.error(chalk.red(`Error: ${msg.message || 'Unexpected error'}`));

			// Show stack trace in development mode or when DEBUG is set
			const isDevelopment = process.env.NODE_ENV !== 'production';
			if ((isDevelopment || process.env.DEBUG) && error.stack) {
				console.error(chalk.gray(error.stack));
			}
			process.exit(1);
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
	 * Initialize TaskMasterCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTaskMasterCore({ projectPath: projectRoot });
		}
	}

	/**
	 * Get the next available task if no ID is provided
	 */
	private async getNextAvailableTask(): Promise<string | null> {
		if (!this.tmCore) {
			throw new Error('TaskMasterCore not initialized');
		}

		const nextTask = await this.tmCore.getNextTask();
		return nextTask?.id || null;
	}

	/**
	 * Start working on a task
	 */
	private async startTask(
		taskId: string,
		options: StartCommandOptions
	): Promise<StartTaskResult> {
		if (!this.tmCore) {
			throw new Error('TaskMasterCore not initialized');
		}

		// Get the task
		const task = await this.tmCore.getTask(taskId);

		if (!task) {
			return {
				task: null,
				found: false,
				started: false,
				storageType: this.tmCore.getStorageType() as Exclude<
					StorageType,
					'auto'
				>,
				error: `Task ${taskId} not found`
			};
		}

		// Execute the task using ExecutorService
		// Note: Status management is handled by the user via set-status command
		let started = false;
		let executionResult;
		if (!options.dryRun) {
			executionResult = await this.tmCore.executeTask(task);
			started = executionResult.success;
		} else {
			// For dry-run, just show that we would execute
			started = true;
		}

		return {
			task,
			found: true,
			started,
			storageType: this.tmCore.getStorageType() as Exclude<StorageType, 'auto'>,
			claudeCodePrompt: executionResult?.output || 'Task executed via ExecutorService'
		};
	}


	/**
	 * Display results based on format
	 */
	private displayResults(
		result: StartTaskResult,
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
	private displayJson(result: StartTaskResult): void {
		console.log(JSON.stringify(result, null, 2));
	}

	/**
	 * Display result in text format
	 */
	private displayTextResult(
		result: StartTaskResult,
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

		// Header
		console.log(
			boxen(chalk.white.bold(`Starting Task #${task.id} - ${task.title}`), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'green',
				borderStyle: 'round',
				margin: { top: 1 }
			})
		);

		// Task details
		console.log(
			`\n${chalk.blue.bold('Status:')} ${ui.getStatusWithColor(task.status)}`
		);
		console.log(
			`${chalk.blue.bold('Priority:')} ${ui.getPriorityWithColor(task.priority)}`
		);

		if (task.description) {
			console.log(`\n${chalk.blue.bold('Description:')}`);
			console.log(task.description);
		}

		if (task.details) {
			console.log(`\n${chalk.blue.bold('Implementation Details:')}`);
			console.log(task.details);
		}

		// Dependencies
		if (task.dependencies && task.dependencies.length > 0) {
			console.log(`\n${chalk.blue.bold('Dependencies:')}`);
			task.dependencies.forEach((dep) => {
				console.log(`  - ${chalk.cyan(dep)}`);
			});
		}

		// Test strategy
		if (task.testStrategy) {
			console.log(`\n${chalk.blue.bold('Test Strategy:')}`);
			console.log(task.testStrategy);
		}

		// Show claude-code prompt if dry-run
		if (options.dryRun && result.claudeCodePrompt) {
			console.log(`\n${chalk.blue.bold('Claude-Code Prompt:')}`);
			console.log(
				boxen(result.claudeCodePrompt, {
					padding: { top: 0, bottom: 0, left: 1, right: 1 },
					borderColor: 'cyan',
					borderStyle: 'round',
					margin: { top: 1 }
				})
			);
		}

		// Show execution status
		if (options.dryRun) {
			console.log(
				chalk.yellow(
					'\n🔍 Dry run - claude-code would be launched with the above prompt'
				)
			);
		} else if (result.started) {
			console.log(chalk.green('\n🚀 claude-code launched successfully'));
		} else {
			console.log(chalk.red('\n❌ Failed to launch claude-code'));
			if (result.error) {
				console.log(chalk.gray(`Error: ${result.error}`));
			}
		}

		console.log(`\n${chalk.gray('Storage: ' + result.storageType)}`);
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: StartTaskResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): StartTaskResult | undefined {
		return this.lastResult;
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		if (this.tmCore) {
			await this.tmCore.close();
			this.tmCore = undefined;
		}
	}

	/**
	 * Static method to register this command on an existing program
	 */
	static registerOn(program: Command): Command {
		const startCommand = new StartCommand();
		program.addCommand(startCommand);
		return startCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 */
	static register(program: Command, name?: string): StartCommand {
		const startCommand = new StartCommand(name);
		program.addCommand(startCommand);
		return startCommand;
	}
}
