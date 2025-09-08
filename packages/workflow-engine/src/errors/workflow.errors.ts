/**
 * @fileoverview Workflow Engine Errors
 * Custom error classes for workflow operations
 */

export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public workflowId?: string,
    public taskId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class WorktreeError extends WorkflowError {
  constructor(message: string, public path?: string, cause?: Error) {
    super(message, 'WORKTREE_ERROR', undefined, undefined, cause);
    this.name = 'WorktreeError';
  }
}

export class ProcessError extends WorkflowError {
  constructor(message: string, public pid?: number, cause?: Error) {
    super(message, 'PROCESS_ERROR', undefined, undefined, cause);
    this.name = 'ProcessError';
  }
}

export class WorkflowTimeoutError extends WorkflowError {
  constructor(workflowId: string, timeoutMinutes: number) {
    super(
      `Workflow ${workflowId} timed out after ${timeoutMinutes} minutes`,
      'WORKFLOW_TIMEOUT',
      workflowId
    );
    this.name = 'WorkflowTimeoutError';
  }
}

export class WorkflowNotFoundError extends WorkflowError {
  constructor(workflowId: string) {
    super(`Workflow ${workflowId} not found`, 'WORKFLOW_NOT_FOUND', workflowId);
    this.name = 'WorkflowNotFoundError';
  }
}

export class MaxConcurrentWorkflowsError extends WorkflowError {
  constructor(maxConcurrent: number) {
    super(
      `Maximum concurrent workflows (${maxConcurrent}) reached`,
      'MAX_CONCURRENT_WORKFLOWS'
    );
    this.name = 'MaxConcurrentWorkflowsError';
  }
}