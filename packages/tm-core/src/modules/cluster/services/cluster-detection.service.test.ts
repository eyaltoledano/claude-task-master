/**
 * @fileoverview Tests for ClusterDetectionService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClusterDetectionService } from './cluster-detection.service.js';
import type { Task } from '../../../common/types/index.js';

describe('ClusterDetectionService', () => {
	let service: ClusterDetectionService;

	beforeEach(() => {
		service = new ClusterDetectionService();
	});

	describe('detectClusters', () => {
		it('should detect single cluster with no dependencies', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(false);
			expect(result.totalClusters).toBe(1);
			expect(result.totalTasks).toBe(2);
			expect(result.clusters).toHaveLength(1);
			expect(result.clusters[0].level).toBe(0);
			expect(result.clusters[0].taskIds).toHaveLength(2);
			expect(result.clusters[0].upstreamClusters).toHaveLength(0);
		});

		it('should detect multiple clusters with simple dependencies', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				},
				{
					id: '3',
					title: 'Task 3',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(false);
			expect(result.totalClusters).toBe(2);
			expect(result.clusters[0].taskIds).toContain('1');
			expect(result.clusters[1].taskIds).toContain('2');
			expect(result.clusters[1].taskIds).toContain('3');
			expect(result.clusters[1].upstreamClusters).toContain('cluster-0');
		});

		it('should detect deep dependency chains', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				},
				{
					id: '3',
					title: 'Task 3',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['2']
				},
				{
					id: '4',
					title: 'Task 4',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['3']
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(false);
			expect(result.totalClusters).toBe(4);
			expect(result.clusters[0].level).toBe(0);
			expect(result.clusters[1].level).toBe(1);
			expect(result.clusters[2].level).toBe(2);
			expect(result.clusters[3].level).toBe(3);
		});

		it('should detect circular dependencies', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['2']
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(true);
			expect(result.circularDependencyPath).toBeDefined();
			expect(result.circularDependencyPath).toContain('1');
			expect(result.circularDependencyPath).toContain('2');
		});

		it('should handle complex dependency graph', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '3',
					title: 'Task 3',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1', '2']
				},
				{
					id: '4',
					title: 'Task 4',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				},
				{
					id: '5',
					title: 'Task 5',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['3', '4']
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(false);
			expect(result.totalClusters).toBe(3);

			// Level 0: tasks 1 and 2
			expect(result.clusters[0].taskIds).toContain('1');
			expect(result.clusters[0].taskIds).toContain('2');

			// Level 1: tasks 3 and 4
			expect(result.clusters[1].taskIds).toContain('3');
			expect(result.clusters[1].taskIds).toContain('4');

			// Level 2: task 5
			expect(result.clusters[2].taskIds).toContain('5');
		});

		it('should handle tasks with subtasks', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					subtasks: [
						{
							id: '1',
							title: 'Subtask 1.1',
							description: '',
							status: 'pending',
							priority: 'medium',
							dependencies: []
						},
						{
							id: '2',
							title: 'Subtask 1.2',
							description: '',
							status: 'pending',
							priority: 'medium',
							dependencies: ['1']
						}
					]
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(false);
			expect(result.totalClusters).toBe(2);
			expect(result.taskToCluster.get('1.1')).toBe('cluster-0');
			expect(result.taskToCluster.get('1.2')).toBe('cluster-1');
		});

		it('should skip missing dependencies', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['999'] // Non-existent dependency
				}
			];

			const result = service.detectClusters(tasks);

			expect(result.hasCircularDependencies).toBe(false);
			expect(result.totalClusters).toBe(1);
			expect(result.clusters[0].taskIds).toContain('1');
		});
	});

	describe('caching', () => {
		it('should cache results with key', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				}
			];

			const result1 = service.detectClusters(tasks, 'cache-key');
			const result2 = service.detectClusters(tasks, 'cache-key');

			expect(result1).toBe(result2); // Same object reference
		});

		it('should invalidate cache', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				}
			];

			const result1 = service.detectClusters(tasks, 'cache-key');
			service.invalidateCache('cache-key');
			const result2 = service.detectClusters(tasks, 'cache-key');

			expect(result1).not.toBe(result2); // Different object references
		});
	});

	describe('cluster operations', () => {
		it('should get cluster by ID', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				}
			];

			const result = service.detectClusters(tasks);
			const cluster = service.getCluster(result, 'cluster-0');

			expect(cluster).toBeDefined();
			expect(cluster?.clusterId).toBe('cluster-0');
		});

		it('should get cluster tasks', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				}
			];

			const result = service.detectClusters(tasks);
			const clusterTasks = service.getClusterTasks(
				result,
				'cluster-0',
				tasks
			);

			expect(clusterTasks).toHaveLength(2);
		});

		it('should check cluster readiness', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				}
			];

			const result = service.detectClusters(tasks);

			// First cluster should be ready
			expect(
				service.isClusterReady(result.clusters[0], result)
			).toBe(true);

			// Second cluster should not be ready yet
			expect(
				service.isClusterReady(result.clusters[1], result)
			).toBe(false);

			// Mark first cluster as done
			service.updateClusterStatus(result, 'cluster-0', 'done');

			// Now second cluster should be ready
			expect(
				service.isClusterReady(result.clusters[1], result)
			).toBe(true);
		});

		it('should update cluster status', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				}
			];

			const result = service.detectClusters(tasks);
			const cluster = result.clusters[0];

			expect(cluster.status).toBe('ready');

			service.updateClusterStatus(result, 'cluster-0', 'in-progress');
			expect(cluster.status).toBe('in-progress');
			expect(cluster.startTime).toBeDefined();

			service.updateClusterStatus(result, 'cluster-0', 'done');
			expect(cluster.status).toBe('done');
			expect(cluster.endTime).toBeDefined();
		});

		it('should block downstream clusters on failure', () => {
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['1']
				},
				{
					id: '3',
					title: 'Task 3',
					description: '',
					status: 'pending',
					priority: 'medium',
					dependencies: ['2']
				}
			];

			const result = service.detectClusters(tasks);

			// Block first cluster
			service.updateClusterStatus(result, 'cluster-0', 'blocked');

			// All downstream clusters should be blocked
			expect(result.clusters[1].status).toBe('blocked');
			expect(result.clusters[2].status).toBe('blocked');
		});
	});
});
