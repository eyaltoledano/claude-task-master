/**
 * @fileoverview Loop command - thin CLI wrapper over @tm/core's LoopDomain
 */

import path from 'node:path';
import {
	type LoopConfig,
	type LoopIteration,
	type LoopOutputCallbacks,
	type LoopResult,
	PRESET_NAMES,
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
	sandbox?: boolean;
	output?: boolean;
	verbose?: boolean;
}

export class LoopCommand extends Command {
	private tmCore!: TmCore;

	constructor(name?: string) {
		super(name || 'loop');

		this.description('Run Claude Code in a loop, one task per iteration')
			.option('-n, --iterations <number>', 'Maximum iterations')
			.option(
				'-p, --prompt <preset|path>',
				`Preset name (${PRESET_NAMES.join(', ')}) or path to custom prompt file`,
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
			.option('--sandbox', 'Run Claude in Docker sandbox mode')
			.option(
				'--no-output',
				'Exclude full Claude output from iteration results'
			)
			.option('-v, --verbose', "Show Claude's work in real-time")
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

			displayCommandHeader(this.tmCore, {
				tag: options.tag || 'master',
				storageType: this.tmCore.tasks.getStorageType()
			});

			// Only check sandbox auth when --sandbox flag is used
			if (options.sandbox) {
				this.handleSandboxAuth();
			}

			console.log(chalk.cyan('Starting Task Master Loop...'));
			console.log(chalk.dim(`Preset: ${prompt}`));
			console.log(chalk.dim(`Max iterations: ${iterations}`));
			console.log(
				chalk.dim(`Mode: ${options.sandbox ? 'Docker sandbox' : 'Claude CLI'}`)
			);

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

			// Auto-detect brief name from auth context (if available)
			const briefName = this.tmCore.auth.getContext()?.briefName;

			const config: Partial<LoopConfig> = {
				iterations,
				prompt,
				progressFile,
				tag: options.tag,
				sandbox: options.sandbox,
				// CLI defaults to including output (users typically want to see it)
				// Domain defaults to false (library consumers opt-in explicitly)
				includeOutput: options.output ?? true,
				verbose: options.verbose ?? false,
				brief: briefName,
				callbacks: this.createOutputCallbacks()
			};

			const result = await this.tmCore.loop.run(config);
			this.displayResult(result);
		} catch (error: unknown) {
			displayError(error, { skipExit: true });
			process.exit(1);
		}
	}

	private handleSandboxAuth(): void {
		console.log(chalk.dim('Checking sandbox auth...'));
		const authCheck = this.tmCore.loop.checkSandboxAuth();

		if (authCheck.error) {
			throw new Error(authCheck.error);
		}

		if (authCheck.ready) {
			console.log(chalk.green('✓ Sandbox ready'));
			return;
		}

		console.log(
			chalk.yellow(
				'Sandbox needs authentication. Starting interactive session...'
			)
		);
		console.log(chalk.dim('Please complete auth, then Ctrl+C to continue.\n'));

		const authResult = this.tmCore.loop.runInteractiveAuth();
		if (!authResult.success) {
			throw new Error(authResult.error || 'Interactive authentication failed');
		}
		console.log(chalk.green('✓ Auth complete\n'));
	}

	private validateIterations(iterations: string): void {
		const parsed = Number(iterations);
		if (!Number.isInteger(parsed) || parsed < 1) {
			throw new Error(
				`Invalid iterations: ${iterations}. Must be a positive integer.`
			);
		}
	}

	private createOutputCallbacks(): LoopOutputCallbacks {
		return {
			onIterationStart: (iteration: number, total: number) => {
				console.log();
				console.log(chalk.cyan(`━━━ Iteration ${iteration} of ${total} ━━━`));
			},
			onText: (text: string) => {
				console.log(text);
			},
			onToolUse: (toolName: string) => {
				console.log(chalk.dim(`  → ${toolName}`));
			},
			onError: (message: string, severity?: 'warning' | 'error') => {
				if (severity === 'warning') {
					console.error(chalk.yellow(`[Loop Warning] ${message}`));
				} else {
					console.error(chalk.red(`[Loop Error] ${message}`));
				}
			},
			onStderr: (iteration: number, text: string) => {
				process.stderr.write(chalk.dim(`[Iteration ${iteration}] `) + text);
			},
			onOutput: (output: string) => {
				console.log(output);
			},
			onIterationEnd: (iteration: LoopIteration) => {
				const statusColor =
					iteration.status === 'success'
						? chalk.green
						: iteration.status === 'error'
							? chalk.red
							: chalk.yellow;
				console.log(
					statusColor(
						`  Iteration ${iteration.iteration} completed: ${iteration.status}`
					)
				);
			}
		};
	}

	private displayResult(result: LoopResult): void {
		console.log();
		console.log(chalk.bold('Loop Complete'));
		console.log(chalk.dim('─'.repeat(40)));
		console.log(`Total iterations: ${result.totalIterations}`);
		console.log(`Tasks completed: ${result.tasksCompleted}`);
		console.log(`Final status: ${this.formatStatus(result.finalStatus)}`);
		if (result.errorMessage) {
			console.log(chalk.red(`Error: ${result.errorMessage}`));
		}
	}

	private formatStatus(status: LoopResult['finalStatus']): string {
		const statusMap: Record<LoopResult['finalStatus'], string> = {
			all_complete: chalk.green('All tasks complete'),
			max_iterations: chalk.yellow('Max iterations reached'),
			blocked: chalk.red('Blocked'),
			error: chalk.red('Error')
		};
		return statusMap[status];
	}

	static register(program: Command, name?: string): LoopCommand {
		const cmd = new LoopCommand(name);
		program.addCommand(cmd);
		return cmd;
	}
}
