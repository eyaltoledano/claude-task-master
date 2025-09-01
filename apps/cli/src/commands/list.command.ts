/**
 * @fileoverview ListTasks command using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
	createTaskMasterCore,
	type Task,
	type TaskStatus,
	type TaskMasterCore,
	TASK_STATUSES,
	OUTPUT_FORMATS,
	STATUS_ICONS,
	type OutputFormat
} from '@tm/core';
import * as ui from '../utils/ui.js';

/**
 * Options interface for the list command
 */
export interface ListCommandOptions {
	status?: string;
	tag?: string;
	withSubtasks?: boolean;
	format?: OutputFormat;
	silent?: boolean;
	project?: string;
}

/**
 * Result type from list command
 */
export interface ListTasksResult {
	tasks: Task[];
	total: number;
	filtered: number;
	tag?: string;
	storageType: 'file' | 'api';
}

/**
 * ListTasksCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class ListTasksCommand extends Command {
	private tmCore?: TaskMasterCore;
	private lastResult?: ListTasksResult;

	constructor(name?: string) {
		super(name || 'list');

		// Configure the command
		this.description('List tasks with optional filtering')
			.alias('ls')
			.option('-s, --status <status>', 'Filter by status (comma-separated)')
			.option('-t, --tag <tag>', 'Filter by tag')
			.option('--with-subtasks', 'Include subtasks in the output')
			.option(
				'-f, --format <format>',
				'Output format (text, json, compact)',
				'text'
			)
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.action(async (options: ListCommandOptions) => {
				await this.executeCommand(options);
			});
	}

	/**
	 * Execute the list command
	 */
	private async executeCommand(options: ListCommandOptions): Promise<void> {
		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Initialize tm-core
			await this.initializeCore(options.project || process.cwd());

			// Get tasks from core
			const result = await this.getTasks(options);

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
	private validateOptions(options: ListCommandOptions): boolean {
		// Validate format
		if (
			options.format &&
			!OUTPUT_FORMATS.includes(options.format as OutputFormat)
		) {
			console.error(chalk.red(`Invalid format: ${options.format}`));
			console.error(chalk.gray(`Valid formats: ${OUTPUT_FORMATS.join(', ')}`));
			return false;
		}

		// Validate status
		if (options.status) {
			const statuses = options.status.split(',').map((s: string) => s.trim());

			for (const status of statuses) {
				if (status !== 'all' && !TASK_STATUSES.includes(status as TaskStatus)) {
					console.error(chalk.red(`Invalid status: ${status}`));
					console.error(
						chalk.gray(`Valid statuses: ${TASK_STATUSES.join(', ')}`)
					);
					return false;
				}
			}
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
	 * Get tasks from tm-core
	 */
	private async getTasks(
		options: ListCommandOptions
	): Promise<ListTasksResult> {
		if (!this.tmCore) {
			throw new Error('TaskMasterCore not initialized');
		}

		// Build filter
		const filter =
			options.status && options.status !== 'all'
				? {
						status: options.status
							.split(',')
							.map((s: string) => s.trim() as TaskStatus)
					}
				: undefined;

		// Call tm-core
		const result = await this.tmCore.getTaskList({
			tag: options.tag,
			filter,
			includeSubtasks: options.withSubtasks
		});

		return result as ListTasksResult;
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: ListTasksResult,
		options: ListCommandOptions
	): void {
		const format = (options.format || 'text') as OutputFormat | 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'compact':
				this.displayCompact(result.tasks, options.withSubtasks);
				break;

			case 'text':
			default:
				this.displayText(result, options.withSubtasks);
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(data: ListTasksResult): void {
		console.log(
			JSON.stringify(
				{
					tasks: data.tasks,
					metadata: {
						total: data.total,
						filtered: data.filtered,
						tag: data.tag,
						storageType: data.storageType
					}
				},
				null,
				2
			)
		);
	}

	/**
	 * Display in compact format
	 */
	private displayCompact(tasks: Task[], withSubtasks?: boolean): void {
		tasks.forEach((task) => {
			const icon = STATUS_ICONS[task.status];
			console.log(`${chalk.cyan(task.id)} ${icon} ${task.title}`);

			if (withSubtasks && task.subtasks?.length) {
				task.subtasks.forEach((subtask) => {
					const subIcon = STATUS_ICONS[subtask.status];
					console.log(
						`  ${chalk.gray(`${task.id}.${subtask.id}`)} ${subIcon} ${chalk.gray(subtask.title)}`
					);
				});
			}
		});
	}

	/**
	 * Display in text format with tables
	 */
	private displayText(data: ListTasksResult, withSubtasks?: boolean): void {
		const { tasks, total, filtered, tag, storageType } = data;

		// Header
		ui.displayBanner(`Task List${tag ? ` (${tag})` : ''}`);

		// Statistics
		console.log(chalk.blue.bold('\n📊 Statistics:\n'));
		console.log(`  Total tasks: ${chalk.cyan(total)}`);
		console.log(`  Filtered: ${chalk.cyan(filtered)}`);
		if (tag) {
			console.log(`  Tag: ${chalk.cyan(tag)}`);
		}
		console.log(`  Storage: ${chalk.cyan(storageType)}`);

		// No tasks message
		if (tasks.length === 0) {
			ui.displayWarning('No tasks found matching the criteria.');
			return;
		}

		// Task table
		console.log(chalk.blue.bold(`\n📋 Tasks (${tasks.length}):\n`));
		console.log(
			ui.createTaskTable(tasks, {
				showSubtasks: withSubtasks,
				showDependencies: true
			})
		);

		// Progress bar
		const completedCount = tasks.filter(
			(t: Task) => t.status === 'done'
		).length;
		console.log(chalk.blue.bold('\n📊 Overall Progress:\n'));
		console.log(`  ${ui.createProgressBar(completedCount, tasks.length)}`);
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: ListTasksResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): ListTasksResult | undefined {
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
		const listCommand = new ListTasksCommand();
		program.addCommand(listCommand);
		return listCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 * Can also configure the command name if needed
	 */
	static register(program: Command, name?: string): ListTasksCommand {
		const listCommand = new ListTasksCommand(name);
		program.addCommand(listCommand);
		return listCommand;
	}
}
