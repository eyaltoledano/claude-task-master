/**
 * ClusterPRIntegration - Integration layer between workflow orchestration and PR creation
 *
 * This service:
 * - Provides handlers for cluster completion events (invoked by WorkflowOrchestrator)
 * - Invokes GitHubPRService with properly formatted inputs
 * - Handles PR creation results and updates run state
 * - Provides error handling and fallback strategies
 */

import { getLogger } from '../../../common/logger/index.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import {
	GitHubPRService,
	type PRClusterInput,
	type PRCreationResult
} from '../../git/services/github-pr.service.js';
import type { WorkflowContext, WorkflowEventData } from '../types.js';
import { logActivity } from '../../storage/adapters/activity-logger.js';
import path from 'path';

const logger = getLogger('ClusterPRIntegration');

/**
 * Options for cluster PR integration
 */
export interface ClusterPRIntegrationOptions {
	/** Project root directory */
	projectRoot: string;
	/** Base branch for PRs (default: main) */
	baseBranch?: string;
	/** Whether to enable dry-run mode */
	dryRun?: boolean;
	/** Whether to enable auto-merge */
	autoMerge?: boolean;
	/** Labels to add to PRs */
	labels?: string[];
	/** Whether to create PRs as drafts */
	draft?: boolean;
	/** Activity log path for tracking */
	activityLogPath?: string;
}

/**
 * Cluster completion event data
 */
export interface ClusterCompletionEvent {
	/** Cluster identifier */
	clusterId: string;
	/** Workflow context at completion */
	workflowContext: WorkflowContext;
	/** Branch name */
	branchName?: string;
	/** Commit SHAs in this cluster */
	commits?: string[];
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Result of PR integration
 */
export interface PRIntegrationResult {
	/** Whether integration was successful */
	success: boolean;
	/** PR creation result */
	prResult?: PRCreationResult;
	/** Error message if failed */
	error?: string;
	/** Cluster ID */
	clusterId: string;
}

/**
 * ClusterPRIntegration service
 */
export class ClusterPRIntegration {
	private prService: GitHubPRService;
	private options: ClusterPRIntegrationOptions;

	constructor(options: ClusterPRIntegrationOptions) {
		this.options = options;
		this.prService = new GitHubPRService(
			options.projectRoot,
			options.baseBranch || 'main'
		);
	}

	/**
	 * Handle cluster completion and create PR
	 */
	async handleClusterCompletion(
		event: ClusterCompletionEvent
	): Promise<PRIntegrationResult> {
		const { clusterId, workflowContext, branchName, commits, metadata } = event;

		logger.info(`Handling cluster completion for ${clusterId}`);

		try {
			const resolvedBranchName = branchName || workflowContext.branchName;
			if (!resolvedBranchName) {
				throw new TaskMasterError(
					`branchName is required for createPR (cluster: ${clusterId})`,
					ERROR_CODES.VALIDATION_ERROR,
					{ clusterId, operation: 'handleClusterCompletion' }
				);
			}

			// Build cluster metadata
			const clusterInput: PRClusterInput = {
				clusterId,
				branchName: resolvedBranchName,
				baseBranch: this.options.baseBranch,
				taskId: workflowContext.taskId,
				tag: workflowContext.tag,
				commits,
				metadata: {
					...metadata,
					...workflowContext.metadata
				}
			};

			// Create PR
			const prResult = await this.prService.createPR({
				cluster: clusterInput,
				workflowContext,
				dryRun: this.options.dryRun,
				autoMerge: this.options.autoMerge,
				labels: this.options.labels || [],
				draft: this.options.draft || false
			});

			// Log activity
			if (this.options.activityLogPath) {
				await this.logPRCreation(prResult, clusterId);
			}

			// Check if PR creation succeeded
			if (!prResult.success) {
				return {
					success: false,
					prResult,
					error: prResult.error,
					clusterId
				};
			}

			// Update run state if successful
			if (prResult.prUrl) {
				this.updateRunStateWithPR(workflowContext, clusterId, prResult);
			}

			logger.info(
				`Successfully handled cluster ${clusterId}, PR: ${prResult.prUrl || 'dry-run'}`
			);

			return {
				success: true,
				prResult,
				clusterId
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.error(`Failed to handle cluster ${clusterId}:`, error);

			// Log error activity
			if (this.options.activityLogPath) {
				try {
					await this.logPRError(clusterId, errorMessage);
				} catch (logError) {
					logger.error('Failed to log PR error activity', {
						logError,
						originalError: error
					});
				}
			}

			return {
				success: false,
				error: errorMessage,
				clusterId
			};
		}
	}

	/**
	 * Handle workflow event (for orchestrator integration)
	 */
	async handleWorkflowEvent(
		event: WorkflowEventData,
		workflowContext: WorkflowContext
	): Promise<PRIntegrationResult | null> {
		// Only handle finalize complete events
		if (event.type !== 'phase:exited' || event.phase !== 'FINALIZE') {
			return null;
		}

		logger.info('Detected workflow finalization, creating PR');

		// Generate cluster ID from workflow context
		const clusterId = this.generateClusterId(workflowContext);

		// Create cluster completion event
		const clusterEvent: ClusterCompletionEvent = {
			clusterId,
			workflowContext,
			branchName: workflowContext.branchName,
			commits: [], // Would be populated from git history
			metadata: event.data
		};

		return await this.handleClusterCompletion(clusterEvent);
	}

	/**
	 * Generate cluster ID from workflow context
	 */
	private generateClusterId(context: WorkflowContext): string {
		const taskId = context.taskId;
		const timestamp = Date.now();
		return `cluster-${taskId}-${timestamp}`;
	}

	/**
	 * Update run state with PR information
	 */
	private updateRunStateWithPR(
		context: WorkflowContext,
		clusterId: string,
		prResult: PRCreationResult
	): void {
		const existingPrs = (context.metadata.prs as Record<string, unknown>) || {};

		const updatedPrs = {
			...existingPrs,
			[clusterId]: {
				prUrl: prResult.prUrl,
				prNumber: prResult.prNumber,
				createdAt: new Date().toISOString()
			}
		};

		context.metadata = {
			...context.metadata,
			prs: updatedPrs
		};

		logger.debug(`Updated run state with PR info for cluster ${clusterId}`);
	}

	/**
	 * Log PR creation to activity log
	 */
	private async logPRCreation(
		result: PRCreationResult,
		clusterId: string
	): Promise<void> {
		if (!this.options.activityLogPath) {
			return;
		}

		const activityPath = path.join(
			this.options.projectRoot,
			this.options.activityLogPath
		);

		await logActivity(activityPath, {
			type: 'pr:created',
			clusterId,
			prUrl: result.prUrl,
			prNumber: result.prNumber,
			dryRun: result.dryRun,
			success: result.success
		});
	}

	/**
	 * Log PR creation error to activity log
	 */
	private async logPRError(clusterId: string, error: string): Promise<void> {
		if (!this.options.activityLogPath) {
			return;
		}

		const activityPath = path.join(
			this.options.projectRoot,
			this.options.activityLogPath
		);

		await logActivity(activityPath, {
			type: 'pr:error',
			clusterId,
			error,
			success: false
		});
	}

	/**
	 * Get all PR mappings
	 */
	getAllPRMappings() {
		return this.prService.getAllClusterPRMappings();
	}

	/**
	 * Get PR mapping for specific cluster
	 */
	getPRMapping(clusterId: string) {
		return this.prService.getClusterPRMapping(clusterId);
	}

	/**
	 * Enable PR creation (for toggling at runtime)
	 */
	setDryRun(dryRun: boolean): void {
		this.options = { ...this.options, dryRun };
	}

	/**
	 * Update PR options at runtime
	 */
	updateOptions(options: Partial<ClusterPRIntegrationOptions>): void {
		this.options = { ...this.options, ...options };
	}
}
