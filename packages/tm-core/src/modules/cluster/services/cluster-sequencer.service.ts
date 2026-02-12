/**
 * @fileoverview Cluster Sequencer Service
 * Orchestrates sequential execution of clusters while respecting dependencies
 */

import type { Task } from '../../../common/types/index.js';
import type {
	ClusterDetectionResult,
	ClusterMetadata,
	ClusterExecutionResult,
	ProgressEventListener,
	ProgressEventData
} from '../types.js';
import { ClusterDetectionService } from './cluster-detection.service.js';
import {
	ParallelExecutorService,
	type ResourceConstraints,
	type TaskExecutor
} from './parallel-executor.service.js';
import { getLogger } from '../../../common/logger/factory.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';

/**
 * Cluster execution options
 */
export interface ClusterExecutionOptions {
	/** Resource constraints for parallel execution */
	resourceConstraints?: ResourceConstraints;
	/** Skip failed clusters and continue with independent clusters */
	continueOnFailure?: boolean;
	/** Maximum retry attempts per cluster */
	maxRetries?: number;
}

/**
 * Cluster sequencer result
 */
export interface ClusterSequencerResult {
	success: boolean;
	totalClusters: number;
	completedClusters: number;
	failedClusters: number;
	blockedClusters: number;
	clusterResults: ClusterExecutionResult[];
	startTime: Date;
	endTime: Date;
	duration: number;
}

/**
 * ClusterSequencerService orchestrates cluster-to-cluster transitions
 */
export class ClusterSequencerService {
	private logger = getLogger('ClusterSequencerService');
	private clusterDetector: ClusterDetectionService;
	private parallelExecutor: ParallelExecutorService;
	private eventListeners: Set<ProgressEventListener> = new Set();
	private listenerFailureCounts: Map<ProgressEventListener, number> = new Map();

	constructor(
		clusterDetector?: ClusterDetectionService,
		parallelExecutor?: ParallelExecutorService
	) {
		this.clusterDetector = clusterDetector || new ClusterDetectionService();
		this.parallelExecutor = parallelExecutor || new ParallelExecutorService();

		this.parallelExecutor.addEventListener((event) => {
			this.emitEvent(event);
		});
	}

	/**
	 * Execute all clusters in sequence
	 */
	async executeClusters(
		tasks: Task[],
		executor: TaskExecutor,
		options: ClusterExecutionOptions = {}
	): Promise<ClusterSequencerResult> {
		this.logger.info('Starting cluster sequence execution', {
			taskCount: tasks.length
		});

		const startTime = new Date();

		if (options.resourceConstraints) {
			this.parallelExecutor.updateConstraints(options.resourceConstraints);
		}

		const detection = this.clusterDetector.detectClusters(tasks);

		if (detection.hasCircularDependencies) {
			throw new TaskMasterError(
				`Circular dependency detected: ${detection.circularDependencyPath?.join(' -> ')}`,
				ERROR_CODES.VALIDATION_ERROR,
				{
					operation: 'executeClusters',
					circularPath: detection.circularDependencyPath
				}
			);
		}

		const clusterResults: ClusterExecutionResult[] = [];
		let completedClusters = 0;
		let failedClusters = 0;
		let blockedClusters = 0;

		for (const cluster of detection.clusters) {
			if (!this.clusterDetector.isClusterReady(cluster, detection)) {
				this.logger.warn('Cluster not ready, skipping', {
					clusterId: cluster.clusterId,
					status: cluster.status
				});

				if (cluster.status === 'blocked') {
					blockedClusters++;
				}
				continue;
			}

			this.clusterDetector.updateClusterStatus(
				detection,
				cluster.clusterId,
				'in-progress'
			);

			const clusterTasks = this.clusterDetector.getClusterTasks(
				detection,
				cluster.clusterId,
				tasks
			);

			this.logger.info('Executing cluster', {
				clusterId: cluster.clusterId,
				level: cluster.level,
				taskCount: clusterTasks.length
			});

			let result: ClusterExecutionResult | null = null;
			let attempts = 0;
			const maxRetries = options.maxRetries || 0;

			while (attempts <= maxRetries) {
				try {
					result = await this.parallelExecutor.executeCluster(
						cluster,
						clusterTasks,
						executor
					);

					if (result.success) {
						break;
					}

					attempts++;
					if (attempts <= maxRetries) {
						this.logger.warn('Cluster execution failed, retrying', {
							clusterId: cluster.clusterId,
							attempt: attempts,
							maxRetries
						});
					}
				} catch (error) {
					attempts++;
					this.logger.error('Cluster execution error', {
						clusterId: cluster.clusterId,
						attempt: attempts,
						error
					});

					if (attempts > maxRetries) {
						throw error;
					}
				}
			}

			if (!result) {
				throw new TaskMasterError(
					`Cluster execution failed: ${cluster.clusterId}`,
					ERROR_CODES.EXECUTION_ERROR
				);
			}

			clusterResults.push(result);

			if (result.success) {
				this.clusterDetector.updateClusterStatus(
					detection,
					cluster.clusterId,
					'done'
				);
				completedClusters++;

				this.logger.info('Cluster completed successfully', {
					clusterId: cluster.clusterId,
					duration: result.duration
				});
			} else {
				this.clusterDetector.updateClusterStatus(
					detection,
					cluster.clusterId,
					'failed'
				);
				failedClusters++;

				this.logger.error('Cluster failed', {
					clusterId: cluster.clusterId,
					failedTasks: result.failedTasks
				});

				if (!options.continueOnFailure) {
					this.logger.info('Stopping execution due to cluster failure');
					break;
				}
			}

			this.emitEvent({
				type: 'progress:updated',
				timestamp: new Date(),
				progress: {
					completedTasks: clusterResults.reduce(
						(sum, r) => sum + r.completedTasks.length,
						0
					),
					totalTasks: tasks.length,
					completedClusters,
					totalClusters: detection.totalClusters,
					percentage:
						detection.totalClusters > 0
							? (completedClusters / detection.totalClusters) * 100
							: 0
				}
			});
		}

		blockedClusters = detection.clusters.filter(
			(c) => c.status === 'blocked'
		).length;

		const endTime = new Date();
		const duration = endTime.getTime() - startTime.getTime();
		const success =
			failedClusters === 0 && completedClusters === detection.totalClusters;

		this.logger.info('Cluster sequence execution complete', {
			success,
			totalClusters: detection.totalClusters,
			completedClusters,
			failedClusters,
			blockedClusters,
			duration
		});

		return {
			success,
			totalClusters: detection.totalClusters,
			completedClusters,
			failedClusters,
			blockedClusters,
			clusterResults,
			startTime,
			endTime,
			duration
		};
	}

	/**
	 * Execute a single cluster by ID
	 */
	async executeCluster(
		clusterId: string,
		detection: ClusterDetectionResult,
		tasks: Task[],
		executor: TaskExecutor,
		options: ClusterExecutionOptions = {}
	): Promise<ClusterExecutionResult> {
		const cluster = this.clusterDetector.getCluster(detection, clusterId);
		if (!cluster) {
			throw new TaskMasterError(
				`Cluster not found: ${clusterId}`,
				ERROR_CODES.NOT_FOUND
			);
		}

		if (!this.clusterDetector.isClusterReady(cluster, detection)) {
			throw new TaskMasterError(
				`Cluster not ready: ${clusterId} (status: ${cluster.status})`,
				ERROR_CODES.VALIDATION_ERROR,
				{
					clusterId,
					status: cluster.status,
					upstreamClusters: cluster.upstreamClusters
				}
			);
		}

		if (options.resourceConstraints) {
			this.parallelExecutor.updateConstraints(options.resourceConstraints);
		}

		this.clusterDetector.updateClusterStatus(
			detection,
			clusterId,
			'in-progress'
		);

		const clusterTasks = this.clusterDetector.getClusterTasks(
			detection,
			clusterId,
			tasks
		);

		const result = await this.parallelExecutor.executeCluster(
			cluster,
			clusterTasks,
			executor
		);

		const finalStatus = result.success ? 'done' : 'blocked';
		this.clusterDetector.updateClusterStatus(detection, clusterId, finalStatus);

		return result;
	}

	/**
	 * Get next ready cluster
	 */
	getNextReadyCluster(
		detection: ClusterDetectionResult
	): ClusterMetadata | null {
		return (
			detection.clusters.find((cluster) =>
				this.clusterDetector.isClusterReady(cluster, detection)
			) || null
		);
	}

	/**
	 * Check if all clusters have reached a terminal state (done, failed, or blocked).
	 * Note: This does NOT mean all clusters succeeded — check individual statuses.
	 */
	areAllClustersTerminal(detection: ClusterDetectionResult): boolean {
		return detection.clusters.every(
			(cluster) =>
				cluster.status === 'done' ||
				cluster.status === 'failed' ||
				cluster.status === 'blocked'
		);
	}

	/**
	 * Get cluster execution progress
	 */
	getProgress(detection: ClusterDetectionResult): {
		completedClusters: number;
		totalClusters: number;
		blockedClusters: number;
		percentage: number;
	} {
		const completedClusters = detection.clusters.filter(
			(c) => c.status === 'done'
		).length;
		const blockedClusters = detection.clusters.filter(
			(c) => c.status === 'blocked'
		).length;

		return {
			completedClusters,
			totalClusters: detection.totalClusters,
			blockedClusters,
			percentage:
				detection.totalClusters > 0
					? (completedClusters / detection.totalClusters) * 100
					: 0
		};
	}

	/**
	 * Stop all cluster execution
	 */
	async stopAll(): Promise<void> {
		this.logger.info('Stopping all cluster execution');
		await this.parallelExecutor.stopAll();
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

	getParallelExecutor(): ParallelExecutorService {
		return this.parallelExecutor;
	}
}
