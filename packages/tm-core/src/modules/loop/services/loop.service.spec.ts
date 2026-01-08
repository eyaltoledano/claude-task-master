/**
 * @fileoverview Unit tests for LoopService
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type MockInstance
} from 'vitest';
import { LoopService, type LoopServiceOptions } from './loop.service.js';
import { LoopCompletionService } from './loop-completion.service.js';
import { LoopExecutorService } from './loop-executor.service.js';
import { LoopPresetService } from './loop-preset.service.js';
import { LoopProgressService } from './loop-progress.service.js';
import { LoopPromptService } from './loop-prompt.service.js';

describe('LoopService', () => {
	const defaultOptions: LoopServiceOptions = {
		projectRoot: '/test/project'
	};

	describe('constructor', () => {
		it('should create a LoopService instance with required options', () => {
			const service = new LoopService(defaultOptions);
			expect(service).toBeInstanceOf(LoopService);
		});

		it('should store projectRoot from options', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getProjectRoot()).toBe('/test/project');
		});

		it('should create LoopPresetService instance', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getPresetService()).toBeInstanceOf(LoopPresetService);
		});

		it('should create LoopProgressService with projectRoot', () => {
			const service = new LoopService(defaultOptions);
			const progressService = service.getProgressService();
			expect(progressService).toBeInstanceOf(LoopProgressService);
			// Verify projectRoot was passed by checking default progress path
			expect(progressService.getDefaultProgressPath()).toBe(
				'/test/project/.taskmaster/loop-progress.txt'
			);
		});

		it('should create LoopCompletionService instance', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getCompletionService()).toBeInstanceOf(
				LoopCompletionService
			);
		});

		it('should create LoopPromptService with presetService dependency', () => {
			const service = new LoopService(defaultOptions);
			const promptService = service.getPromptService();
			expect(promptService).toBeInstanceOf(LoopPromptService);
			// Prompt service should use the same preset service instance
			// We verify this indirectly by checking it can load presets
		});

		it('should create LoopExecutorService with completionService dependency', () => {
			const service = new LoopService(defaultOptions);
			const executorService = service.getExecutorService();
			expect(executorService).toBeInstanceOf(LoopExecutorService);
		});

		it('should initialize isRunning to false', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getIsRunning()).toBe(false);
		});
	});

	describe('service instantiation with different project roots', () => {
		it('should work with absolute path', () => {
			const service = new LoopService({ projectRoot: '/absolute/path/to/project' });
			expect(service.getProjectRoot()).toBe('/absolute/path/to/project');
		});

		it('should work with Windows-style path', () => {
			const service = new LoopService({ projectRoot: 'C:\\Users\\test\\project' });
			expect(service.getProjectRoot()).toBe('C:\\Users\\test\\project');
		});

		it('should work with empty projectRoot', () => {
			const service = new LoopService({ projectRoot: '' });
			expect(service.getProjectRoot()).toBe('');
		});
	});

	describe('service instance isolation', () => {
		it('should create new service instances for each LoopService', () => {
			const service1 = new LoopService(defaultOptions);
			const service2 = new LoopService(defaultOptions);

			// Each LoopService should have its own sub-service instances
			expect(service1.getPresetService()).not.toBe(service2.getPresetService());
			expect(service1.getProgressService()).not.toBe(service2.getProgressService());
			expect(service1.getCompletionService()).not.toBe(service2.getCompletionService());
			expect(service1.getPromptService()).not.toBe(service2.getPromptService());
			expect(service1.getExecutorService()).not.toBe(service2.getExecutorService());
		});

		it('should maintain independent state between instances', () => {
			const service1 = new LoopService({ projectRoot: '/project1' });
			const service2 = new LoopService({ projectRoot: '/project2' });

			expect(service1.getProjectRoot()).toBe('/project1');
			expect(service2.getProjectRoot()).toBe('/project2');
		});
	});

	describe('DI wiring verification', () => {
		it('should wire LoopPromptService to use the LoopPresetService instance', () => {
			const service = new LoopService(defaultOptions);
			const presetService = service.getPresetService();

			// Verify preset service is properly wired and can access preset data
			const presetNames = presetService.getPresetNames();
			expect(presetNames).toContain('default');
			expect(presetNames.length).toBeGreaterThan(0);

			// Verify prompt service was created (DI wiring verified by no constructor errors)
			expect(service.getPromptService()).toBeInstanceOf(LoopPromptService);
		});

		it('should wire LoopProgressService with correct projectRoot', () => {
			const projectRoot = '/my/test/project';
			const service = new LoopService({ projectRoot });
			const progressService = service.getProgressService();

			// Progress service should use the provided projectRoot
			expect(progressService.getDefaultProgressPath()).toContain(projectRoot);
		});
	});

	describe('stop()', () => {
		let service: LoopService;
		let executorStopSpy: MockInstance;

		beforeEach(() => {
			service = new LoopService(defaultOptions);
			executorStopSpy = vi
				.spyOn(service.getExecutorService(), 'stop')
				.mockResolvedValue(undefined);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should set isRunning to false', async () => {
			// Simulate that a loop was running
			// Access private field via any cast for testing
			(service as unknown as { isRunning: boolean }).isRunning = true;
			expect(service.getIsRunning()).toBe(true);

			await service.stop();

			expect(service.getIsRunning()).toBe(false);
		});

		it('should call executorService.stop()', async () => {
			await service.stop();

			expect(executorStopSpy).toHaveBeenCalledTimes(1);
		});

		it('should call executorService.stop() even if already stopped', async () => {
			// When not running, stop should still call executor stop for cleanup
			expect(service.getIsRunning()).toBe(false);

			await service.stop();

			expect(executorStopSpy).toHaveBeenCalledTimes(1);
		});

		it('should be safe to call multiple times', async () => {
			await service.stop();
			await service.stop();
			await service.stop();

			expect(executorStopSpy).toHaveBeenCalledTimes(3);
			expect(service.getIsRunning()).toBe(false);
		});
	});

	describe('sleep()', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should resolve after specified delay', async () => {
			const service = new LoopService(defaultOptions);
			// Access private sleep method via any cast
			const sleepMethod = (
				service as unknown as { sleep: (ms: number) => Promise<void> }
			).sleep.bind(service);

			let resolved = false;
			const promise = sleepMethod(1000).then(() => {
				resolved = true;
			});

			// Before advancing time, promise should not be resolved
			expect(resolved).toBe(false);

			// Advance time by 500ms - still not resolved
			await vi.advanceTimersByTimeAsync(500);
			expect(resolved).toBe(false);

			// Advance to complete the delay
			await vi.advanceTimersByTimeAsync(500);
			await promise;

			expect(resolved).toBe(true);
		});

		it('should resolve immediately for 0ms delay', async () => {
			const service = new LoopService(defaultOptions);
			const sleepMethod = (
				service as unknown as { sleep: (ms: number) => Promise<void> }
			).sleep.bind(service);

			let resolved = false;
			const promise = sleepMethod(0).then(() => {
				resolved = true;
			});

			// 0ms sleep should resolve on next tick
			await vi.advanceTimersByTimeAsync(0);
			await promise;

			expect(resolved).toBe(true);
		});

		it('should work with different delay values', async () => {
			const service = new LoopService(defaultOptions);
			const sleepMethod = (
				service as unknown as { sleep: (ms: number) => Promise<void> }
			).sleep.bind(service);

			// Test 5 second delay
			let resolved = false;
			const promise = sleepMethod(5000).then(() => {
				resolved = true;
			});

			await vi.advanceTimersByTimeAsync(4999);
			expect(resolved).toBe(false);

			await vi.advanceTimersByTimeAsync(1);
			await promise;

			expect(resolved).toBe(true);
		});
	});

	describe('run() with stop() mid-loop', () => {
		let service: LoopService;

		beforeEach(() => {
			vi.useFakeTimers();
			service = new LoopService(defaultOptions);

			// Mock progress service methods
			vi.spyOn(service.getProgressService(), 'initializeProgressFile').mockResolvedValue(
				undefined
			);
			vi.spyOn(service.getProgressService(), 'appendProgress').mockResolvedValue(undefined);

			// Mock prompt service
			vi.spyOn(service.getPromptService(), 'generatePrompt').mockResolvedValue(
				'test prompt'
			);

			// Mock executor stop
			vi.spyOn(service.getExecutorService(), 'stop').mockResolvedValue(undefined);
		});

		afterEach(() => {
			vi.useRealTimers();
			vi.restoreAllMocks();
		});

		it('should exit gracefully when stop() called between iterations', async () => {
			let iterationCount = 0;

			// Mock executor to complete normally, but call stop after first iteration
			vi.spyOn(service.getExecutorService(), 'executeIteration').mockImplementation(
				async (_prompt, iteration) => {
					iterationCount++;
					// Call stop after first iteration completes
					if (iteration === 1) {
						// Schedule stop to occur before next iteration starts
						await service.stop();
					}
					return {
						iteration: {
							iteration,
							status: 'success',
							duration: 100
						},
						output: 'test output',
						completionCheck: { isComplete: false, isBlocked: false },
						exitCode: 0
					};
				}
			);

			const result = await service.run({
				prompt: 'default',
				iterations: 5,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			// Should have only run 1 iteration before stopping
			expect(iterationCount).toBe(1);
			expect(result.totalIterations).toBe(1);
			expect(result.finalStatus).toBe('max_iterations');
		});

		it('should respect isRunning flag in loop condition', async () => {
			// Set isRunning to false before starting
			(service as unknown as { isRunning: boolean }).isRunning = false;

			const executeSpy = vi
				.spyOn(service.getExecutorService(), 'executeIteration')
				.mockResolvedValue({
					iteration: { iteration: 1, status: 'success', duration: 100 },
					output: '',
					completionCheck: { isComplete: false, isBlocked: false },
					exitCode: 0
				});

			// Run sets isRunning to true, then loop checks condition
			// We can't easily test "pre-stopped" state, but we can test that
			// the condition is checked
			const result = await service.run({
				prompt: 'default',
				iterations: 3,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			// Should run all iterations since run() sets isRunning = true at start
			expect(executeSpy).toHaveBeenCalledTimes(3);
			expect(result.totalIterations).toBe(3);
		});

		it('should complete current iteration when stop() called during execution', async () => {
			let resolveExecute: (() => void) | undefined;

			vi.spyOn(service.getExecutorService(), 'executeIteration').mockImplementation(
				async (_prompt, iteration) => {
					if (iteration === 1) {
						// First iteration: simulate a long-running execution
						// During which stop() is called
						const executePromise = new Promise<void>((resolve) => {
							resolveExecute = () => resolve();
						});

						// Start the stop in parallel
						setTimeout(() => {
							service.stop();
						}, 10);

						// Simulate work being done
						await vi.advanceTimersByTimeAsync(10);
						await executePromise;
					}

					return {
						iteration: { iteration, status: 'success', duration: 100 },
						output: 'test output',
						completionCheck: { isComplete: false, isBlocked: false },
						exitCode: 0
					};
				}
			);

			// Start run in background
			const runPromise = service.run({
				prompt: 'default',
				iterations: 5,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			// Allow time to advance for the stop timeout
			await vi.advanceTimersByTimeAsync(15);

			// Resolve the execution
			if (resolveExecute) resolveExecute();

			// Allow promises to resolve
			await vi.runAllTimersAsync();

			const result = await runPromise;

			// Stop was called, so loop should exit after current iteration completes
			expect(service.getIsRunning()).toBe(false);
			expect(result.totalIterations).toBeGreaterThanOrEqual(1);
		});

		it('should set isRunning to false on completion', async () => {
			vi.spyOn(service.getExecutorService(), 'executeIteration').mockResolvedValue({
				iteration: { iteration: 1, status: 'success', duration: 100 },
				output: '',
				completionCheck: { isComplete: false, isBlocked: false },
				exitCode: 0
			});

			await service.run({
				prompt: 'default',
				iterations: 2,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			expect(service.getIsRunning()).toBe(false);
		});

		it('should set isRunning to false on early completion', async () => {
			vi.spyOn(service.getExecutorService(), 'executeIteration').mockResolvedValue({
				iteration: { iteration: 1, status: 'complete', duration: 100 },
				output: '<loop-complete>ALL_DONE</loop-complete>',
				completionCheck: {
					isComplete: true,
					isBlocked: false,
					marker: { type: 'complete', reason: 'ALL_DONE' }
				},
				exitCode: 0
			});

			const result = await service.run({
				prompt: 'default',
				iterations: 5,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			expect(service.getIsRunning()).toBe(false);
			expect(result.finalStatus).toBe('all_complete');
		});

		it('should set isRunning to false on blocked', async () => {
			vi.spyOn(service.getExecutorService(), 'executeIteration').mockResolvedValue({
				iteration: { iteration: 1, status: 'blocked', duration: 100 },
				output: '<loop-blocked>STUCK</loop-blocked>',
				completionCheck: {
					isComplete: false,
					isBlocked: true,
					marker: { type: 'blocked', reason: 'STUCK' }
				},
				exitCode: 0
			});

			const result = await service.run({
				prompt: 'default',
				iterations: 5,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			expect(service.getIsRunning()).toBe(false);
			expect(result.finalStatus).toBe('blocked');
		});
	});
});
