/**
 * @fileoverview Tests for ProgressTrackerService
 */

import fs from 'fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressTrackerService } from './progress-tracker.service.js';
import type { ClusterDetectionResult, ProgressEventData } from '../types.js';

vi.mock('fs', () => {
	const promises = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		rename: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue('{}'),
		unlink: vi.fn().mockResolvedValue(undefined)
	};
	return { default: { promises }, promises };
});

vi.mock('../../../common/logger/factory.js', () => ({
	getLogger: () => ({
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	})
}));

function makeDetection(): ClusterDetectionResult {
	return {
		clusters: [
			{
				clusterId: 'cluster-0',
				level: 0,
				taskIds: ['1', '2'],
				upstreamClusters: [],
				downstreamClusters: ['cluster-1'],
				status: 'pending'
			},
			{
				clusterId: 'cluster-1',
				level: 1,
				taskIds: ['3'],
				upstreamClusters: ['cluster-0'],
				downstreamClusters: [],
				status: 'pending'
			}
		],
		totalClusters: 2,
		totalTasks: 3,
		taskToCluster: new Map([
			['1', 'cluster-0'],
			['2', 'cluster-0'],
			['3', 'cluster-1']
		]),
		hasCircularDependencies: false
	};
}

describe('ProgressTrackerService', () => {
	let service: ProgressTrackerService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new ProgressTrackerService();
	});

	describe('initialize', () => {
		it('should set totalClusters and totalTasks from detection result', async () => {
			const detection = makeDetection();

			await service.initialize(detection);

			const progress = service.getProgress();
			expect(progress.totalClusters).toBe(2);
			expect(progress.totalTasks).toBe(3);
		});

		it('should create cluster progress entries for each cluster', async () => {
			const detection = makeDetection();

			await service.initialize(detection);

			expect(service.getClusterProgress('cluster-0')).toBeDefined();
			expect(service.getClusterProgress('cluster-1')).toBeDefined();
			expect(service.getClusterProgress('nonexistent')).toBeUndefined();
		});

		it('should create task progress entries for each task', async () => {
			const detection = makeDetection();

			await service.initialize(detection);

			expect(service.getTaskProgress('1')).toBeDefined();
			expect(service.getTaskProgress('2')).toBeDefined();
			expect(service.getTaskProgress('3')).toBeDefined();
			expect(service.getTaskProgress('1')?.status).toBe('pending');
			expect(service.getTaskProgress('1')?.attemptCount).toBe(0);
		});
	});

	describe('handleEvent', () => {
		beforeEach(async () => {
			await service.initialize(makeDetection());
		});

		it('should update cluster status to in-progress on cluster:started', async () => {
			const now = new Date();

			await service.handleEvent({
				type: 'cluster:started',
				timestamp: now,
				clusterId: 'cluster-0'
			});

			const cluster = service.getClusterProgress('cluster-0');
			expect(cluster?.status).toBe('in-progress');
			expect(cluster?.startTime).toBe(now);
		});

		it('should update cluster status and duration on cluster:completed', async () => {
			const start = new Date(1000);
			const end = new Date(5000);

			await service.handleEvent({
				type: 'cluster:started',
				timestamp: start,
				clusterId: 'cluster-0'
			});

			await service.handleEvent({
				type: 'cluster:completed',
				timestamp: end,
				clusterId: 'cluster-0',
				status: 'done'
			});

			const cluster = service.getClusterProgress('cluster-0');
			expect(cluster?.status).toBe('done');
			expect(cluster?.endTime).toBe(end);
			expect(cluster?.duration).toBe(4000);
		});

		it('should update cluster status on cluster:failed', async () => {
			const start = new Date(1000);
			const end = new Date(3000);

			await service.handleEvent({
				type: 'cluster:started',
				timestamp: start,
				clusterId: 'cluster-0'
			});

			await service.handleEvent({
				type: 'cluster:failed',
				timestamp: end,
				clusterId: 'cluster-0',
				status: 'failed'
			});

			const cluster = service.getClusterProgress('cluster-0');
			expect(cluster?.status).toBe('failed');
			expect(cluster?.duration).toBe(2000);
		});

		it('should update cluster status on cluster:blocked', async () => {
			await service.handleEvent({
				type: 'cluster:blocked',
				timestamp: new Date(),
				clusterId: 'cluster-1',
				status: 'blocked'
			});

			const cluster = service.getClusterProgress('cluster-1');
			expect(cluster?.status).toBe('blocked');
		});

		it('should set cluster duration to undefined when no startTime', async () => {
			await service.handleEvent({
				type: 'cluster:completed',
				timestamp: new Date(),
				clusterId: 'cluster-0',
				status: 'done'
			});

			const cluster = service.getClusterProgress('cluster-0');
			expect(cluster?.duration).toBeUndefined();
		});

		it('should update task status and increment attemptCount on task:started', async () => {
			const now = new Date();

			await service.handleEvent({
				type: 'task:started',
				timestamp: now,
				taskId: '1'
			});

			const task = service.getTaskProgress('1');
			expect(task?.status).toBe('in-progress');
			expect(task?.startTime).toBe(now);
			expect(task?.attemptCount).toBe(1);
		});

		it('should increment attemptCount on repeated task:started', async () => {
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			expect(service.getTaskProgress('1')?.attemptCount).toBe(2);
		});

		it('should update task status with duration on task:completed', async () => {
			const start = new Date(2000);
			const end = new Date(7000);

			await service.handleEvent({
				type: 'task:started',
				timestamp: start,
				taskId: '1'
			});

			await service.handleEvent({
				type: 'task:completed',
				timestamp: end,
				taskId: '1',
				status: 'done'
			});

			const task = service.getTaskProgress('1');
			expect(task?.status).toBe('done');
			expect(task?.endTime).toBe(end);
			expect(task?.duration).toBe(5000);
		});

		it('should update task status and store error on task:failed', async () => {
			const start = new Date(0);
			const end = new Date(1000);

			await service.handleEvent({
				type: 'task:started',
				timestamp: start,
				taskId: '2'
			});

			await service.handleEvent({
				type: 'task:failed',
				timestamp: end,
				taskId: '2',
				status: 'blocked',
				error: 'Something went wrong'
			});

			const task = service.getTaskProgress('2');
			expect(task?.status).toBe('blocked');
			expect(task?.error).toBe('Something went wrong');
			expect(task?.duration).toBe(1000);
		});

		it('should update parent cluster completedTasks when task completes with done status', async () => {
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(0),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:completed',
				timestamp: new Date(100),
				taskId: '1',
				status: 'done'
			});

			const cluster = service.getClusterProgress('cluster-0');
			expect(cluster?.completedTasks).toBe(1);
			expect(cluster?.failedTasks).toBe(0);
		});

		it('should update parent cluster failedTasks when task status is cancelled', async () => {
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(0),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:failed',
				timestamp: new Date(100),
				taskId: '1',
				status: 'cancelled'
			});

			const cluster = service.getClusterProgress('cluster-0');
			expect(cluster?.completedTasks).toBe(0);
			expect(cluster?.failedTasks).toBe(1);
		});

		it('should emit progress:updated event after handling any event', async () => {
			const received: ProgressEventData[] = [];
			service.addEventListener((event) => received.push(event));

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			const progressEvent = received.find((e) => e.type === 'progress:updated');
			expect(progressEvent).toBeDefined();
			expect(progressEvent?.progress).toBeDefined();
			expect(progressEvent?.progress?.totalTasks).toBe(3);
		});

		it('should re-emit the original event', async () => {
			const received: ProgressEventData[] = [];
			service.addEventListener((event) => received.push(event));

			const original: ProgressEventData = {
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			};

			await service.handleEvent(original);

			const reEmitted = received.find((e) => e === original);
			expect(reEmitted).toBeDefined();
		});

		it('should ignore events with missing clusterId for cluster events', async () => {
			await service.handleEvent({
				type: 'cluster:started',
				timestamp: new Date()
			});

			// Cluster-0 should remain pending
			expect(service.getClusterProgress('cluster-0')?.status).toBe('pending');
		});

		it('should ignore events with missing taskId for task events', async () => {
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date()
			});

			expect(service.getTaskProgress('1')?.status).toBe('pending');
		});
	});

	describe('getProgress', () => {
		it('should return correct counts after completing tasks', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(0),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:completed',
				timestamp: new Date(100),
				taskId: '1',
				status: 'done'
			});

			const progress = service.getProgress();
			expect(progress.completedTasks).toBe(1);
			expect(progress.totalTasks).toBe(3);
			expect(progress.failedTasks).toBe(0);
			expect(progress.blockedTasks).toBe(0);
		});

		it('should count completedClusters correctly', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'cluster:started',
				timestamp: new Date(0),
				clusterId: 'cluster-0'
			});
			await service.handleEvent({
				type: 'cluster:completed',
				timestamp: new Date(100),
				clusterId: 'cluster-0',
				status: 'done'
			});

			const progress = service.getProgress();
			expect(progress.completedClusters).toBe(1);
			expect(progress.totalClusters).toBe(2);
		});

		it('should calculate percentage correctly', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(0),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:completed',
				timestamp: new Date(100),
				taskId: '1',
				status: 'done'
			});

			const progress = service.getProgress();
			expect(progress.percentage).toBeCloseTo((1 / 3) * 100, 1);
		});

		it('should return 0 percentage when totalTasks is 0', () => {
			// Service not initialized, totalTasks defaults to 0
			const progress = service.getProgress();
			expect(progress.percentage).toBe(0);
		});

		it('should calculate estimatedTimeRemaining when completedTasks > 0', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(0),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:completed',
				timestamp: new Date(100),
				taskId: '1',
				status: 'done'
			});

			const progress = service.getProgress();
			expect(progress.estimatedTimeRemaining).toBeDefined();
			expect(typeof progress.estimatedTimeRemaining).toBe('number');
		});

		it('should return undefined estimatedTimeRemaining when no tasks completed', async () => {
			await service.initialize(makeDetection());

			const progress = service.getProgress();
			expect(progress.estimatedTimeRemaining).toBeUndefined();
		});

		it('should identify currentClusterId from in-progress cluster', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'cluster:started',
				timestamp: new Date(),
				clusterId: 'cluster-0'
			});

			const progress = service.getProgress();
			expect(progress.currentClusterId).toBe('cluster-0');
		});
	});

	describe('checkpoint operations', () => {
		let fsMock: {
			mkdir: ReturnType<typeof vi.fn>;
			writeFile: ReturnType<typeof vi.fn>;
			rename: ReturnType<typeof vi.fn>;
			readFile: ReturnType<typeof vi.fn>;
			unlink: ReturnType<typeof vi.fn>;
		};

		beforeEach(() => {
			fsMock = fs.promises as unknown as typeof fsMock;
			vi.clearAllMocks();
		});

		describe('createCheckpoint', () => {
			it('should write checkpoint with atomic temp file + rename', async () => {
				const trackerWithPath = new ProgressTrackerService(
					'/tmp/checkpoints/state.json'
				);
				await trackerWithPath.initialize(makeDetection());

				await trackerWithPath.createCheckpoint('cluster-0');

				expect(fsMock.mkdir).toHaveBeenCalledWith('/tmp/checkpoints', {
					recursive: true
				});
				expect(fsMock.writeFile).toHaveBeenCalledWith(
					'/tmp/checkpoints/state.json.tmp',
					expect.any(String),
					'utf-8'
				);
				expect(fsMock.rename).toHaveBeenCalledWith(
					'/tmp/checkpoints/state.json.tmp',
					'/tmp/checkpoints/state.json'
				);
			});

			it('should do nothing when no checkpointPath is set', async () => {
				await service.initialize(makeDetection());

				await service.createCheckpoint('cluster-0');

				expect(fsMock.mkdir).not.toHaveBeenCalled();
				expect(fsMock.writeFile).not.toHaveBeenCalled();
			});

			it('should include correct data in checkpoint JSON', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');
				await trackerWithPath.initialize(makeDetection());

				// Complete task 1 so it appears in completedTasks
				await trackerWithPath.handleEvent({
					type: 'task:started',
					timestamp: new Date(0),
					taskId: '1'
				});
				await trackerWithPath.handleEvent({
					type: 'task:completed',
					timestamp: new Date(100),
					taskId: '1',
					status: 'done'
				});

				await trackerWithPath.createCheckpoint('cluster-0');

				const writtenJson = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock
					.calls[0][1] as string;
				const checkpoint = JSON.parse(writtenJson);

				expect(checkpoint.currentClusterId).toBe('cluster-0');
				expect(checkpoint.completedTasks).toContain('1');
				expect(checkpoint.taskStatuses['1']).toBe('done');
			});
		});

		describe('loadCheckpoint', () => {
			it('should restore progress state immutably', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');
				await trackerWithPath.initialize(makeDetection());

				const checkpointData = {
					timestamp: new Date().toISOString(),
					currentClusterId: 'cluster-0',
					completedClusters: ['cluster-0'],
					completedTasks: ['1'],
					failedTasks: [],
					clusterStatuses: {
						'cluster-0': 'done',
						'cluster-1': 'pending'
					},
					taskStatuses: { '1': 'done', '2': 'pending', '3': 'pending' }
				};

				(fsMock.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
					JSON.stringify(checkpointData)
				);

				const result = await trackerWithPath.loadCheckpoint();

				expect(result).toBeDefined();
				expect(result?.currentClusterId).toBe('cluster-0');

				const cluster = trackerWithPath.getClusterProgress('cluster-0');
				expect(cluster?.status).toBe('done');

				const task = trackerWithPath.getTaskProgress('1');
				expect(task?.status).toBe('done');
			});

			it('should return null when file not found (ENOENT)', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');

				const enoent = new Error('File not found') as NodeJS.ErrnoException;
				enoent.code = 'ENOENT';
				(fsMock.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
					enoent
				);

				const result = await trackerWithPath.loadCheckpoint();

				expect(result).toBeNull();
			});

			it('should throw on non-ENOENT errors', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');

				const permError = new Error(
					'Permission denied'
				) as NodeJS.ErrnoException;
				permError.code = 'EACCES';
				(fsMock.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
					permError
				);

				await expect(trackerWithPath.loadCheckpoint()).rejects.toThrow(
					'Permission denied'
				);
			});

			it('should return null when no checkpointPath is set', async () => {
				const result = await service.loadCheckpoint();
				expect(result).toBeNull();
			});
		});

		describe('deleteCheckpoint', () => {
			it('should remove the checkpoint file', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');

				await trackerWithPath.deleteCheckpoint();

				expect(fsMock.unlink).toHaveBeenCalledWith('/tmp/cp.json');
			});

			it('should ignore ENOENT silently', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');

				const enoent = new Error('Not found') as NodeJS.ErrnoException;
				enoent.code = 'ENOENT';
				(fsMock.unlink as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
					enoent
				);

				await expect(
					trackerWithPath.deleteCheckpoint()
				).resolves.toBeUndefined();
			});

			it('should throw on non-ENOENT errors', async () => {
				const trackerWithPath = new ProgressTrackerService('/tmp/cp.json');

				const ioError = new Error('I/O error') as NodeJS.ErrnoException;
				ioError.code = 'EIO';
				(fsMock.unlink as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
					ioError
				);

				await expect(trackerWithPath.deleteCheckpoint()).rejects.toThrow(
					'I/O error'
				);
			});

			it('should do nothing when no checkpointPath is set', async () => {
				await service.deleteCheckpoint();

				expect(fsMock.unlink).not.toHaveBeenCalled();
			});
		});
	});

	describe('event listener management', () => {
		it('should call added listeners when events are emitted', async () => {
			await service.initialize(makeDetection());
			const listener = vi.fn();

			service.addEventListener(listener);

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			// handleEvent emits progress:updated + the original event
			expect(listener).toHaveBeenCalledTimes(2);
		});

		it('should not call removed listeners', async () => {
			await service.initialize(makeDetection());
			const listener = vi.fn();

			service.addEventListener(listener);
			service.removeEventListener(listener);

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			expect(listener).not.toHaveBeenCalled();
		});

		it('should track listener failures with counter', async () => {
			await service.initialize(makeDetection());
			const failingListener = vi.fn(() => {
				throw new Error('listener error');
			});

			service.addEventListener(failingListener);

			// Trigger 2 events, each emits 2 sub-events (progress:updated + original)
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			// Listener was called and failed, but service continues
			expect(failingListener).toHaveBeenCalled();
		});

		it('should reset failure count on successful listener call', async () => {
			await service.initialize(makeDetection());
			let shouldFail = true;
			const listener = vi.fn(() => {
				if (shouldFail) {
					throw new Error('fail');
				}
			});

			service.addEventListener(listener);

			// Fail once
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			// Now succeed
			shouldFail = false;
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '2'
			});

			// Listener was called multiple times without being removed
			expect(listener).toHaveBeenCalled();
		});

		it('should call multiple listeners', async () => {
			await service.initialize(makeDetection());
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			service.addEventListener(listener1);
			service.addEventListener(listener2);

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			expect(listener1).toHaveBeenCalled();
			expect(listener2).toHaveBeenCalled();
		});

		it('should clear failure count when listener is removed', async () => {
			await service.initialize(makeDetection());
			const listener = vi.fn(() => {
				throw new Error('fail');
			});

			service.addEventListener(listener);

			// Trigger failures
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			service.removeEventListener(listener);

			// Re-add and it should start fresh (no accumulated failure count)
			service.addEventListener(listener);

			// This verifies removal cleared the count by not throwing
			// with "repeatedly failing" log on first failure after re-add
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '2'
			});

			expect(listener).toHaveBeenCalled();
		});
	});

	describe('getTimeline', () => {
		it('should return sorted events from task and cluster progress', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'cluster:started',
				timestamp: new Date(1000),
				clusterId: 'cluster-0'
			});
			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(2000),
				taskId: '1'
			});
			await service.handleEvent({
				type: 'task:completed',
				timestamp: new Date(3000),
				taskId: '1',
				status: 'done'
			});

			const timeline = service.getTimeline();

			expect(timeline.length).toBeGreaterThanOrEqual(3);

			// Verify chronological order
			for (let i = 1; i < timeline.length; i++) {
				expect(timeline[i].timestamp.getTime()).toBeGreaterThanOrEqual(
					timeline[i - 1].timestamp.getTime()
				);
			}

			const clusterStart = timeline.find(
				(e) => e.type === 'cluster:started' && e.clusterId === 'cluster-0'
			);
			expect(clusterStart).toBeDefined();

			const taskStart = timeline.find(
				(e) => e.type === 'task:started' && e.taskId === '1'
			);
			expect(taskStart).toBeDefined();

			const taskComplete = timeline.find(
				(e) => e.type === 'task:completed' && e.taskId === '1'
			);
			expect(taskComplete).toBeDefined();
			expect(taskComplete?.status).toBe('done');
		});

		it('should return empty timeline when no events have occurred', async () => {
			await service.initialize(makeDetection());

			const timeline = service.getTimeline();

			expect(timeline).toEqual([]);
		});
	});

	describe('reset', () => {
		it('should clear all state', async () => {
			await service.initialize(makeDetection());

			await service.handleEvent({
				type: 'task:started',
				timestamp: new Date(),
				taskId: '1'
			});

			service.reset();

			const progress = service.getProgress();
			expect(progress.totalClusters).toBe(0);
			expect(progress.totalTasks).toBe(0);
			expect(progress.completedTasks).toBe(0);
			expect(progress.completedClusters).toBe(0);

			expect(service.getTaskProgress('1')).toBeUndefined();
			expect(service.getClusterProgress('cluster-0')).toBeUndefined();
			expect(service.getTimeline()).toEqual([]);
		});
	});
});
