/**
 * @fileoverview NextCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createTaskMasterCore, type Task, type TaskMasterCore } from '@tm/core';
import type { StorageType } from '@tm/core/types';
import { displayError } from '../utils/error-handler.js';
import { displayTaskDetails } from '../ui/components/task-detail.component.js';
import { displayCommandHeader } from '../utils/display-helpers.js';

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
}

/**
 * NextCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class NextCommand extends Command {
	private tmCore?: TaskMasterCore;
	private lastResult?: NextTaskResult;

	constructor(name?: string) {
		super(name || 'next');

		// Configure the command
		this.description('Find the next available task to work on')
			.option('-t, --tag <tag>', 'Filter by tag')
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
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
			await this.initializeCore(options.project || process.cwd());

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
	 * Initialize TaskMasterCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			const resolved = path.resolve(projectRoot);
			this.tmCore = await createTaskMasterCore({ projectPath: resolved });
		}
	}

	/**
	 * Get next task from tm-core
	 */
	private async getNextTask(
		options: NextCommandOptions
	): Promise<NextTaskResult> {
		if (!this.tmCore) {
			throw new Error('TaskMasterCore not initialized');
		}

		// Call tm-core to get next task
		const task = await this.tmCore.getNextTask(options.tag);

		// Get storage type and active tag
		const storageType = this.tmCore.getStorageType();
		if (storageType === 'auto') {
			throw new Error('Storage type must be resolved before use');
		}
		const activeTag = options.tag || this.tmCore.getActiveTag();

		return {
			task,
			found: task !== null,
			tag: activeTag,
			storageType
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
			// No next task available
			console.log(
				boxen(
					chalk.yellow(
						'No tasks available to work on. All tasks are either completed, blocked by dependencies, or in progress.'
					),
					{
						padding: 1,
						borderStyle: 'round',
						borderColor: 'yellow',
						title: '⚠ NO TASKS AVAILABLE ⚠',
						titleAlignment: 'center'
					}
				)
			);
			console.log(
				`\n${chalk.dim('Tip: Try')} ${chalk.cyan('task-master list --status pending')} ${chalk.dim('to see all pending tasks')}`
			);
			return;
		}

		const task = result.task;

		// Display the task details using the same component as 'show' command
		// with a custom header indicating this is the next task
		const customHeader = `Next Task: #${task.id} - ${task.title}`;
		displayTaskDetails(task, {
			customHeader,
			headerColor: 'green',
			showSuggestedActions: true
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
			await this.tmCore.close();
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
