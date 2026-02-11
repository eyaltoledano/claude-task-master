/**
 * @fileoverview ClusterStartCommand — subcommand of `clusters`
 * Builds an execution plan and launches an interactive Claude Code session
 * with a system prompt containing full cluster context for teams-mode execution.
 *
 * Usage: tm clusters start [--tag <tag>] [--dry-run] [--parallel <n>] [--resume] [--json]
 */

import { spawn, type ChildProcess } from 'child_process';
import { type ExecutionPlan, type TmCore, createTmCore } from '@tm/core';
import boxen from 'boxen';
import chalk from 'chalk';
import { Command } from 'commander';
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

	constructor() {
		super('start');

		this.description(
			'Execute task clusters via an interactive Claude Code teams session'
		)
			.option(
				'-t, --tag <tag>',
				'Tag to execute clusters for (default: master)'
			)
			.option('--dry-run', 'Show execution plan without launching Claude')
			.option(
				'--parallel <n>',
				'Max concurrent tasks per level (default: 5)',
				(v) => parseInt(v, 10)
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
			spinner = ora('Initializing Task Master...').start();
			this.tmCore = await createTmCore({ projectPath: projectRoot });
			spinner.succeed('Task Master initialized');

			// Build execution plan (auto-detects clusters from the DAG)
			spinner = ora('Building execution plan...').start();
			const plan = await this.tmCore.cluster.buildExecutionPlan({
				tag: options.tag,
				dryRun: options.dryRun,
				parallel: options.parallel,
				resume: options.resume,
				continueOnFailure: options.continueOnFailure
			});
			this.currentPlan = plan;

			if (plan.totalTasks === 0) {
				spinner.warn('No tasks found for the specified tag');
				return;
			}

			spinner.succeed(
				`Plan ready: ${plan.totalClusters} clusters, ${plan.totalTasks} tasks, ${plan.estimatedTurns} turns`
			);

			// Display the plan
			displayExecutionPlan(plan, { json: options.json });

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

			// Generate system prompt
			const systemPrompt = this.tmCore.cluster.buildSystemPrompt(plan);

			// Launch interactive Claude session
			await this.launchClaudeSession(systemPrompt, projectRoot);

			// Post-session message
			this.displayPostSessionMessage(plan);
		} catch (error: any) {
			if (spinner?.isSpinning) {
				spinner.fail('Operation failed');
			}
			displayError(error);
		}
	}

	/**
	 * Launch an interactive Claude Code session with the system prompt.
	 * The session inherits stdio so the user can interact with Claude directly.
	 */
	private async launchClaudeSession(
		systemPrompt: string,
		projectRoot: string
	): Promise<void> {
		return new Promise((resolve, reject) => {
			console.log(chalk.green('Launching Claude Code teams session...'));
			console.log();

			this.childProcess = spawn('claude', ['--system-prompt', systemPrompt], {
				cwd: projectRoot,
				stdio: 'inherit',
				shell: false
			});

			this.childProcess.on('close', (code) => {
				this.childProcess = undefined;
				if (code === 0 || code === null) {
					resolve();
				} else {
					reject(new Error(`Claude Code exited with code ${code}`));
				}
			});

			this.childProcess.on('error', (error) => {
				this.childProcess = undefined;
				reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
			});

			// Handle SIGINT: save checkpoint and terminate child
			const cleanup = async () => {
				if (this.childProcess && !this.childProcess.killed) {
					this.childProcess.kill('SIGTERM');
				}

				// Save checkpoint
				if (this.tmCore && this.currentPlan) {
					try {
						await this.tmCore.cluster.saveCheckpoint(
							this.currentPlan.tag,
							[],
							[]
						);
						console.log(
							chalk.yellow(
								`\nCheckpoint saved. Resume with: tm clusters start --tag ${this.currentPlan.tag} --resume`
							)
						);
					} catch {
						// Best-effort checkpoint save
					}
				}
			};

			process.on('SIGINT', cleanup);
			process.on('SIGTERM', cleanup);
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
