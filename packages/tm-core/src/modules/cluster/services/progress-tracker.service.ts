/**
 * @fileoverview Progress Tracker Service
 * Real-time progress tracking and persistence for cluster execution
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { getLogger } from '../../../common/logger/factory.js';
import type { TaskStatus } from '../../../common/types/index.js';
import type {
	ClusterDetectionResult,
	ClusterStatus,
	ExecutionCheckpoint,
	ProgressEventData,
	ProgressEventListener
} from '../types.js';

interface TaskProgress {
	taskId: string;
	status: TaskStatus;
	startTime?: Date;
	endTime?: Date;
	duration?: number;
	error?: string;
	attemptCount: number;
}

interface ClusterProgress {
	clusterId: string;
	status: ClusterStatus;
	startTime?: Date;
	endTime?: Date;
	duration?: number;
	completedTasks: number;
	totalTasks: number;
	failedTasks: number;
}

export interface ExecutionProgress {
	currentClusterId?: string;
	completedClusters: number;
	totalClusters: number;
	completedTasks: number;
	totalTasks: number;
	failedTasks: number;
	blockedTasks: number;
	percentage: number;
	startTime: Date;
	endTime?: Date;
	duration?: number;
	estimatedTimeRemaining?: number;
}

/**
 * ProgressTrackerService manages real-time progress tracking and persistence
 */
export class ProgressTrackerService {
	private logger = getLogger('ProgressTrackerService');
	private eventListeners: Set<ProgressEventListener> = new Set();
	private listenerFailureCounts: Map<ProgressEventListener, number> = new Map();
	private taskProgress: Map<string, TaskProgress> = new Map();
	private clusterProgress: Map<string, ClusterProgress> = new Map();
	private taskToClusterMap: Map<string, string> = new Map();
	private checkpointPath?: string;
	private startTime: Date;
	private totalTasks: number = 0;
	private totalClusters: number = 0;
	private initialized: boolean = false;

	constructor(checkpointPath?: string) {
		this.checkpointPath = checkpointPath;
		this.startTime = new Date();
	}

	/**
	 * Check whether progress tracking has been initialized with detection data
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Initialize progress tracking from cluster detection
	 */
	async initialize(detection: ClusterDetectionResult): Promise<void> {
		this.totalClusters = detection.totalClusters;
		this.totalTasks = detection.totalTasks;

		detection.clusters.forEach((cluster) => {
			this.clusterProgress.set(cluster.clusterId, {
				clusterId: cluster.clusterId,
				status: cluster.status,
				completedTasks: 0,
				totalTasks: cluster.taskIds.length,
				failedTasks: 0
			});

			cluster.taskIds.forEach((taskId) => {
				this.taskProgress.set(taskId, {
					taskId,
					status: 'pending',
					attemptCount: 0
				});
				this.taskToClusterMap.set(taskId, cluster.clusterId);
			});
		});

		this.initialized = true;

		this.logger.info('Progress tracker initialized', {
			totalClusters: this.totalClusters,
			totalTasks: this.totalTasks
		});
	}

	/**
	 * Handle progress event and update state
	 */
	async handleEvent(event: ProgressEventData): Promise<void> {
		switch (event.type) {
			case 'cluster:started':
				await this.handleClusterStarted(event);
				break;
			case 'cluster:completed':
			case 'cluster:failed':
			case 'cluster:blocked':
				await this.handleClusterCompleted(event);
				break;
			case 'task:started':
				await this.handleTaskStarted(event);
				break;
			case 'task:completed':
			case 'task:failed':
				await this.handleTaskCompleted(event);
				break;
		}

		const progress = this.getProgress();
		this.emitEvent({
			type: 'progress:updated',
			timestamp: new Date(),
			progress: {
				completedTasks: progress.completedTasks,
				totalTasks: progress.totalTasks,
				completedClusters: progress.completedClusters,
				totalClusters: progress.totalClusters,
				percentage: progress.percentage
			}
		});

		this.emitEvent(event);
	}

	private async handleClusterStarted(event: ProgressEventData): Promise<void> {
		if (!event.clusterId) return;

		const cluster = this.clusterProgress.get(event.clusterId);
		if (cluster) {
			this.clusterProgress.set(event.clusterId, {
				...cluster,
				status: 'in-progress',
				startTime: event.timestamp
			});
		}
	}

	private async handleClusterCompleted(
		event: ProgressEventData
	): Promise<void> {
		if (!event.clusterId) return;

		const cluster = this.clusterProgress.get(event.clusterId);
		if (cluster) {
			const duration = cluster.startTime
				? event.timestamp.getTime() - cluster.startTime.getTime()
				: undefined;

			const status = (event.status as ClusterStatus) ?? cluster.status;

			this.clusterProgress.set(event.clusterId, {
				...cluster,
				status,
				endTime: event.timestamp,
				duration
			});
		}

		if (this.checkpointPath) {
			await this.createCheckpoint(event.clusterId);
		}
	}

	private async handleTaskStarted(event: ProgressEventData): Promise<void> {
		if (!event.taskId) return;

		const task = this.taskProgress.get(event.taskId);
		if (task) {
			this.taskProgress.set(event.taskId, {
				...task,
				status: 'in-progress',
				startTime: event.timestamp,
				attemptCount: task.attemptCount + 1
			});
		}
	}

	private async handleTaskCompleted(event: ProgressEventData): Promise<void> {
		if (!event.taskId) return;

		const task = this.taskProgress.get(event.taskId);
		if (task) {
			const duration = task.startTime
				? event.timestamp.getTime() - task.startTime.getTime()
				: undefined;

			const updatedTask: TaskProgress = {
				...task,
				status: event.status as TaskStatus,
				endTime: event.timestamp,
				error: event.error,
				duration
			};
			this.taskProgress.set(event.taskId, updatedTask);

			this.updateClusterFromTask(event.taskId, updatedTask);
		}
	}

	/**
	 * Update cluster counters when a task completes or fails
	 */
	private updateClusterFromTask(taskId: string, task: TaskProgress): void {
		const clusterId = this.findClusterForTask(taskId);
		if (!clusterId) return;

		const cluster = this.clusterProgress.get(clusterId);
		if (!cluster) return;

		const completedDelta = task.status === 'done' ? 1 : 0;
		const failedDelta = ['cancelled', 'failed', 'blocked'].includes(task.status)
			? 1
			: 0;

		this.clusterProgress.set(clusterId, {
			...cluster,
			completedTasks: cluster.completedTasks + completedDelta,
			failedTasks: cluster.failedTasks + failedDelta
		});
	}

	/**
	 * Find cluster ID for a task using pre-built lookup map
	 */
	private findClusterForTask(taskId: string): string | undefined {
		return this.taskToClusterMap.get(taskId);
	}

	getProgress(): ExecutionProgress {
		const completedClusters = Array.from(this.clusterProgress.values()).filter(
			(c) => c.status === 'done'
		).length;

		const completedTasks = Array.from(this.taskProgress.values()).filter(
			(t) => t.status === 'done'
		).length;

		const failedTasks = Array.from(this.taskProgress.values()).filter((t) =>
			['cancelled', 'failed', 'blocked'].includes(t.status)
		).length;

		const blockedTasks = Array.from(this.taskProgress.values()).filter(
			(t) => t.status === 'blocked'
		).length;

		const currentCluster = Array.from(this.clusterProgress.values()).find(
			(c) => c.status === 'in-progress'
		);

		const now = new Date();
		const duration = now.getTime() - this.startTime.getTime();
		const percentage =
			this.totalTasks > 0 ? (completedTasks / this.totalTasks) * 100 : 0;

		let estimatedTimeRemaining: number | undefined;
		if (completedTasks > 0) {
			const avgDuration = duration / completedTasks;
			const remainingTasks = this.totalTasks - completedTasks;
			estimatedTimeRemaining = avgDuration * remainingTasks;
		}

		return {
			currentClusterId: currentCluster?.clusterId,
			completedClusters,
			totalClusters: this.totalClusters,
			completedTasks,
			totalTasks: this.totalTasks,
			failedTasks,
			blockedTasks,
			percentage,
			startTime: this.startTime,
			duration,
			estimatedTimeRemaining
		};
	}

	getTaskProgress(taskId: string): TaskProgress | undefined {
		return this.taskProgress.get(taskId);
	}

	getClusterProgress(clusterId: string): ClusterProgress | undefined {
		return this.clusterProgress.get(clusterId);
	}

	/**
	 * Create execution checkpoint (atomic write via temp file + rename)
	 */
	async createCheckpoint(clusterId: string): Promise<void> {
		if (!this.checkpointPath) return;

		const completedClusters = Array.from(this.clusterProgress.entries())
			.filter(([_, c]) => c.status === 'done')
			.map(([id]) => id);

		const completedTasks = Array.from(this.taskProgress.entries())
			.filter(([_, t]) => t.status === 'done')
			.map(([id]) => id);

		const failedTasks = Array.from(this.taskProgress.entries())
			.filter(([_, t]) => ['cancelled', 'failed', 'blocked'].includes(t.status))
			.map(([id]) => id);

		const clusterStatuses: Record<string, ClusterStatus> = {};
		this.clusterProgress.forEach((cluster, id) => {
			clusterStatuses[id] = cluster.status;
		});

		const taskStatuses: Record<string, TaskStatus> = {};
		this.taskProgress.forEach((task, id) => {
			taskStatuses[id] = task.status;
		});

		const checkpoint: ExecutionCheckpoint = {
			timestamp: new Date(),
			currentClusterId: clusterId,
			completedClusters,
			completedTasks,
			failedTasks,
			clusterStatuses,
			taskStatuses
		};

		try {
			await fs.mkdir(dirname(this.checkpointPath), { recursive: true });

			const tempPath = `${this.checkpointPath}.tmp`;
			await fs.writeFile(
				tempPath,
				JSON.stringify(checkpoint, null, 2),
				'utf-8'
			);
			await fs.rename(tempPath, this.checkpointPath);

			this.logger.debug('Checkpoint created', {
				clusterId,
				path: this.checkpointPath
			});
		} catch (error) {
			this.logger.error('Failed to create checkpoint', {
				error,
				path: this.checkpointPath
			});
			throw error;
		}
	}

	async loadCheckpoint(): Promise<ExecutionCheckpoint | null> {
		if (!this.checkpointPath) return null;

		try {
			const content = await fs.readFile(this.checkpointPath, 'utf-8');
			const checkpoint = JSON.parse(content) as ExecutionCheckpoint;

			// Restore progress state immutably
			Object.entries(checkpoint.clusterStatuses).forEach(([id, status]) => {
				const cluster = this.clusterProgress.get(id);
				if (cluster) {
					this.clusterProgress.set(id, {
						...cluster,
						status
					});
				}
			});

			Object.entries(checkpoint.taskStatuses).forEach(([id, status]) => {
				const task = this.taskProgress.get(id);
				if (task) {
					this.taskProgress.set(id, { ...task, status });
				}
			});

			this.logger.info('Checkpoint loaded', {
				currentClusterId: checkpoint.currentClusterId,
				completedClusters: checkpoint.completedClusters.length,
				completedTasks: checkpoint.completedTasks.length
			});

			return checkpoint;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				this.logger.debug('No checkpoint file found', {
					path: this.checkpointPath
				});
				return null;
			}
			this.logger.error('Failed to load checkpoint', {
				error,
				path: this.checkpointPath
			});
			throw error;
		}
	}

	async deleteCheckpoint(): Promise<void> {
		if (!this.checkpointPath) return;

		try {
			await fs.unlink(this.checkpointPath);
			this.logger.debug('Checkpoint deleted', {
				path: this.checkpointPath
			});
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return; // File already gone, that's fine
			}
			this.logger.error('Failed to delete checkpoint', {
				error,
				path: this.checkpointPath
			});
			throw error;
		}
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

	getTimeline(): Array<{
		timestamp: Date;
		type: string;
		taskId?: string;
		clusterId?: string;
		status: string;
	}> {
		const timeline: Array<{
			timestamp: Date;
			type: string;
			taskId?: string;
			clusterId?: string;
			status: string;
		}> = [];

		this.taskProgress.forEach((task) => {
			if (task.startTime) {
				timeline.push({
					timestamp: task.startTime,
					type: 'task:started',
					taskId: task.taskId,
					status: 'in-progress'
				});
			}
			if (task.endTime) {
				timeline.push({
					timestamp: task.endTime,
					type: task.status === 'done' ? 'task:completed' : 'task:failed',
					taskId: task.taskId,
					status: task.status
				});
			}
		});

		this.clusterProgress.forEach((cluster) => {
			if (cluster.startTime) {
				timeline.push({
					timestamp: cluster.startTime,
					type: 'cluster:started',
					clusterId: cluster.clusterId,
					status: 'in-progress'
				});
			}
			if (cluster.endTime) {
				timeline.push({
					timestamp: cluster.endTime,
					type:
						cluster.status === 'done' ? 'cluster:completed' : 'cluster:failed',
					clusterId: cluster.clusterId,
					status: cluster.status
				});
			}
		});

		timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		return timeline;
	}

	reset(): void {
		this.taskProgress.clear();
		this.clusterProgress.clear();
		this.taskToClusterMap.clear();
		this.startTime = new Date();
		this.totalTasks = 0;
		this.totalClusters = 0;
		this.initialized = false;
	}
}
