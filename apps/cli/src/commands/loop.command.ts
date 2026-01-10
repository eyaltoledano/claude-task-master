/**
 * @fileoverview Loop command - thin CLI wrapper over @tm/core's LoopDomain
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

export interface LoopCommandOptions {
	iterations?: string;
	prompt?: string;
	progressFile?: string;
	tag?: string;
	project?: string;
	json?: boolean;
}

export class LoopCommand extends Command {
	private tmCore!: TmCore;

	constructor(name?: string) {
		super(name || 'loop');

		this.description('Run Claude Code in a loop, one task per iteration')
			.option('-n, --iterations <number>', 'Maximum iterations')
			.option(
				'-p, --prompt <preset|path>',
				'Preset name (default, test-coverage, linting, duplication, entropy) or path to custom prompt file',
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
			.action((options: LoopCommandOptions) => this.execute(options));
	}

	private async execute(options: LoopCommandOptions): Promise<void> {
		const prompt = options.prompt || 'default';
		const progressFile = options.progressFile || '.taskmaster/progress.txt';

		try {
			const projectRoot = path.resolve(getProjectRoot(options.project));
			this.tmCore = await createTmCore({ projectPath: projectRoot });

			// Get pending task count for default preset iteration resolution
			const pendingTaskCount =
				prompt === 'default'
					? await this.tmCore.tasks.getCount('pending', options.tag)
					: undefined;

			// Delegate iteration resolution logic to tm-core
			const iterations = this.tmCore.loop.resolveIterations({
				userIterations: options.iterations
					? parseInt(options.iterations, 10)
					: undefined,
				preset: prompt,
				pendingTaskCount
			});

			this.validateIterations(String(iterations));

			if (!options.json) {
				displayCommandHeader(this.tmCore, {
					tag: options.tag || 'master',
					storageType: this.tmCore.tasks.getStorageType()
				});
			}

			this.handleSandboxAuth(options.json);

			if (!options.json) {
				console.log(chalk.cyan('Starting Task Master Loop...'));
				console.log(chalk.dim(`Preset: ${prompt}`));
				console.log(chalk.dim(`Max iterations: ${iterations}`));

				// Show next task only for default preset (other presets don't use Task Master tasks)
				if (prompt === 'default') {
					const nextTask = await this.tmCore.tasks.getNext(options.tag);
					if (nextTask) {
						console.log(
							chalk.white(
								`Next task to work on: ${chalk.white(nextTask.id)} - ${nextTask.title}`
							)
						);
					} else {
						console.log(chalk.yellow('No pending tasks found'));
					}
				}
				console.log();
			}

			const config: Partial<LoopConfig> = {
				iterations,
				prompt,
				progressFile,
				tag: options.tag
			};

			const result = await this.tmCore.loop.run(config);

			if (options.json) {
				console.log(JSON.stringify(result, null, 2));
			} else {
				this.displayResult(result);
			}
		} catch (error: unknown) {
			displayError(error, { skipExit: true });
			process.exit(1);
		}
	}

	private handleSandboxAuth(isJson?: boolean): void {
		if (!isJson) console.log(chalk.dim('Checking sandbox auth...'));
		const isAuthed = this.tmCore.loop.checkSandboxAuth();

		if (isAuthed) {
			if (!isJson) console.log(chalk.green('✓ Sandbox ready'));
			return;
		}

		if (!isJson) {
			console.log(
				chalk.yellow(
					'Sandbox needs authentication. Starting interactive session...'
				)
			);
			console.log(
				chalk.dim('Please complete auth, then Ctrl+C to continue.\n')
			);
		}

		this.tmCore.loop.runInteractiveAuth();
		if (!isJson) console.log(chalk.green('✓ Auth complete\n'));
	}

	private validateIterations(iterations: string): void {
		const parsed = parseInt(iterations, 10);
		if (isNaN(parsed) || parsed < 1) {
			throw new Error(
				`Invalid iterations: ${iterations}. Must be a positive integer.`
			);
		}
	}

	private displayResult(result: LoopResult): void {
		console.log();
		console.log(chalk.bold('Loop Complete'));
		console.log(chalk.dim('─'.repeat(40)));
		console.log(`Total iterations: ${result.totalIterations}`);
		console.log(`Tasks completed: ${result.tasksCompleted}`);
		console.log(`Final status: ${this.formatStatus(result.finalStatus)}`);
	}

	private formatStatus(status: LoopResult['finalStatus']): string {
		const statusMap: Record<string, string> = {
			all_complete: chalk.green('All tasks complete'),
			max_iterations: chalk.yellow('Max iterations reached'),
			blocked: chalk.red('Blocked'),
			error: chalk.red('Error')
		};
		return statusMap[status] || status;
	}

	static register(program: Command, name?: string): LoopCommand {
		const cmd = new LoopCommand(name);
		program.addCommand(cmd);
		return cmd;
	}
}
