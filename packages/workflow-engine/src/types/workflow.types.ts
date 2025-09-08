/**
 * @fileoverview Workflow Engine Types
 * Core types for workflow execution system
 */

export interface WorkflowConfig {
  /** Maximum number of concurrent workflows */
  maxConcurrent: number;
  /** Default timeout for workflow execution (minutes) */
  defaultTimeout: number;
  /** Base directory for worktrees */
  worktreeBase: string;
  /** Claude Code executable path */
  claudeExecutable: string;
  /** Enable debug logging */
  debug: boolean;
}

export interface WorkflowExecutionContext {
  /** Task ID being executed */
  taskId: string;
  /** Task title for display */
  taskTitle: string;
  /** Full task description */
  taskDescription: string;
  /** Task implementation details */
  taskDetails?: string;
  /** Project root path */
  projectRoot: string;
  /** Worktree path */
  worktreePath: string;
  /** Branch name for this workflow */
  branchName: string;
  /** Process ID of running Claude Code */
  processId?: number;
  /** Workflow start time */
  startedAt: Date;
  /** Workflow status */
  status: WorkflowStatus;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Execution metadata */
  metadata?: Record<string, any>;
}

export type WorkflowStatus = 
  | 'pending'     // Created but not started
  | 'initializing' // Setting up worktree/process
  | 'running'     // Active execution
  | 'paused'      // Temporarily stopped
  | 'completed'   // Successfully finished
  | 'failed'      // Error occurred
  | 'cancelled'   // User cancelled
  | 'timeout';    // Exceeded time limit

export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowId: string;
  taskId: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

export type WorkflowEventType =
  | 'workflow.created'
  | 'workflow.started'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'worktree.created'
  | 'worktree.deleted'
  | 'process.started'
  | 'process.stopped'
  | 'process.output'
  | 'process.error';

export interface WorkflowProcess {
  /** Process ID */
  pid: number;
  /** Command that was executed */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Process start time */
  startedAt: Date;
  /** Process status */
  status: ProcessStatus;
}

export type ProcessStatus = 
  | 'starting'
  | 'running'
  | 'stopped'
  | 'crashed'
  | 'killed';

export interface WorktreeInfo {
  /** Worktree path */
  path: string;
  /** Branch name */
  branch: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Associated task ID */
  taskId: string;
  /** Git commit hash */
  commit?: string;
  /** Worktree lock status */
  locked: boolean;
  /** Lock reason if applicable */
  lockReason?: string;
}