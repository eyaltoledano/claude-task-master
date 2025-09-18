/**
 * @fileoverview StartCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { execSync } from 'child_process';
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
			if (error.stack && process.env.DEBUG) {
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

		// TODO: Implement next task logic via tm-core
		// This should find the next task that can be worked on (no blocking dependencies)
		return null;
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

		// Mark task as in-progress if not already
		if (task.status === 'pending') {
			// TODO: Update task status to 'in-progress' via tm-core
		}

		// Build standardized prompt for claude-code
		const claudeCodePrompt = this.buildStandardizedPrompt(task);

		// Execute claude-code with the prompt (or show dry-run)
		let started = false;
		if (!options.dryRun) {
			started = await this.executeClaudeCode(claudeCodePrompt, options);
		} else {
			// For dry-run, just show that we would execute
			started = true;
		}

		return {
			task,
			found: true,
			started,
			storageType: this.tmCore.getStorageType() as Exclude<StorageType, 'auto'>,
			claudeCodePrompt
		};
	}

	/**
	 * Build the standardized prompt for claude-code based on task details
	 * Includes all task information directly in the prompt
	 */
	private buildStandardizedPrompt(task: Task): string {
		const sections: string[] = [];

		// Header
		sections.push(
			`You are an AI coding assistant with access to this repository's codebase.`
		);
		sections.push('');

		// Task information
		sections.push(`TASK: ${task.id} - ${task.title}`);
		sections.push('='.repeat(50));
		sections.push('');

		// Description
		if (task.description) {
			sections.push('DESCRIPTION:');
			sections.push(task.description);
			sections.push('');
		}

		// Implementation details
		if (task.details) {
			sections.push('IMPLEMENTATION DETAILS:');
			sections.push(task.details);
			sections.push('');
		}

		// Dependencies context
		if (task.dependencies && task.dependencies.length > 0) {
			sections.push('DEPENDENCIES:');
			sections.push(`This task depends on: ${task.dependencies.join(', ')}`);
			sections.push(
				'Make sure these dependencies are completed before proceeding.'
			);
			sections.push('');
		}

		// Test strategy
		if (task.testStrategy) {
			sections.push('TEST STRATEGY:');
			sections.push(task.testStrategy);
			sections.push('');
		}

		// Subtasks context
		if (task.subtasks && task.subtasks.length > 0) {
			sections.push('SUBTASKS:');
			task.subtasks.forEach((subtask) => {
				const statusIcon =
					subtask.status === 'done'
						? '✅'
						: subtask.status === 'in-progress'
							? '🔄'
							: '⭕';
				sections.push(
					`  ${statusIcon} ${task.id}.${subtask.id} - ${subtask.title} [${subtask.status}]`
				);
				if (subtask.description) {
					sections.push(`      ${subtask.description}`);
				}
			});
			sections.push('');
		}

		// Priority context
		if (task.priority) {
			sections.push(`PRIORITY: ${task.priority.toUpperCase()}`);
			sections.push('');
		}

		// Implementation guidelines
		sections.push('IMPLEMENTATION REQUIREMENTS:');
		sections.push('- Make the SMALLEST number of code changes possible');
		sections.push('- Follow ALL existing patterns in the codebase');
		sections.push('- Do NOT over-engineer the solution');
		sections.push('- Use existing files/functions/patterns wherever possible');
		sections.push("- Follow the project's conventions and best practices");
		sections.push('- Ensure proper TypeScript typing');
		sections.push('- Add appropriate error handling');
		sections.push('- Do NOT create or modify tasks in the task database');
		sections.push('- Do NOT use task-master commands');
		sections.push('');

		// Completion instruction
		sections.push('COMPLETION:');
		sections.push(
			'When complete, print: COMPLETED: <brief summary of changes>'
		);
		sections.push('');
		sections.push('Begin implementation now.');

		return sections.join('\n');
	}

	/**
	 * Execute claude-code with the built prompt
	 */
	private async executeClaudeCode(
		prompt: string,
		options: StartCommandOptions
	): Promise<boolean> {
		try {
			console.log(
				chalk.blue('🚀 Starting claude-code to implement the task...')
			);

			// Escape quotes in the prompt for shell execution
			const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/`/g, '\\`');

			// Construct the claude command with auto-exit
			// Use printf to send the prompt and then /exit
			const claudeCommand = `printf "${escapedPrompt}\\n/exit\\n" | claude`;

			if (options.dryRun) {
				console.log(chalk.cyan('Dry run - would execute:'));
				console.log(chalk.gray(claudeCommand));
				return true;
			}

			// Execute claude-code with the prompt
			// Use stdio: 'inherit' to allow interactive session
			execSync(claudeCommand, {
				stdio: 'inherit',
				cwd: options.project || process.cwd()
			});

			console.log(chalk.green('✅ Claude session completed successfully.'));

			return true;
		} catch (error: any) {
			// Handle common errors
			if (error.status === 127) {
				console.error(chalk.red('❌ Error: claude command not found'));
				console.error(
					chalk.yellow(
						'Please make sure Claude Code is installed and available in your PATH'
					)
				);
				console.error(chalk.gray('Install from: https://claude.ai/code'));
				return false;
			}

			if (error.signal === 'SIGINT') {
				console.log(chalk.yellow('\n⚠️  Claude session interrupted by user'));
				return false;
			}

			console.error(
				chalk.red(`❌ Error executing claude-code: ${error.message}`)
			);

			// Show additional error details in debug mode
			if (process.env.DEBUG) {
				console.error(chalk.gray('Error details:'));
				console.error(chalk.gray(JSON.stringify(error, null, 2)));
			}

			return false;
		}
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
