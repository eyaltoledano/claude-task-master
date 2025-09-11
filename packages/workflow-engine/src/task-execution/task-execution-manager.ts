/**
 * @fileoverview Task Execution Manager
 * Orchestrates the complete task execution workflow using worktrees and processes
 */

import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { Task } from '@tm/core';
import {
	WorktreeManager,
	type WorktreeManagerConfig
} from '../worktree/worktree-manager.js';
import {
	ProcessSandbox,
	type ProcessSandboxConfig
} from '../process/process-sandbox.js';
import {
	WorkflowStateManager,
	type WorkflowStateConfig
} from '../state/workflow-state-manager.js';
import type {
	WorkflowConfig,
	WorkflowExecutionContext,
	WorkflowStatus,
	WorkflowEvent
} from '../types/workflow.types.js';
import {
	WorkflowError,
	WorkflowNotFoundError,
	MaxConcurrentWorkflowsError,
	WorkflowTimeoutError
} from '../errors/workflow.errors.js';

export interface TaskExecutionManagerConfig extends WorkflowConfig {
	/** Project root directory */
	projectRoot: string;
}

/**
 * TaskExecutionManager orchestrates the complete task execution workflow
 * Coordinates worktree creation, process spawning, and state management
 */
export class TaskExecutionManager extends EventEmitter {
	private config: TaskExecutionManagerConfig;
	private worktreeManager: WorktreeManager;
	private processSandbox: ProcessSandbox;
	private stateManager: WorkflowStateManager;
	private initialized = false;

	constructor(config: TaskExecutionManagerConfig) {
		super();
		this.config = config;

		// Initialize component managers
		const worktreeConfig: WorktreeManagerConfig = {
			worktreeBase: config.worktreeBase,
			projectRoot: config.projectRoot,
			autoCleanup: true
		};

		const processConfig: ProcessSandboxConfig = {
			claudeExecutable: config.claudeExecutable,
			defaultTimeout: config.defaultTimeout,
			debug: config.debug
		};

		const stateConfig: WorkflowStateConfig = {
			projectRoot: config.projectRoot
		};

		this.worktreeManager = new WorktreeManager(worktreeConfig);
		this.processSandbox = new ProcessSandbox(processConfig);
		this.stateManager = new WorkflowStateManager(stateConfig);

		// Forward events from components
		this.processSandbox.on('event', (event: WorkflowEvent) => {
			this.stateManager.recordEvent(event);
			this.emit('event', event);
		});
	}

	/**
	 * Initialize the task execution manager
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		await this.stateManager.loadState();

		// Clean up any stale workflows
		await this.cleanupStaleWorkflows();

		this.initialized = true;
	}

	/**
	 * Start task execution workflow
	 */
	async startTaskExecution(
		task: Task,
		options?: {
			branchName?: string;
			timeout?: number;
			env?: Record<string, string>;
		}
	): Promise<string> {
		if (!this.initialized) {
			await this.initialize();
		}

		// Check concurrent workflow limit
		const runningCount = this.stateManager.getRunningCount();
		if (runningCount >= this.config.maxConcurrent) {
			throw new MaxConcurrentWorkflowsError(this.config.maxConcurrent);
		}

		// Check if task already has an active workflow
		if (this.stateManager.hasActiveWorkflow(task.id)) {
			throw new WorkflowError(
				`Task ${task.id} already has an active workflow`,
				'TASK_ALREADY_EXECUTING',
				undefined,
				task.id
			);
		}

		try {
			// Create worktree
			const worktreeInfo = await this.worktreeManager.createWorktree(
				task.id,
				options?.branchName
			);

			// Prepare task context
			const context: WorkflowExecutionContext = {
				taskId: task.id,
				taskTitle: task.title,
				taskDescription: task.description,
				taskDetails: task.details,
				projectRoot: this.config.projectRoot,
				worktreePath: worktreeInfo.path,
				branchName: worktreeInfo.branch,
				startedAt: new Date(),
				status: 'initializing',
				lastActivity: new Date(),
				metadata: {
					priority: task.priority,
					dependencies: task.dependencies
				}
			};

			// Register workflow
			const workflowId = await this.stateManager.registerWorkflow(context);

			try {
				// Prepare task prompt for Claude Code
				const taskPrompt = this.generateTaskPrompt(task);

				// Start Claude Code process
				const process = await this.processSandbox.startProcess(
					workflowId,
					task.id,
					taskPrompt,
					{
						cwd: worktreeInfo.path,
						timeout: options?.timeout,
						env: options?.env
					}
				);

				// Update workflow with process information
				await this.stateManager.updateWorkflow(workflowId, {
					processId: process.pid,
					status: 'running'
				});

				// Emit workflow started event
				this.emitEvent('workflow.started', workflowId, task.id, {
					worktreePath: worktreeInfo.path,
					processId: process.pid
				});

				return workflowId;
			} catch (error) {
				// Clean up worktree if process failed to start
				await this.worktreeManager.removeWorktree(task.id, true);
				await this.stateManager.unregisterWorkflow(workflowId);
				throw error;
			}
		} catch (error) {
			throw new WorkflowError(
				`Failed to start task execution for ${task.id}`,
				'TASK_EXECUTION_START_ERROR',
				undefined,
				task.id,
				error as Error
			);
		}
	}

	/**
	 * Stop task execution workflow
	 */
	async stopTaskExecution(workflowId: string, force = false): Promise<void> {
		const workflow = this.stateManager.getWorkflow(workflowId);
		if (!workflow) {
			throw new WorkflowNotFoundError(workflowId);
		}

		try {
			// Stop the process if running
			if (this.processSandbox.isProcessRunning(workflowId)) {
				await this.processSandbox.stopProcess(workflowId, force);
			}

			// Update workflow status
			const status: WorkflowStatus = force ? 'cancelled' : 'completed';
			await this.stateManager.updateWorkflowStatus(workflowId, status);

			// Clean up worktree
			await this.worktreeManager.removeWorktree(workflow.taskId, force);

			// Emit workflow stopped event
			this.emitEvent('workflow.completed', workflowId, workflow.taskId, {
				status,
				forced: force
			});

			// Unregister workflow
			await this.stateManager.unregisterWorkflow(workflowId);
		} catch (error) {
			throw new WorkflowError(
				`Failed to stop workflow ${workflowId}`,
				'WORKFLOW_STOP_ERROR',
				workflowId,
				workflow.taskId,
				error as Error
			);
		}
	}

	/**
	 * Pause task execution
	 */
	async pauseTaskExecution(workflowId: string): Promise<void> {
		const workflow = this.stateManager.getWorkflow(workflowId);
		if (!workflow) {
			throw new WorkflowNotFoundError(workflowId);
		}

		if (workflow.status !== 'running') {
			throw new WorkflowError(
				`Cannot pause workflow ${workflowId} - not currently running`,
				'WORKFLOW_NOT_RUNNING',
				workflowId,
				workflow.taskId
			);
		}

		// For now, we'll just mark as paused - in the future could implement
		// process suspension or other pause mechanisms
		await this.stateManager.updateWorkflowStatus(workflowId, 'paused');

		this.emitEvent('workflow.paused', workflowId, workflow.taskId);
	}

	/**
	 * Resume paused task execution
	 */
	async resumeTaskExecution(workflowId: string): Promise<void> {
		const workflow = this.stateManager.getWorkflow(workflowId);
		if (!workflow) {
			throw new WorkflowNotFoundError(workflowId);
		}

		if (workflow.status !== 'paused') {
			throw new WorkflowError(
				`Cannot resume workflow ${workflowId} - not currently paused`,
				'WORKFLOW_NOT_PAUSED',
				workflowId,
				workflow.taskId
			);
		}

		await this.stateManager.updateWorkflowStatus(workflowId, 'running');

		this.emitEvent('workflow.resumed', workflowId, workflow.taskId);
	}

	/**
	 * Get workflow status
	 */
	getWorkflowStatus(workflowId: string): WorkflowExecutionContext | undefined {
		return this.stateManager.getWorkflow(workflowId);
	}

	/**
	 * Get workflow by task ID
	 */
	getWorkflowByTaskId(taskId: string): WorkflowExecutionContext | undefined {
		return this.stateManager.getWorkflowByTaskId(taskId);
	}

	/**
	 * List all workflows
	 */
	listWorkflows(): WorkflowExecutionContext[] {
		return this.stateManager.listWorkflows();
	}

	/**
	 * List active workflows
	 */
	listActiveWorkflows(): WorkflowExecutionContext[] {
		return this.stateManager.listWorkflowsByStatus('running');
	}

	/**
	 * Send input to a running workflow
	 */
	async sendInputToWorkflow(workflowId: string, input: string): Promise<void> {
		const workflow = this.stateManager.getWorkflow(workflowId);
		if (!workflow) {
			throw new WorkflowNotFoundError(workflowId);
		}

		if (!this.processSandbox.isProcessRunning(workflowId)) {
			throw new WorkflowError(
				`Cannot send input to workflow ${workflowId} - process not running`,
				'PROCESS_NOT_RUNNING',
				workflowId,
				workflow.taskId
			);
		}

		await this.processSandbox.sendInput(workflowId, input);
	}

	/**
	 * Clean up all workflows
	 */
	async cleanup(force = false): Promise<void> {
		// Stop all processes
		await this.processSandbox.cleanupAll(force);

		// Clean up all worktrees
		await this.worktreeManager.cleanupAll(force);

		// Clear workflow state
		await this.stateManager.clearState();
	}

	/**
	 * Generate task prompt for Claude Code
	 */
	private generateTaskPrompt(task: Task): string {
		const prompt = [
			`Work on Task ${task.id}: ${task.title}`,
			'',
			`Description: ${task.description}`
		];

		if (task.details) {
			prompt.push('', `Details: ${task.details}`);
		}

		if (task.testStrategy) {
			prompt.push('', `Test Strategy: ${task.testStrategy}`);
		}

		if (task.dependencies?.length) {
			prompt.push('', `Dependencies: ${task.dependencies.join(', ')}`);
		}

		prompt.push(
			'',
			'Please implement this task following the project conventions and best practices.',
			'When complete, update the task status appropriately using the available Task Master commands.'
		);

		return prompt.join('\n');
	}

	/**
	 * Clean up stale workflows from previous sessions
	 */
	private async cleanupStaleWorkflows(): Promise<void> {
		const workflows = this.stateManager.listWorkflows();

		for (const workflow of workflows) {
			const isStale =
				workflow.status === 'running' &&
				!this.processSandbox.isProcessRunning(`workflow-${workflow.taskId}`);

			if (isStale) {
				console.log(`Cleaning up stale workflow for task ${workflow.taskId}`);

				try {
					await this.stateManager.updateWorkflowStatus(
						`workflow-${workflow.taskId}`,
						'failed'
					);

					// Try to clean up worktree
					await this.worktreeManager.removeWorktree(workflow.taskId, true);
				} catch (error) {
					console.error(`Failed to cleanup stale workflow:`, error);
				}
			}
		}
	}

	/**
	 * Emit workflow event
	 */
	private emitEvent(
		type: string,
		workflowId: string,
		taskId: string,
		data?: any
	): void {
		const event: WorkflowEvent = {
			type: type as any,
			workflowId,
			taskId,
			timestamp: new Date(),
			data
		};

		this.emit('event', event);
		this.emit(type, event);
	}
}
