/**
 * Cluster execution types
 */

import type { Task, TaskStatus } from '../../common/types/index.js';

/**
 * Cluster execution status
 */
export type ClusterStatus =
	| 'pending' // Waiting for upstream clusters
	| 'ready' // All dependencies satisfied
	| 'in-progress' // Currently executing tasks
	| 'delivered' // All tasks complete
	| 'done' // Cluster fully processed
	| 'blocked'; // Upstream dependency failed

/**
 * Cluster metadata
 */
export interface ClusterMetadata {
	/** Unique cluster identifier */
	clusterId: string;
	/** Cluster index in topological order */
	level: number;
	/** Task IDs in this cluster */
	taskIds: string[];
	/** Cluster IDs this cluster depends on */
	upstreamClusters: string[];
	/** Cluster IDs that depend on this cluster */
	downstreamClusters: string[];
	/** Current execution status */
	status: ClusterStatus;
	/** Start time of cluster execution */
	startTime?: Date;
	/** End time of cluster execution */
	endTime?: Date;
	/** Error message if blocked */
	error?: string;
}

/**
 * Task with cluster assignment
 */
export interface TaskWithCluster extends Task {
	clusterId: string;
	clusterLevel: number;
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
	| 'task:started'
	| 'task:completed'
	| 'task:failed'
	| 'progress:updated';

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
	status: 'pending' | 'in-progress' | 'completed' | 'failed';
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
	status: 'pending' | 'in-progress' | 'completed' | 'failed';
}
