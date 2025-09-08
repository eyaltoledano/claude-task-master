/**
 * @fileoverview Workflow Stop Command
 * Stop and clean up workflow execution
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
	TaskExecutionManager,
	type TaskExecutionManagerConfig
} from '@tm/workflow-engine';
import * as ui from '../../utils/ui.js';

export interface WorkflowStopOptions {
	project?: string;
	worktreeBase?: string;
	claude?: string;
	force?: boolean;
	all?: boolean;
}

/**
 * WorkflowStopCommand - Stop workflow execution
 */
export class WorkflowStopCommand extends Command {
	private workflowManager?: TaskExecutionManager;

	constructor(name?: string) {
		super(name || 'stop');

		this.description('Stop workflow execution and clean up resources')
			.argument('[workflow-id]', 'Workflow ID to stop (or task ID)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.option(
				'--worktree-base <path>',
				'Base directory for worktrees',
				'../task-worktrees'
			)
			.option('--claude <path>', 'Claude Code executable path', 'claude')
			.option('-f, --force', 'Force stop (kill process immediately)')
			.option('--all', 'Stop all running workflows')
			.action(
				async (
					workflowId: string | undefined,
					options: WorkflowStopOptions
				) => {
					await this.executeCommand(workflowId, options);
				}
			);
	}

	private async executeCommand(
		workflowId: string | undefined,
		options: WorkflowStopOptions
	): Promise<void> {
		try {
			// Initialize workflow manager
			await this.initializeWorkflowManager(options);

			if (options.all) {
				await this.stopAllWorkflows(options);
			} else if (workflowId) {
				await this.stopSingleWorkflow(workflowId, options);
			} else {
				ui.displayError('Please specify a workflow ID or use --all flag');
				process.exit(1);
			}
		} catch (error: any) {
			ui.displayError(error.message || 'Failed to stop workflow');
			process.exit(1);
		}
	}

	private async initializeWorkflowManager(
		options: WorkflowStopOptions
	): Promise<void> {
		if (!this.workflowManager) {
			const projectRoot = options.project || process.cwd();
			const worktreeBase = path.resolve(
				projectRoot,
				options.worktreeBase || '../task-worktrees'
			);

			const config: TaskExecutionManagerConfig = {
				projectRoot,
				maxConcurrent: 5,
				defaultTimeout: 60,
				worktreeBase,
				claudeExecutable: options.claude || 'claude',
				debug: false
			};

			this.workflowManager = new TaskExecutionManager(config);
			await this.workflowManager.initialize();
		}
	}

	private async stopSingleWorkflow(
		workflowId: string,
		options: WorkflowStopOptions
	): Promise<void> {
		// Try to find workflow by ID or task ID
		let workflow = this.workflowManager!.getWorkflowStatus(workflowId);

		if (!workflow) {
			// Try as task ID
			workflow = this.workflowManager!.getWorkflowByTaskId(workflowId);
		}

		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		const actualWorkflowId = `workflow-${workflow.taskId}`;

		// Display workflow info
		console.log(chalk.blue.bold(`🛑 Stopping Workflow: ${actualWorkflowId}`));
		console.log(`${chalk.blue('Task:')} ${workflow.taskTitle}`);
		console.log(
			`${chalk.blue('Status:')} ${this.getStatusDisplay(workflow.status)}`
		);
		console.log(
			`${chalk.blue('Worktree:')} ${chalk.gray(workflow.worktreePath)}`
		);

		if (workflow.processId) {
			console.log(
				`${chalk.blue('Process ID:')} ${chalk.gray(workflow.processId)}`
			);
		}

		console.log();

		// Confirm if not forced
		if (!options.force && ['running', 'paused'].includes(workflow.status)) {
			const shouldProceed = await ui.confirm(
				`Are you sure you want to stop this ${workflow.status} workflow?`
			);

			if (!shouldProceed) {
				console.log(chalk.gray('Operation cancelled'));
				return;
			}
		}

		// Stop the workflow
		ui.displaySpinner('Stopping workflow and cleaning up resources...');

		await this.workflowManager!.stopTaskExecution(
			actualWorkflowId,
			options.force
		);

		ui.displaySuccess('Workflow stopped successfully!');
		console.log();
		console.log(`${chalk.green('✓')} Process terminated`);
		console.log(`${chalk.green('✓')} Worktree cleaned up`);
		console.log(`${chalk.green('✓')} State updated`);
	}

	private async stopAllWorkflows(options: WorkflowStopOptions): Promise<void> {
		const workflows = this.workflowManager!.listWorkflows();
		const activeWorkflows = workflows.filter((w) =>
			['pending', 'initializing', 'running', 'paused'].includes(w.status)
		);

		if (activeWorkflows.length === 0) {
			ui.displayWarning('No active workflows to stop');
			return;
		}

		console.log(
			chalk.blue.bold(`🛑 Stopping ${activeWorkflows.length} Active Workflows`)
		);
		console.log();

		// List workflows to be stopped
		activeWorkflows.forEach((workflow) => {
			console.log(
				`  • ${chalk.cyan(`workflow-${workflow.taskId}`)} - ${workflow.taskTitle} ${this.getStatusDisplay(workflow.status)}`
			);
		});
		console.log();

		// Confirm if not forced
		if (!options.force) {
			const shouldProceed = await ui.confirm(
				`Are you sure you want to stop all ${activeWorkflows.length} active workflows?`
			);

			if (!shouldProceed) {
				console.log(chalk.gray('Operation cancelled'));
				return;
			}
		}

		// Stop all workflows
		ui.displaySpinner('Stopping all workflows...');

		let stopped = 0;
		let failed = 0;

		for (const workflow of activeWorkflows) {
			try {
				const workflowId = `workflow-${workflow.taskId}`;
				await this.workflowManager!.stopTaskExecution(
					workflowId,
					options.force
				);
				stopped++;
			} catch (error) {
				console.error(
					`${chalk.red('✗')} Failed to stop workflow ${workflow.taskId}: ${error}`
				);
				failed++;
			}
		}

		console.log();
		if (stopped > 0) {
			ui.displaySuccess(`Successfully stopped ${stopped} workflows`);
		}

		if (failed > 0) {
			ui.displayWarning(`Failed to stop ${failed} workflows`);
		}
	}

	private getStatusDisplay(status: string): string {
		const statusMap = {
			pending: { icon: '⏳', color: chalk.yellow },
			initializing: { icon: '🔄', color: chalk.blue },
			running: { icon: '🚀', color: chalk.green },
			paused: { icon: '⏸️', color: chalk.hex('#FFA500') },
			completed: { icon: '✅', color: chalk.green },
			failed: { icon: '❌', color: chalk.red },
			cancelled: { icon: '🛑', color: chalk.gray },
			timeout: { icon: '⏰', color: chalk.red }
		};

		const statusInfo = statusMap[status as keyof typeof statusMap] || {
			icon: '❓',
			color: chalk.white
		};
		return `${statusInfo.icon} ${statusInfo.color(status)}`;
	}

	async cleanup(): Promise<void> {
		if (this.workflowManager) {
			this.workflowManager.removeAllListeners();
		}
	}

	static register(program: Command, name?: string): WorkflowStopCommand {
		const command = new WorkflowStopCommand(name);
		program.addCommand(command);
		return command;
	}
}
