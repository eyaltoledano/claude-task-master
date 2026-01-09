/**
 * @fileoverview LoopCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 * This is a thin presentation layer over @tm/core's LoopDomain
 */

import path from 'node:path';
import {
	type LoopConfig,
	type LoopResult,
	type TmCore,
	createTmCore
} from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * CLI-specific options interface for the loop command
 */
export interface LoopCommandOptions {
	/** Maximum number of iterations */
	iterations?: string;
	/** Preset name or path to prompt file */
	prompt?: string;
	/** Path to progress log file */
	progressFile?: string;
	/** Filter by tag */
	tag?: string;
	/** Project root directory */
	project?: string;
	/** Output results as JSON */
	json?: boolean;
}

/**
 * LoopCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core's LoopDomain
 */
export class LoopCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: LoopResult;

	constructor(name?: string) {
		super(name || 'loop');

		// Configure the command
		this.description('Run Claude Code in a loop, one task per iteration')
			.option('-n, --iterations <number>', 'Maximum iterations', '10')
			.option(
				'-p, --prompt <preset|path>',
				'Preset name or path to prompt file',
				'default'
			)
			.option(
				'--progress-file <path>',
				'Path to progress log file',
				'.taskmaster/progress.txt'
			)
			.option('-t, --tag <tag>', 'Only work on tasks with this tag')
			.option(
				'--project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.option('--json', 'Output results as JSON')
			.action(async (options: LoopCommandOptions) => {
				await this.executeLoop(options);
			});
	}

	/**
	 * Execute the loop command
	 */
	private async executeLoop(options: LoopCommandOptions): Promise<void> {
		let hasError = false;

		try {
			// Validate options
			this.validateOptions(options);

			// Initialize tm-core
			const projectRoot = getProjectRoot(options.project);
			await this.initializeCore(projectRoot);

			// Display header for non-JSON output
			if (!options.json && this.tmCore) {
				const storageType = this.tmCore.tasks.getStorageType();
				displayCommandHeader(this.tmCore, {
					tag: options.tag || 'master',
					storageType
				});
				console.log(chalk.cyan('Starting Task Master Loop...'));
				console.log(chalk.dim(`Preset: ${options.prompt || 'default'}`));
				console.log(chalk.dim(`Max iterations: ${options.iterations || '10'}`));
				console.log();
			}

			// Build LoopConfig from options
			const config: Partial<LoopConfig> = {
				iterations: parseInt(options.iterations || '10', 10),
				prompt: options.prompt || 'default',
				progressFile: options.progressFile || '.taskmaster/progress.txt',
				tag: options.tag
			};

			if (!this.tmCore) {
				throw new Error('TmCore not initialized');
			}

			// Execute loop via TmCore
			const result = await this.tmCore.loop.run(config);

			// Store result for programmatic access
			this.lastResult = result;

			// Display results
			if (options.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				this.displayResult(result);
			}
		} catch (error: any) {
			hasError = true;
			displayError(error, { skipExit: true });
		} finally {
			// Clean up resources
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
	private validateOptions(options: LoopCommandOptions): void {
		// Validate iterations
		if (options.iterations) {
			const iterations = parseInt(options.iterations, 10);
			if (isNaN(iterations) || iterations < 1) {
				throw new Error(
					`Invalid iterations: ${options.iterations}. Must be a positive integer.`
				);
			}
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
	 * Display result in text format
	 */
	private displayResult(result: LoopResult): void {
		console.log();
		console.log(chalk.bold('Loop Complete'));
		console.log(chalk.dim('\u2500'.repeat(40)));
		console.log(`Total iterations: ${result.totalIterations}`);
		console.log(`Tasks completed: ${result.tasksCompleted}`);
		console.log(`Final status: ${this.formatStatus(result.finalStatus)}`);
	}

	/**
	 * Format status with color
	 */
	private formatStatus(status: LoopResult['finalStatus']): string {
		switch (status) {
			case 'all_complete':
				return chalk.green('All tasks complete');
			case 'max_iterations':
				return chalk.yellow('Max iterations reached');
			case 'blocked':
				return chalk.red('Blocked');
			case 'error':
				return chalk.red('Error');
			default:
				return status;
		}
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): LoopResult | undefined {
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
	static register(program: Command, name?: string): LoopCommand {
		const loopCommand = new LoopCommand(name);
		program.addCommand(loopCommand);
		return loopCommand;
	}
}
