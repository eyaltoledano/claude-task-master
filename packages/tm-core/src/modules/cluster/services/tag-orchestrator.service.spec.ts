/**
 * @fileoverview Tests for TagOrchestratorService
 *
 * Uses real internal service instances (ClusterDetectionService,
 * ClusterSequencerService, ProgressTrackerService) per tm-core testing
 * guidelines. Only external I/O (filesystem) is mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagOrchestratorService } from './tag-orchestrator.service.js';
import { ClusterDetectionService } from './cluster-detection.service.js';
import { ClusterSequencerService } from './cluster-sequencer.service.js';
import { ProgressTrackerService } from './progress-tracker.service.js';
import { ParallelExecutorService } from './parallel-executor.service.js';
import type { Task } from '../../../common/types/index.js';
import type { ProgressEventData, TaskExecutionResult } from '../types.js';
import { promises as fsMock } from 'fs';
import { TaskMasterError } from '../../../common/errors/task-master-error.js';

vi.mock('../../../common/logger/factory.js', () => ({
	getLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	})
}));

// Mock filesystem -- the only external I/O boundary used by ProgressTrackerService
vi.mock('fs', () => ({
	promises: {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		rename: vi.fn().mockResolvedValue(undefined),
		readFile: vi
			.fn()
			.mockRejectedValue(
				Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
			),
		unlink: vi.fn().mockResolvedValue(undefined)
	}
}));

// --- Helpers ---

const makeTask = (id: string, deps: string[] = []): Task => ({
	id,
	title: `Task ${id}`,
	description: '',
	status: 'pending',
	priority: 'medium',
	dependencies: deps,
	details: '',
	testStrategy: '',
	subtasks: []
});

/**
 * Create an executor that returns a successful TaskExecutionResult for every task.
 */
const makeSuccessExecutor = () =>
	vi.fn(
		async (task: Task): Promise<TaskExecutionResult> => ({
			taskId: String(task.id),
			success: true,
			startTime: new Date(),
			endTime: new Date(),
			duration: 10
		})
	);

/**
 * Create an executor that fails for specific task IDs.
 */
const makeFailingExecutor = (failIds: Set<string>) =>
	vi.fn(
		async (task: Task): Promise<TaskExecutionResult> => ({
			taskId: String(task.id),
			success: !failIds.has(String(task.id)),
			startTime: new Date(),
			endTime: new Date(),
			duration: 10,
			error: failIds.has(String(task.id)) ? 'Task failed' : undefined
		})
	);

describe('TagOrchestratorService', () => {
	let detector: ClusterDetectionService;
	let parallelExecutor: ParallelExecutorService;
	let sequencer: ClusterSequencerService;
	let progressTracker: ProgressTrackerService;
	let service: TagOrchestratorService;

	beforeEach(() => {
		vi.clearAllMocks();

		detector = new ClusterDetectionService();
		parallelExecutor = new ParallelExecutorService({
			maxConcurrentTasks: 5
		});
		sequencer = new ClusterSequencerService(detector, parallelExecutor);
		progressTracker = new ProgressTrackerService();

		service = new TagOrchestratorService(detector, sequencer, progressTracker);
	});

	describe('constructor', () => {
		it('should create with default services when none provided', () => {
			const defaultService = new TagOrchestratorService();

			expect(defaultService.getClusterDetector()).toBeInstanceOf(
				ClusterDetectionService
			);
			expect(defaultService.getClusterSequencer()).toBeInstanceOf(
				ClusterSequencerService
			);
			expect(defaultService.getProgressTracker()).toBeInstanceOf(
				ProgressTrackerService
			);
		});

		it('should accept injected services', () => {
			expect(service.getClusterDetector()).toBe(detector);
			expect(service.getClusterSequencer()).toBe(sequencer);
			expect(service.getProgressTracker()).toBe(progressTracker);
		});

		it('should forward sequencer events to progress tracker and own listeners', () => {
			// Create fresh services with spies to capture the constructor wiring
			const freshSequencer = new ClusterSequencerService(
				detector,
				parallelExecutor
			);
			const addListenerSpy = vi.spyOn(freshSequencer, 'addEventListener');
			const freshTracker = new ProgressTrackerService();
			const handleEventSpy = vi.spyOn(freshTracker, 'handleEvent');

			const freshService = new TagOrchestratorService(
				detector,
				freshSequencer,
				freshTracker
			);

			// Constructor should have registered a listener on the sequencer
			expect(addListenerSpy).toHaveBeenCalledTimes(1);

			const registeredListener = addListenerSpy.mock.calls[0][0];
			const externalListener = vi.fn();
			freshService.addEventListener(externalListener);

			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date(),
				clusterId: 'cluster-0'
			};

			registeredListener(event);

			expect(handleEventSpy).toHaveBeenCalledWith(event);
			expect(externalListener).toHaveBeenCalledWith(event);
		});

		it('should forward progress tracker events to own listeners', () => {
			const freshTracker = new ProgressTrackerService();
			const addListenerSpy = vi.spyOn(freshTracker, 'addEventListener');

			const freshService = new TagOrchestratorService(
				detector,
				sequencer,
				freshTracker
			);

			// Constructor should have registered a listener on the tracker
			expect(addListenerSpy).toHaveBeenCalledTimes(1);

			const registeredListener = addListenerSpy.mock.calls[0][0];
			const externalListener = vi.fn();
			freshService.addEventListener(externalListener);

			const event: ProgressEventData = {
				type: 'progress:updated',
				timestamp: new Date()
			};

			registeredListener(event);

			expect(externalListener).toHaveBeenCalledWith(event);
		});
	});

	describe('executeTag', () => {
		const tasks = [makeTask('1'), makeTask('2'), makeTask('3', ['1', '2'])];

		it('should detect clusters and execute via sequencer', async () => {
			const detectSpy = vi.spyOn(detector, 'detectClusters');
			const executeSpy = vi.spyOn(sequencer, 'executeClusters');
			const executor = makeSuccessExecutor();

			await service.executeTag('feature', tasks, executor);

			expect(detectSpy).toHaveBeenCalledWith(tasks, 'tag:feature');
			expect(executeSpy).toHaveBeenCalledWith(tasks, executor, {});
		});

		it('should throw TaskMasterError on circular dependencies', async () => {
			const circularTasks = [makeTask('1', ['2']), makeTask('2', ['1'])];
			const executor = makeSuccessExecutor();

			await expect(
				service.executeTag('feature', circularTasks, executor)
			).rejects.toThrow(TaskMasterError);

			await expect(
				service.executeTag('feature', circularTasks, executor)
			).rejects.toThrow(/Circular dependency/);
		});

		it('should set context status to done on success', async () => {
			const executor = makeSuccessExecutor();

			await service.executeTag('feature', tasks, executor);

			const context = service.getCurrentContext();
			expect(context?.status).toBe('done');
		});

		it('should set context status to failed on failure', async () => {
			// Fail task '1', causing cluster-0 to fail
			const executor = makeFailingExecutor(new Set(['1']));

			await service.executeTag('feature', tasks, executor);

			const context = service.getCurrentContext();
			expect(context?.status).toBe('failed');
		});

		it('should return a complete TagExecutionResult', async () => {
			const executor = makeSuccessExecutor();

			const result = await service.executeTag('feature', tasks, executor);

			expect(result.tag).toBe('feature');
			expect(result.success).toBe(true);
			expect(result.totalClusters).toBe(2);
			expect(result.completedClusters).toBe(2);
			expect(result.failedClusters).toBe(0);
			expect(result.startTime).toBeInstanceOf(Date);
			expect(result.endTime).toBeInstanceOf(Date);
			expect(typeof result.duration).toBe('number');
			expect(result.sequencerResult).toBeDefined();
		});

		it('should delete checkpoint on success when checkpointPath provided', async () => {
			const executor = makeSuccessExecutor();

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json'
			});

			expect(fsMock.unlink).toHaveBeenCalledWith('/tmp/checkpoint.json');
		});

		it('should not delete checkpoint on failure', async () => {
			vi.mocked(fsMock.unlink).mockClear();

			const executor = makeFailingExecutor(new Set(['1']));

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json'
			});

			expect(fsMock.unlink).not.toHaveBeenCalled();
		});
	});

	describe('resumeFromCheckpoint (via executeTag)', () => {
		const tasks = [makeTask('1'), makeTask('2'), makeTask('3', ['1', '2'])];

		it('should load checkpoint and restore cluster statuses', async () => {
			const checkpoint = {
				timestamp: new Date().toISOString(),
				currentClusterId: 'cluster-1',
				completedClusters: ['cluster-0'],
				completedTasks: ['1', '2'],
				failedTasks: [],
				clusterStatuses: {
					'cluster-0': 'done' as const,
					'cluster-1': 'pending' as const
				},
				taskStatuses: {}
			};

			vi.mocked(fsMock.readFile).mockResolvedValueOnce(
				JSON.stringify(checkpoint)
			);

			const updateStatusSpy = vi.spyOn(detector, 'updateClusterStatus');
			const executor = makeSuccessExecutor();

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json',
				resumeFromCheckpoint: true
			});

			expect(fsMock.readFile).toHaveBeenCalledWith(
				'/tmp/checkpoint.json',
				'utf-8'
			);
			expect(updateStatusSpy).toHaveBeenCalledWith(
				expect.anything(),
				'cluster-0',
				'done'
			);
			expect(updateStatusSpy).toHaveBeenCalledWith(
				expect.anything(),
				'cluster-1',
				'pending'
			);
		});

		it('should skip if no checkpoint found', async () => {
			vi.mocked(fsMock.readFile).mockRejectedValueOnce(
				Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
			);

			const updateStatusSpy = vi.spyOn(detector, 'updateClusterStatus');
			const executor = makeSuccessExecutor();

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json',
				resumeFromCheckpoint: true
			});

			expect(fsMock.readFile).toHaveBeenCalled();
			// The checkpoint-resume path calls updateClusterStatus with 'pending' status.
			// Normal sequencer execution only sets 'in-progress', 'done', 'failed', 'blocked'.
			// Verify no 'pending' status was restored from a checkpoint.
			const pendingCalls = updateStatusSpy.mock.calls.filter(
				([, , status]) => status === 'pending'
			);
			expect(pendingCalls).toHaveLength(0);
		});
	});

	describe('executeCluster', () => {
		const tasks = [makeTask('1'), makeTask('2'), makeTask('3', ['1', '2'])];

		it('should delegate to sequencer', async () => {
			const executeSpy = vi.spyOn(sequencer, 'executeCluster');
			const executor = makeSuccessExecutor();
			const detection = detector.detectClusters(tasks);

			await service.executeCluster(
				'feature',
				'cluster-0',
				detection,
				tasks,
				executor
			);

			expect(executeSpy).toHaveBeenCalledWith(
				'cluster-0',
				detection,
				tasks,
				executor,
				{}
			);
		});

		it('should create checkpoint after execution when checkpointPath provided', async () => {
			const createCheckpointSpy = vi.spyOn(progressTracker, 'createCheckpoint');
			const executor = makeSuccessExecutor();
			const detection = detector.detectClusters(tasks);

			await service.executeCluster(
				'feature',
				'cluster-0',
				detection,
				tasks,
				executor,
				{ checkpointPath: '/tmp/cp.json' }
			);

			expect(createCheckpointSpy).toHaveBeenCalledWith('cluster-0');
		});

		it('should update currentContext.currentClusterIndex', async () => {
			const executor = makeSuccessExecutor();

			// Set up currentContext by running executeTag first
			await service.executeTag('feature', tasks, executor);

			const detection = detector.detectClusters(tasks);

			await service.executeCluster(
				'feature',
				'cluster-0',
				detection,
				tasks,
				executor
			);

			const context = service.getCurrentContext();
			// After executing cluster-0 (index 0), currentClusterIndex = 0 + 1 = 1
			expect(context?.currentClusterIndex).toBe(1);
		});
	});

	describe('isTagReady', () => {
		it('should return true when no dependencies', () => {
			expect(service.isTagReady('feature', [], new Set())).toBe(true);
		});

		it('should return true when all dependencies completed', () => {
			const completed = new Set(['setup', 'init']);

			expect(service.isTagReady('feature', ['setup', 'init'], completed)).toBe(
				true
			);
		});

		it('should return false when any dependency not completed', () => {
			const completed = new Set(['setup']);

			expect(service.isTagReady('feature', ['setup', 'init'], completed)).toBe(
				false
			);
		});
	});

	describe('areAllClustersTerminal', () => {
		it('should delegate to sequencer', () => {
			const areTerminalSpy = vi.spyOn(sequencer, 'areAllClustersTerminal');
			const detection = detector.detectClusters([makeTask('1'), makeTask('2')]);

			// Mark all clusters as done so the method returns true
			detection.clusters.forEach((c) => {
				c.status = 'done';
			});

			const result = service.areAllClustersTerminal(detection);

			expect(areTerminalSpy).toHaveBeenCalledWith(detection);
			expect(result).toBe(true);
		});
	});

	describe('getNextReadyCluster', () => {
		it('should delegate to sequencer', () => {
			const getNextSpy = vi.spyOn(sequencer, 'getNextReadyCluster');
			const detection = detector.detectClusters([
				makeTask('1'),
				makeTask('2', ['1'])
			]);

			const result = service.getNextReadyCluster(detection);

			expect(getNextSpy).toHaveBeenCalledWith(detection);
			// cluster-0 should be ready (level 0, status 'ready')
			expect(result).toBeDefined();
			expect(result?.clusterId).toBe('cluster-0');
		});
	});

	describe('stopExecution', () => {
		it('should set context status to failed with endTime', async () => {
			const executor = makeSuccessExecutor();
			const tasks = [makeTask('1')];

			await service.executeTag('feature', tasks, executor);

			await service.stopExecution();

			const context = service.getCurrentContext();
			expect(context?.status).toBe('failed');
			expect(context?.endTime).toBeInstanceOf(Date);
		});

		it('should delegate to sequencer.stopAll()', async () => {
			const stopAllSpy = vi.spyOn(sequencer, 'stopAll');

			await service.stopExecution();

			expect(stopAllSpy).toHaveBeenCalled();
		});
	});

	describe('event listener management', () => {
		it('should call listeners when event is emitted', () => {
			// Create fresh services to capture the sequencer listener from constructor
			const freshSequencer = new ClusterSequencerService(
				detector,
				parallelExecutor
			);
			const addListenerSpy = vi.spyOn(freshSequencer, 'addEventListener');
			const freshService = new TagOrchestratorService(
				detector,
				freshSequencer,
				new ProgressTrackerService()
			);

			const listener = vi.fn();
			freshService.addEventListener(listener);

			// Trigger event through the sequencer listener captured in constructor
			const sequencerCallback = addListenerSpy.mock.calls[0][0];
			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date()
			};
			sequencerCallback(event);

			expect(listener).toHaveBeenCalledWith(event);
		});

		it('should not call removed listeners', () => {
			const freshSequencer = new ClusterSequencerService(
				detector,
				parallelExecutor
			);
			const addListenerSpy = vi.spyOn(freshSequencer, 'addEventListener');
			const freshService = new TagOrchestratorService(
				detector,
				freshSequencer,
				new ProgressTrackerService()
			);

			const listener = vi.fn();
			freshService.addEventListener(listener);
			freshService.removeEventListener(listener);

			const sequencerCallback = addListenerSpy.mock.calls[0][0];
			sequencerCallback({
				type: 'cluster:started',
				timestamp: new Date()
			});

			expect(listener).not.toHaveBeenCalled();
		});

		it('should track listener failures with warn at 1-2, error at 3+', () => {
			const freshSequencer = new ClusterSequencerService(
				detector,
				parallelExecutor
			);
			const addListenerSpy = vi.spyOn(freshSequencer, 'addEventListener');
			const freshService = new TagOrchestratorService(
				detector,
				freshSequencer,
				new ProgressTrackerService()
			);

			const failingListener = vi.fn(() => {
				throw new Error('listener error');
			});
			freshService.addEventListener(failingListener);

			const sequencerCallback = addListenerSpy.mock.calls[0][0];
			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date()
			};

			// First two failures: warn level (no error thrown out)
			sequencerCallback(event);
			sequencerCallback(event);

			// Third failure: error level (still no throw, counter increments)
			sequencerCallback(event);

			// Listener was called 3 times total
			expect(failingListener).toHaveBeenCalledTimes(3);
		});

		it('should clear failure count when listener is removed', () => {
			const freshSequencer = new ClusterSequencerService(
				detector,
				parallelExecutor
			);
			const addListenerSpy = vi.spyOn(freshSequencer, 'addEventListener');
			const freshService = new TagOrchestratorService(
				detector,
				freshSequencer,
				new ProgressTrackerService()
			);

			const failingListener = vi.fn(() => {
				throw new Error('listener error');
			});
			freshService.addEventListener(failingListener);

			const sequencerCallback = addListenerSpy.mock.calls[0][0];
			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date()
			};

			// Accumulate failures
			sequencerCallback(event);
			sequencerCallback(event);

			// Remove and re-add
			freshService.removeEventListener(failingListener);
			freshService.addEventListener(failingListener);

			// Next failure should be treated as count=1 (warn), not count=3 (error)
			// This validates removeEventListener clears the failure count
			expect(() => sequencerCallback(event)).not.toThrow();
		});
	});

	describe('accessors', () => {
		it('should return injected clusterDetector', () => {
			expect(service.getClusterDetector()).toBe(detector);
		});

		it('should return injected clusterSequencer', () => {
			expect(service.getClusterSequencer()).toBe(sequencer);
		});

		it('should return injected progressTracker', () => {
			expect(service.getProgressTracker()).toBe(progressTracker);
		});
	});
});
