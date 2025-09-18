/**
 * @fileoverview StartCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createTaskMasterCore, type Task, type TaskMasterCore } from '@tm/core';
import type { StorageType } from '@tm/core/types';
import { displayTaskDetails } from '../ui/components/task-detail.component.js';

/**
 * Options interface for the start command
 */
export interface StartCommandOptions {
	id?: string;
	format?: 'text' | 'json';
	silent?: boolean;
	project?: string;
	dryRun?: boolean;
	force?: boolean;
	noStatusUpdate?: boolean;
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
	subtaskId?: string;
	subtask?: any; // The specific subtask object if working on a subtask
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

			// Check for in-progress tasks and warn if needed
			const canProceed = await this.checkInProgressTasks(targetTaskId, options);
			if (!canProceed) {
				process.exit(1);
			}

			// Update task status to in-progress if not disabled
			if (!options.noStatusUpdate && !options.dryRun) {
				try {
					await this.tmCore?.updateTaskStatus(targetTaskId, 'in-progress');
					if (!options.silent) {
						console.log(
							chalk.blue('📝 Updated task status to: ') +
								chalk.green.bold('in-progress')
						);
					}
				} catch (error) {
					if (!options.silent) {
						console.log(
							chalk.yellow('⚠ Could not update task status: ') +
								chalk.gray(
									error instanceof Error ? error.message : String(error)
								)
						);
						throw error;
					}
				}
			}

			// Show pre-launch message for non-dry-run, non-silent execution
			if (!options.dryRun && !options.silent) {
				const task = await this.tmCore!.getTask(targetTaskId);
				if (task) {
					console.log(
						chalk.green('🚀 Starting Task: ') +
							chalk.white.bold(`#${task.id} - ${task.title}`)
					);
					console.log(chalk.gray('Launching Claude Code...'));
					console.log(); // Empty line
				}
			}

			// Handle subtask IDs by extracting parent task ID
			let actualTaskId = targetTaskId;
			let subtaskId: string | undefined;

			if (targetTaskId.includes('.')) {
				// This is a subtask ID like "67.1"
				const [parentId, subId] = targetTaskId.split('.');
				actualTaskId = parentId;
				subtaskId = subId;
			}

			// Get the task and start it
			const result = await this.startTask(actualTaskId, options, subtaskId);

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
	 * Check for existing in-progress tasks and warn user if needed
	 */
	private async checkInProgressTasks(
		targetTaskId: string,
		options: StartCommandOptions
	): Promise<boolean> {
		if (!this.tmCore || options.force) {
			return true; // Skip check if forced or core not available
		}

		// Get all tasks to check for in-progress status
		const allTasks = await this.tmCore.getTaskList();
		const inProgressTasks = allTasks.tasks.filter(
			(task) => task.status === 'in-progress'
		);

		// If the target task is already in-progress, that's fine
		const targetTaskInProgress = inProgressTasks.find(
			(task) => task.id === targetTaskId
		);
		if (targetTaskInProgress) {
			return true; // Target task is already in-progress, allow continuation
		}

		// Check if target is a subtask and its parent is in-progress
		const isSubtask = targetTaskId.includes('.');
		if (isSubtask) {
			const parentTaskId = targetTaskId.split('.')[0];
			const parentInProgress = inProgressTasks.find(
				(task) => task.id === parentTaskId
			);
			if (parentInProgress) {
				return true; // Allow subtasks when parent is in-progress
			}
		}

		// Check if other unrelated tasks are in-progress
		const otherInProgressTasks = inProgressTasks.filter((task) => {
			if (task.id === targetTaskId) return false;

			// If target is a subtask, exclude its parent from conflicts
			if (isSubtask) {
				const parentTaskId = targetTaskId.split('.')[0];
				if (task.id === parentTaskId) return false;
			}

			// If the in-progress task is a subtask of our target parent, exclude it
			if (task.id.toString().includes('.')) {
				const taskParentId = task.id.toString().split('.')[0];
				if (isSubtask && taskParentId === targetTaskId.split('.')[0]) {
					return false;
				}
			}

			return true;
		});

		if (otherInProgressTasks.length > 0) {
			console.log(
				boxen(
					chalk.yellow.bold('⚠ Warning: Tasks Already In Progress') +
						'\n\n' +
						chalk.white('The following tasks are currently in-progress:') +
						'\n\n' +
						otherInProgressTasks
							.map((task) => `• Task #${task.id}: ${task.title}`)
							.join('\n') +
						'\n\n' +
						chalk.cyan('Suggestions:') +
						'\n' +
						`• Complete current task(s) first\n` +
						`• Run ${chalk.yellow('tm set-status --id=<id> --status=done')} to mark complete\n` +
						`• Use ${chalk.yellow('--force')} flag to override this warning`,
					{
						padding: 1,
						borderStyle: 'round',
						borderColor: 'yellow',
						width: process.stdout.columns * 0.9 || 100,
						margin: { top: 1 }
					}
				)
			);
			return false;
		}

		return true;
	}

	/**
	 * Start working on a task
	 */
	private async startTask(
		taskId: string,
		options: StartCommandOptions,
		subtaskId?: string
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

		// Find the specific subtask if provided
		let subtask = undefined;
		if (subtaskId && task.subtasks) {
			subtask = task.subtasks.find(st => String(st.id) === subtaskId);
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
			claudeCodePrompt:
				executionResult?.output || 'Task executed via ExecutorService',
			subtaskId,
			subtask
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
			if (result.claudeCodePrompt) {
				console.log(); // Empty line for spacing
				console.log(
					boxen(
						chalk.white.bold('Claude-Code Prompt:') +
							'\n\n' +
							result.claudeCodePrompt,
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
