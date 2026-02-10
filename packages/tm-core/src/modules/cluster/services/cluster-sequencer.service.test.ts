/**
 * @fileoverview Tests for ClusterSequencerService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClusterSequencerService } from './cluster-sequencer.service.js';
import { ClusterDetectionService } from './cluster-detection.service.js';
import { ParallelExecutorService } from './parallel-executor.service.js';
import type { Task } from '../../../common/types/index.js';

describe('ClusterSequencerService', () => {
	let service: ClusterSequencerService;

	beforeEach(() => {
		service = new ClusterSequencerService();
	});

	describe('executeClusters', () => {
		it('should execute clusters in sequence', async () => {
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

			const result = await service.executeClusters(tasks, executor);

			expect(result.success).toBe(true);
			expect(result.completedClusters).toBe(2);
			expect(result.failedClusters).toBe(0);
			expect(executionOrder[0]).toBe('1'); // Task 1 executed first
			expect(executionOrder[1]).toBe('2'); // Task 2 executed second
		});

		it('should stop on cluster failure by default', async () => {
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

			const result = await service.executeClusters(tasks, executor);

			expect(result.success).toBe(false);
			expect(result.completedClusters).toBe(0);
			expect(result.failedClusters).toBe(1);
			expect(result.blockedClusters).toBe(1); // Second cluster blocked
		});

		it('should continue on failure when configured', async () => {
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
					dependencies: ['1']
				}
			];

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

			const result = await service.executeClusters(tasks, executor, {
				continueOnFailure: true
			});

			expect(result.failedClusters).toBe(1);
			expect(result.completedClusters).toBe(1); // Task 2 still completed
			expect(result.blockedClusters).toBe(1); // Task 3 blocked
		});

		it('should detect circular dependencies', async () => {
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

			const executor = vi.fn();

			await expect(
				service.executeClusters(tasks, executor)
			).rejects.toThrow('Circular dependency');

			expect(executor).not.toHaveBeenCalled();
		});

		it('should retry failed clusters', async () => {
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

			let attemptCount = 0;
			const executor = vi.fn(async (task: Task) => {
				attemptCount++;
				if (attemptCount < 3) {
					return {
						taskId: String(task.id),
						success: false,
						startTime: new Date(),
						endTime: new Date(),
						duration: 10,
						error: 'Temporary failure'
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

			const result = await service.executeClusters(tasks, executor, {
				maxRetries: 2
			});

			expect(result.success).toBe(true);
			expect(attemptCount).toBe(3); // Initial attempt + 2 retries
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

			await service.executeClusters(tasks, executor);

			expect(events).toContain('progress:updated');
		});
	});

	describe('executeCluster', () => {
		it('should execute a single cluster', async () => {
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

			const detector = new ClusterDetectionService();
			const detection = detector.detectClusters(tasks);

			const executor = vi.fn(async (task: Task) => {
				return {
					taskId: String(task.id),
					success: true,
					startTime: new Date(),
					endTime: new Date(),
					duration: 10
				};
			});

			const result = await service.executeCluster(
				'cluster-0',
				detection,
				tasks,
				executor
			);

			expect(result.success).toBe(true);
			expect(result.completedTasks).toContain('1');
		});

		it('should throw if cluster not found', async () => {
			const tasks: Task[] = [];
			const detector = new ClusterDetectionService();
			const detection = detector.detectClusters(tasks);

			const executor = vi.fn();

			await expect(
				service.executeCluster('invalid-id', detection, tasks, executor)
			).rejects.toThrow('Cluster not found');
		});

		it('should throw if cluster not ready', async () => {
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

			const detector = new ClusterDetectionService();
			const detection = detector.detectClusters(tasks);

			const executor = vi.fn();

			// Try to execute second cluster before first is done
			await expect(
				service.executeCluster('cluster-1', detection, tasks, executor)
			).rejects.toThrow('Cluster not ready');
		});
	});

	describe('getNextReadyCluster', () => {
		it('should return next ready cluster', () => {
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

			const detector = new ClusterDetectionService();
			const detection = detector.detectClusters(tasks);

			const nextCluster = service.getNextReadyCluster(detection);

			expect(nextCluster).toBeDefined();
			expect(nextCluster?.clusterId).toBe('cluster-0');
		});
	});

	describe('getProgress', () => {
		it('should return execution progress', () => {
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

			const detector = new ClusterDetectionService();
			const detection = detector.detectClusters(tasks);

			detector.updateClusterStatus(detection, 'cluster-0', 'done');

			const progress = service.getProgress(detection);

			expect(progress.completedClusters).toBe(1);
			expect(progress.totalClusters).toBe(1);
			expect(progress.percentage).toBe(100);
		});
	});

	describe('stopAll', () => {
		it('should stop all cluster execution', async () => {
			await service.stopAll();
			// Should not throw
		});
	});
});
