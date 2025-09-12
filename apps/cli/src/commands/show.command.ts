/**
 * @fileoverview ShowCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createTaskMasterCore, type Task, type TaskMasterCore } from '@tm/core';
import type { StorageType } from '@tm/core/types';
import * as ui from '../utils/ui.js';

/**
 * Options interface for the show command
 */
export interface ShowCommandOptions {
	id?: string;
	status?: string;
	format?: 'text' | 'json';
	silent?: boolean;
	project?: string;
}

/**
 * Result type from show command
 */
export interface ShowTaskResult {
	task: Task | null;
	found: boolean;
	storageType: Exclude<StorageType, 'auto'>;
}

/**
 * Result type for multiple tasks
 */
export interface ShowMultipleTasksResult {
	tasks: Task[];
	notFound: string[];
	storageType: Exclude<StorageType, 'auto'>;
}

/**
 * ShowCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class ShowCommand extends Command {
	private tmCore?: TaskMasterCore;
	private lastResult?: ShowTaskResult | ShowMultipleTasksResult;

	constructor(name?: string) {
		super(name || 'show');

		// Configure the command
		this.description('Display detailed information about one or more tasks')
			.argument('[id]', 'Task ID(s) to show (comma-separated for multiple)')
			.option(
				'-i, --id <id>',
				'Task ID(s) to show (comma-separated for multiple)'
			)
			.option('-s, --status <status>', 'Filter subtasks by status')
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.action(
				async (taskId: string | undefined, options: ShowCommandOptions) => {
					await this.executeCommand(taskId, options);
				}
			);
	}

	/**
	 * Execute the show command
	 */
	private async executeCommand(
		taskId: string | undefined,
		options: ShowCommandOptions
	): Promise<void> {
		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Initialize tm-core
			await this.initializeCore(options.project || process.cwd());

			// Get the task ID from argument or option
			const idArg = taskId || options.id;
			if (!idArg) {
				console.error(chalk.red('Error: Please provide a task ID'));
				process.exit(1);
			}

			// Check if multiple IDs are provided (comma-separated)
			const taskIds = idArg
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id.length > 0);

			// Get tasks from core
			const result =
				taskIds.length > 1
					? await this.getMultipleTasks(taskIds, options)
					: await this.getSingleTask(taskIds[0], options);

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
			if (error.stack && process.env.DEBUG) {
				console.error(chalk.gray(error.stack));
			}
			process.exit(1);
		}
	}

	/**
	 * Validate command options
	 */
	private validateOptions(options: ShowCommandOptions): boolean {
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
	 * Get a single task from tm-core
	 */
	private async getSingleTask(
		taskId: string,
		_options: ShowCommandOptions
	): Promise<ShowTaskResult> {
		if (!this.tmCore) {
			throw new Error('TaskMasterCore not initialized');
		}

		// Get the task
		const task = await this.tmCore.getTask(taskId);

		// Get storage type
		const storageType = this.tmCore.getStorageType();

		return {
			task,
			found: task !== null,
			storageType: storageType as Exclude<StorageType, 'auto'>
		};
	}

	/**
	 * Get multiple tasks from tm-core
	 */
	private async getMultipleTasks(
		taskIds: string[],
		_options: ShowCommandOptions
	): Promise<ShowMultipleTasksResult> {
		if (!this.tmCore) {
			throw new Error('TaskMasterCore not initialized');
		}

		const tasks: Task[] = [];
		const notFound: string[] = [];

		// Get each task individually
		for (const taskId of taskIds) {
			const task = await this.tmCore.getTask(taskId);
			if (task) {
				tasks.push(task);
			} else {
				notFound.push(taskId);
			}
		}

		// Get storage type
		const storageType = this.tmCore.getStorageType();

		return {
			tasks,
			notFound,
			storageType: storageType as Exclude<StorageType, 'auto'>
		};
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: ShowTaskResult | ShowMultipleTasksResult,
		options: ShowCommandOptions
	): void {
		const format = options.format || 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'text':
			default:
				if ('task' in result) {
					// Single task result
					this.displaySingleTask(result, options);
				} else {
					// Multiple tasks result
					this.displayMultipleTasks(result, options);
				}
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(result: ShowTaskResult | ShowMultipleTasksResult): void {
		console.log(JSON.stringify(result, null, 2));
	}

	/**
	 * Display a single task in text format
	 */
	private displaySingleTask(
		result: ShowTaskResult,
		options: ShowCommandOptions
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
			boxen(chalk.white.bold(`Task #${task.id} - ${task.title}`), {
				padding: { top: 0, bottom: 0, left: 1, right: 1 },
				borderColor: 'blue',
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
			console.log(`\n${chalk.blue.bold('Details:')}`);
			console.log(task.details);
		}

		// Dependencies
		if (task.dependencies && task.dependencies.length > 0) {
			console.log(`\n${chalk.blue.bold('Dependencies:')}`);
			task.dependencies.forEach((dep) => {
				console.log(`  - ${chalk.cyan(dep)}`);
			});
		}

		// Subtasks
		if (task.subtasks && task.subtasks.length > 0) {
			console.log(`\n${chalk.blue.bold('Subtasks:')}`);

			// Filter subtasks by status if provided
			const filteredSubtasks = options.status
				? task.subtasks.filter((sub) => sub.status === options.status)
				: task.subtasks;

			if (filteredSubtasks.length === 0 && options.status) {
				console.log(
					chalk.gray(`  No subtasks with status '${options.status}'`)
				);
			} else {
				filteredSubtasks.forEach((subtask) => {
					console.log(
						`  ${chalk.cyan(`${task.id}.${subtask.id}`)} ${ui.getStatusWithColor(subtask.status)} ${subtask.title}`
					);
					if (subtask.description) {
						console.log(`    ${chalk.gray(subtask.description)}`);
					}
				});
			}
		}

		if (task.testStrategy) {
			console.log(`\n${chalk.blue.bold('Test Strategy:')}`);
			console.log(task.testStrategy);
		}

		console.log(`\n${chalk.gray('Storage: ' + result.storageType)}`);
	}

	/**
	 * Display multiple tasks in text format
	 */
	private displayMultipleTasks(
		result: ShowMultipleTasksResult,
		_options: ShowCommandOptions
	): void {
		// Header
		ui.displayBanner(`Tasks (${result.tasks.length} found)`);

		if (result.notFound.length > 0) {
			console.log(chalk.yellow(`\n⚠ Not found: ${result.notFound.join(', ')}`));
		}

		if (result.tasks.length === 0) {
			ui.displayWarning('No tasks found matching the criteria.');
			return;
		}

		// Task table
		console.log(chalk.blue.bold(`\n📋 Tasks:\n`));
		console.log(
			ui.createTaskTable(result.tasks, {
				showSubtasks: true,
				showDependencies: true
			})
		);

		console.log(`\n${chalk.gray('Storage: ' + result.storageType)}`);
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(
		result: ShowTaskResult | ShowMultipleTasksResult
	): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): ShowTaskResult | ShowMultipleTasksResult | undefined {
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
	 * This is for gradual migration - allows commands.js to use this
	 */
	static registerOn(program: Command): Command {
		const showCommand = new ShowCommand();
		program.addCommand(showCommand);
		return showCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 * Can also configure the command name if needed
	 */
	static register(program: Command, name?: string): ShowCommand {
		const showCommand = new ShowCommand(name);
		program.addCommand(showCommand);
		return showCommand;
	}
}
