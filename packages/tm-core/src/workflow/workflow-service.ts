/**
 * @fileoverview Workflow Service
 * Integrates workflow engine into Task Master Core
 */

import {
	TaskExecutionManager,
	type TaskExecutionManagerConfig,
	type WorkflowExecutionContext
} from '@tm/workflow-engine';
import type { Task } from '../types/index.js';
import { TaskMasterError } from '../errors/index.js';

export interface WorkflowServiceConfig {
	/** Project root directory */
	projectRoot: string;
	/** Maximum number of concurrent workflows */
	maxConcurrent?: number;
	/** Default timeout for workflow execution (minutes) */
	defaultTimeout?: number;
	/** Base directory for worktrees */
	worktreeBase?: string;
	/** Claude Code executable path */
	claudeExecutable?: string;
	/** Enable debug logging */
	debug?: boolean;
}

/**
 * WorkflowService provides Task Master workflow capabilities through core
 */
export class WorkflowService {
	private workflowEngine: TaskExecutionManager;

	constructor(
		config: WorkflowServiceConfig,
		private getTask: (taskId: string) => Promise<Task>
	) {

		const engineConfig: TaskExecutionManagerConfig = {
			projectRoot: config.projectRoot,
			maxConcurrent: config.maxConcurrent || 5,
			defaultTimeout: config.defaultTimeout || 60,
			worktreeBase:
				config.worktreeBase ||
				require('path').join(config.projectRoot, '..', 'task-worktrees'),
			claudeExecutable: config.claudeExecutable || 'claude',
			debug: config.debug || false
		};

		this.workflowEngine = new TaskExecutionManager(engineConfig);
	}

	/**
	 * Initialize the workflow service
	 */
	async initialize(): Promise<void> {
		await this.workflowEngine.initialize();
	}

	/**
	 * Start a workflow for a task
	 */
	async start(
		taskId: string,
		options?: {
			branchName?: string;
			timeout?: number;
			env?: Record<string, string>;
		}
	): Promise<string> {
		try {
			// Get task from core
			const task = await this.getTask(taskId);
			
			// Start workflow using engine
			return await this.workflowEngine.startTaskExecution(task, options);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to start workflow for task ${taskId}`,
				'WORKFLOW_START_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Stop a workflow
	 */
	async stop(workflowId: string, force = false): Promise<void> {
		try {
			await this.workflowEngine.stopTaskExecution(workflowId, force);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to stop workflow ${workflowId}`,
				'WORKFLOW_STOP_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Pause a workflow
	 */
	async pause(workflowId: string): Promise<void> {
		try {
			await this.workflowEngine.pauseTaskExecution(workflowId);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to pause workflow ${workflowId}`,
				'WORKFLOW_PAUSE_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Resume a paused workflow
	 */
	async resume(workflowId: string): Promise<void> {
		try {
			await this.workflowEngine.resumeTaskExecution(workflowId);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to resume workflow ${workflowId}`,
				'WORKFLOW_RESUME_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Get workflow status
	 */
	getStatus(workflowId: string): WorkflowExecutionContext | undefined {
		return this.workflowEngine.getWorkflowStatus(workflowId);
	}

	/**
	 * Get workflow by task ID
	 */
	getByTaskId(taskId: string): WorkflowExecutionContext | undefined {
		return this.workflowEngine.getWorkflowByTaskId(taskId);
	}

	/**
	 * List all workflows
	 */
	list(): WorkflowExecutionContext[] {
		return this.workflowEngine.listWorkflows();
	}

	/**
	 * List active workflows
	 */
	listActive(): WorkflowExecutionContext[] {
		return this.workflowEngine.listActiveWorkflows();
	}

	/**
	 * Send input to a running workflow
	 */
	async sendInput(workflowId: string, input: string): Promise<void> {
		try {
			await this.workflowEngine.sendInputToWorkflow(workflowId, input);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to send input to workflow ${workflowId}`,
				'WORKFLOW_INPUT_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Clean up all workflows
	 */
	async cleanup(force = false): Promise<void> {
		try {
			await this.workflowEngine.cleanup(force);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to cleanup workflows',
				'WORKFLOW_CLEANUP_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Subscribe to workflow events
	 */
	on(event: string, listener: (...args: any[]) => void): void {
		this.workflowEngine.on(event, listener);
	}

	/**
	 * Unsubscribe from workflow events
	 */
	off(event: string, listener: (...args: any[]) => void): void {
		this.workflowEngine.off(event, listener);
	}

	/**
	 * Get workflow engine instance (for advanced usage)
	 */
	getEngine(): TaskExecutionManager {
		return this.workflowEngine;
	}

	/**
	 * Dispose of the workflow service
	 */
	async dispose(): Promise<void> {
		await this.cleanup(true);
		this.workflowEngine.removeAllListeners();
	}
}