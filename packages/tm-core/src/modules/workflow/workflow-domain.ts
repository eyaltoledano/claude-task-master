/**
 * @fileoverview Workflow Domain Facade
 * Public API for TDD workflow operations
 */

import type { ConfigManager } from '../config/managers/config-manager.js';
import type { TasksDomain } from '../tasks/tasks-domain.js';
import {
	type TaskStatusUpdater,
	WorkflowService
} from './services/workflow.service.js';
import type {
	NextAction,
	StartWorkflowOptions,
	WorkflowStatus
} from './services/workflow.service.js';
import type { TestResult, WorkflowContext } from './types.js';

/**
 * Workflow Domain - Unified API for TDD workflow operations
 * Automatically handles task status updates through dependency injection
 */
export class WorkflowDomain {
	private workflowService: WorkflowService | null = null;
	private readonly projectRoot: string;
	private readonly configManager: ConfigManager;
	private tasksDomain: TasksDomain | null = null;

	constructor(configManager: ConfigManager) {
		this.configManager = configManager;
		this.projectRoot = configManager.getProjectRoot();
	}

	/**
	 * Set the TasksDomain for status updates
	 * Called by TmCore after TasksDomain is initialized
	 */
	setTasksDomain(tasksDomain: TasksDomain): void {
		this.tasksDomain = tasksDomain;
	}

	/**
	 * Create or get WorkflowService instance with proper DI
	 */
	private getWorkflowService(): WorkflowService {
		if (!this.workflowService) {
			const currentTag = this.configManager.getActiveTag();

			// Create task status updater if TasksDomain is available
			const taskStatusUpdater: TaskStatusUpdater | undefined = this.tasksDomain
				? {
						updateStatus: async (taskId, status, tag) => {
							await this.tasksDomain!.updateStatus(taskId, status, tag);
						}
					}
				: undefined;

			this.workflowService = new WorkflowService({
				projectRoot: this.projectRoot,
				taskStatusUpdater,
				tag: currentTag
			});
		}
		return this.workflowService;
	}

	/**
	 * Reset workflow service (for when workflow completes or aborts)
	 */
	private resetWorkflowService(): void {
		this.workflowService = null;
	}

	// ========== Workflow Lifecycle ==========

	/**
	 * Start a new TDD workflow for a task
	 */
	async start(options: StartWorkflowOptions): Promise<WorkflowStatus> {
		// Reset to get fresh service with current tag
		this.resetWorkflowService();
		return this.getWorkflowService().startWorkflow(options);
	}

	/**
	 * Resume an existing workflow
	 */
	async resume(): Promise<WorkflowStatus> {
		// Reset to get fresh service with current tag
		this.resetWorkflowService();
		return this.getWorkflowService().resumeWorkflow();
	}

	/**
	 * Get current workflow status
	 */
	getStatus(): WorkflowStatus {
		return this.getWorkflowService().getStatus();
	}

	/**
	 * Get workflow context
	 */
	getContext(): WorkflowContext {
		return this.getWorkflowService().getContext();
	}

	/**
	 * Get next action to perform in workflow
	 */
	getNextAction(): NextAction {
		return this.getWorkflowService().getNextAction();
	}

	/**
	 * Complete current phase with test results
	 */
	async completePhase(testResults: TestResult): Promise<WorkflowStatus> {
		return this.getWorkflowService().completePhase(testResults);
	}

	/**
	 * Commit changes with auto-generated message
	 */
	async commit(): Promise<WorkflowStatus> {
		return this.getWorkflowService().commit();
	}

	/**
	 * Finalize and complete the workflow
	 * Resets workflow service after completion
	 */
	async finalize(): Promise<WorkflowStatus> {
		const result = await this.getWorkflowService().finalizeWorkflow();
		this.resetWorkflowService();
		return result;
	}

	/**
	 * Abort the current workflow
	 * Resets workflow service after abort
	 */
	async abort(): Promise<void> {
		await this.getWorkflowService().abortWorkflow();
		this.resetWorkflowService();
	}

	// ========== Workflow Information ==========

	/**
	 * Check if a workflow currently exists
	 */
	async hasWorkflow(): Promise<boolean> {
		return this.getWorkflowService().hasWorkflow();
	}
}
