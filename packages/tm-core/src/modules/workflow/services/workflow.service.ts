/**
 * @fileoverview WorkflowService - High-level facade for TDD workflow operations
 * Provides a simplified API for MCP tools while delegating to WorkflowOrchestrator
 */

import { WorkflowOrchestrator } from '../orchestrators/workflow-orchestrator.js';
import { WorkflowStateManager } from '../managers/workflow-state-manager.js';
import { WorkflowActivityLogger } from './workflow-activity-logger.js';
import type {
	WorkflowContext,
	SubtaskInfo,
	TestResult,
	WorkflowPhase,
	TDDPhase,
	WorkflowState
} from '../types.js';
import { GitAdapter } from '../../git/adapters/git-adapter.js';

/**
 * Options for starting a new workflow
 */
export interface StartWorkflowOptions {
	taskId: string;
	taskTitle: string;
	subtasks: Array<{
		id: string;
		title: string;
		status: string;
		maxAttempts?: number;
	}>;
	maxAttempts?: number;
	force?: boolean;
	tag?: string; // Optional tag for branch naming
}

/**
 * Simplified workflow status for MCP responses
 */
export interface WorkflowStatus {
	taskId: string;
	phase: WorkflowPhase;
	tddPhase?: TDDPhase;
	branchName?: string;
	currentSubtask?: {
		id: string;
		title: string;
		attempts: number;
		maxAttempts: number;
	};
	progress: {
		completed: number;
		total: number;
		current: number;
		percentage: number;
	};
}

/**
 * Next action recommendation for AI agent
 */
export interface NextAction {
	action: string;
	description: string;
	nextSteps: string;
	phase: WorkflowPhase;
	tddPhase?: TDDPhase;
	subtask?: {
		id: string;
		title: string;
	};
}

/**
 * WorkflowService - Facade for workflow operations
 * Manages WorkflowOrchestrator lifecycle and state persistence
 */
export class WorkflowService {
	private readonly projectRoot: string;
	private readonly stateManager: WorkflowStateManager;
	private orchestrator?: WorkflowOrchestrator;
	private activityLogger?: WorkflowActivityLogger;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
		this.stateManager = new WorkflowStateManager(projectRoot);
	}

	/**
	 * Check if workflow state exists
	 */
	async hasWorkflow(): Promise<boolean> {
		return await this.stateManager.exists();
	}

	/**
	 * Start a new TDD workflow
	 */
	async startWorkflow(options: StartWorkflowOptions): Promise<WorkflowStatus> {
		const {
			taskId,
			taskTitle,
			subtasks,
			maxAttempts = 3,
			force,
			tag
		} = options;

		// Check for existing workflow
		if ((await this.hasWorkflow()) && !force) {
			throw new Error(
				'Workflow already exists. Use force=true to override or resume existing workflow.'
			);
		}

		// Initialize git adapter and ensure clean state
		const gitAdapter = new GitAdapter(this.projectRoot);
		await gitAdapter.ensureGitRepository();
		await gitAdapter.ensureCleanWorkingTree();

		// Parse subtasks to WorkflowContext format
		const workflowSubtasks: SubtaskInfo[] = subtasks.map((st) => ({
			id: st.id,
			title: st.title,
			status: st.status === 'done' ? 'completed' : 'pending',
			attempts: 0,
			maxAttempts: st.maxAttempts || maxAttempts
		}));

		// Find the first incomplete subtask to resume from
		const firstIncompleteIndex = workflowSubtasks.findIndex(
			(st) => st.status !== 'completed'
		);

		// If all subtasks are already completed, throw an error
		if (firstIncompleteIndex === -1) {
			throw new Error(
				`All subtasks for task ${taskId} are already completed. Nothing to do.`
			);
		}

		// Create workflow context, starting from first incomplete subtask
		const context: WorkflowContext = {
			taskId,
			subtasks: workflowSubtasks,
			currentSubtaskIndex: firstIncompleteIndex,
			errors: [],
			metadata: {
				startedAt: new Date().toISOString(),
				taskTitle,
				resumedFromSubtask:
					firstIncompleteIndex > 0
						? workflowSubtasks[firstIncompleteIndex].id
						: undefined
			}
		};

		// Create orchestrator with auto-persistence
		this.orchestrator = new WorkflowOrchestrator(context);
		this.orchestrator.enableAutoPersist(async (state: WorkflowState) => {
			await this.stateManager.save(state);
		});

		// Initialize activity logger to track all workflow events
		this.activityLogger = new WorkflowActivityLogger(
			this.orchestrator,
			this.stateManager.getActivityLogPath()
		);
		this.activityLogger.start();

		// Transition through PREFLIGHT and BRANCH_SETUP phases
		await this.orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

		// Create git branch with descriptive name
		const branchName = this.generateBranchName(taskId, taskTitle, tag);

		// Check if we're already on the target branch
		const currentBranch = await gitAdapter.getCurrentBranch();
		if (currentBranch !== branchName) {
			// Only create branch if we're not already on it
			await gitAdapter.createAndCheckoutBranch(branchName);
		}

		// Transition to SUBTASK_LOOP with RED phase
		await this.orchestrator.transition({
			type: 'BRANCH_CREATED',
			branchName
		});

		return this.getStatus();
	}

	/**
	 * Resume an existing workflow
	 */
	async resumeWorkflow(): Promise<WorkflowStatus> {
		// Load state
		const state = await this.stateManager.load();

		// Create new orchestrator with loaded context
		this.orchestrator = new WorkflowOrchestrator(state.context);

		// Validate and restore state
		if (!this.orchestrator.canResumeFromState(state)) {
			throw new Error(
				'Invalid workflow state. State may be corrupted. Consider starting a new workflow.'
			);
		}

		this.orchestrator.restoreState(state);

		// Re-enable auto-persistence
		this.orchestrator.enableAutoPersist(async (newState: WorkflowState) => {
			await this.stateManager.save(newState);
		});

		// Initialize activity logger to continue tracking events
		this.activityLogger = new WorkflowActivityLogger(
			this.orchestrator,
			this.stateManager.getActivityLogPath()
		);
		this.activityLogger.start();

		return this.getStatus();
	}

	/**
	 * Get current workflow status
	 */
	getStatus(): WorkflowStatus {
		if (!this.orchestrator) {
			throw new Error('No active workflow. Start or resume a workflow first.');
		}

		const context = this.orchestrator.getContext();
		const progress = this.orchestrator.getProgress();
		const currentSubtask = this.orchestrator.getCurrentSubtask();

		return {
			taskId: context.taskId,
			phase: this.orchestrator.getCurrentPhase(),
			tddPhase: this.orchestrator.getCurrentTDDPhase(),
			branchName: context.branchName,
			currentSubtask: currentSubtask
				? {
						id: currentSubtask.id,
						title: currentSubtask.title,
						attempts: currentSubtask.attempts,
						maxAttempts: currentSubtask.maxAttempts || 3
					}
				: undefined,
			progress
		};
	}

	/**
	 * Get workflow context (for accessing full state details)
	 */
	getContext(): WorkflowContext {
		if (!this.orchestrator) {
			throw new Error('No active workflow. Start or resume a workflow first.');
		}

		return this.orchestrator.getContext();
	}

	/**
	 * Get next recommended action for AI agent
	 */
	getNextAction(): NextAction {
		if (!this.orchestrator) {
			throw new Error('No active workflow. Start or resume a workflow first.');
		}

		const phase = this.orchestrator.getCurrentPhase();
		const tddPhase = this.orchestrator.getCurrentTDDPhase();
		const currentSubtask = this.orchestrator.getCurrentSubtask();

		// Determine action based on current phase
		if (phase === 'COMPLETE') {
			return {
				action: 'workflow_complete',
				description: 'All subtasks completed',
				nextSteps:
					'All subtasks completed! Review the entire implementation and merge your branch when ready.',
				phase
			};
		}

		if (phase === 'FINALIZE') {
			return {
				action: 'finalize_workflow',
				description: 'Finalize and complete the workflow',
				nextSteps:
					'All subtasks are complete! Use autopilot_finalize to verify no uncommitted changes remain and mark the workflow as complete.',
				phase
			};
		}

		if (phase !== 'SUBTASK_LOOP' || !tddPhase || !currentSubtask) {
			return {
				action: 'unknown',
				description: 'Workflow is not in active state',
				nextSteps: 'Use autopilot_status to check workflow state.',
				phase
			};
		}

		const baseAction = {
			phase,
			tddPhase,
			subtask: {
				id: currentSubtask.id,
				title: currentSubtask.title
			}
		};

		switch (tddPhase) {
			case 'RED':
				return {
					...baseAction,
					action: 'generate_test',
					description: 'Generate failing test for current subtask',
					nextSteps: `Write failing tests for subtask ${currentSubtask.id}: "${currentSubtask.title}". Create test file(s) that validate the expected behavior. Run tests and use autopilot_complete_phase with results. Note: If all tests pass (0 failures), the feature is already implemented and the subtask will be auto-completed.`
				};
			case 'GREEN':
				return {
					...baseAction,
					action: 'implement_code',
					description: 'Implement feature to make tests pass',
					nextSteps: `Implement code to make tests pass for subtask ${currentSubtask.id}: "${currentSubtask.title}". Write the minimal code needed to pass all tests (GREEN phase), then use autopilot_complete_phase with test results.`
				};
			case 'COMMIT':
				return {
					...baseAction,
					action: 'commit_changes',
					description: 'Commit RED-GREEN cycle changes',
					nextSteps: `Review and commit your changes for subtask ${currentSubtask.id}: "${currentSubtask.title}". Use autopilot_commit to create the commit and advance to the next subtask.`
				};
			default:
				return {
					...baseAction,
					action: 'unknown',
					description: 'Unknown TDD phase',
					nextSteps: 'Use autopilot_status to check workflow state.'
				};
		}
	}

	/**
	 * Complete current TDD phase with test results
	 */
	async completePhase(testResults: TestResult): Promise<WorkflowStatus> {
		if (!this.orchestrator) {
			throw new Error('No active workflow. Start or resume a workflow first.');
		}

		const tddPhase = this.orchestrator.getCurrentTDDPhase();

		if (!tddPhase) {
			throw new Error('Not in active TDD phase');
		}

		// Transition based on current phase
		switch (tddPhase) {
			case 'RED':
				await this.orchestrator.transition({
					type: 'RED_PHASE_COMPLETE',
					testResults
				});
				break;
			case 'GREEN':
				await this.orchestrator.transition({
					type: 'GREEN_PHASE_COMPLETE',
					testResults
				});
				break;
			case 'COMMIT':
				throw new Error(
					'Cannot complete COMMIT phase with test results. Use commit() instead.'
				);
			default:
				throw new Error(`Unknown TDD phase: ${tddPhase}`);
		}

		return this.getStatus();
	}

	/**
	 * Commit current changes and advance workflow
	 */
	async commit(): Promise<WorkflowStatus> {
		if (!this.orchestrator) {
			throw new Error('No active workflow. Start or resume a workflow first.');
		}

		const tddPhase = this.orchestrator.getCurrentTDDPhase();

		if (tddPhase !== 'COMMIT') {
			throw new Error(
				`Cannot commit in ${tddPhase} phase. Complete RED and GREEN phases first.`
			);
		}

		// Transition COMMIT phase complete
		await this.orchestrator.transition({
			type: 'COMMIT_COMPLETE'
		});

		// Check if should advance to next subtask
		const progress = this.orchestrator.getProgress();
		if (progress.current < progress.total) {
			await this.orchestrator.transition({ type: 'SUBTASK_COMPLETE' });
		} else {
			// All subtasks complete
			await this.orchestrator.transition({ type: 'ALL_SUBTASKS_COMPLETE' });
		}

		return this.getStatus();
	}

	/**
	 * Finalize and complete the workflow
	 * Validates working tree is clean before marking complete
	 */
	async finalizeWorkflow(): Promise<WorkflowStatus> {
		if (!this.orchestrator) {
			throw new Error('No active workflow. Start or resume a workflow first.');
		}

		const phase = this.orchestrator.getCurrentPhase();
		if (phase !== 'FINALIZE') {
			throw new Error(
				`Cannot finalize workflow in ${phase} phase. Complete all subtasks first.`
			);
		}

		// Check working tree is clean
		const gitAdapter = new GitAdapter(this.projectRoot);
		const statusSummary = await gitAdapter.getStatusSummary();

		if (!statusSummary.isClean) {
			throw new Error(
				`Cannot finalize workflow: working tree has uncommitted changes.\n` +
					`Staged: ${statusSummary.staged}, Modified: ${statusSummary.modified}, ` +
					`Deleted: ${statusSummary.deleted}, Untracked: ${statusSummary.untracked}\n` +
					`Please commit all changes before finalizing the workflow.`
			);
		}

		// Transition to COMPLETE
		await this.orchestrator.transition({ type: 'FINALIZE_COMPLETE' });

		return this.getStatus();
	}

	/**
	 * Abort current workflow
	 */
	async abortWorkflow(): Promise<void> {
		if (this.orchestrator) {
			await this.orchestrator.transition({ type: 'ABORT' });
		}

		// Delete state file
		await this.stateManager.delete();

		this.orchestrator = undefined;
	}

	/**
	 * Generate a descriptive git branch name
	 * Format: tag-name/task-id-task-title or task-id-task-title
	 */
	private generateBranchName(
		taskId: string,
		taskTitle: string,
		tag?: string
	): string {
		// Sanitize task title for branch name
		const sanitizedTitle = taskTitle
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
			.replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
			.substring(0, 50); // Limit length

		// Format task ID for branch name
		const formattedTaskId = taskId.replace(/\./g, '-');

		// Add tag prefix if tag is provided
		const tagPrefix = tag ? `${tag}/` : '';

		return `${tagPrefix}task-${formattedTaskId}-${sanitizedTitle}`;
	}
}
