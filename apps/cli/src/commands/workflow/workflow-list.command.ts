/**
 * @fileoverview Workflow List Command
 * List active and recent workflow executions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { 
  TaskExecutionManager,
  type TaskExecutionManagerConfig,
  type WorkflowExecutionContext 
} from '@tm/workflow-engine';
import * as ui from '../../utils/ui.js';

export interface WorkflowListOptions {
  project?: string;
  status?: string;
  format?: 'text' | 'json' | 'compact';
  worktreeBase?: string;
  claude?: string;
  all?: boolean;
}

/**
 * WorkflowListCommand - List workflow executions
 */
export class WorkflowListCommand extends Command {
  private workflowManager?: TaskExecutionManager;

  constructor(name?: string) {
    super(name || 'list');

    this.description('List active and recent workflow executions')
      .alias('ls')
      .option('-p, --project <path>', 'Project root directory', process.cwd())
      .option('-s, --status <status>', 'Filter by status (running, completed, failed, etc.)')
      .option('-f, --format <format>', 'Output format (text, json, compact)', 'text')
      .option('--worktree-base <path>', 'Base directory for worktrees', '../task-worktrees')
      .option('--claude <path>', 'Claude Code executable path', 'claude')
      .option('--all', 'Show all workflows including completed ones')
      .action(async (options: WorkflowListOptions) => {
        await this.executeCommand(options);
      });
  }

  private async executeCommand(options: WorkflowListOptions): Promise<void> {
    try {
      // Initialize workflow manager
      await this.initializeWorkflowManager(options);

      // Get workflows
      let workflows = this.workflowManager!.listWorkflows();

      // Apply status filter
      if (options.status) {
        workflows = workflows.filter(w => w.status === options.status);
      }

      // Apply active filter (default behavior)
      if (!options.all) {
        workflows = workflows.filter(w => 
          ['pending', 'initializing', 'running', 'paused'].includes(w.status)
        );
      }

      // Display results
      this.displayResults(workflows, options);

    } catch (error: any) {
      ui.displayError(error.message || 'Failed to list workflows');
      process.exit(1);
    }
  }

  private async initializeWorkflowManager(options: WorkflowListOptions): Promise<void> {
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

  private displayResults(workflows: WorkflowExecutionContext[], options: WorkflowListOptions): void {
    switch (options.format) {
      case 'json':
        this.displayJson(workflows);
        break;
      case 'compact':
        this.displayCompact(workflows);
        break;
      case 'text':
      default:
        this.displayText(workflows);
        break;
    }
  }

  private displayJson(workflows: WorkflowExecutionContext[]): void {
    console.log(JSON.stringify({
      workflows: workflows.map(w => ({
        workflowId: `workflow-${w.taskId}`,
        taskId: w.taskId,
        taskTitle: w.taskTitle,
        status: w.status,
        worktreePath: w.worktreePath,
        branchName: w.branchName,
        processId: w.processId,
        startedAt: w.startedAt,
        lastActivity: w.lastActivity,
        metadata: w.metadata
      })),
      total: workflows.length,
      timestamp: new Date().toISOString()
    }, null, 2));
  }

  private displayCompact(workflows: WorkflowExecutionContext[]): void {
    if (workflows.length === 0) {
      console.log(chalk.gray('No workflows found'));
      return;
    }

    workflows.forEach(workflow => {
      const workflowId = `workflow-${workflow.taskId}`;
      const statusDisplay = this.getStatusDisplay(workflow.status);
      const duration = this.formatDuration(workflow.startedAt, workflow.lastActivity);
      
      console.log(
        `${chalk.cyan(workflowId)} ${statusDisplay} ${workflow.taskTitle} ${chalk.gray(`(${duration})`)}`
      );
    });
  }

  private displayText(workflows: WorkflowExecutionContext[]): void {
    ui.displayBanner('Active Workflows');

    if (workflows.length === 0) {
      ui.displayWarning('No workflows found');
      console.log();
      console.log(chalk.blue('💡 Start a new workflow with:'));
      console.log(`   ${chalk.cyan('tm workflow start <task-id>')}`);
      return;
    }

    // Statistics
    console.log(chalk.blue.bold('\n📊 Statistics:\n'));
    const statusCounts = this.getStatusCounts(workflows);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${this.getStatusDisplay(status)}: ${chalk.cyan(count)}`);
    });

    // Workflows table
    console.log(chalk.blue.bold(`\n🔄 Workflows (${workflows.length}):\n`));
    
    const tableData = workflows.map(workflow => {
      const workflowId = `workflow-${workflow.taskId}`;
      const duration = this.formatDuration(workflow.startedAt, workflow.lastActivity);
      
      return [
        chalk.cyan(workflowId),
        chalk.yellow(workflow.taskId),
        workflow.taskTitle.substring(0, 30) + (workflow.taskTitle.length > 30 ? '...' : ''),
        this.getStatusDisplay(workflow.status),
        workflow.processId ? chalk.green(workflow.processId.toString()) : chalk.gray('N/A'),
        chalk.gray(duration),
        chalk.gray(path.basename(workflow.worktreePath))
      ];
    });

    console.log(ui.createTable(
      ['Workflow ID', 'Task ID', 'Task Title', 'Status', 'PID', 'Duration', 'Worktree'],
      tableData
    ));

    // Running workflows actions
    const runningWorkflows = workflows.filter(w => w.status === 'running');
    if (runningWorkflows.length > 0) {
      console.log(chalk.blue.bold('\n🚀 Quick Actions:\n'));
      runningWorkflows.slice(0, 3).forEach(workflow => {
        const workflowId = `workflow-${workflow.taskId}`;
        console.log(`  • Attach to ${chalk.cyan(workflowId)}: ${chalk.gray(`tm workflow attach ${workflowId}`)}`);
      });
      
      if (runningWorkflows.length > 3) {
        console.log(`  ${chalk.gray(`... and ${runningWorkflows.length - 3} more`)}`);
      }
    }
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

  private getStatusCounts(workflows: WorkflowExecutionContext[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    workflows.forEach(workflow => {
      counts[workflow.status] = (counts[workflow.status] || 0) + 1;
    });

    return counts;
  }

  private formatDuration(start: Date, end: Date): string {
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  }

  async cleanup(): Promise<void> {
    if (this.workflowManager) {
      this.workflowManager.removeAllListeners();
    }
  }

  static register(program: Command, name?: string): WorkflowListCommand {
    const command = new WorkflowListCommand(name);
    program.addCommand(command);
    return command;
  }
}