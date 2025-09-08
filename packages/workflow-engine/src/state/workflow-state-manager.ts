/**
 * @fileoverview Workflow State Manager
 * Extends tm-core RuntimeStateManager with workflow tracking capabilities
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { 
  WorkflowExecutionContext,
  WorkflowStatus,
  WorkflowEvent 
} from '../types/workflow.types.js';
import { WorkflowError } from '../errors/workflow.errors.js';

export interface WorkflowStateConfig {
  /** Project root directory */
  projectRoot: string;
  /** Custom state directory (defaults to .taskmaster) */
  stateDir?: string;
}

export interface WorkflowRegistryEntry {
  /** Workflow ID */
  workflowId: string;
  /** Task ID being executed */
  taskId: string;
  /** Workflow status */
  status: WorkflowStatus;
  /** Worktree path */
  worktreePath: string;
  /** Process ID if running */
  processId?: number;
  /** Start timestamp */
  startedAt: string;
  /** Last activity timestamp */
  lastActivity: string;
  /** Branch name */
  branchName: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * WorkflowStateManager manages workflow execution state
 * Extends the concept of RuntimeStateManager to track active workflows globally
 */
export class WorkflowStateManager {
  private config: WorkflowStateConfig;
  private stateFilePath: string;
  private activeWorkflows = new Map<string, WorkflowExecutionContext>();

  constructor(config: WorkflowStateConfig) {
    this.config = config;
    const stateDir = config.stateDir || '.taskmaster';
    this.stateFilePath = path.join(config.projectRoot, stateDir, 'workflows.json');
  }

  /**
   * Load workflow state from disk
   */
  async loadState(): Promise<void> {
    try {
      const stateData = await fs.readFile(this.stateFilePath, 'utf-8');
      const registry = JSON.parse(stateData) as Record<string, WorkflowRegistryEntry>;

      // Convert registry entries to WorkflowExecutionContext
      for (const [workflowId, entry] of Object.entries(registry)) {
        const context: WorkflowExecutionContext = {
          taskId: entry.taskId,
          taskTitle: `Task ${entry.taskId}`, // Will be updated when task details are loaded
          taskDescription: '',
          projectRoot: this.config.projectRoot,
          worktreePath: entry.worktreePath,
          branchName: entry.branchName,
          processId: entry.processId,
          startedAt: new Date(entry.startedAt),
          status: entry.status,
          lastActivity: new Date(entry.lastActivity),
          metadata: entry.metadata
        };

        this.activeWorkflows.set(workflowId, context);
      }

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Workflows file doesn't exist, start with empty state
        console.debug('No workflows.json found, starting with empty state');
        return;
      }

      console.warn('Failed to load workflow state:', error.message);
    }
  }

  /**
   * Save workflow state to disk
   */
  async saveState(): Promise<void> {
    const stateDir = path.dirname(this.stateFilePath);

    try {
      await fs.mkdir(stateDir, { recursive: true });

      // Convert contexts to registry entries
      const registry: Record<string, WorkflowRegistryEntry> = {};
      
      for (const [workflowId, context] of this.activeWorkflows.entries()) {
        registry[workflowId] = {
          workflowId,
          taskId: context.taskId,
          status: context.status,
          worktreePath: context.worktreePath,
          processId: context.processId,
          startedAt: context.startedAt.toISOString(),
          lastActivity: context.lastActivity.toISOString(),
          branchName: context.branchName,
          metadata: context.metadata
        };
      }

      await fs.writeFile(
        this.stateFilePath,
        JSON.stringify(registry, null, 2),
        'utf-8'
      );

    } catch (error) {
      throw new WorkflowError(
        'Failed to save workflow state',
        'WORKFLOW_STATE_SAVE_ERROR',
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Register a new workflow
   */
  async registerWorkflow(context: WorkflowExecutionContext): Promise<string> {
    const workflowId = this.generateWorkflowId(context.taskId);
    
    this.activeWorkflows.set(workflowId, {
      ...context,
      lastActivity: new Date()
    });

    await this.saveState();
    return workflowId;
  }

  /**
   * Update workflow context
   */
  async updateWorkflow(
    workflowId: string, 
    updates: Partial<WorkflowExecutionContext>
  ): Promise<void> {
    const existing = this.activeWorkflows.get(workflowId);
    if (!existing) {
      throw new WorkflowError(
        `Workflow ${workflowId} not found`,
        'WORKFLOW_NOT_FOUND',
        workflowId
      );
    }

    const updated = {
      ...existing,
      ...updates,
      lastActivity: new Date()
    };

    this.activeWorkflows.set(workflowId, updated);
    await this.saveState();
  }

  /**
   * Update workflow status
   */
  async updateWorkflowStatus(workflowId: string, status: WorkflowStatus): Promise<void> {
    await this.updateWorkflow(workflowId, { status });
  }

  /**
   * Unregister a workflow (remove from state)
   */
  async unregisterWorkflow(workflowId: string): Promise<void> {
    if (!this.activeWorkflows.has(workflowId)) {
      throw new WorkflowError(
        `Workflow ${workflowId} not found`,
        'WORKFLOW_NOT_FOUND',
        workflowId
      );
    }

    this.activeWorkflows.delete(workflowId);
    await this.saveState();
  }

  /**
   * Get workflow context by ID
   */
  getWorkflow(workflowId: string): WorkflowExecutionContext | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get workflow by task ID
   */
  getWorkflowByTaskId(taskId: string): WorkflowExecutionContext | undefined {
    for (const context of this.activeWorkflows.values()) {
      if (context.taskId === taskId) {
        return context;
      }
    }
    return undefined;
  }

  /**
   * List all active workflows
   */
  listWorkflows(): WorkflowExecutionContext[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * List workflows by status
   */
  listWorkflowsByStatus(status: WorkflowStatus): WorkflowExecutionContext[] {
    return this.listWorkflows().filter(w => w.status === status);
  }

  /**
   * Get running workflows count
   */
  getRunningCount(): number {
    return this.listWorkflowsByStatus('running').length;
  }

  /**
   * Check if a task has an active workflow
   */
  hasActiveWorkflow(taskId: string): boolean {
    return this.getWorkflowByTaskId(taskId) !== undefined;
  }

  /**
   * Clean up completed/failed workflows older than specified time
   */
  async cleanupOldWorkflows(olderThanHours = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    let cleaned = 0;

    for (const [workflowId, context] of this.activeWorkflows.entries()) {
      const isOld = context.lastActivity < cutoffTime;
      const isFinished = ['completed', 'failed', 'cancelled', 'timeout'].includes(context.status);
      
      if (isOld && isFinished) {
        this.activeWorkflows.delete(workflowId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.saveState();
    }

    return cleaned;
  }

  /**
   * Clear all workflow state
   */
  async clearState(): Promise<void> {
    try {
      await fs.unlink(this.stateFilePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    this.activeWorkflows.clear();
  }

  /**
   * Record workflow event (for audit trail)
   */
  async recordEvent(event: WorkflowEvent): Promise<void> {
    // Update workflow last activity
    const workflow = this.activeWorkflows.get(event.workflowId);
    if (workflow) {
      workflow.lastActivity = event.timestamp;
      await this.saveState();
    }

    // Optional: Could extend to maintain event log file
    if (process.env.TASKMASTER_DEBUG) {
      console.log('Workflow Event:', {
        type: event.type,
        workflowId: event.workflowId,
        taskId: event.taskId,
        timestamp: event.timestamp.toISOString(),
        data: event.data
      });
    }
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(taskId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `workflow-${taskId}-${timestamp}-${random}`;
  }
}