/**
 * @fileoverview ClusterStartCommand — subcommand of `clusters`
 * Builds an execution plan and launches an interactive Claude Code session
 * with a system prompt containing full cluster context for teams-mode execution.
 *
 * Usage: tm clusters start [--tag <tag>] [--dry-run] [--parallel <n>] [--resume] [--json]
 */

import { type ChildProcess, spawn } from 'child_process';
import { type ExecutionPlan, type TmCore, createTmCore } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import { Command, InvalidArgumentError } from 'commander';
import ora, { type Ora } from 'ora';
import { displayExecutionPlan } from '../ui/components/execution-plan.component.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * CLI options for `tm clusters start`
 */
export interface ClusterStartOptions {
	tag?: string;
	dryRun?: boolean;
	parallel?: number;
	resume?: boolean;
	continueOnFailure?: boolean;
	json?: boolean;
	project?: string;
}

/**
 * ClusterStartCommand — launches cluster execution via Claude Code teams session
 */
export class ClusterStartCommand extends Command {
	private tmCore?: TmCore;
	private childProcess?: ChildProcess;
	private currentPlan?: ExecutionPlan;
	/**
	 * Placeholders for future progress tracking.
	 * Currently not populated because the Claude child process doesn't emit
	 * structured progress events that we can intercept. This is a known limitation
	 * where we spawn Claude as an interactive session (inheriting stdio), so we
	 * cannot get real-time task completion feedback.
	 */
	private completedClusters: string[] = [];
	private completedTasks: string[] = [];

	constructor() {
		super('start');

		this.description(
			'Execute task clusters via an interactive Claude Code teams session'
		)
			.option(
				'-t, --tag <tag>',
				'Tag to execute clusters for (default: active tag)'
			)
			.option('--dry-run', 'Show execution plan without launching Claude')
			.option(
				'--parallel <n>',
				'Max concurrent tasks per level (default: 5)',
				(v) => {
					const parsed = parseInt(v, 10);
					if (
						!Number.isInteger(parsed) ||
						parsed <= 0 ||
						String(parsed) !== v
					) {
						throw new InvalidArgumentError(
							'--parallel must be a positive integer'
						);
					}
					return parsed;
				}
			)
			.option('--resume', 'Resume from a previous checkpoint')
			.option(
				'--continue-on-failure',
				'Continue execution even if some tasks fail'
			)
			.option('--json', 'Output execution plan as JSON')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (options: ClusterStartOptions) => {
				await this.executeCommand(options);
			});
	}

	private async executeCommand(options: ClusterStartOptions): Promise<void> {
		let spinner: Ora | null = null;

		try {
			// Initialize tm-core
			const projectRoot = getProjectRoot(options.project);
			if (!options.json) {
				spinner = ora('Initializing Task Master...').start();
			}
			this.tmCore = await createTmCore({ projectPath: projectRoot });
			if (!options.json && spinner) {
				spinner.succeed('Task Master initialized');
			}

			// Build execution plan (auto-detects clusters from the DAG)
			if (!options.json) {
				spinner = ora('Building execution plan...').start();
			}
			const plan = await this.tmCore.cluster.buildExecutionPlan({
				tag: options.tag,
				dryRun: options.dryRun,
				parallel: options.parallel,
				resume: options.resume,
				continueOnFailure: options.continueOnFailure
			});
			this.currentPlan = plan;

			if (plan.totalTasks === 0) {
				if (!options.json && spinner) {
					spinner.warn('No tasks found for the specified tag');
				}
				displayExecutionPlan(plan, { json: options.json });
				return;
			}

			if (!options.json && spinner) {
				spinner.succeed(
					`Plan ready: ${plan.totalClusters} clusters, ${plan.totalTasks} tasks, ${plan.estimatedTurns} turns`
				);
			}

			// Display the plan
			displayExecutionPlan(plan, { json: options.json });

			// In JSON mode, output plan and exit immediately
			if (options.json) {
				return;
			}

			// Stop here for dry run
			if (options.dryRun) {
				console.log(
					boxen(
						chalk.yellow(
							'Dry run — Claude Code would be launched with the above plan'
						),
						{
							padding: { top: 0, bottom: 0, left: 1, right: 1 },
							borderColor: 'yellow',
							borderStyle: 'round',
							margin: { top: 1 }
						}
					)
				);
				return;
			}

			// Generate prompt
			const prompt = this.tmCore.cluster.buildPrompt(plan);

			// Launch interactive Claude session
			await this.launchClaudeSession(prompt, projectRoot);

			// Post-session message
			this.displayPostSessionMessage(plan);
		} catch (error: any) {
			if (spinner?.isSpinning) {
				spinner.fail('Operation failed');
			}
			displayError(error);
		} finally {
			// Clean up TmCore resources
			if (this.tmCore) {
				try {
					await this.tmCore.close();
				} catch (closeError) {
					// Silently handle close errors to avoid masking original errors
				}
				this.tmCore = undefined;
			}
		}
	}

	/**
	 * Launch an interactive Claude Code session with the prompt.
	 * The session inherits stdio so the user can interact with Claude directly.
	 */
	private async launchClaudeSession(
		prompt: string,
		projectRoot: string
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			console.log(chalk.green('Launching Claude Code teams session...'));
			console.log();

			this.childProcess = spawn('claude', [], {
				cwd: projectRoot,
				stdio: ['pipe', 'inherit', 'inherit'],
				shell: false,
				env: {
					...process.env,
					CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1'
				}
			});

			// Write prompt to stdin
			this.childProcess.stdin?.write(prompt);
			this.childProcess.stdin?.end();

			const cleanup = () => {
				// Remove handlers immediately to prevent double-firing
				process.removeListener('SIGINT', cleanup);
				process.removeListener('SIGTERM', cleanup);

				if (this.childProcess && !this.childProcess.killed) {
					this.childProcess.kill('SIGTERM');
				}

				// Best-effort checkpoint save (fire-and-forget in signal handler)
				// NOTE: Progress tracking is not yet wired up — completedClusters and
				// completedTasks are empty because the Claude child process doesn't emit
				// structured progress events we can intercept. This checkpoint still saves
				// the plan metadata, but doesn't track actual completion progress.
				if (this.tmCore && this.currentPlan) {
					const tag = this.currentPlan.tag;
					this.tmCore.cluster
						.saveCheckpoint(tag, this.completedClusters, this.completedTasks)
						.then(() => {
							console.log(
								chalk.yellow(
									`\nCheckpoint saved. Resume with: tm clusters start --tag ${tag} --resume`
								)
							);
						})
						.catch(() => {
							// Best-effort checkpoint save
						});
				}
			};

			process.on('SIGINT', cleanup);
			process.on('SIGTERM', cleanup);

			this.childProcess.on('close', (code) => {
				this.childProcess = undefined;
				// Clean up signal handlers on normal exit
				process.removeListener('SIGINT', cleanup);
				process.removeListener('SIGTERM', cleanup);

				if (code === 0) {
					resolve();
				} else if (code === null) {
					console.log(chalk.yellow('\nSession interrupted by signal'));
					resolve();
				} else {
					reject(new Error(`Claude Code exited with code ${code}`));
				}
			});

			this.childProcess.on('error', (error) => {
				this.childProcess = undefined;
				// Clean up signal handlers on error
				process.removeListener('SIGINT', cleanup);
				process.removeListener('SIGTERM', cleanup);

				reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
			});
		});
	}

	/**
	 * Display a summary message after the Claude session ends
	 */
	private displayPostSessionMessage(plan: ExecutionPlan): void {
		console.log(
			boxen(
				chalk.green.bold('Cluster Execution Session Complete') +
					'\n\n' +
					chalk.white(`Tag: ${plan.tag}`) +
					'\n' +
					chalk.white(`Clusters: ${plan.totalClusters}`) +
					'\n' +
					chalk.white(`Tasks: ${plan.totalTasks}`) +
					'\n\n' +
					chalk.cyan('Next steps:') +
					'\n' +
					`  ${chalk.yellow(`tm list --tag ${plan.tag}`)} — review task statuses\n` +
					`  ${chalk.yellow(`tm clusters --tag ${plan.tag}`)} — view cluster breakdown\n` +
					`  ${chalk.yellow(`tm clusters start --tag ${plan.tag} --resume`)} — resume if interrupted`,
				{
					padding: 1,
					borderStyle: 'round',
					borderColor: 'green',
					width: Math.min(process.stdout.columns || 100, 100),
					margin: { top: 1 }
				}
			)
		);
	}
}
