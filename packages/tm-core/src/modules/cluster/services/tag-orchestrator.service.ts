/**
 * @fileoverview Tag Orchestrator Service
 * Manages execution of all clusters within a specific tag context,
 * with checkpoint-based resumability.
 */

import type { Task } from '../../../common/types/index.js';
import type {
	TagExecutionContext,
	ClusterDetectionResult,
	ProgressEventListener,
	ProgressEventData
} from '../types.js';
import { ClusterDetectionService } from './cluster-detection.service.js';
import {
	ClusterSequencerService,
	type ClusterExecutionOptions,
	type ClusterSequencerResult
} from './cluster-sequencer.service.js';
import {
	ProgressTrackerService,
	type ExecutionProgress
} from './progress-tracker.service.js';
import type { TaskExecutor } from './parallel-executor.service.js';
import { getLogger } from '../../../common/logger/factory.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';

/**
 * Tag execution options
 */
export interface TagExecutionOptions extends ClusterExecutionOptions {
	/** Path for checkpoint persistence */
	checkpointPath?: string;
	/** Resume from checkpoint if available */
	resumeFromCheckpoint?: boolean;
}

/**
 * Tag execution result
 */
export interface TagExecutionResult {
	tag: string;
	success: boolean;
	totalClusters: number;
	completedClusters: number;
	failedClusters: number;
	blockedClusters: number;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	startTime: Date;
	endTime: Date;
	duration: number;
	sequencerResult: ClusterSequencerResult;
}

/**
 * TagOrchestratorService manages tag-level execution
 */
export class TagOrchestratorService {
	private logger = getLogger('TagOrchestratorService');
	private clusterDetector: ClusterDetectionService;
	private clusterSequencer: ClusterSequencerService;
	private progressTracker: ProgressTrackerService;
	private eventListeners: Set<ProgressEventListener> = new Set();
	private listenerFailureCounts: Map<ProgressEventListener, number> = new Map();
	private currentSequencerListener?: (event: ProgressEventData) => void;
	private currentContext?: TagExecutionContext;

	constructor(
		clusterDetector?: ClusterDetectionService,
		clusterSequencer?: ClusterSequencerService,
		progressTracker?: ProgressTrackerService
	) {
		this.clusterDetector = clusterDetector || new ClusterDetectionService();
		this.clusterSequencer =
			clusterSequencer || new ClusterSequencerService(this.clusterDetector);
		this.progressTracker = progressTracker || new ProgressTrackerService();

		this.clusterSequencer.addEventListener((event) => {
			this.progressTracker.handleEvent(event);
			this.emitEvent(event);
		});

		this.progressTracker.addEventListener((event) => {
			this.emitEvent(event);
		});
	}

	/**
	 * Execute all clusters for a tag
	 */
	async executeTag(
		tag: string,
		tasks: Task[],
		executor: TaskExecutor,
		options: TagExecutionOptions = {}
	): Promise<TagExecutionResult> {
		this.logger.info('Starting tag execution', {
			tag,
			taskCount: tasks.length
		});

		const startTime = new Date();

		const detection = this.clusterDetector.detectClusters(tasks, `tag:${tag}`);

		if (detection.hasCircularDependencies) {
			throw new TaskMasterError(
				`Circular dependency detected in tag ${tag}: ${detection.circularDependencyPath?.join(' -> ')}`,
				ERROR_CODES.VALIDATION_ERROR,
				{
					operation: 'executeTag',
					tag,
					circularPath: detection.circularDependencyPath
				}
			);
		}

		this.progressTracker = new ProgressTrackerService(options.checkpointPath);
		await this.progressTracker.initialize(detection);

		if (this.currentSequencerListener) {
			this.clusterSequencer.removeEventListener(this.currentSequencerListener);
		}

		this.currentSequencerListener = (event: ProgressEventData) => {
			this.progressTracker.handleEvent(event);
		};
		this.clusterSequencer.addEventListener(this.currentSequencerListener);

		this.currentContext = {
			tag,
			clusters: detection.clusters,
			currentClusterIndex: 0,
			startTime,
			status: 'in-progress'
		};

		if (options.resumeFromCheckpoint && options.checkpointPath) {
			await this.resumeFromCheckpoint(detection);
		}

		const sequencerResult = await this.clusterSequencer.executeClusters(
			tasks,
			executor,
			options
		);

		const endTime = new Date();
		const duration = endTime.getTime() - startTime.getTime();

		this.currentContext = {
			...this.currentContext,
			status: sequencerResult.success ? 'done' : 'failed',
			endTime
		};

		const progress = this.progressTracker.getProgress();

		if (sequencerResult.success && options.checkpointPath) {
			await this.progressTracker.deleteCheckpoint();
		}

		return this.buildTagResult(
			tag,
			sequencerResult,
			progress,
			startTime,
			endTime,
			duration
		);
	}

	/**
	 * Resume execution state from a saved checkpoint
	 */
	private async resumeFromCheckpoint(
		detection: ClusterDetectionResult
	): Promise<void> {
		const checkpoint = await this.progressTracker.loadCheckpoint();
		if (!checkpoint) return;

		this.logger.info('Resuming from checkpoint', {
			currentClusterId: checkpoint.currentClusterId,
			completedClusters: checkpoint.completedClusters.length
		});

		const currentClusterIndex = detection.clusters.findIndex(
			(c) => c.clusterId === checkpoint.currentClusterId
		);

		if (currentClusterIndex >= 0 && this.currentContext) {
			this.currentContext = {
				...this.currentContext,
				currentClusterIndex
			};
		}

		Object.entries(checkpoint.clusterStatuses).forEach(
			([clusterId, status]) => {
				this.clusterDetector.updateClusterStatus(detection, clusterId, status);
			}
		);
	}

	/**
	 * Build the final tag execution result
	 */
	private buildTagResult(
		tag: string,
		sequencerResult: ClusterSequencerResult,
		progress: ExecutionProgress,
		startTime: Date,
		endTime: Date,
		duration: number
	): TagExecutionResult {
		const result: TagExecutionResult = {
			tag,
			success: sequencerResult.success,
			totalClusters: sequencerResult.totalClusters,
			completedClusters: sequencerResult.completedClusters,
			failedClusters: sequencerResult.failedClusters,
			blockedClusters: sequencerResult.blockedClusters,
			totalTasks: progress.totalTasks,
			completedTasks: progress.completedTasks,
			failedTasks: progress.failedTasks,
			startTime,
			endTime,
			duration,
			sequencerResult
		};

		this.logger.info('Tag execution complete', {
			tag,
			success: result.success,
			completedClusters: result.completedClusters,
			totalClusters: result.totalClusters,
			duration
		});

		return result;
	}

	/**
	 * Execute a single cluster within a tag
	 */
	async executeCluster(
		tag: string,
		clusterId: string,
		detection: ClusterDetectionResult,
		tasks: Task[],
		executor: TaskExecutor,
		options: TagExecutionOptions = {}
	): Promise<void> {
		this.logger.info('Executing cluster in tag context', {
			tag,
			clusterId
		});

		if (!this.progressTracker) {
			this.progressTracker = new ProgressTrackerService(options.checkpointPath);
			await this.progressTracker.initialize(detection);
		}

		await this.clusterSequencer.executeCluster(
			clusterId,
			detection,
			tasks,
			executor,
			options
		);

		if (options.checkpointPath) {
			await this.progressTracker.createCheckpoint(clusterId);
		}

		if (this.currentContext) {
			const clusterIndex = this.currentContext.clusters.findIndex(
				(c) => c.clusterId === clusterId
			);
			if (clusterIndex >= 0) {
				this.currentContext = {
					...this.currentContext,
					currentClusterIndex: clusterIndex + 1
				};
			}
		}
	}

	/**
	 * Get current execution context
	 */
	getCurrentContext(): TagExecutionContext | undefined {
		return this.currentContext;
	}

	/**
	 * Get current execution progress
	 */
	getProgress(): ExecutionProgress {
		return this.progressTracker.getProgress();
	}

	/**
	 * Get cluster detection for a tag
	 */
	detectClustersForTag(tag: string, tasks: Task[]): ClusterDetectionResult {
		return this.clusterDetector.detectClusters(tasks, `tag:${tag}`);
	}

	/**
	 * Check if tag is ready to execute (all dependencies satisfied)
	 */
	isTagReady(
		_tag: string,
		dependencies: string[],
		completedTags: Set<string>
	): boolean {
		if (dependencies.length === 0) return true;

		return dependencies.every((dep) => completedTags.has(dep));
	}

	/**
	 * Get next ready cluster in current tag
	 */
	getNextReadyCluster(detection: ClusterDetectionResult) {
		return this.clusterSequencer.getNextReadyCluster(detection);
	}

	/**
	 * Check if all clusters in tag are in a terminal state (done, failed, or blocked)
	 */
	areAllClustersTerminal(detection: ClusterDetectionResult): boolean {
		return this.clusterSequencer.areAllClustersTerminal(detection);
	}

	/**
	 * Stop tag execution
	 */
	async stopExecution(): Promise<void> {
		this.logger.info('Stopping tag execution');

		if (this.currentContext) {
			this.currentContext = {
				...this.currentContext,
				status: 'failed',
				endTime: new Date()
			};
		}

		await this.clusterSequencer.stopAll();
	}

	/**
	 * Create checkpoint at current position
	 */
	async createCheckpoint(): Promise<void> {
		if (this.currentContext && this.currentContext.currentClusterIndex >= 0) {
			const currentCluster =
				this.currentContext.clusters[this.currentContext.currentClusterIndex];
			if (currentCluster) {
				await this.progressTracker.createCheckpoint(currentCluster.clusterId);
			}
		}
	}

	/**
	 * Load checkpoint and restore state
	 */
	async loadCheckpoint(): Promise<boolean> {
		const checkpoint = await this.progressTracker.loadCheckpoint();
		return checkpoint !== null;
	}

	addEventListener(listener: ProgressEventListener): void {
		this.eventListeners.add(listener);
	}

	removeEventListener(listener: ProgressEventListener): void {
		this.eventListeners.delete(listener);
		this.listenerFailureCounts.delete(listener);
	}

	private emitEvent(event: ProgressEventData): void {
		this.eventListeners.forEach((listener) => {
			try {
				listener(event);
				this.listenerFailureCounts.delete(listener);
			} catch (error) {
				const count = (this.listenerFailureCounts.get(listener) || 0) + 1;
				this.listenerFailureCounts.set(listener, count);
				if (count >= 3) {
					this.logger.error('Event listener is repeatedly failing', {
						failureCount: count,
						error
					});
				} else {
					this.logger.warn('Error in event listener', { error });
				}
			}
		});
	}

	getClusterDetector(): ClusterDetectionService {
		return this.clusterDetector;
	}

	getClusterSequencer(): ClusterSequencerService {
		return this.clusterSequencer;
	}

	getProgressTracker(): ProgressTrackerService {
		return this.progressTracker;
	}
}
