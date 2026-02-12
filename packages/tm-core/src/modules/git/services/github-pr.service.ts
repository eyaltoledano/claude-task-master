/**
 * GitHubPRService - Create and manage GitHub pull requests per execution cluster
 *
 * This service handles:
 * - Creating PRs via gh CLI with cluster metadata
 * - Mapping clusters to PR URLs for traceability
 * - Generating PR titles and bodies from workflow context
 * - Supporting dry-run mode for validation
 */

import { getLogger } from '../../../common/logger/index.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import type { WorkflowContext } from '../../workflow/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PRBodyFormatter, type CommitInfo } from './pr-body-formatter.js';

const execAsync = promisify(exec);
const logger = getLogger('GitHubPRService');

/**
 * PR cluster input for PR creation
 */
export interface PRClusterInput {
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
	/** Error code from TaskMasterError if available */
	errorCode?: string;
	/** Cluster ID this PR is associated with */
	clusterId: string;
	/** Whether this was a dry run */
	dryRun: boolean;
	/** Whether auto-merge was enabled */
	autoMergeEnabled?: boolean;
	/** Error from auto-merge attempt */
	autoMergeError?: string;
}

/**
 * Options for PR creation
 */
export interface CreatePROptions {
	/** Cluster metadata */
	cluster: PRClusterInput;
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
			this.validateClusterData(cluster);

			if (!dryRun) {
				await this.validateGhCLI();
			}

			const title =
				customTitle || this.generatePRTitle(cluster, workflowContext);
			const body = customBody || this.generatePRBody(cluster, workflowContext);

			if (dryRun) {
				return this.handleDryRun(cluster, title, body);
			}

			const result = await this.createPRViaGhCLI({
				title,
				body,
				baseBranch: cluster.baseBranch || this.defaultBaseBranch,
				headBranch: cluster.branchName,
				draft,
				labels
			});

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

			const autoMergeResult =
				autoMerge && result.prNumber
					? await this.enableAutoMerge(result.prNumber)
					: undefined;

			logger.info(
				`Successfully created PR for cluster ${cluster.clusterId}: ${result.prUrl}`
			);

			return {
				success: true,
				prUrl: result.prUrl,
				prNumber: result.prNumber,
				clusterId: cluster.clusterId,
				dryRun: false,
				autoMergeEnabled: autoMergeResult?.enabled,
				autoMergeError: autoMergeResult?.error
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorCode =
				error instanceof TaskMasterError ? error.code : undefined;
			logger.error(
				`Failed to create PR for cluster ${cluster.clusterId}:`,
				error
			);

			return {
				success: false,
				error: errorMessage,
				errorCode,
				clusterId: cluster.clusterId,
				dryRun
			};
		}
	}

	private handleDryRun(
		cluster: PRClusterInput,
		title: string,
		body: string
	): PRCreationResult {
		logger.info(`[DRY RUN] Would create PR with title: ${title}`);
		logger.info(`[DRY RUN] Body:\n${body}`);

		const dryRunMapping: ClusterPRMapping = {
			clusterId: cluster.clusterId,
			prUrl: '',
			prNumber: 0,
			branchName: cluster.branchName,
			createdAt: new Date().toISOString(),
			metadata: { ...cluster.metadata, dryRun: true }
		};
		this.clusterPRMappings.set(cluster.clusterId, dryRunMapping);

		return {
			success: true,
			clusterId: cluster.clusterId,
			dryRun: true
		};
	}

	getClusterPRMapping(clusterId: string): ClusterPRMapping | undefined {
		return this.clusterPRMappings.get(clusterId);
	}

	getAllClusterPRMappings(): ClusterPRMapping[] {
		return Array.from(this.clusterPRMappings.values());
	}

	/**
	 * Validate cluster data before PR creation
	 */
	private validateClusterData(cluster: PRClusterInput): void {
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
		cluster: PRClusterInput,
		workflowContext?: WorkflowContext
	): string {
		const taskId = cluster.taskId || workflowContext?.taskId;
		const tag = cluster.tag || workflowContext?.tag;

		const type = 'feat'; // Defaults to feat; customization not yet supported
		const scope = tag ? `${tag}` : 'cluster';
		const description = `implement cluster ${cluster.clusterId}`;

		return `${type}(${scope}): ${description}${taskId ? ` [${taskId}]` : ''}`;
	}

	/**
	 * Generate PR body from cluster and workflow context
	 * Uses PRBodyFormatter for comprehensive formatting
	 */
	private generatePRBody(
		cluster: PRClusterInput,
		workflowContext?: WorkflowContext
	): string {
		const commits: CommitInfo[] | undefined = cluster.commits?.map((sha) => ({
			sha,
			message: '' // Message not available in cluster metadata
		}));

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
			const command = `gh ${args
				.map((arg) => {
					if (arg.includes(' ') || arg.includes('\n')) {
						return `'${arg.replace(/'/g, "'\\''")}'`;
					}
					return arg;
				})
				.join(' ')}`;

			const { stdout } = await execAsync(command, {
				cwd: this.projectRoot
			});
			const prUrl = stdout.trim();

			const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
			const prNumber = prNumberMatch
				? parseInt(prNumberMatch[1], 10)
				: undefined;

			return { prUrl, prNumber };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new TaskMasterError(
				`Failed to create PR via gh CLI: ${errorMessage}`,
				ERROR_CODES.GIT_ERROR,
				{ title, baseBranch, headBranch }
			);
		}
	}

	/**
	 * Enable auto-merge for a PR. Returns status so callers can report it.
	 */
	private async enableAutoMerge(
		prNumber: number
	): Promise<{ enabled: boolean; error?: string }> {
		try {
			await execAsync(`gh pr merge ${prNumber} --auto --squash`, {
				cwd: this.projectRoot
			});
			logger.info(`Enabled auto-merge for PR #${prNumber}`);
			return { enabled: true };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.warn(
				`Failed to enable auto-merge for PR #${prNumber}: ${errorMessage}`
			);
			return { enabled: false, error: errorMessage };
		}
	}

	setClusterPRMapping(mapping: ClusterPRMapping): void {
		this.clusterPRMappings.set(mapping.clusterId, mapping);
	}

	clearMappings(): void {
		this.clusterPRMappings.clear();
	}
}
