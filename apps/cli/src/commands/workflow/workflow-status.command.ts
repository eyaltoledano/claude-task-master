/**
 * @fileoverview Workflow Status Command
 * Show detailed status of a specific workflow
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { 
  TaskExecutionManager,
  type TaskExecutionManagerConfig 
} from '@tm/workflow-engine';
import * as ui from '../../utils/ui.js';

export interface WorkflowStatusOptions {
  project?: string;
  worktreeBase?: string;
  claude?: string;
  watch?: boolean;
  format?: 'text' | 'json';
}

/**
 * WorkflowStatusCommand - Show workflow execution status
 */
export class WorkflowStatusCommand extends Command {
  private workflowManager?: TaskExecutionManager;

  constructor(name?: string) {
    super(name || 'status');

    this.description('Show detailed status of a workflow execution')
      .argument('<workflow-id>', 'Workflow ID or task ID to check')
      .option('-p, --project <path>', 'Project root directory', process.cwd())
      .option('--worktree-base <path>', 'Base directory for worktrees', '../task-worktrees')
      .option('--claude <path>', 'Claude Code executable path', 'claude')
      .option('-w, --watch', 'Watch for status changes (refresh every 2 seconds)')
      .option('-f, --format <format>', 'Output format (text, json)', 'text')
      .action(async (workflowId: string, options: WorkflowStatusOptions) => {
        await this.executeCommand(workflowId, options);
      });
  }

  private async executeCommand(workflowId: string, options: WorkflowStatusOptions): Promise<void> {
    try {
      // Initialize workflow manager
      await this.initializeWorkflowManager(options);

      if (options.watch) {
        await this.watchWorkflowStatus(workflowId, options);
      } else {
        await this.showWorkflowStatus(workflowId, options);
      }

    } catch (error: any) {
      ui.displayError(error.message || 'Failed to get workflow status');
      process.exit(1);
    }
  }

  private async initializeWorkflowManager(options: WorkflowStatusOptions): Promise<void> {
    if (!this.workflowManager) {
      const projectRoot = options.project || process.cwd();
      const worktreeBase = path.resolve(projectRoot, options.worktreeBase || '../task-worktrees');

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

  private async showWorkflowStatus(workflowId: string, options: WorkflowStatusOptions): Promise<void> {
    // Try to find workflow by ID or task ID
    let workflow = this.workflowManager!.getWorkflowStatus(workflowId);
    
    if (!workflow) {
      // Try as task ID
      workflow = this.workflowManager!.getWorkflowByTaskId(workflowId);
    }

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (options.format === 'json') {
      this.displayJsonStatus(workflow);
    } else {
      this.displayTextStatus(workflow);
    }
  }

  private async watchWorkflowStatus(workflowId: string, options: WorkflowStatusOptions): Promise<void> {
    console.log(chalk.blue.bold('👀 Watching workflow status (Press Ctrl+C to exit)\n'));

    let lastStatus = '';
    let updateCount = 0;

    const updateStatus = async () => {
      try {
        // Clear screen and move cursor to top
        if (updateCount > 0) {
          process.stdout.write('\x1b[2J\x1b[0f');
        }

        let workflow = this.workflowManager!.getWorkflowStatus(workflowId);
        
        if (!workflow) {
          workflow = this.workflowManager!.getWorkflowByTaskId(workflowId);
        }

        if (!workflow) {
          console.log(chalk.red(`Workflow not found: ${workflowId}`));
          return;
        }

        // Display header with timestamp
        console.log(chalk.blue.bold('👀 Watching Workflow Status'));
        console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}\n`));

        this.displayTextStatus(workflow);

        // Check if workflow has ended
        if (['completed', 'failed', 'cancelled', 'timeout'].includes(workflow.status)) {
          console.log(chalk.yellow('\n⚠️  Workflow has ended. Stopping watch mode.'));
          return;
        }

        updateCount++;

      } catch (error) {
        console.error(chalk.red('Error updating status:'), error);
      }
    };

    // Initial display
    await updateStatus();

    // Setup interval for updates
    const interval = setInterval(updateStatus, 2000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.yellow('\n👋 Stopped watching workflow status'));
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});
  }

  private displayJsonStatus(workflow: any): void {
    const status = {
      workflowId: `workflow-${workflow.taskId}`,
      taskId: workflow.taskId,
      taskTitle: workflow.taskTitle,
      taskDescription: workflow.taskDescription,
      status: workflow.status,
      worktreePath: workflow.worktreePath,
      branchName: workflow.branchName,
      processId: workflow.processId,
      startedAt: workflow.startedAt,
      lastActivity: workflow.lastActivity,
      duration: this.calculateDuration(workflow.startedAt, workflow.lastActivity),
      metadata: workflow.metadata
    };

    console.log(JSON.stringify(status, null, 2));
  }

  private displayTextStatus(workflow: any): void {
    const workflowId = `workflow-${workflow.taskId}`;
    const duration = this.formatDuration(workflow.startedAt, workflow.lastActivity);

    ui.displayBanner(`Workflow Status: ${workflowId}`);

    // Basic information
    console.log(chalk.blue.bold('\n📋 Basic Information:\n'));
    console.log(`  Workflow ID: ${chalk.cyan(workflowId)}`);
    console.log(`  Task ID: ${chalk.cyan(workflow.taskId)}`);
    console.log(`  Task Title: ${workflow.taskTitle}`);
    console.log(`  Status: ${this.getStatusDisplay(workflow.status)}`);
    console.log(`  Duration: ${chalk.gray(duration)}`);

    // Task details
    if (workflow.taskDescription) {
      console.log(chalk.blue.bold('\n📝 Task Details:\n'));
      console.log(`  ${workflow.taskDescription}`);
    }

    // Process information
    console.log(chalk.blue.bold('\n⚙️  Process Information:\n'));
    console.log(`  Process ID: ${workflow.processId ? chalk.green(workflow.processId) : chalk.gray('N/A')}`);
    console.log(`  Worktree: ${chalk.gray(workflow.worktreePath)}`);
    console.log(`  Branch: ${chalk.gray(workflow.branchName)}`);

    // Timing information
    console.log(chalk.blue.bold('\n⏰ Timing:\n'));
    console.log(`  Started: ${chalk.gray(workflow.startedAt.toLocaleString())}`);
    console.log(`  Last Activity: ${chalk.gray(workflow.lastActivity.toLocaleString())}`);

    // Metadata
    if (workflow.metadata && Object.keys(workflow.metadata).length > 0) {
      console.log(chalk.blue.bold('\n🔖 Metadata:\n'));
      Object.entries(workflow.metadata).forEach(([key, value]) => {
        console.log(`  ${key}: ${chalk.gray(String(value))}`);
      });
    }

    // Status-specific information
    this.displayStatusSpecificInfo(workflow);

    // Actions
    this.displayAvailableActions(workflow);
  }

  private displayStatusSpecificInfo(workflow: any): void {
    const workflowId = `workflow-${workflow.taskId}`;

    switch (workflow.status) {
      case 'running':
        console.log(chalk.blue.bold('\n🚀 Running Status:\n'));
        console.log(`  ${chalk.green('●')} Process is actively executing`);
        console.log(`  ${chalk.blue('ℹ')} Monitor output with: ${chalk.cyan(`tm workflow attach ${workflowId}`)}`);
        break;

      case 'paused':
        console.log(chalk.blue.bold('\n⏸️  Paused Status:\n'));
        console.log(`  ${chalk.yellow('●')} Workflow is paused`);
        console.log(`  ${chalk.blue('ℹ')} Resume with: ${chalk.cyan(`tm workflow resume ${workflowId}`)}`);
        break;

      case 'completed':
        console.log(chalk.blue.bold('\n✅ Completed Status:\n'));
        console.log(`  ${chalk.green('●')} Workflow completed successfully`);
        console.log(`  ${chalk.blue('ℹ')} Resources have been cleaned up`);
        break;

      case 'failed':
        console.log(chalk.blue.bold('\n❌ Failed Status:\n'));
        console.log(`  ${chalk.red('●')} Workflow execution failed`);
        console.log(`  ${chalk.blue('ℹ')} Check logs for error details`);
        break;

      case 'initializing':
        console.log(chalk.blue.bold('\n🔄 Initializing Status:\n'));
        console.log(`  ${chalk.blue('●')} Setting up worktree and process`);
        console.log(`  ${chalk.blue('ℹ')} This should complete shortly`);
        break;
    }
  }

  private displayAvailableActions(workflow: any): void {
    const workflowId = `workflow-${workflow.taskId}`;
    console.log(chalk.blue.bold('\n🎯 Available Actions:\n'));

    switch (workflow.status) {
      case 'running':
        console.log(`  • Attach: ${chalk.cyan(`tm workflow attach ${workflowId}`)}`);
        console.log(`  • Pause: ${chalk.cyan(`tm workflow pause ${workflowId}`)}`);
        console.log(`  • Stop: ${chalk.cyan(`tm workflow stop ${workflowId}`)}`);
        break;

      case 'paused':
        console.log(`  • Resume: ${chalk.cyan(`tm workflow resume ${workflowId}`)}`);
        console.log(`  • Stop: ${chalk.cyan(`tm workflow stop ${workflowId}`)}`);
        break;

      case 'pending':
      case 'initializing':
        console.log(`  • Stop: ${chalk.cyan(`tm workflow stop ${workflowId}`)}`);
        break;

      case 'completed':
      case 'failed':
      case 'cancelled':
        console.log(`  • View logs: ${chalk.cyan(`tm workflow logs ${workflowId}`)}`);
        console.log(`  • Start new: ${chalk.cyan(`tm workflow start ${workflow.taskId}`)}`);
        break;
    }

    console.log(`  • List all: ${chalk.cyan('tm workflow list')}`);
  }

  private getStatusDisplay(status: string): string {
    const statusMap = {
      pending: { icon: '⏳', color: chalk.yellow },
      initializing: { icon: '🔄', color: chalk.blue },
      running: { icon: '🚀', color: chalk.green },
      paused: { icon: '⏸️', color: chalk.orange },
      completed: { icon: '✅', color: chalk.green },
      failed: { icon: '❌', color: chalk.red },
      cancelled: { icon: '🛑', color: chalk.gray },
      timeout: { icon: '⏰', color: chalk.red }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { icon: '❓', color: chalk.white };
    return `${statusInfo.icon} ${statusInfo.color(status)}`;
  }

  private formatDuration(start: Date, end: Date): string {
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private calculateDuration(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }

  async cleanup(): Promise<void> {
    if (this.workflowManager) {
      this.workflowManager.removeAllListeners();
    }
  }

  static register(program: Command, name?: string): WorkflowStatusCommand {
    const command = new WorkflowStatusCommand(name);
    program.addCommand(command);
    return command;
  }
}