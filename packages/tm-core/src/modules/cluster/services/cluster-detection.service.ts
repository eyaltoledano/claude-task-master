/**
 * @fileoverview Cluster Detection Service
 * Analyzes task dependencies and groups tasks into execution clusters using topological sort
 */

import type { Task } from '../../../common/types/index.js';
import type {
	ClusterDetectionResult,
	ClusterMetadata,
	ClusterStatus
} from '../types.js';
import { getLogger } from '../../../common/logger/factory.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';

/**
 * Internal node for topological sort
 */
interface GraphNode {
	taskId: string;
	dependencies: string[];
	level: number;
	visited: boolean;
	inStack: boolean;
}

/**
 * ClusterDetectionService implements topological sort to detect execution clusters
 */
export class ClusterDetectionService {
	private logger = getLogger('ClusterDetectionService');
	private cache: Map<string, ClusterDetectionResult> = new Map();

	/**
	 * Detect execution clusters from task list
	 * @param tasks - List of tasks with dependencies
	 * @param cacheKey - Optional cache key for result caching
	 * @returns Cluster detection result
	 */
	detectClusters(tasks: Task[], cacheKey?: string): ClusterDetectionResult {
		if (cacheKey && this.cache.has(cacheKey)) {
			this.logger.debug('Returning cached cluster detection result', {
				cacheKey
			});
			return this.cache.get(cacheKey)!;
		}

		this.logger.info('Starting cluster detection', { taskCount: tasks.length });

		const graph = this.buildGraph(tasks);
		const circularPath = this.detectCircularDependencies(graph);
		if (circularPath) {
			return {
				clusters: [],
				totalClusters: 0,
				totalTasks: tasks.length,
				taskToCluster: new Map(),
				hasCircularDependencies: true,
				circularDependencyPath: circularPath
			};
		}

		const levels = this.topologicalSort(graph);
		const clusters = this.createClusters(levels, graph);

		const taskToCluster = new Map<string, string>();
		clusters.forEach((cluster) => {
			cluster.taskIds.forEach((taskId) => {
				taskToCluster.set(taskId, cluster.clusterId);
			});
		});

		const result: ClusterDetectionResult = {
			clusters,
			totalClusters: clusters.length,
			totalTasks: tasks.length,
			taskToCluster,
			hasCircularDependencies: false
		};

		if (cacheKey) {
			this.cache.set(cacheKey, result);
		}

		this.logger.info('Cluster detection complete', {
			totalClusters: result.totalClusters,
			totalTasks: result.totalTasks
		});

		return result;
	}

	/**
	 * Build dependency graph from tasks
	 */
	private buildGraph(tasks: Task[]): Map<string, GraphNode> {
		const graph = new Map<string, GraphNode>();

		tasks.forEach((task) => {
			const taskId = String(task.id);
			graph.set(taskId, {
				taskId,
				dependencies: (task.dependencies || []).map(String),
				level: -1,
				visited: false,
				inStack: false
			});

			if (task.subtasks && task.subtasks.length > 0) {
				task.subtasks.forEach((subtask) => {
					const subtaskId = `${taskId}.${subtask.id}`;
					const subtaskDeps = (subtask.dependencies || []).map((dep) => {
						if (String(dep).includes('.')) {
							return String(dep);
						}
						return `${taskId}.${dep}`;
					});

					graph.set(subtaskId, {
						taskId: subtaskId,
						dependencies: subtaskDeps,
						level: -1,
						visited: false,
						inStack: false
					});
				});
			}
		});

		return graph;
	}

	/**
	 * Detect circular dependencies using DFS
	 * @returns Path of circular dependency if detected, null otherwise
	 */
	private detectCircularDependencies(
		graph: Map<string, GraphNode>
	): string[] | null {
		const path: string[] = [];

		for (const [taskId, node] of graph.entries()) {
			if (!node.visited) {
				const cycle = this.dfsDetectCycle(taskId, graph, path);
				if (cycle) {
					return cycle;
				}
			}
		}

		return null;
	}

	/**
	 * DFS helper for cycle detection
	 */
	private dfsDetectCycle(
		taskId: string,
		graph: Map<string, GraphNode>,
		path: string[]
	): string[] | null {
		const node = graph.get(taskId);
		if (!node) return null;

		if (node.inStack) {
			const cycleStart = path.indexOf(taskId);
			return path.slice(cycleStart).concat([taskId]);
		}

		if (node.visited) return null;

		node.visited = true;
		node.inStack = true;
		path.push(taskId);

		for (const depId of node.dependencies) {
			if (!graph.has(depId)) {
				this.logger.warn(
					`Dependency '${depId}' referenced by task '${taskId}' not found in graph — skipping`
				);
				continue;
			}

			const cycle = this.dfsDetectCycle(depId, graph, path);
			if (cycle) return cycle;
		}

		node.inStack = false;
		path.pop();

		return null;
	}

	/**
	 * Perform topological sort with level assignment
	 * @returns Map of level to task IDs
	 */
	private topologicalSort(
		graph: Map<string, GraphNode>
	): Map<number, string[]> {
		const levels = new Map<number, string[]>();
		const inDegree = new Map<string, number>();

		graph.forEach((node) => {
			inDegree.set(node.taskId, 0);
		});

		graph.forEach((node) => {
			node.dependencies.forEach((depId) => {
				if (graph.has(depId)) {
					inDegree.set(node.taskId, (inDegree.get(node.taskId) || 0) + 1);
				}
			});
		});

		const queue: Array<{ taskId: string; level: number }> = [];
		inDegree.forEach((degree, taskId) => {
			if (degree === 0) {
				queue.push({ taskId, level: 0 });
				const node = graph.get(taskId)!;
				node.level = 0;
			}
		});

		while (queue.length > 0) {
			const { taskId, level } = queue.shift()!;

			if (!levels.has(level)) {
				levels.set(level, []);
			}
			levels.get(level)!.push(taskId);

			graph.forEach((dependent) => {
				if (dependent.dependencies.includes(taskId)) {
					const newInDegree = (inDegree.get(dependent.taskId) || 0) - 1;
					inDegree.set(dependent.taskId, newInDegree);

					if (newInDegree === 0) {
						let maxDepLevel = -1;
						dependent.dependencies.forEach((depId) => {
							const depNode = graph.get(depId);
							if (depNode && depNode.level > maxDepLevel) {
								maxDepLevel = depNode.level;
							}
						});
						const dependentLevel = maxDepLevel + 1;
						dependent.level = dependentLevel;
						queue.push({ taskId: dependent.taskId, level: dependentLevel });
					}
				}
			});
		}

		return levels;
	}

	/**
	 * Create cluster metadata from level assignments
	 */
	private createClusters(
		levels: Map<number, string[]>,
		graph: Map<string, GraphNode>
	): ClusterMetadata[] {
		const clusters: ClusterMetadata[] = [];
		const levelArray = Array.from(levels.keys()).sort((a, b) => a - b);

		levelArray.forEach((level) => {
			const taskIds = levels.get(level) || [];
			const clusterId = `cluster-${level}`;

			const upstreamClusters = new Set<string>();
			taskIds.forEach((taskId) => {
				const node = graph.get(taskId)!;
				node.dependencies.forEach((depId) => {
					const depNode = graph.get(depId);
					if (depNode && depNode.level < level) {
						upstreamClusters.add(`cluster-${depNode.level}`);
					}
				});
			});

			const downstreamClusters = new Set<string>();
			graph.forEach((node) => {
				if (node.level > level) {
					node.dependencies.forEach((depId) => {
						if (taskIds.includes(depId)) {
							downstreamClusters.add(`cluster-${node.level}`);
						}
					});
				}
			});

			let status: ClusterStatus = 'pending';
			if (level === 0) {
				status = 'ready';
			}

			clusters.push({
				clusterId,
				level,
				taskIds,
				upstreamClusters: Array.from(upstreamClusters).sort(),
				downstreamClusters: Array.from(downstreamClusters).sort(),
				status
			});
		});

		return clusters;
	}

	/**
	 * Invalidate cache for a specific key
	 */
	invalidateCache(cacheKey: string): void {
		this.cache.delete(cacheKey);
		this.logger.debug('Cache invalidated', { cacheKey });
	}

	/**
	 * Clear entire cache
	 */
	clearCache(): void {
		this.cache.clear();
		this.logger.debug('All cache cleared');
	}

	/**
	 * Get cluster by ID from detection result
	 */
	getCluster(
		result: ClusterDetectionResult,
		clusterId: string
	): ClusterMetadata | null {
		return result.clusters.find((c) => c.clusterId === clusterId) || null;
	}

	/**
	 * Get tasks in a cluster
	 */
	getClusterTasks(
		result: ClusterDetectionResult,
		clusterId: string,
		allTasks: Task[]
	): Task[] {
		const cluster = this.getCluster(result, clusterId);
		if (!cluster) {
			this.logger.warn(`Cluster not found: ${clusterId}`);
			return [];
		}

		const taskMap = new Map(allTasks.map((t) => [String(t.id), t]));
		return cluster.taskIds
			.map((taskId) => taskMap.get(taskId))
			.filter((t): t is Task => t !== undefined);
	}

	/**
	 * Check if cluster is ready to execute
	 */
	isClusterReady(
		cluster: ClusterMetadata,
		result: ClusterDetectionResult
	): boolean {
		if (cluster.status === 'ready') return true;
		if (cluster.status !== 'pending') return false;

		return cluster.upstreamClusters.every((upstreamId) => {
			const upstream = this.getCluster(result, upstreamId);
			return upstream && upstream.status === 'done';
		});
	}

	/**
	 * Update cluster status
	 */
	updateClusterStatus(
		result: ClusterDetectionResult,
		clusterId: string,
		status: ClusterStatus
	): void {
		const cluster = this.getCluster(result, clusterId);
		if (!cluster) {
			throw new TaskMasterError(
				`Cluster not found: ${clusterId}`,
				ERROR_CODES.NOT_FOUND
			);
		}

		cluster.status = status;

		if (status === 'in-progress' && !cluster.startTime) {
			cluster.startTime = new Date();
		}
		if (
			(status === 'done' || status === 'failed' || status === 'blocked') &&
			!cluster.endTime
		) {
			cluster.endTime = new Date();
		}

		if (status === 'done') {
			cluster.downstreamClusters.forEach((downstreamId) => {
				const downstream = this.getCluster(result, downstreamId);
				if (downstream && this.isClusterReady(downstream, result)) {
					downstream.status = 'ready';
				}
			});
		}

		if (status === 'failed' || status === 'blocked') {
			this.blockDownstreamClusters(result, clusterId);
		}
	}

	/**
	 * Block all downstream clusters recursively
	 */
	private blockDownstreamClusters(
		result: ClusterDetectionResult,
		clusterId: string
	): void {
		const cluster = this.getCluster(result, clusterId);
		if (!cluster) return;

		cluster.downstreamClusters.forEach((downstreamId) => {
			const downstream = this.getCluster(result, downstreamId);
			if (!downstream) {
				this.logger.warn(
					`Downstream cluster not found: ${downstreamId} (referenced by ${clusterId})`
				);
				return;
			}
			if (downstream.status !== 'done') {
				downstream.status = 'blocked';
				downstream.error = `Blocked by upstream cluster: ${clusterId}`;
				this.blockDownstreamClusters(result, downstreamId);
			}
		});
	}
}
