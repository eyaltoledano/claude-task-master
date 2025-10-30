/**
 * @fileoverview ShowCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createTmCore, type Task, type TmCore } from '@tm/core';
import type { StorageType, Subtask } from '@tm/core';
import * as ui from '../utils/ui.js';
import { displayError } from '../utils/error-handler.js';
import { displayTaskDetails } from '../ui/components/task-detail.component.js';
import { displayCommandHeader } from '../utils/display-helpers.js';

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
	task: Task | Subtask | null;
	found: boolean;
	storageType: Exclude<StorageType, 'auto'>;
	originalTaskId?: string; // The original task ID requested (for subtasks like "104.1")
}

/**
 * Result type for multiple tasks
 */
export interface ShowMultipleTasksResult {
	tasks: (Task | Subtask)[];
	notFound: string[];
	storageType: Exclude<StorageType, 'auto'>;
}

/**
 * ShowCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class ShowCommand extends Command {
	private tmCore?: TmCore;
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
			displayError(error);
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
	 * Initialize TmCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({ projectPath: projectRoot });
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
			throw new Error('TmCore not initialized');
		}

		// Get the task
		const result = await this.tmCore.tasks.get(taskId);

		// Get storage type
		const storageType = this.tmCore.tasks.getStorageType();

		return {
			task: result.task,
			found: result.task !== null,
			storageType: storageType as Exclude<StorageType, 'auto'>,
			originalTaskId: result.isSubtask ? taskId : undefined
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
			throw new Error('TmCore not initialized');
		}

		const tasks: (Task | Subtask)[] = [];
		const notFound: string[] = [];

		// Get each task individually
		for (const taskId of taskIds) {
			const result = await this.tmCore.tasks.get(taskId);
			if (result.task) {
				tasks.push(result.task);
			} else {
				notFound.push(taskId);
			}
		}

		// Get storage type (resolved, not config value)
		const storageType = this.tmCore.tasks.getStorageType();

		return {
			tasks,
			notFound,
			storageType
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

		// Display header with storage info
		const activeTag = this.tmCore?.config.getActiveTag() || 'master';
		displayCommandHeader(this.tmCore, {
			tag: activeTag,
			storageType: result.storageType
		});

		console.log(); // Add spacing

		// Use the global task details display function
		// Pass the original requested ID if it's a subtask
		displayTaskDetails(result.task, {
			statusFilter: options.status,
			showSuggestedActions: true,
			originalTaskId: result.originalTaskId
		});
	}

	/**
	 * Display multiple tasks in text format
	 */
	private displayMultipleTasks(
		result: ShowMultipleTasksResult,
		_options: ShowCommandOptions
	): void {
		// Display header with storage info
		const activeTag = this.tmCore?.config.getActiveTag() || 'master';
		displayCommandHeader(this.tmCore, {
			tag: activeTag,
			storageType: result.storageType
		});

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
			this.tmCore = undefined;
		}
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): ShowCommand {
		const showCommand = new ShowCommand(name);
		program.addCommand(showCommand);
		return showCommand;
	}
}
