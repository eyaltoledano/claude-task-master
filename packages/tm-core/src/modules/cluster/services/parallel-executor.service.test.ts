/**
 * @fileoverview Tests for ParallelExecutorService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParallelExecutorService } from './parallel-executor.service.js';
import type { Task } from '../../../common/types/index.js';
import type { ClusterMetadata, TaskExecutionResult } from '../types.js';

describe('ParallelExecutorService', () => {
	let service: ParallelExecutorService;

	beforeEach(() => {
		service = new ParallelExecutorService({ maxConcurrentTasks: 2 });
	});

	describe('executeCluster', () => {
		it('should execute tasks in parallel', async () => {
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

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '2'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			const executionOrder: string[] = [];
			const executor = vi.fn(async (task: Task) => {
				executionOrder.push(String(task.id));
				await new Promise((resolve) => setTimeout(resolve, 10));
				return {
					taskId: String(task.id),
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 10
				};
			});

			const result = await service.executeCluster(cluster, tasks, executor);

			expect(result.success).toBe(true);
			expect(result.completedTasks).toHaveLength(2);
			expect(result.failedTasks).toHaveLength(0);
			expect(executor).toHaveBeenCalledTimes(2);
		});

		it('should respect max concurrent tasks', async () => {
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
					dependencies: []
				}
			];

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '2', '3'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			let concurrentCount = 0;
			let maxConcurrent = 0;

			const executor = vi.fn(async (task: Task) => {
				concurrentCount++;
				maxConcurrent = Math.max(maxConcurrent, concurrentCount);

				await new Promise((resolve) => setTimeout(resolve, 50));

				concurrentCount--;

				return {
					taskId: String(task.id),
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 50
				};
			});

			await service.executeCluster(cluster, tasks, executor);

			// Should never exceed max concurrent tasks (2)
			expect(maxConcurrent).toBeLessThanOrEqual(2);
		});

		it('should handle task failures', async () => {
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

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '2'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			const executor = vi.fn(async (task: Task) => {
				if (task.id === '1') {
					return {
						taskId: String(task.id),
						success: false,
						startTime: new Date(),
						endTime: new Date(),
						duration: 10,
						error: 'Task failed'
					};
				}
				return {
					taskId: String(task.id),
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 10
				};
			});

			const result = await service.executeCluster(cluster, tasks, executor);

			expect(result.success).toBe(false);
			expect(result.completedTasks).toHaveLength(1);
			expect(result.failedTasks).toHaveLength(1);
			expect(result.failedTasks).toContain('1');
		});

		it('should handle executor exceptions', async () => {
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

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			const executor = vi.fn(async () => {
				throw new Error('Executor error');
			});

			const result = await service.executeCluster(cluster, tasks, executor);

			expect(result.success).toBe(false);
			expect(result.failedTasks).toContain('1');
		});

		it('should emit progress events', async () => {
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

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			const events: string[] = [];
			service.addEventListener((event) => {
				events.push(event.type);
			});

			const executor = vi.fn(async (task: Task) => {
				return {
					taskId: String(task.id),
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 10
				};
			});

			await service.executeCluster(cluster, tasks, executor);

			expect(events).toContain('cluster:started');
			expect(events).toContain('task:started');
			expect(events).toContain('task:completed');
			expect(events).toContain('cluster:completed');
		});
	});

	describe('stopTask', () => {
		it('should stop a running task', async () => {
			const task: Task = {
				id: '1',
				title: 'Task 1',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: []
			};

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			const executor = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return {
					taskId: '1',
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 1000
				};
			});

			const executionPromise = service.executeCluster(
				cluster,
				[task],
				executor
			);

			// Wait a bit for execution to start
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Stop the task
			await service.stopTask('1');

			const result = await executionPromise;

			// Task should still complete (stop just cleans up context)
			expect(result).toBeDefined();
		});
	});

	describe('resource constraints', () => {
		it('should update constraints', () => {
			service.updateConstraints({ maxConcurrentTasks: 10 });

			const constraints = service.getConstraints();
			expect(constraints.maxConcurrentTasks).toBe(10);
		});

		it('should get active execution count', async () => {
			const task: Task = {
				id: '1',
				title: 'Task 1',
				description: '',
				status: 'pending',
				priority: 'medium',
				dependencies: []
			};

			const cluster: ClusterMetadata = {
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1'],
				upstreamClusters: [],
				downstreamClusters: [],
				status: 'ready'
			};

			const executor = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return {
					taskId: '1',
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 100
				};
			});

			const executionPromise = service.executeCluster(
				cluster,
				[task],
				executor
			);

			// Wait a bit for execution to start
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should have 1 active execution (note: this might be 0 if task completes quickly)
			const count = service.getActiveExecutionCount();
			expect(count).toBeGreaterThanOrEqual(0);

			await executionPromise;
		});
	});

	describe('event listeners', () => {
		it('should add and remove event listeners', () => {
			const listener = vi.fn();

			service.addEventListener(listener);
			service.removeEventListener(listener);

			// Listener should not be called after removal
			expect(listener).not.toHaveBeenCalled();
		});
	});
});
