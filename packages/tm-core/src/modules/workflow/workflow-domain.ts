/**
 * @fileoverview Workflow Domain Facade
 * Public API for TDD workflow operations
 */

import type { ConfigManager } from '../config/managers/config-manager.js';
import { WorkflowService } from './services/workflow.service.js';
import type {
	StartWorkflowOptions,
	WorkflowStatus,
	NextAction
} from './services/workflow.service.js';
import type { TestResult, WorkflowContext } from './types.js';

/**
 * Workflow Domain - Unified API for TDD workflow operations
 */
export class WorkflowDomain {
	private workflowService: WorkflowService;

	constructor(configManager: ConfigManager) {
		this.workflowService = new WorkflowService(configManager.getProjectRoot());
	}

	// ========== Workflow Lifecycle ==========

	/**
	 * Start a new TDD workflow for a task
	 */
	async start(options: StartWorkflowOptions): Promise<WorkflowStatus> {
		return this.workflowService.startWorkflow(options);
	}

	/**
	 * Resume an existing workflow
	 */
	async resume(): Promise<WorkflowStatus> {
		return this.workflowService.resumeWorkflow();
	}

	/**
	 * Get current workflow status
	 */
	getStatus(): WorkflowStatus {
		return this.workflowService.getStatus();
	}

	/**
	 * Get workflow context
	 */
	getContext(): WorkflowContext {
		return this.workflowService.getContext();
	}

	/**
	 * Get next action to perform in workflow
	 */
	getNextAction(): NextAction {
		return this.workflowService.getNextAction();
	}

	/**
	 * Complete current phase with test results
	 */
	async completePhase(testResults: TestResult): Promise<WorkflowStatus> {
		return this.workflowService.completePhase(testResults);
	}

	/**
	 * Commit changes with auto-generated message
	 */
	async commit(): Promise<WorkflowStatus> {
		return this.workflowService.commit();
	}

	/**
	 * Finalize and complete the workflow
	 */
	async finalize(): Promise<WorkflowStatus> {
		return this.workflowService.finalizeWorkflow();
	}

	/**
	 * Abort the current workflow
	 */
	async abort(): Promise<void> {
		return this.workflowService.abortWorkflow();
	}

	// ========== Workflow Information ==========

	/**
	 * Check if a workflow currently exists
	 */
	async hasWorkflow(): Promise<boolean> {
		return this.workflowService.hasWorkflow();
	}
}
