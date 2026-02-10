/**
 * GitHubPRService - Create and manage GitHub pull requests per execution cluster
 *
 * This service handles:
 * - Creating PRs via gh CLI with cluster metadata
 * - Mapping clusters to PR URLs for traceability
 * - Generating PR titles and bodies from workflow state
 * - Supporting dry-run mode for validation
 */

import { getLogger } from '../../../common/logger/index.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import type { WorkflowContext, WorkflowState } from '../../workflow/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PRBodyFormatter, type CommitInfo } from './pr-body-formatter.js';

const execAsync = promisify(exec);
const logger = getLogger('GitHubPRService');

/**
 * Cluster metadata for PR creation
 */
export interface ClusterMetadata {
	/** Unique cluster identifier */
	clusterId: string;
	/** Branch name for this cluster */
	branchName: string;
	/** Base branch to create PR against */
	baseBranch?: string;
	/** Task ID associated with cluster */
	taskId?: string;
	/** Tag for categorization */
	tag?: string;
	/** Array of commit SHAs in this cluster */
	commits?: string[];
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Result of PR creation operation
 */
export interface PRCreationResult {
	/** Whether PR was successfully created */
	success: boolean;
	/** GitHub PR URL */
	prUrl?: string;
	/** PR number */
	prNumber?: number;
	/** Error message if creation failed */
	error?: string;
	/** Cluster ID this PR is associated with */
	clusterId: string;
	/** Whether this was a dry run */
	dryRun: boolean;
}

/**
 * Options for PR creation
 */
export interface CreatePROptions {
	/** Cluster metadata */
	cluster: ClusterMetadata;
	/** Workflow context with run state */
	workflowContext?: WorkflowContext;
	/** PR title (auto-generated if not provided) */
	title?: string;
	/** PR body (auto-generated if not provided) */
	body?: string;
	/** Whether to run in dry-run mode (no actual PR creation) */
	dryRun?: boolean;
	/** Whether to enable auto-merge */
	autoMerge?: boolean;
	/** Labels to add to PR */
	labels?: string[];
	/** Draft mode */
	draft?: boolean;
}

/**
 * Cluster to PR mapping for traceability
 */
export interface ClusterPRMapping {
	clusterId: string;
	prUrl: string;
	prNumber: number;
	branchName: string;
	createdAt: string;
	metadata?: Record<string, unknown>;
}

/**
 * GitHubPRService for creating PRs per cluster
 */
export class GitHubPRService {
	private clusterPRMappings: Map<string, ClusterPRMapping> = new Map();
	private prBodyFormatter: PRBodyFormatter;

	constructor(
		private projectRoot: string,
		private defaultBaseBranch: string = 'main'
	) {
		this.prBodyFormatter = new PRBodyFormatter();
	}

	/**
	 * Create a GitHub PR for a cluster
	 */
	async createPR(options: CreatePROptions): Promise<PRCreationResult> {
		const {
			cluster,
			workflowContext,
			title: customTitle,
			body: customBody,
			dryRun = false,
			autoMerge = false,
			labels = [],
			draft = false
		} = options;

		try {
			// Validate cluster data
			this.validateClusterData(cluster);

			// Check gh CLI is available
			if (!dryRun) {
				await this.validateGhCLI();
			}

			// Generate PR title
			const title = customTitle || this.generatePRTitle(cluster, workflowContext);

			// Generate PR body
			const body = customBody || this.generatePRBody(cluster, workflowContext);

			if (dryRun) {
				logger.info(`[DRY RUN] Would create PR with title: ${title}`);
				logger.info(`[DRY RUN] Body:\n${body}`);
				return {
					success: true,
					clusterId: cluster.clusterId,
					dryRun: true
				};
			}

			// Create PR via gh CLI
			const result = await this.createPRViaGhCLI({
				title,
				body,
				baseBranch: cluster.baseBranch || this.defaultBaseBranch,
				headBranch: cluster.branchName,
				draft,
				labels
			});

			// Store mapping
			if (result.prUrl && result.prNumber) {
				const mapping: ClusterPRMapping = {
					clusterId: cluster.clusterId,
					prUrl: result.prUrl,
					prNumber: result.prNumber,
					branchName: cluster.branchName,
					createdAt: new Date().toISOString(),
					metadata: cluster.metadata
				};
				this.clusterPRMappings.set(cluster.clusterId, mapping);
			}

			// Enable auto-merge if requested
			if (autoMerge && result.prNumber) {
				await this.enableAutoMerge(result.prNumber);
			}

			logger.info(`Successfully created PR for cluster ${cluster.clusterId}: ${result.prUrl}`);

			return {
				success: true,
				prUrl: result.prUrl,
				prNumber: result.prNumber,
				clusterId: cluster.clusterId,
				dryRun: false
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to create PR for cluster ${cluster.clusterId}:`, error);

			return {
				success: false,
				error: errorMessage,
				clusterId: cluster.clusterId,
				dryRun
			};
		}
	}

	/**
	 * Get PR mapping for a cluster
	 */
	getClusterPRMapping(clusterId: string): ClusterPRMapping | undefined {
		return this.clusterPRMappings.get(clusterId);
	}

	/**
	 * Get all cluster PR mappings
	 */
	getAllClusterPRMappings(): ClusterPRMapping[] {
		return Array.from(this.clusterPRMappings.values());
	}

	/**
	 * Validate cluster data before PR creation
	 */
	private validateClusterData(cluster: ClusterMetadata): void {
		if (!cluster.clusterId) {
			throw new TaskMasterError(
				'Cluster ID is required',
				ERROR_CODES.VALIDATION_ERROR,
				{ cluster }
			);
		}

		if (!cluster.branchName) {
			throw new TaskMasterError(
				'Branch name is required',
				ERROR_CODES.VALIDATION_ERROR,
				{ clusterId: cluster.clusterId }
			);
		}
	}

	/**
	 * Validate gh CLI is available
	 */
	private async validateGhCLI(): Promise<void> {
		try {
			await execAsync('gh --version', { cwd: this.projectRoot });
		} catch (error) {
			throw new TaskMasterError(
				'GitHub CLI (gh) is not installed or not available',
				ERROR_CODES.DEPENDENCY_ERROR,
				{ suggestion: 'Install gh CLI: https://cli.github.com/' }
			);
		}
	}

	/**
	 * Generate PR title from cluster metadata
	 */
	private generatePRTitle(
		cluster: ClusterMetadata,
		workflowContext?: WorkflowContext
	): string {
		const taskId = cluster.taskId || workflowContext?.taskId;
		const tag = cluster.tag || workflowContext?.tag;

		// Use conventional commit format
		const type = 'feat'; // Default to feat, can be customized
		const scope = tag ? `${tag}` : 'cluster';
		const description = `implement cluster ${cluster.clusterId}`;

		return `${type}(${scope}): ${description}${taskId ? ` [${taskId}]` : ''}`;
	}

	/**
	 * Generate PR body from cluster and workflow context
	 * Uses PRBodyFormatter for comprehensive formatting
	 */
	private generatePRBody(
		cluster: ClusterMetadata,
		workflowContext?: WorkflowContext
	): string {
		// Convert cluster commits to CommitInfo format
		const commits: CommitInfo[] | undefined = cluster.commits?.map((sha) => ({
			sha,
			message: '' // Message not available in cluster metadata
		}));

		// Format using PRBodyFormatter
		return this.prBodyFormatter.format({
			workflowContext,
			commits,
			branchName: cluster.branchName,
			tag: cluster.tag || workflowContext?.tag,
			taskId: cluster.taskId || workflowContext?.taskId,
			taskTitle: cluster.metadata?.taskTitle as string | undefined,
			taskDescription: cluster.metadata?.taskDescription as string | undefined,
			runStartTime: cluster.metadata?.runStartTime as string | undefined,
			runEndTime: cluster.metadata?.runEndTime as string | undefined,
			coveragePercent: cluster.metadata?.coveragePercent as number | undefined
		});
	}

	/**
	 * Create PR using gh CLI
	 */
	private async createPRViaGhCLI(options: {
		title: string;
		body: string;
		baseBranch: string;
		headBranch: string;
		draft: boolean;
		labels: string[];
	}): Promise<{ prUrl?: string; prNumber?: number }> {
		const { title, body, baseBranch, headBranch, draft, labels } = options;

		// Build gh pr create command
		const args = [
			'pr',
			'create',
			'--title',
			title,
			'--body',
			body,
			'--base',
			baseBranch,
			'--head',
			headBranch
		];

		if (draft) {
			args.push('--draft');
		}

		if (labels.length > 0) {
			args.push('--label', labels.join(','));
		}

		try {
			// Execute gh command
			const command = `gh ${args.map((arg) => {
				// Quote args that contain spaces or special chars
				if (arg.includes(' ') || arg.includes('\n')) {
					return `'${arg.replace(/'/g, "'\\''")}'`;
				}
				return arg;
			}).join(' ')}`;

			const { stdout } = await execAsync(command, { cwd: this.projectRoot });
			const prUrl = stdout.trim();

			// Extract PR number from URL
			const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
			const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : undefined;

			return { prUrl, prNumber };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new TaskMasterError(
				`Failed to create PR via gh CLI: ${errorMessage}`,
				ERROR_CODES.GIT_ERROR,
				{ title, baseBranch, headBranch }
			);
		}
	}

	/**
	 * Enable auto-merge for a PR
	 */
	private async enableAutoMerge(prNumber: number): Promise<void> {
		try {
			await execAsync(`gh pr merge ${prNumber} --auto --squash`, {
				cwd: this.projectRoot
			});
			logger.info(`Enabled auto-merge for PR #${prNumber}`);
		} catch (error) {
			logger.warn(`Failed to enable auto-merge for PR #${prNumber}:`, error);
			// Don't throw - auto-merge is optional
		}
	}

	/**
	 * Update PR mapping (for resumability)
	 */
	setClusterPRMapping(mapping: ClusterPRMapping): void {
		this.clusterPRMappings.set(mapping.clusterId, mapping);
	}

	/**
	 * Clear all mappings
	 */
	clearMappings(): void {
		this.clusterPRMappings.clear();
	}
}
