/**
 * @fileoverview Cluster Execution Domain
 * Domain facade for building execution plans and generating system prompts
 * for Claude Code teams-mode cluster execution.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getLogger } from '../../common/logger/index.js';
import type { Task, TaskStatus } from '../../common/types/index.js';
import { readJSON, writeJSON } from '../../common/utils/index.js';
import type { ConfigManager } from '../config/managers/config-manager.js';
import type { TasksDomain } from '../tasks/tasks-domain.js';
import { ClusterDetectionService } from './services/cluster-detection.service.js';
import {
	PromptBuilderService,
	type PromptContext
} from './services/prompt-builder.service.js';
import type {
	ClusterMetadata,
	ClusterStatus,
	ExecutionCheckpoint
} from './types.js';

/**
 * Options for building a cluster execution plan
 */
export interface ClusterStartOptions {
	/** Tag to execute clusters for */
	tag?: string;
	/** Only build the plan, don't generate prompt */
	dryRun?: boolean;
	/** Maximum parallel tasks per level (default: 5) */
	parallel?: number;
	/** Resume from a previous checkpoint */
	resume?: boolean;
	/** Continue executing even if some tasks fail */
	continueOnFailure?: boolean;
}

/**
 * Checkpoint info for display purposes
 */
export interface CheckpointInfo {
	readonly completedClusters: number;
	readonly completedTasks: number;
	readonly timestamp: Date;
}

/**
 * Execution plan built from cluster detection
 */
export interface ExecutionPlan {
	readonly tag: string;
	readonly clusters: readonly ClusterMetadata[];
	readonly tasks: readonly Task[];
	readonly totalClusters: number;
	readonly totalTasks: number;
	/** Number of distinct topological levels (turns) */
	readonly estimatedTurns: number;
	readonly hasResumableCheckpoint: boolean;
	readonly checkpointInfo?: CheckpointInfo;
	readonly checkpointPath: string;
}

/**
 * ClusterExecutionDomain — facade for cluster execution features.
 *
 * Follows the same domain pattern as LoopDomain:
 *   constructor receives ConfigManager + TasksDomain,
 *   exposes public methods for building plans and generating prompts.
 */
export class ClusterExecutionDomain {
	private readonly logger = getLogger('ClusterExecutionDomain');
	private readonly projectRoot: string;
	private readonly detectionService = new ClusterDetectionService();
	private readonly promptBuilder = new PromptBuilderService();

	constructor(
		private readonly configManager: ConfigManager,
		private readonly tasksDomain: TasksDomain
	) {
		this.projectRoot = configManager.getProjectRoot();
	}

	/**
	 * Build an execution plan for the given tag.
	 *
	 * 1. Loads tasks for the tag
	 * 2. Runs cluster detection (always computed fresh from the DAG)
	 * 3. Checks for an existing checkpoint if resume is requested
	 */
	async buildExecutionPlan(
		options: ClusterStartOptions = {}
	): Promise<ExecutionPlan> {
		const tag = options.tag ?? this.configManager.getActiveTag();

		this.logger.info('Building execution plan', { tag });

		// Load tasks for the tag
		const result = await this.tasksDomain.list({
			tag,
			includeSubtasks: true
		});

		if (result.tasks.length === 0) {
			return {
				tag,
				clusters: [],
				tasks: [],
				totalClusters: 0,
				totalTasks: 0,
				estimatedTurns: 0,
				hasResumableCheckpoint: false,
				checkpointPath: this.getCheckpointPath(tag)
			};
		}

		// Detect clusters from the dependency DAG
		const detection = this.detectionService.detectClusters(result.tasks);

		if (detection.hasCircularDependencies) {
			this.logger.error('Circular dependencies detected', {
				path: detection.circularDependencyPath
			});
			throw new Error(
				`Circular dependencies detected: ${(detection.circularDependencyPath ?? []).join(' -> ')}`
			);
		}

		// Count distinct levels
		const levelSet = new Set(detection.clusters.map((c) => c.level));
		const estimatedTurns = levelSet.size;

		// Check for existing checkpoint
		const checkpointPath = this.getCheckpointPath(tag);
		let hasResumableCheckpoint = false;
		let checkpointInfo: CheckpointInfo | undefined;

		if (options.resume) {
			const checkpoint = await this.loadCheckpointFile(checkpointPath);
			if (checkpoint) {
				hasResumableCheckpoint = true;
				checkpointInfo = {
					completedClusters: checkpoint.completedClusters.length,
					completedTasks: checkpoint.completedTasks.length,
					timestamp: new Date(checkpoint.timestamp)
				};
			}
		}

		return {
			tag,
			clusters: detection.clusters,
			tasks: result.tasks,
			totalClusters: detection.totalClusters,
			totalTasks: detection.totalTasks,
			estimatedTurns,
			hasResumableCheckpoint,
			checkpointInfo,
			checkpointPath
		};
	}

	/**
	 * Generate the prompt for a Claude Code teams session.
	 */
	buildPrompt(plan: ExecutionPlan): string {
		const context: PromptContext = {
			projectPath: this.projectRoot,
			tag: plan.tag,
			clusters: plan.clusters,
			tasks: plan.tasks,
			totalClusters: plan.totalClusters,
			totalTasks: plan.totalTasks,
			checkpointPath: plan.checkpointPath
		};

		return this.promptBuilder.buildPrompt(context);
	}

	/**
	 * Save an execution checkpoint (e.g. on SIGINT).
	 */
	async saveCheckpoint(
		tag: string,
		completedClusters: string[],
		completedTasks: string[],
		failedTasks: string[] = [],
		clusterStatuses: Record<string, ClusterStatus> = {},
		taskStatuses: Record<string, TaskStatus> = {}
	): Promise<void> {
		const checkpointPath = this.getCheckpointPath(tag);

		const checkpoint: ExecutionCheckpoint = {
			timestamp: new Date(),
			currentClusterId: completedClusters[completedClusters.length - 1] ?? '',
			completedClusters,
			completedTasks,
			failedTasks,
			clusterStatuses,
			taskStatuses
		};

		await writeJSON(checkpointPath, checkpoint);

		this.logger.info('Checkpoint saved', { checkpointPath });
	}

	/**
	 * Clear a checkpoint (called after successful completion).
	 */
	async clearCheckpoint(tag: string): Promise<void> {
		const checkpointPath = this.getCheckpointPath(tag);

		try {
			await fs.unlink(checkpointPath);
			this.logger.debug('Checkpoint cleared', { checkpointPath });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
			// Already gone, fine
		}
	}

	private getCheckpointPath(tag: string): string {
		return path.join(
			this.projectRoot,
			'.taskmaster',
			'execution',
			tag,
			'checkpoint.json'
		);
	}

	private async loadCheckpointFile(
		checkpointPath: string
	): Promise<ExecutionCheckpoint | null> {
		const data = await readJSON<any>(checkpointPath);

		// readJSON returns null on any I/O or parse failure
		if (data === null) {
			return null;
		}

		// Validate: must be a non-null, non-array object
		if (typeof data !== 'object' || Array.isArray(data)) {
			this.logger.warn('Invalid checkpoint structure', { checkpointPath });
			return null;
		}

		const {
			timestamp,
			currentClusterId,
			completedClusters,
			completedTasks,
			failedTasks,
			clusterStatuses,
			taskStatuses
		} = data;

		// Validate individual fields with strict type checks
		if (typeof timestamp !== 'number' && typeof timestamp !== 'string') {
			this.logger.warn('Invalid checkpoint: bad timestamp', { checkpointPath });
			return null;
		}
		if (typeof timestamp === 'number' && !Number.isFinite(timestamp)) {
			this.logger.warn('Invalid checkpoint: non-finite timestamp', {
				checkpointPath
			});
			return null;
		}
		if (typeof currentClusterId !== 'string') {
			this.logger.warn('Invalid checkpoint: bad currentClusterId', {
				checkpointPath
			});
			return null;
		}
		if (
			!Array.isArray(completedClusters) ||
			!Array.isArray(completedTasks) ||
			!Array.isArray(failedTasks)
		) {
			this.logger.warn('Invalid checkpoint: arrays missing', {
				checkpointPath
			});
			return null;
		}
		if (
			clusterStatuses === null ||
			typeof clusterStatuses !== 'object' ||
			Array.isArray(clusterStatuses)
		) {
			this.logger.warn('Invalid checkpoint: bad clusterStatuses', {
				checkpointPath
			});
			return null;
		}
		if (
			taskStatuses === null ||
			typeof taskStatuses !== 'object' ||
			Array.isArray(taskStatuses)
		) {
			this.logger.warn('Invalid checkpoint: bad taskStatuses', {
				checkpointPath
			});
			return null;
		}

		return data as ExecutionCheckpoint;
	}
}
