/**
 * @fileoverview NextCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import path from 'node:path';
import { type Task, type TmCore, createTmCore } from '@tm/core';
import type { StorageType } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import { Command } from 'commander';
import { displayTaskDetails } from '../ui/components/task-detail.component.js';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * Options interface for the next command
 */
export interface NextCommandOptions {
	tag?: string;
	format?: 'text' | 'json';
	silent?: boolean;
	project?: string;
}

/**
 * Result type from next command
 */
export interface NextTaskResult {
	task: Task | null;
	found: boolean;
	tag: string;
	storageType: Exclude<StorageType, 'auto'>;
	hasAnyTasks?: boolean;
}

/**
 * NextCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class NextCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: NextTaskResult;

	constructor(name?: string) {
		super(name || 'next');

		// Configure the command
		this.description('Find the next available task to work on')
			.option('-t, --tag <tag>', 'Filter by tag')
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (options: NextCommandOptions) => {
				await this.executeCommand(options);
			});
	}

	/**
	 * Execute the next command
	 */
	private async executeCommand(options: NextCommandOptions): Promise<void> {
		let hasError = false;
		try {
			// Validate options (throws on invalid options)
			this.validateOptions(options);

			// Initialize tm-core
			await this.initializeCore(getProjectRoot(options.project));

			// Get next task from core
			const result = await this.getNextTask(options);

			// Store result for programmatic access
			this.setLastResult(result);

			// Display results
			if (!options.silent) {
				this.displayResults(result, options);
			}
		} catch (error: any) {
			hasError = true;
			displayError(error, { skipExit: true });
		} finally {
			// Always clean up resources, even on error
			await this.cleanup();
		}

		// Exit after cleanup completes
		if (hasError) {
			process.exit(1);
		}
	}

	/**
	 * Validate command options
	 */
	private validateOptions(options: NextCommandOptions): void {
		// Validate format
		if (options.format && !['text', 'json'].includes(options.format)) {
			throw new Error(
				`Invalid format: ${options.format}. Valid formats are: text, json`
			);
		}
	}

	/**
	 * Initialize TmCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			const resolved = path.resolve(projectRoot);
			this.tmCore = await createTmCore({ projectPath: resolved });
		}
	}

	/**
	 * Get next task from tm-core
	 */
	private async getNextTask(
		options: NextCommandOptions
	): Promise<NextTaskResult> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}

		// Call tm-core to get next task
		const task = await this.tmCore.tasks.getNext(options.tag);

		// Get storage type and active tag
		const storageType = this.tmCore.tasks.getStorageType();

		const activeTag = options.tag || this.tmCore.config.getActiveTag();

		// Check if there are ANY tasks at all
		const allTasks = await this.tmCore.tasks.list({ tag: options.tag });
		const hasAnyTasks = allTasks && allTasks.tasks.length > 0;

		return {
			task,
			found: task !== null,
			tag: activeTag,
			storageType,
			hasAnyTasks
		};
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: NextTaskResult,
		options: NextCommandOptions
	): void {
		const format = options.format || 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'text':
			default:
				this.displayText(result);
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(result: NextTaskResult): void {
		console.log(JSON.stringify(result, null, 2));
	}

	/**
	 * Display in text format
	 */
	private displayText(result: NextTaskResult): void {
		// Display header with storage info
		displayCommandHeader(this.tmCore, {
			tag: result.tag || 'master',
			storageType: result.storageType
		});

		if (!result.found || !result.task) {
			// Only show warning box if there are literally NO tasks at all
			if (!result.hasAnyTasks) {
				console.log(
					boxen(chalk.yellow('No tasks found in this project.'), {
						padding: 1,
						borderStyle: 'round',
						borderColor: 'yellow',
						title: '⚠️ NO TASKS AVAILABLE ⚠️',
						titleAlignment: 'center'
					})
				);
				console.log(
					`\n${chalk.dim('Tip: Create tasks with')} ${chalk.cyan('task-master parse-prd')} ${chalk.dim('or')} ${chalk.cyan('task-master add-task')}`
				);
			} else {
				// Tasks exist but none are available to work on - just show a simple message
				console.log(
					chalk.yellow(
						'✓ All tasks are either completed, blocked by dependencies, or in progress.'
					)
				);
				console.log(
					`\n${chalk.dim('Tip: Try')} ${chalk.cyan('task-master list')} ${chalk.dim('to see all tasks')}`
				);
			}
			return;
		}

		const task = result.task;

		// Display the task details using the same component as 'show' command
		// with a custom header indicating this is the next task
		const customHeader = `Next Task: #${task.id} - ${task.title}`;
		displayTaskDetails(task, {
			customHeader,
			headerColor: 'green',
			showSuggestedActions: true,
			storageType: result.storageType
		});
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: NextTaskResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): NextTaskResult | undefined {
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
	static register(program: Command, name?: string): NextCommand {
		const nextCommand = new NextCommand(name);
		program.addCommand(nextCommand);
		return nextCommand;
	}
}
