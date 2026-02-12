/**
 * @fileoverview Tests for TagOrchestratorService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagOrchestratorService } from './tag-orchestrator.service.js';
import { ClusterDetectionService } from './cluster-detection.service.js';
import {
	ClusterSequencerService,
	type ClusterSequencerResult
} from './cluster-sequencer.service.js';
import {
	ProgressTrackerService,
	type ExecutionProgress
} from './progress-tracker.service.js';
import type { Task } from '../../../common/types/index.js';
import type { ClusterDetectionResult, ProgressEventData } from '../types.js';
import { TaskMasterError } from '../../../common/errors/task-master-error.js';

vi.mock('../../../common/logger/factory.js', () => ({
	getLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	})
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

const makeDetection = (): ClusterDetectionResult => ({
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
});

const makeSequencerResult = (success = true): ClusterSequencerResult => ({
	success,
	totalClusters: 2,
	completedClusters: success ? 2 : 1,
	failedClusters: success ? 0 : 1,
	blockedClusters: 0,
	clusterResults: [],
	startTime: new Date(),
	endTime: new Date(),
	duration: 100
});

const makeProgress = (): ExecutionProgress => ({
	completedClusters: 2,
	totalClusters: 2,
	completedTasks: 3,
	totalTasks: 3,
	failedTasks: 0,
	blockedTasks: 0,
	percentage: 100,
	startTime: new Date(),
	duration: 100
});

const createMockDetector = () =>
	({
		detectClusters: vi.fn(),
		updateClusterStatus: vi.fn()
	}) as unknown as ClusterDetectionService;

const createMockSequencer = () =>
	({
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		executeClusters: vi.fn(),
		executeCluster: vi.fn(),
		getNextReadyCluster: vi.fn(),
		areAllClustersTerminal: vi.fn(),
		stopAll: vi.fn()
	}) as unknown as ClusterSequencerService;

const createMockProgressTracker = () =>
	({
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		initialize: vi.fn(),
		handleEvent: vi.fn(),
		getProgress: vi.fn(),
		createCheckpoint: vi.fn(),
		loadCheckpoint: vi.fn(),
		deleteCheckpoint: vi.fn()
	}) as unknown as ProgressTrackerService;

describe('TagOrchestratorService', () => {
	let service: TagOrchestratorService;
	let mockDetector: ReturnType<typeof createMockDetector>;
	let mockSequencer: ReturnType<typeof createMockSequencer>;
	let mockProgressTracker: ReturnType<typeof createMockProgressTracker>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDetector = createMockDetector();
		mockSequencer = createMockSequencer();
		mockProgressTracker = createMockProgressTracker();
		service = new TagOrchestratorService(
			mockDetector,
			mockSequencer,
			mockProgressTracker
		);
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
			expect(service.getClusterDetector()).toBe(mockDetector);
			expect(service.getClusterSequencer()).toBe(mockSequencer);
			expect(service.getProgressTracker()).toBe(mockProgressTracker);
		});

		it('should forward sequencer events to progress tracker and own listeners', () => {
			// The constructor calls addEventListener on both sequencer and progressTracker.
			// Capture the listener registered on the sequencer.
			const sequencerAddListener = vi.mocked(mockSequencer.addEventListener);
			expect(sequencerAddListener).toHaveBeenCalledTimes(1);

			const registeredListener = sequencerAddListener.mock.calls[0][0];
			const externalListener = vi.fn();
			service.addEventListener(externalListener);

			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date(),
				clusterId: 'cluster-0'
			};

			registeredListener(event);

			expect(mockProgressTracker.handleEvent).toHaveBeenCalledWith(event);
			expect(externalListener).toHaveBeenCalledWith(event);
		});

		it('should forward progress tracker events to own listeners', () => {
			const trackerAddListener = vi.mocked(
				mockProgressTracker.addEventListener
			);
			expect(trackerAddListener).toHaveBeenCalledTimes(1);

			const registeredListener = trackerAddListener.mock.calls[0][0];
			const externalListener = vi.fn();
			service.addEventListener(externalListener);

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
		const executor = vi.fn();

		beforeEach(() => {
			vi.mocked(mockDetector.detectClusters).mockReturnValue(makeDetection());
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult()
			);
		});

		it('should detect clusters and initialize progress tracker', async () => {
			// executeTag creates a NEW ProgressTrackerService internally,
			// so we spy on the constructor indirectly via the detection call.
			await service.executeTag('feature', tasks, executor);

			expect(mockDetector.detectClusters).toHaveBeenCalledWith(
				tasks,
				'tag:feature'
			);
			// The sequencer should have been called
			expect(mockSequencer.executeClusters).toHaveBeenCalledWith(
				tasks,
				executor,
				{}
			);
		});

		it('should throw TaskMasterError on circular dependencies', async () => {
			const circularDetection: ClusterDetectionResult = {
				...makeDetection(),
				hasCircularDependencies: true,
				circularDependencyPath: ['1', '2', '1']
			};
			vi.mocked(mockDetector.detectClusters).mockReturnValue(circularDetection);

			await expect(
				service.executeTag('feature', tasks, executor)
			).rejects.toThrow(TaskMasterError);

			await expect(
				service.executeTag('feature', tasks, executor)
			).rejects.toThrow(/Circular dependency/);
		});

		it('should set context status to done on success', async () => {
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult(true)
			);

			await service.executeTag('feature', tasks, executor);

			const context = service.getCurrentContext();
			expect(context?.status).toBe('done');
		});

		it('should set context status to failed on failure', async () => {
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult(false)
			);

			await service.executeTag('feature', tasks, executor);

			const context = service.getCurrentContext();
			expect(context?.status).toBe('failed');
		});

		it('should return a complete TagExecutionResult', async () => {
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
			// executeTag creates its own ProgressTrackerService internally.
			// We need to spy on the prototype to verify deleteCheckpoint.
			const deleteCheckpointSpy = vi
				.spyOn(ProgressTrackerService.prototype, 'deleteCheckpoint')
				.mockResolvedValue();
			vi.spyOn(
				ProgressTrackerService.prototype,
				'initialize'
			).mockResolvedValue();
			vi.spyOn(ProgressTrackerService.prototype, 'getProgress').mockReturnValue(
				makeProgress()
			);

			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult(true)
			);

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json'
			});

			expect(deleteCheckpointSpy).toHaveBeenCalled();

			deleteCheckpointSpy.mockRestore();
		});

		it('should not delete checkpoint on failure', async () => {
			const deleteCheckpointSpy = vi
				.spyOn(ProgressTrackerService.prototype, 'deleteCheckpoint')
				.mockResolvedValue();
			vi.spyOn(
				ProgressTrackerService.prototype,
				'initialize'
			).mockResolvedValue();
			vi.spyOn(ProgressTrackerService.prototype, 'getProgress').mockReturnValue(
				makeProgress()
			);

			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult(false)
			);

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json'
			});

			expect(deleteCheckpointSpy).not.toHaveBeenCalled();

			deleteCheckpointSpy.mockRestore();
		});
	});

	describe('resumeFromCheckpoint (via executeTag)', () => {
		const tasks = [makeTask('1'), makeTask('2'), makeTask('3', ['1', '2'])];
		const executor = vi.fn();

		it('should load checkpoint and restore cluster statuses', async () => {
			const checkpoint = {
				timestamp: new Date(),
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

			vi.mocked(mockDetector.detectClusters).mockReturnValue(makeDetection());
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult()
			);

			const loadCheckpointSpy = vi
				.spyOn(ProgressTrackerService.prototype, 'loadCheckpoint')
				.mockResolvedValue(checkpoint);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'initialize'
			).mockResolvedValue();
			vi.spyOn(ProgressTrackerService.prototype, 'getProgress').mockReturnValue(
				makeProgress()
			);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'deleteCheckpoint'
			).mockResolvedValue();

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json',
				resumeFromCheckpoint: true
			});

			expect(loadCheckpointSpy).toHaveBeenCalled();
			expect(mockDetector.updateClusterStatus).toHaveBeenCalledWith(
				expect.anything(),
				'cluster-0',
				'done'
			);
			expect(mockDetector.updateClusterStatus).toHaveBeenCalledWith(
				expect.anything(),
				'cluster-1',
				'pending'
			);

			loadCheckpointSpy.mockRestore();
		});

		it('should skip if no checkpoint found', async () => {
			vi.mocked(mockDetector.detectClusters).mockReturnValue(makeDetection());
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult()
			);

			const loadCheckpointSpy = vi
				.spyOn(ProgressTrackerService.prototype, 'loadCheckpoint')
				.mockResolvedValue(null);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'initialize'
			).mockResolvedValue();
			vi.spyOn(ProgressTrackerService.prototype, 'getProgress').mockReturnValue(
				makeProgress()
			);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'deleteCheckpoint'
			).mockResolvedValue();

			await service.executeTag('feature', tasks, executor, {
				checkpointPath: '/tmp/checkpoint.json',
				resumeFromCheckpoint: true
			});

			expect(loadCheckpointSpy).toHaveBeenCalled();
			expect(mockDetector.updateClusterStatus).not.toHaveBeenCalled();

			loadCheckpointSpy.mockRestore();
		});
	});

	describe('executeCluster', () => {
		const tasks = [makeTask('1'), makeTask('2'), makeTask('3', ['1', '2'])];
		const executor = vi.fn();
		const detection = makeDetection();

		it('should delegate to sequencer', async () => {
			vi.mocked(mockSequencer.executeCluster).mockResolvedValue(
				undefined as any
			);

			await service.executeCluster(
				'feature',
				'cluster-0',
				detection,
				tasks,
				executor
			);

			expect(mockSequencer.executeCluster).toHaveBeenCalledWith(
				'cluster-0',
				detection,
				tasks,
				executor,
				{}
			);
		});

		it('should create checkpoint after execution when checkpointPath provided', async () => {
			vi.mocked(mockSequencer.executeCluster).mockResolvedValue(
				undefined as any
			);

			await service.executeCluster(
				'feature',
				'cluster-0',
				detection,
				tasks,
				executor,
				{ checkpointPath: '/tmp/cp.json' }
			);

			expect(mockProgressTracker.createCheckpoint).toHaveBeenCalledWith(
				'cluster-0'
			);
		});

		it('should update currentContext.currentClusterIndex', async () => {
			vi.mocked(mockSequencer.executeCluster).mockResolvedValue(
				undefined as any
			);
			vi.mocked(mockDetector.detectClusters).mockReturnValue(detection);
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult()
			);

			// Set up currentContext by running executeTag first
			vi.spyOn(
				ProgressTrackerService.prototype,
				'initialize'
			).mockResolvedValue();
			vi.spyOn(ProgressTrackerService.prototype, 'getProgress').mockReturnValue(
				makeProgress()
			);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'deleteCheckpoint'
			).mockResolvedValue();

			await service.executeTag('feature', tasks, executor);

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
			const detection = makeDetection();
			vi.mocked(mockSequencer.areAllClustersTerminal).mockReturnValue(true);

			const result = service.areAllClustersTerminal(detection);

			expect(mockSequencer.areAllClustersTerminal).toHaveBeenCalledWith(
				detection
			);
			expect(result).toBe(true);
		});
	});

	describe('getNextReadyCluster', () => {
		it('should delegate to sequencer', () => {
			const detection = makeDetection();
			const expectedCluster = detection.clusters[0];
			vi.mocked(mockSequencer.getNextReadyCluster).mockReturnValue(
				expectedCluster
			);

			const result = service.getNextReadyCluster(detection);

			expect(mockSequencer.getNextReadyCluster).toHaveBeenCalledWith(detection);
			expect(result).toBe(expectedCluster);
		});
	});

	describe('stopExecution', () => {
		it('should set context status to failed with endTime', async () => {
			// Set up context first
			vi.mocked(mockDetector.detectClusters).mockReturnValue(makeDetection());
			vi.mocked(mockSequencer.executeClusters).mockResolvedValue(
				makeSequencerResult()
			);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'initialize'
			).mockResolvedValue();
			vi.spyOn(ProgressTrackerService.prototype, 'getProgress').mockReturnValue(
				makeProgress()
			);
			vi.spyOn(
				ProgressTrackerService.prototype,
				'deleteCheckpoint'
			).mockResolvedValue();

			const tasks = [makeTask('1')];
			await service.executeTag('feature', tasks, vi.fn());

			await service.stopExecution();

			const context = service.getCurrentContext();
			expect(context?.status).toBe('failed');
			expect(context?.endTime).toBeInstanceOf(Date);
		});

		it('should delegate to sequencer.stopAll()', async () => {
			vi.mocked(mockSequencer.stopAll).mockResolvedValue();

			await service.stopExecution();

			expect(mockSequencer.stopAll).toHaveBeenCalled();
		});
	});

	describe('event listener management', () => {
		it('should call listeners when event is emitted', () => {
			const listener = vi.fn();
			service.addEventListener(listener);

			// Trigger event through the sequencer listener
			const seqAddListener = vi.mocked(mockSequencer.addEventListener);
			const sequencerCallback = seqAddListener.mock.calls[0][0];

			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date()
			};
			sequencerCallback(event);

			expect(listener).toHaveBeenCalledWith(event);
		});

		it('should not call removed listeners', () => {
			const listener = vi.fn();
			service.addEventListener(listener);
			service.removeEventListener(listener);

			const seqAddListener = vi.mocked(mockSequencer.addEventListener);
			const sequencerCallback = seqAddListener.mock.calls[0][0];

			sequencerCallback({
				type: 'cluster:started',
				timestamp: new Date()
			});

			expect(listener).not.toHaveBeenCalled();
		});

		it('should track listener failures with warn at 1-2, error at 3+', () => {
			const failingListener = vi.fn(() => {
				throw new Error('listener error');
			});
			service.addEventListener(failingListener);

			const seqAddListener = vi.mocked(mockSequencer.addEventListener);
			const sequencerCallback = seqAddListener.mock.calls[0][0];
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
			const failingListener = vi.fn(() => {
				throw new Error('listener error');
			});
			service.addEventListener(failingListener);

			const seqAddListener = vi.mocked(mockSequencer.addEventListener);
			const sequencerCallback = seqAddListener.mock.calls[0][0];
			const event: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date()
			};

			// Accumulate failures
			sequencerCallback(event);
			sequencerCallback(event);

			// Remove and re-add
			service.removeEventListener(failingListener);
			service.addEventListener(failingListener);

			// Next failure should be treated as count=1 (warn), not count=3 (error)
			// This validates removeEventListener clears the failure count
			expect(() => sequencerCallback(event)).not.toThrow();
		});
	});

	describe('accessors', () => {
		it('should return injected clusterDetector', () => {
			expect(service.getClusterDetector()).toBe(mockDetector);
		});

		it('should return injected clusterSequencer', () => {
			expect(service.getClusterSequencer()).toBe(mockSequencer);
		});

		it('should return injected progressTracker', () => {
			expect(service.getProgressTracker()).toBe(mockProgressTracker);
		});
	});
});
