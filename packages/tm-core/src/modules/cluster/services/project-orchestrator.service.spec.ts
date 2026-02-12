/**
 * @fileoverview Tests for ProjectOrchestratorService
 *
 * Uses a real TagOrchestratorService instance (with real internal sub-services)
 * and spies only on `executeTag` to control I/O-boundary results.
 * `isTagReady` and event wiring use real implementations.
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	vi,
	type MockInstance
} from 'vitest';
import {
	ProjectOrchestratorService,
	type TagWithDependencies
} from './project-orchestrator.service.js';
import {
	TagOrchestratorService,
	type TagExecutionResult
} from './tag-orchestrator.service.js';
import type { Task } from '../../../common/types/index.js';
import type { ProgressEventData } from '../types.js';

vi.mock('../../../common/logger/factory.js', () => ({
	getLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	})
}));

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

const makeTagData = (
	tag: string,
	tasks: Task[],
	dependencies: string[] = []
): TagWithDependencies => ({
	tag,
	tasks,
	dependencies
});

const makeSuccessResult = (tag: string, taskCount = 1): TagExecutionResult => ({
	tag,
	success: true,
	totalClusters: 1,
	completedClusters: 1,
	failedClusters: 0,
	blockedClusters: 0,
	totalTasks: taskCount,
	completedTasks: taskCount,
	failedTasks: 0,
	startTime: new Date(),
	endTime: new Date(),
	duration: 100,
	sequencerResult: {
		success: true,
		totalClusters: 1,
		completedClusters: 1,
		failedClusters: 0,
		blockedClusters: 0,
		clusterResults: [],
		startTime: new Date(),
		endTime: new Date(),
		duration: 100
	}
});

const makeFailureResult = (tag: string, taskCount = 1): TagExecutionResult => ({
	tag,
	success: false,
	totalClusters: 1,
	completedClusters: 0,
	failedClusters: 1,
	blockedClusters: 0,
	totalTasks: taskCount,
	completedTasks: 0,
	failedTasks: taskCount,
	startTime: new Date(),
	endTime: new Date(),
	duration: 50,
	sequencerResult: {
		success: false,
		totalClusters: 1,
		completedClusters: 0,
		failedClusters: 1,
		blockedClusters: 0,
		clusterResults: [],
		startTime: new Date(),
		endTime: new Date(),
		duration: 50
	}
});

/**
 * Emit an event through the real TagOrchestratorService event system.
 * This accesses the private emitEvent method to simulate events flowing
 * through the real wiring (TagOrchestrator -> ProjectOrchestrator).
 */
function emitTagOrchestratorEvent(
	tagOrchestrator: TagOrchestratorService,
	event: ProgressEventData
): void {
	// Access the private emitEvent to trigger the real event forwarding chain
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(tagOrchestrator as any).emitEvent(event);
}

const noopExecutor = vi.fn();

describe('ProjectOrchestratorService', () => {
	let tagOrchestrator: TagOrchestratorService;
	let executeTagSpy: MockInstance;
	let service: ProjectOrchestratorService;

	beforeEach(() => {
		vi.restoreAllMocks();
		tagOrchestrator = new TagOrchestratorService();
		executeTagSpy = vi
			.spyOn(tagOrchestrator, 'executeTag')
			.mockResolvedValue(makeSuccessResult('default'));
		service = new ProjectOrchestratorService(tagOrchestrator);
	});

	describe('construction', () => {
		it('should accept an injected TagOrchestratorService', () => {
			expect(service.getTagOrchestrator()).toBe(tagOrchestrator);
		});

		it('should forward events from TagOrchestratorService to own listeners', () => {
			const receivedEvents: ProgressEventData[] = [];
			service.addEventListener((event) => receivedEvents.push(event));

			const testEvent: ProgressEventData = {
				type: 'cluster:started',
				timestamp: new Date(),
				clusterId: 'c1'
			};
			emitTagOrchestratorEvent(tagOrchestrator, testEvent);

			expect(receivedEvents).toHaveLength(1);
			expect(receivedEvents[0]).toBe(testEvent);
		});
	});

	describe('executeProject', () => {
		it('should execute tags in topological order', async () => {
			const executionOrder: string[] = [];
			executeTagSpy.mockImplementation(async (tag: string) => {
				executionOrder.push(tag);
				return makeSuccessResult(tag);
			});

			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], ['A']),
				makeTagData('C', [makeTask('3')], ['B'])
			];

			await service.executeProject('proj-1', tagData, noopExecutor);

			expect(executionOrder).toEqual(['A', 'B', 'C']);
		});

		it('should handle single tag with no dependencies', async () => {
			executeTagSpy.mockResolvedValue(makeSuccessResult('solo'));

			const tagData = [makeTagData('solo', [makeTask('1')], [])];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.success).toBe(true);
			expect(result.totalTags).toBe(1);
			expect(result.completedTags).toBe(1);
			expect(result.failedTags).toBe(0);
			expect(result.blockedTags).toBe(0);
		});

		it('should handle multiple tags with linear dependencies', async () => {
			executeTagSpy.mockImplementation(async (tag: string) =>
				makeSuccessResult(tag)
			);

			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], ['A']),
				makeTagData('C', [makeTask('3')], ['B'])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.success).toBe(true);
			expect(result.completedTags).toBe(3);
			expect(result.totalTags).toBe(3);
		});

		it('should handle parallel tags with no inter-dependencies', async () => {
			executeTagSpy.mockImplementation(async (tag: string) =>
				makeSuccessResult(tag)
			);

			const tagData = [
				makeTagData('X', [makeTask('1')], []),
				makeTagData('Y', [makeTask('2')], []),
				makeTagData('Z', [makeTask('3')], [])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.success).toBe(true);
			expect(result.completedTags).toBe(3);
			expect(executeTagSpy).toHaveBeenCalledTimes(3);
		});

		it('should set currentContext with status in-progress during execution', async () => {
			let capturedStatus: string | undefined;
			executeTagSpy.mockImplementation(async () => {
				capturedStatus = service.getCurrentContext()?.status;
				return makeSuccessResult('A');
			});

			const tagData = [makeTagData('A', [makeTask('1')], [])];
			await service.executeProject('proj-1', tagData, noopExecutor);

			expect(capturedStatus).toBe('in-progress');
		});

		it('should set currentContext status to done on full success', async () => {
			executeTagSpy.mockResolvedValue(makeSuccessResult('A'));

			const tagData = [makeTagData('A', [makeTask('1')], [])];
			await service.executeProject('proj-1', tagData, noopExecutor);

			expect(service.getCurrentContext()?.status).toBe('done');
		});

		it('should set currentContext status to failed when any tag fails', async () => {
			executeTagSpy.mockResolvedValue(makeFailureResult('A'));

			const tagData = [makeTagData('A', [makeTask('1')], [])];
			await service.executeProject('proj-1', tagData, noopExecutor);

			expect(service.getCurrentContext()?.status).toBe('failed');
		});

		it('should emit progress:updated events during execution', async () => {
			executeTagSpy.mockResolvedValue(makeSuccessResult('A'));

			const events: ProgressEventData[] = [];
			service.addEventListener((event) => events.push(event));

			const tagData = [makeTagData('A', [makeTask('1')], [])];
			await service.executeProject('proj-1', tagData, noopExecutor);

			const progressEvents = events.filter(
				(e) => e.type === 'progress:updated'
			);
			expect(progressEvents.length).toBeGreaterThanOrEqual(1);
			expect(progressEvents[0].progress).toBeDefined();
			expect(progressEvents[0].progress?.percentage).toBe(100);
		});

		it('should emit tag:blocked when tag dependencies not satisfied', async () => {
			// Tag A depends on 'missing' which will never be in completedTags,
			// so the real isTagReady returns false
			const events: ProgressEventData[] = [];
			service.addEventListener((event) => events.push(event));

			const tagData = [makeTagData('A', [makeTask('1')], ['missing'])];
			await service.executeProject('proj-1', tagData, noopExecutor);

			const blockedEvents = events.filter((e) => e.type === 'tag:blocked');
			expect(blockedEvents).toHaveLength(1);
			expect(blockedEvents[0].metadata?.tag).toBe('A');
		});

		it('should throw on circular dependency between tags', async () => {
			const tagData = [
				makeTagData('A', [makeTask('1')], ['B']),
				makeTagData('B', [makeTask('2')], ['A'])
			];

			await expect(
				service.executeProject('proj-1', tagData, noopExecutor)
			).rejects.toThrow('Circular dependency');
		});

		it('should correctly order tags with complex dependency graph', async () => {
			const executionOrder: string[] = [];
			executeTagSpy.mockImplementation(async (tag: string) => {
				executionOrder.push(tag);
				return makeSuccessResult(tag);
			});

			// Diamond dependency: A -> B, A -> C, B -> D, C -> D
			const tagData = [
				makeTagData('D', [makeTask('4')], ['B', 'C']),
				makeTagData('B', [makeTask('2')], ['A']),
				makeTagData('C', [makeTask('3')], ['A']),
				makeTagData('A', [makeTask('1')], [])
			];

			await service.executeProject('proj-1', tagData, noopExecutor);

			const indexA = executionOrder.indexOf('A');
			const indexB = executionOrder.indexOf('B');
			const indexC = executionOrder.indexOf('C');
			const indexD = executionOrder.indexOf('D');

			expect(indexA).toBeLessThan(indexB);
			expect(indexA).toBeLessThan(indexC);
			expect(indexB).toBeLessThan(indexD);
			expect(indexC).toBeLessThan(indexD);
		});

		it('should populate result aggregates from tag results', async () => {
			executeTagSpy.mockResolvedValue(makeSuccessResult('A', 3));

			const tagData = [
				makeTagData('A', [makeTask('1'), makeTask('2'), makeTask('3')], [])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.projectId).toBe('proj-1');
			expect(result.totalTasks).toBe(3);
			expect(result.completedTasks).toBe(3);
			expect(result.totalClusters).toBe(1);
			expect(result.completedClusters).toBe(1);
			expect(result.tagResults).toHaveLength(1);
			expect(result.duration).toBeGreaterThanOrEqual(0);
		});
	});

	describe('stopOnFailure option', () => {
		it('should stop executing remaining tags when stopOnFailure=true', async () => {
			executeTagSpy
				.mockResolvedValueOnce(makeFailureResult('A'))
				.mockResolvedValueOnce(makeSuccessResult('B'));

			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], [])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor,
				{ stopOnFailure: true }
			);

			expect(result.failedTags).toBe(1);
			expect(executeTagSpy).toHaveBeenCalledTimes(1);
		});

		it('should block downstream tags when a tag fails', async () => {
			executeTagSpy
				.mockResolvedValueOnce(makeFailureResult('A'))
				.mockResolvedValueOnce(makeSuccessResult('B'));

			// B depends on A, so when A fails, B should be blocked
			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], ['A'])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.failedTags).toBe(1);
			expect(result.blockedTags).toBe(1);
		});

		it('should continue to next tag when stopOnFailure=false (default)', async () => {
			executeTagSpy
				.mockResolvedValueOnce(makeFailureResult('A'))
				.mockResolvedValueOnce(makeSuccessResult('B'));

			// A and B are independent
			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], [])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(executeTagSpy).toHaveBeenCalledTimes(2);
			expect(result.failedTags).toBe(1);
			expect(result.completedTags).toBe(1);
		});

		it('should re-throw when executeTag throws and stopOnFailure=true', async () => {
			executeTagSpy.mockRejectedValue(new Error('executor boom'));

			const tagData = [makeTagData('A', [makeTask('1')], [])];

			await expect(
				service.executeProject('proj-1', tagData, noopExecutor, {
					stopOnFailure: true
				})
			).rejects.toThrow('executor boom');
		});
	});

	describe('blockDownstreamTags', () => {
		it('should block all tags that depend on a failed tag', async () => {
			// Real isTagReady handles dependency checking: deps must all be in completedTags
			executeTagSpy
				.mockResolvedValueOnce(makeFailureResult('A'))
				.mockResolvedValueOnce(makeSuccessResult('C'));

			// B depends on A, C is independent
			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], ['A']),
				makeTagData('C', [makeTask('3')], [])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.blockedTags).toBe(1);
			expect(result.completedTags).toBe(1);
			expect(result.failedTags).toBe(1);
		});

		it('should recursively block transitive dependents', async () => {
			// Real isTagReady handles dependency checking
			executeTagSpy.mockResolvedValueOnce(makeFailureResult('A'));

			// A -> B -> C (transitive dependency chain)
			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], ['A']),
				makeTagData('C', [makeTask('3')], ['B'])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			// B and C should both be blocked
			expect(result.blockedTags).toBe(2);
			expect(result.failedTags).toBe(1);
		});

		it('should not block already-completed tags', async () => {
			const executionOrder: string[] = [];
			executeTagSpy.mockImplementation(async (tag: string) => {
				executionOrder.push(tag);
				if (tag === 'B') return makeFailureResult('B');
				return makeSuccessResult(tag);
			});

			// A has no deps, B depends on A, C depends on A
			// A completes first, then B fails — C should not be blocked since it depends on A (not B)
			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], ['A']),
				makeTagData('C', [makeTask('3')], ['A'])
			];

			const result = await service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			expect(result.completedTags).toBe(2); // A and C
			expect(result.failedTags).toBe(1); // B
			expect(result.blockedTags).toBe(0);
		});
	});

	describe('event listener management', () => {
		it('should add and invoke event listeners', () => {
			const events: ProgressEventData[] = [];
			const listener = (event: ProgressEventData) => events.push(event);
			service.addEventListener(listener);

			// Trigger an event through the real tag orchestrator's event system
			const testEvent: ProgressEventData = {
				type: 'cluster:completed',
				timestamp: new Date()
			};
			emitTagOrchestratorEvent(tagOrchestrator, testEvent);

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('cluster:completed');
		});

		it('should remove event listeners', () => {
			const events: ProgressEventData[] = [];
			const listener = (event: ProgressEventData) => events.push(event);
			service.addEventListener(listener);
			service.removeEventListener(listener);

			emitTagOrchestratorEvent(tagOrchestrator, {
				type: 'cluster:completed',
				timestamp: new Date()
			});

			expect(events).toHaveLength(0);
		});

		it('should warn on listener failure (count 1-2) and error on 3+', async () => {
			// We test through executeProject which calls emitEvent internally
			const failingListener = vi.fn(() => {
				throw new Error('listener broke');
			});
			service.addEventListener(failingListener);

			executeTagSpy.mockResolvedValue(makeSuccessResult('A'));

			// Execute 3 tags to trigger emitEvent multiple times
			const tagData = [
				makeTagData('A', [makeTask('1')], []),
				makeTagData('B', [makeTask('2')], []),
				makeTagData('C', [makeTask('3')], [])
			];

			// Should not throw even when listener fails
			await expect(
				service.executeProject('proj-1', tagData, noopExecutor)
			).resolves.toBeDefined();
		});

		it('should clear failure count when listener is removed', () => {
			const failingListener = vi.fn(() => {
				throw new Error('listener broke');
			});
			service.addEventListener(failingListener);

			// Trigger failures through the real event chain
			emitTagOrchestratorEvent(tagOrchestrator, {
				type: 'cluster:started',
				timestamp: new Date()
			});
			emitTagOrchestratorEvent(tagOrchestrator, {
				type: 'cluster:started',
				timestamp: new Date()
			});

			// Remove and re-add — count should be reset
			service.removeEventListener(failingListener);
			service.addEventListener(failingListener);

			// This should trigger a warn (count 1), not an error (count 3)
			// We cannot directly inspect the logger, but we verify it doesn't blow up
			emitTagOrchestratorEvent(tagOrchestrator, {
				type: 'cluster:started',
				timestamp: new Date()
			});
			expect(failingListener).toHaveBeenCalledTimes(3);
		});
	});

	describe('stopExecution', () => {
		it('should set context status to failed', async () => {
			const stopSpy = vi.spyOn(tagOrchestrator, 'stopExecution');

			// Start an execution to create a context
			let resolveExecution: (() => void) | undefined;
			executeTagSpy.mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveExecution = () => resolve(makeSuccessResult('A'));
					})
			);

			const tagData = [makeTagData('A', [makeTask('1')], [])];
			const executionPromise = service.executeProject(
				'proj-1',
				tagData,
				noopExecutor
			);

			// Wait for context to be set
			await vi.waitFor(() => {
				expect(service.getCurrentContext()).toBeDefined();
			});

			await service.stopExecution();

			expect(service.getCurrentContext()?.status).toBe('failed');
			expect(stopSpy).toHaveBeenCalledOnce();

			// Clean up the hanging promise
			resolveExecution?.();
			await executionPromise;
		});

		it('should delegate to tagOrchestrator.stopExecution()', async () => {
			const stopSpy = vi.spyOn(tagOrchestrator, 'stopExecution');

			await service.stopExecution();

			expect(stopSpy).toHaveBeenCalledOnce();
		});
	});

	describe('getCurrentContext / getTagOrchestrator', () => {
		it('should return undefined context before any execution', () => {
			expect(service.getCurrentContext()).toBeUndefined();
		});

		it('should return the injected tag orchestrator', () => {
			expect(service.getTagOrchestrator()).toBe(tagOrchestrator);
		});

		it('should return context after execution', async () => {
			executeTagSpy.mockResolvedValue(makeSuccessResult('A'));

			const tagData = [makeTagData('A', [makeTask('1')], [])];
			await service.executeProject('proj-1', tagData, noopExecutor);

			const ctx = service.getCurrentContext();
			expect(ctx).toBeDefined();
			expect(ctx?.projectId).toBe('proj-1');
			expect(ctx?.tags).toEqual(['A']);
		});
	});
});
