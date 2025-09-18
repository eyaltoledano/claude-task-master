/**
 * @fileoverview SetStatusCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import {
	createTaskMasterCore,
	type TaskMasterCore,
	type TaskStatus
} from '@tm/core';
import type { StorageType } from '@tm/core/types';

/**
 * Valid task status values for validation
 */
const VALID_TASK_STATUSES: TaskStatus[] = [
	'pending',
	'in-progress',
	'done',
	'deferred',
	'cancelled',
	'blocked',
	'review'
];

/**
 * Options interface for the set-status command
 */
export interface SetStatusCommandOptions {
	id?: string;
	status?: TaskStatus;
	format?: 'text' | 'json';
	silent?: boolean;
	project?: string;
}

/**
 * Result type from set-status command
 */
export interface SetStatusResult {
	success: boolean;
	updatedTasks: Array<{
		taskId: string;
		oldStatus: TaskStatus;
		newStatus: TaskStatus;
	}>;
	storageType: Exclude<StorageType, 'auto'>;
}

/**
 * SetStatusCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class SetStatusCommand extends Command {
	private tmCore?: TaskMasterCore;
	private lastResult?: SetStatusResult;

	constructor(name?: string) {
		super(name || 'set-status');

		// Configure the command
		this.description('Update the status of one or more tasks')
			.requiredOption(
				'-i, --id <id>',
				'Task ID(s) to update (comma-separated for multiple, supports subtasks like 5.2)'
			)
			.requiredOption(
				'-s, --status <status>',
				`New status (${VALID_TASK_STATUSES.join(', ')})`
			)
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.action(async (options: SetStatusCommandOptions) => {
				await this.executeCommand(options);
			});
	}

	/**
	 * Execute the set-status command
	 */
	private async executeCommand(
		options: SetStatusCommandOptions
	): Promise<void> {
		try {
			// Validate required options
			if (!options.id) {
				console.error(chalk.red('Error: Task ID is required. Use -i or --id'));
				process.exit(1);
			}

			if (!options.status) {
				console.error(
					chalk.red('Error: Status is required. Use -s or --status')
				);
				process.exit(1);
			}

			// Validate status
			if (!VALID_TASK_STATUSES.includes(options.status)) {
				console.error(
					chalk.red(
						`Error: Invalid status "${options.status}". Valid options: ${VALID_TASK_STATUSES.join(', ')}`
					)
				);
				process.exit(1);
			}

			// Initialize TaskMaster core
			this.tmCore = await createTaskMasterCore({
				projectPath: options.project || process.cwd()
			});

			// Parse task IDs (handle comma-separated values)
			const taskIds = options.id.split(',').map((id) => id.trim());

			// Update each task
			const updatedTasks: Array<{
				taskId: string;
				oldStatus: TaskStatus;
				newStatus: TaskStatus;
			}> = [];

			for (const taskId of taskIds) {
				try {
					const result = await this.tmCore.updateTaskStatus(
						taskId,
						options.status
					);
					updatedTasks.push({
						taskId: result.taskId,
						oldStatus: result.oldStatus,
						newStatus: result.newStatus
					});
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);

					if (!options.silent) {
						console.error(
							chalk.red(`Failed to update task ${taskId}: ${errorMessage}`)
						);
					}
					if (options.format === 'json') {
						console.log(
							JSON.stringify({
								success: false,
								error: errorMessage,
								taskId,
								timestamp: new Date().toISOString()
							})
						);
					}
					process.exit(1);
				}
			}

			// Store result for potential reuse
			this.lastResult = {
				success: true,
				updatedTasks,
				storageType: this.tmCore.getStorageType() as Exclude<
					StorageType,
					'auto'
				>
			};

			// Display results
			this.displayResults(this.lastResult, options);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error occurred';

			if (!options.silent) {
				console.error(chalk.red(`Error: ${errorMessage}`));
			}

			if (options.format === 'json') {
				console.log(JSON.stringify({ success: false, error: errorMessage }));
			}

			process.exit(1);
		} finally {
			// Clean up resources
			if (this.tmCore) {
				await this.tmCore.close();
			}
		}
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: SetStatusResult,
		options: SetStatusCommandOptions
	): void {
		const format = options.format || 'text';

		switch (format) {
			case 'json':
				console.log(JSON.stringify(result, null, 2));
				break;

			case 'text':
			default:
				if (!options.silent) {
					this.displayTextResults(result);
				}
				break;
		}
	}

	/**
	 * Display results in text format
	 */
	private displayTextResults(result: SetStatusResult): void {
		if (result.updatedTasks.length === 1) {
			// Single task update
			const update = result.updatedTasks[0];
			console.log(
				boxen(
					chalk.white.bold(`✅ Successfully updated task ${update.taskId}`) +
						'\n\n' +
						`${chalk.blue('From:')} ${this.getStatusDisplay(update.oldStatus)}\n` +
						`${chalk.blue('To:')}   ${this.getStatusDisplay(update.newStatus)}`,
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);
		} else {
			// Multiple task updates
			console.log(
				boxen(
					chalk.white.bold(
						`✅ Successfully updated ${result.updatedTasks.length} tasks`
					) +
						'\n\n' +
						result.updatedTasks
							.map(
								(update) =>
									`${chalk.cyan(update.taskId)}: ${this.getStatusDisplay(update.oldStatus)} → ${this.getStatusDisplay(update.newStatus)}`
							)
							.join('\n'),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);
		}

		// Show storage info
		console.log(chalk.gray(`\nUsing ${result.storageType} storage`));
	}

	/**
	 * Get colored status display
	 */
	private getStatusDisplay(status: TaskStatus): string {
		const statusColors: Record<TaskStatus, (text: string) => string> = {
			pending: chalk.yellow,
			'in-progress': chalk.blue,
			done: chalk.green,
			deferred: chalk.gray,
			cancelled: chalk.red,
			blocked: chalk.red,
			review: chalk.magenta,
			completed: chalk.green
		};

		const colorFn = statusColors[status] || chalk.white;
		return colorFn(status);
	}

	/**
	 * Get the last command result (useful for testing or chaining)
	 */
	getLastResult(): SetStatusResult | undefined {
		return this.lastResult;
	}

	/**
	 * Static method to register this command on an existing program
	 * This is for gradual migration - allows commands.js to use this
	 */
	static registerOn(program: Command): Command {
		const setStatusCommand = new SetStatusCommand();
		program.addCommand(setStatusCommand);
		return setStatusCommand;
	}

	/**
	 * Alternative registration that returns the command for chaining
	 * Can also configure the command name if needed
	 */
	static register(program: Command, name?: string): SetStatusCommand {
		const setStatusCommand = new SetStatusCommand(name);
		program.addCommand(setStatusCommand);
		return setStatusCommand;
	}
}

/**
 * Factory function to create and configure the set-status command
 */
export function createSetStatusCommand(): SetStatusCommand {
	return new SetStatusCommand();
}
