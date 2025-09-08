/**
 * @fileoverview Workflow Command
 * Main workflow command with subcommands
 */

import { Command } from 'commander';
import { 
  WorkflowStartCommand,
  WorkflowListCommand, 
  WorkflowStopCommand,
  WorkflowStatusCommand 
} from './workflow/index.js';

/**
 * WorkflowCommand - Main workflow command with subcommands
 */
export class WorkflowCommand extends Command {
  constructor(name?: string) {
    super(name || 'workflow');

    this.description('Manage task execution workflows with git worktrees and Claude Code')
      .alias('wf');

    // Register subcommands
    this.addSubcommands();
  }

  private addSubcommands(): void {
    // Start workflow
    WorkflowStartCommand.register(this);

    // List workflows  
    WorkflowListCommand.register(this);

    // Stop workflow
    WorkflowStopCommand.register(this);

    // Show workflow status
    WorkflowStatusCommand.register(this);

    // Alias commands for convenience
    this.addCommand(new WorkflowStartCommand('run'));  // tm workflow run <task-id>
    this.addCommand(new WorkflowStopCommand('kill'));   // tm workflow kill <workflow-id>
    this.addCommand(new WorkflowStatusCommand('info')); // tm workflow info <workflow-id>
  }

  /**
   * Static method to register this command on an existing program
   */
  static register(program: Command, name?: string): WorkflowCommand {
    const workflowCommand = new WorkflowCommand(name);
    program.addCommand(workflowCommand);
    return workflowCommand;
  }

}

export default WorkflowCommand;