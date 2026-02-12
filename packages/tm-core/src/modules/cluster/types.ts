/**
 * Cluster execution types
 */

import type { TaskStatus } from '../../common/types/index.js';

/**
 * Cluster lifecycle statuses.
 *
 * State transitions:
 *   pending → ready → in-progress → delivered → done
 *                                  ↘ failed
 *                    ↘ blocked (upstream failure)
 *
 * - `delivered`: PR has been created for this cluster but not yet merged
 * - `done`: PR merged and cluster work is complete
 * - `failed`: Execution failed during this cluster's tasks
 * - `blocked`: Could not start because an upstream cluster failed
 */
export type ClusterStatus =
	| 'pending' // Waiting for upstream clusters
	| 'ready' // All dependencies satisfied
	| 'in-progress' // Currently executing tasks
	| 'delivered' // PR created but not yet merged
	| 'done' // PR merged, cluster work complete
	| 'failed' // Execution failed (distinct from blocked)
	| 'blocked'; // Upstream dependency failed

/**
 * Execution status for tag and project contexts.
 */
export type ExecutionStatus = 'pending' | 'in-progress' | 'done' | 'failed';

/**
 * Cluster metadata
 */
export interface ClusterMetadata {
	/** Unique cluster identifier */
	readonly clusterId: string;
	/** Cluster index in topological order */
	readonly level: number;
	/** Task IDs in this cluster */
	readonly taskIds: readonly string[];
	/** Cluster IDs this cluster depends on */
	readonly upstreamClusters: readonly string[];
	/** Cluster IDs that depend on this cluster */
	readonly downstreamClusters: readonly string[];
	/** Current execution status */
	status: ClusterStatus;
	/** Start time of cluster execution */
	startTime?: Date;
	/** End time of cluster execution */
	endTime?: Date;
	/** Error message if blocked or failed */
	error?: string;
}

/**
 * Cluster detection result
 */
export interface ClusterDetectionResult {
	/** All detected clusters in topological order */
	clusters: ClusterMetadata[];
	/** Total number of clusters */
	totalClusters: number;
	/** Total number of tasks */
	totalTasks: number;
	/** Map of task ID to cluster ID */
	taskToCluster: Map<string, string>;
	/** Whether circular dependencies were detected */
	hasCircularDependencies: boolean;
	/** Circular dependency path if detected */
	circularDependencyPath?: string[];
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
	taskId: string;
	success: boolean;
	startTime: Date;
	endTime: Date;
	duration: number;
	error?: string;
	output?: unknown;
}

/**
 * Cluster execution result
 */
export interface ClusterExecutionResult {
	clusterId: string;
	success: boolean;
	startTime: Date;
	endTime: Date;
	duration: number;
	taskResults: TaskExecutionResult[];
	failedTasks: string[];
	completedTasks: string[];
}

/**
 * Progress event types
 */
export type ProgressEventType =
	| 'cluster:started'
	| 'cluster:completed'
	| 'cluster:failed'
	| 'cluster:blocked'
	| 'tag:blocked'
	| 'task:started'
	| 'task:completed'
	| 'task:failed'
	| 'progress:updated'
	| 'execution:started'
	| 'execution:completed';

/**
 * Progress event data
 */
export interface ProgressEventData {
	type: ProgressEventType;
	timestamp: Date;
	clusterId?: string;
	taskId?: string;
	status?: ClusterStatus | TaskStatus;
	progress?: {
		completedTasks: number;
		totalTasks: number;
		completedClusters: number;
		totalClusters: number;
		percentage: number;
	};
	error?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Snapshot of execution progress at a point in time
 */
export interface ProgressSnapshot {
	completedTasks: number;
	totalTasks: number;
	completedClusters: number;
	totalClusters: number;
	percentage: number;
}

/**
 * Progress event listener
 */
export type ProgressEventListener = (event: ProgressEventData) => void;

/**
 * Execution checkpoint for resumability
 */
export interface ExecutionCheckpoint {
	timestamp: Date;
	currentClusterId: string;
	completedClusters: string[];
	completedTasks: string[];
	failedTasks: string[];
	clusterStatuses: Record<string, ClusterStatus>;
	taskStatuses: Record<string, TaskStatus>;
}

/**
 * Tag execution context
 */
export interface TagExecutionContext {
	tag: string;
	clusters: ClusterMetadata[];
	currentClusterIndex: number;
	startTime: Date;
	endTime?: Date;
	status: ExecutionStatus;
	checkpoint?: ExecutionCheckpoint;
}

/**
 * Project execution context
 */
export interface ProjectExecutionContext {
	projectId: string;
	tags: string[];
	currentTagIndex: number;
	tagContexts: Map<string, TagExecutionContext>;
	startTime: Date;
	endTime?: Date;
	status: ExecutionStatus;
}
