/**
 * @fileoverview Workflow Start Command
 * Start task execution in isolated worktree with Claude Code process
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  createTaskMasterCore,
  type TaskMasterCore
} from '@tm/core';
import { 
  TaskExecutionManager,
  type TaskExecutionManagerConfig 
} from '@tm/workflow-engine';
import * as ui from '../../utils/ui.js';

export interface WorkflowStartOptions {
  project?: string;
  branch?: string;
  timeout?: number;
  worktreeBase?: string;
  claude?: string;
  debug?: boolean;
  env?: string;
}

/**
 * WorkflowStartCommand - Start task execution workflow
 */
export class WorkflowStartCommand extends Command {
  private tmCore?: TaskMasterCore;
  private workflowManager?: TaskExecutionManager;

  constructor(name?: string) {
    super(name || 'start');

    this.description('Start task execution in isolated worktree')
      .argument('<task-id>', 'Task ID to execute')
      .option('-p, --project <path>', 'Project root directory', process.cwd())
      .option('-b, --branch <name>', 'Custom branch name for worktree')
      .option('-t, --timeout <minutes>', 'Execution timeout in minutes', '60')
      .option('--worktree-base <path>', 'Base directory for worktrees', '../task-worktrees')
      .option('--claude <path>', 'Claude Code executable path', 'claude')
      .option('--debug', 'Enable debug logging')
      .option('--env <vars>', 'Environment variables (KEY=VALUE,KEY2=VALUE2)')
      .action(async (taskId: string, options: WorkflowStartOptions) => {
        await this.executeCommand(taskId, options);
      });
  }

  private async executeCommand(taskId: string, options: WorkflowStartOptions): Promise<void> {
    try {
      // Initialize components
      await this.initializeCore(options.project || process.cwd());
      await this.initializeWorkflowManager(options);

      // Get task details
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Check if task already has active workflow
      const existingWorkflow = this.workflowManager!.getWorkflowByTaskId(taskId);
      if (existingWorkflow) {
        ui.displayWarning(`Task ${taskId} already has an active workflow`);
        console.log(`Workflow ID: ${chalk.cyan('workflow-' + taskId)}`);
        console.log(`Status: ${this.getStatusDisplay(existingWorkflow.status)}`);
        console.log(`Worktree: ${chalk.gray(existingWorkflow.worktreePath)}`);
        return;
      }

      // Parse environment variables
      const env = this.parseEnvironmentVariables(options.env);

      // Display task info
      ui.displayBanner(`Starting Workflow for Task ${taskId}`);
      console.log(`${chalk.blue('Task:')} ${task.title}`);
      console.log(`${chalk.blue('Description:')} ${task.description}`);
      
      if (task.dependencies?.length) {
        console.log(`${chalk.blue('Dependencies:')} ${task.dependencies.join(', ')}`);
      }

      console.log(`${chalk.blue('Priority:')} ${task.priority || 'normal'}`);
      console.log();

      // Start workflow
      ui.displaySpinner('Creating worktree and starting Claude Code process...');

      const workflowId = await this.workflowManager!.startTaskExecution(task, {
        branchName: options.branch,
        timeout: parseInt(options.timeout || '60'),
        env
      });

      const workflow = this.workflowManager!.getWorkflowStatus(workflowId);

      ui.displaySuccess('Workflow started successfully!');
      console.log();
      console.log(`${chalk.green('✓')} Workflow ID: ${chalk.cyan(workflowId)}`);
      console.log(`${chalk.green('✓')} Worktree: ${chalk.gray(workflow?.worktreePath)}`);
      console.log(`${chalk.green('✓')} Branch: ${chalk.gray(workflow?.branchName)}`);
      console.log(`${chalk.green('✓')} Process ID: ${chalk.gray(workflow?.processId)}`);
      console.log();

      // Display next steps
      console.log(chalk.blue.bold('📋 Next Steps:'));
      console.log(`  • Monitor: ${chalk.cyan(`tm workflow status ${workflowId}`)}`);
      console.log(`  • Attach: ${chalk.cyan(`tm workflow attach ${workflowId}`)}`);
      console.log(`  • Stop: ${chalk.cyan(`tm workflow stop ${workflowId}`)}`);
      console.log();

      // Setup event listeners for real-time updates
      this.setupEventListeners();

    } catch (error: any) {
      ui.displayError(error.message || 'Failed to start workflow');
      
      if (options.debug && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      
      process.exit(1);
    }
  }

  private async initializeCore(projectRoot: string): Promise<void> {
    if (!this.tmCore) {
      this.tmCore = await createTaskMasterCore({ projectPath: projectRoot });
    }
  }

  private async initializeWorkflowManager(options: WorkflowStartOptions): Promise<void> {
    if (!this.workflowManager) {
      const projectRoot = options.project || process.cwd();
      const worktreeBase = path.resolve(projectRoot, options.worktreeBase || '../task-worktrees');

      const config: TaskExecutionManagerConfig = {
        projectRoot,
        maxConcurrent: 5,
        defaultTimeout: parseInt(options.timeout || '60'),
        worktreeBase,
        claudeExecutable: options.claude || 'claude',
        debug: options.debug || false
      };

      this.workflowManager = new TaskExecutionManager(config);
      await this.workflowManager.initialize();
    }
  }

  private async getTask(taskId: string) {
    if (!this.tmCore) {
      throw new Error('TaskMasterCore not initialized');
    }

    const result = await this.tmCore.getTaskList({});
    return result.tasks.find(task => task.id === taskId);
  }

  private parseEnvironmentVariables(envString?: string): Record<string, string> | undefined {
    if (!envString) return undefined;

    const env: Record<string, string> = {};
    
    for (const pair of envString.split(',')) {
      const [key, ...valueParts] = pair.trim().split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }

    return Object.keys(env).length > 0 ? env : undefined;
  }

  private getStatusDisplay(status: string): string {
    const colors = {
      pending: chalk.yellow,
      initializing: chalk.blue,
      running: chalk.green,
      paused: chalk.orange,
      completed: chalk.green,
      failed: chalk.red,
      cancelled: chalk.gray,
      timeout: chalk.red
    };

    const color = colors[status as keyof typeof colors] || chalk.white;
    return color(status);
  }

  private setupEventListeners(): void {
    if (!this.workflowManager) return;

    this.workflowManager.on('workflow.started', (event) => {
      console.log(`${chalk.green('🚀')} Workflow started: ${event.workflowId}`);
    });

    this.workflowManager.on('process.output', (event) => {
      if (event.data?.stream === 'stdout') {
        console.log(`${chalk.blue('[OUT]')} ${event.data.data.trim()}`);
      } else if (event.data?.stream === 'stderr') {
        console.log(`${chalk.red('[ERR]')} ${event.data.data.trim()}`);
      }
    });

    this.workflowManager.on('workflow.completed', (event) => {
      console.log(`${chalk.green('✅')} Workflow completed: ${event.workflowId}`);
    });

    this.workflowManager.on('workflow.failed', (event) => {
      console.log(`${chalk.red('❌')} Workflow failed: ${event.workflowId}`);
      if (event.error) {
        console.log(`${chalk.red('Error:')} ${event.error.message}`);
      }
    });
  }

  async cleanup(): Promise<void> {
    if (this.workflowManager) {
      // Don't cleanup workflows, just disconnect
      this.workflowManager.removeAllListeners();
    }
    
    if (this.tmCore) {
      await this.tmCore.close();
      this.tmCore = undefined;
    }
  }

  static register(program: Command, name?: string): WorkflowStartCommand {
    const command = new WorkflowStartCommand(name);
    program.addCommand(command);
    return command;
  }
}