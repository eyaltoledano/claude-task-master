/**
 * @fileoverview Progress Tracker Service
 * Real-time progress tracking and persistence for cluster execution
 */

import type { TaskStatus } from '../../../common/types/index.js';
import type {
	ClusterStatus,
	ProgressEventListener,
	ProgressEventData,
	ExecutionCheckpoint,
	ClusterMetadata,
	ClusterDetectionResult
} from '../types.js';
import { getLogger } from '../../../common/logger/factory.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * Task progress state
 */
interface TaskProgress {
	taskId: string;
	status: TaskStatus;
	startTime?: Date;
	endTime?: Date;
	duration?: number;
	error?: string;
	attemptCount: number;
}

/**
 * Cluster progress state
 */
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

/**
 * Overall execution progress
 */
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
	private taskProgress: Map<string, TaskProgress> = new Map();
	private clusterProgress: Map<string, ClusterProgress> = new Map();
	private checkpointPath?: string;
	private startTime: Date;
	private lastProgressUpdate: Date;
	private totalTasks: number = 0;
	private totalClusters: number = 0;

	constructor(checkpointPath?: string) {
		this.checkpointPath = checkpointPath;
		this.startTime = new Date();
		this.lastProgressUpdate = new Date();
	}

	/**
	 * Initialize progress tracking from cluster detection
	 */
	async initialize(detection: ClusterDetectionResult): Promise<void> {
		this.totalClusters = detection.totalClusters;
		this.totalTasks = detection.totalTasks;

		// Initialize cluster progress
		detection.clusters.forEach((cluster) => {
			this.clusterProgress.set(cluster.clusterId, {
				clusterId: cluster.clusterId,
				status: cluster.status,
				completedTasks: 0,
				totalTasks: cluster.taskIds.length,
				failedTasks: 0
			});

			// Initialize task progress
			cluster.taskIds.forEach((taskId) => {
				this.taskProgress.set(taskId, {
					taskId,
					status: 'pending',
					attemptCount: 0
				});
			});
		});

		this.logger.info('Progress tracker initialized', {
			totalClusters: this.totalClusters,
			totalTasks: this.totalTasks
		});
	}

	/**
	 * Handle progress event and update state
	 */
	async handleEvent(event: ProgressEventData): Promise<void> {
		this.lastProgressUpdate = new Date();

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

		// Emit progress update
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

		// Forward original event to listeners
		this.emitEvent(event);
	}

	/**
	 * Handle cluster started event
	 */
	private async handleClusterStarted(
		event: ProgressEventData
	): Promise<void> {
		if (!event.clusterId) return;

		const cluster = this.clusterProgress.get(event.clusterId);
		if (cluster) {
			cluster.status = 'in-progress';
			cluster.startTime = event.timestamp;
		}
	}

	/**
	 * Handle cluster completed event
	 */
	private async handleClusterCompleted(
		event: ProgressEventData
	): Promise<void> {
		if (!event.clusterId) return;

		const cluster = this.clusterProgress.get(event.clusterId);
		if (cluster) {
			cluster.status = event.status as ClusterStatus;
			cluster.endTime = event.timestamp;

			if (cluster.startTime) {
				cluster.duration =
					event.timestamp.getTime() - cluster.startTime.getTime();
			}
		}

		// Create checkpoint at cluster boundaries
		if (this.checkpointPath) {
			await this.createCheckpoint(event.clusterId);
		}
	}

	/**
	 * Handle task started event
	 */
	private async handleTaskStarted(event: ProgressEventData): Promise<void> {
		if (!event.taskId) return;

		const task = this.taskProgress.get(event.taskId);
		if (task) {
			task.status = 'in-progress';
			task.startTime = event.timestamp;
			task.attemptCount++;
		}
	}

	/**
	 * Handle task completed event
	 */
	private async handleTaskCompleted(event: ProgressEventData): Promise<void> {
		if (!event.taskId) return;

		const task = this.taskProgress.get(event.taskId);
		if (task) {
			task.status = event.status as TaskStatus;
			task.endTime = event.timestamp;
			task.error = event.error;

			if (task.startTime) {
				task.duration =
					event.timestamp.getTime() - task.startTime.getTime();
			}
		}

		// Update cluster progress
		const clusterId = this.findClusterForTask(event.taskId);
		if (clusterId) {
			const cluster = this.clusterProgress.get(clusterId);
			if (cluster && task) {
				if (task.status === 'done') {
					cluster.completedTasks++;
				} else if (task.status === 'blocked') {
					cluster.failedTasks++;
				}
			}
		}
	}

	/**
	 * Find cluster ID for a task
	 */
	private findClusterForTask(taskId: string): string | undefined {
		for (const [clusterId, cluster] of this.clusterProgress) {
			// Check if any task in cluster progress matches
			let taskCount = 0;
			this.taskProgress.forEach((task) => {
				// Simple heuristic: tasks belong to cluster if we're tracking them
				taskCount++;
			});

			// This is a simplification - in practice, we'd need the cluster detection result
			// For now, return the first in-progress cluster
			if (cluster.status === 'in-progress') {
				return clusterId;
			}
		}
		return undefined;
	}

	/**
	 * Get current execution progress
	 */
	getProgress(): ExecutionProgress {
		const completedClusters = Array.from(this.clusterProgress.values()).filter(
			(c) => c.status === 'done'
		).length;

		const completedTasks = Array.from(this.taskProgress.values()).filter(
			(t) => t.status === 'done'
		).length;

		const failedTasks = Array.from(this.taskProgress.values()).filter(
			(t) => t.status === 'blocked'
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

		// Estimate time remaining based on average task duration
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

	/**
	 * Get task progress
	 */
	getTaskProgress(taskId: string): TaskProgress | undefined {
		return this.taskProgress.get(taskId);
	}

	/**
	 * Get cluster progress
	 */
	getClusterProgress(clusterId: string): ClusterProgress | undefined {
		return this.clusterProgress.get(clusterId);
	}

	/**
	 * Create execution checkpoint
	 */
	async createCheckpoint(clusterId: string): Promise<void> {
		if (!this.checkpointPath) return;

		const completedClusters = Array.from(this.clusterProgress.entries())
			.filter(([_, c]) => c.status === 'done')
			.map(([id, _]) => id);

		const completedTasks = Array.from(this.taskProgress.entries())
			.filter(([_, t]) => t.status === 'done')
			.map(([id, _]) => id);

		const failedTasks = Array.from(this.taskProgress.entries())
			.filter(([_, t]) => t.status === 'blocked')
			.map(([id, _]) => id);

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
			// Ensure directory exists
			await fs.mkdir(dirname(this.checkpointPath), { recursive: true });

			// Write checkpoint atomically (write to temp, then rename)
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
		}
	}

	/**
	 * Load checkpoint
	 */
	async loadCheckpoint(): Promise<ExecutionCheckpoint | null> {
		if (!this.checkpointPath) return null;

		try {
			const content = await fs.readFile(this.checkpointPath, 'utf-8');
			const checkpoint = JSON.parse(content) as ExecutionCheckpoint;

			// Restore progress state
			Object.entries(checkpoint.clusterStatuses).forEach(([id, status]) => {
				const cluster = this.clusterProgress.get(id);
				if (cluster) {
					cluster.status = status;
				}
			});

			Object.entries(checkpoint.taskStatuses).forEach(([id, status]) => {
				const task = this.taskProgress.get(id);
				if (task) {
					task.status = status;
				}
			});

			this.logger.info('Checkpoint loaded', {
				currentClusterId: checkpoint.currentClusterId,
				completedClusters: checkpoint.completedClusters.length,
				completedTasks: checkpoint.completedTasks.length
			});

			return checkpoint;
		} catch (error) {
			this.logger.warn('Failed to load checkpoint', {
				error,
				path: this.checkpointPath
			});
			return null;
		}
	}

	/**
	 * Delete checkpoint
	 */
	async deleteCheckpoint(): Promise<void> {
		if (!this.checkpointPath) return;

		try {
			await fs.unlink(this.checkpointPath);
			this.logger.debug('Checkpoint deleted', {
				path: this.checkpointPath
			});
		} catch (error) {
			// Ignore errors if file doesn't exist
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				this.logger.error('Failed to delete checkpoint', {
					error,
					path: this.checkpointPath
				});
			}
		}
	}

	/**
	 * Add progress event listener
	 */
	addEventListener(listener: ProgressEventListener): void {
		this.eventListeners.add(listener);
	}

	/**
	 * Remove progress event listener
	 */
	removeEventListener(listener: ProgressEventListener): void {
		this.eventListeners.delete(listener);
	}

	/**
	 * Emit progress event to all listeners (non-blocking)
	 */
	private emitEvent(event: ProgressEventData): void {
		this.eventListeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				this.logger.error('Error in event listener', { error });
			}
		});
	}

	/**
	 * Get execution timeline
	 */
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

		// Add task events
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

		// Add cluster events
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
						cluster.status === 'done'
							? 'cluster:completed'
							: 'cluster:failed',
					clusterId: cluster.clusterId,
					status: cluster.status
				});
			}
		});

		// Sort by timestamp
		timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		return timeline;
	}

	/**
	 * Reset progress tracking
	 */
	reset(): void {
		this.taskProgress.clear();
		this.clusterProgress.clear();
		this.startTime = new Date();
		this.lastProgressUpdate = new Date();
		this.totalTasks = 0;
		this.totalClusters = 0;
	}
}
