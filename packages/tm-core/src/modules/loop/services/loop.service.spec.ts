/**
 * @fileoverview Unit tests for simplified LoopService
 * Tests the inlined logic: presets, progress, execution, completion detection
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
import * as childProcess from 'node:child_process';
import * as fsPromises from 'node:fs/promises';
import { EventEmitter } from 'node:events';

// Mock child_process and fs/promises
vi.mock('node:child_process');
vi.mock('node:fs/promises');

describe('LoopService', () => {
	const defaultOptions: LoopServiceOptions = {
		projectRoot: '/test/project'
	};

	beforeEach(() => {
		vi.resetAllMocks();
		// Default fs mocks
		vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
		vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
		vi.mocked(fsPromises.appendFile).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should create a LoopService instance with required options', () => {
			const service = new LoopService(defaultOptions);
			expect(service).toBeInstanceOf(LoopService);
		});

		it('should store projectRoot from options', () => {
			const service = new LoopService(defaultOptions);
			expect(service.getProjectRoot()).toBe('/test/project');
		});

		it('should initialize isRunning to false', () => {
			const service = new LoopService(defaultOptions);
			expect(service.isRunning).toBe(false);
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
		it('should create independent instances', () => {
			const service1 = new LoopService(defaultOptions);
			const service2 = new LoopService(defaultOptions);
			expect(service1).not.toBe(service2);
		});

		it('should maintain independent state between instances', () => {
			const service1 = new LoopService({ projectRoot: '/project1' });
			const service2 = new LoopService({ projectRoot: '/project2' });

			expect(service1.getProjectRoot()).toBe('/project1');
			expect(service2.getProjectRoot()).toBe('/project2');
		});
	});

	describe('stop()', () => {
		it('should set isRunning to false', () => {
			const service = new LoopService(defaultOptions);
			// Access private field via any cast for testing
			(service as unknown as { _isRunning: boolean })._isRunning = true;
			expect(service.isRunning).toBe(true);

			service.stop();

			expect(service.isRunning).toBe(false);
		});

		it('should be safe to call multiple times', () => {
			const service = new LoopService(defaultOptions);
			service.stop();
			service.stop();
			service.stop();

			expect(service.isRunning).toBe(false);
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
			const sleepMethod = (
				service as unknown as { sleep: (ms: number) => Promise<void> }
			).sleep.bind(service);

			let resolved = false;
			const promise = sleepMethod(1000).then(() => {
				resolved = true;
			});

			expect(resolved).toBe(false);

			await vi.advanceTimersByTimeAsync(500);
			expect(resolved).toBe(false);

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

			await vi.advanceTimersByTimeAsync(0);
			await promise;

			expect(resolved).toBe(true);
		});
	});

	// Helper to create mock process
	function createMockProcess(): EventEmitter & {
		stdout: EventEmitter;
		stderr: EventEmitter;
		kill: MockInstance;
	} {
		const proc = new EventEmitter() as EventEmitter & {
			stdout: EventEmitter;
			stderr: EventEmitter;
			kill: MockInstance;
		};
		proc.stdout = new EventEmitter();
		proc.stderr = new EventEmitter();
		proc.kill = vi.fn();
		return proc;
	}

	describe('run()', () => {
		let service: LoopService;
		let mockSpawn: MockInstance;

		beforeEach(() => {
			service = new LoopService(defaultOptions);
			mockSpawn = vi.mocked(childProcess.spawn);
		});

		describe('successful iteration run', () => {
			it('should run a single iteration successfully', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				// Simulate successful completion
				mockProc.stdout.emit('data', Buffer.from('Task completed'));
				mockProc.emit('close', 0);

				const result = await runPromise;

				expect(result.totalIterations).toBe(1);
				expect(result.tasksCompleted).toBe(1);
				expect(result.finalStatus).toBe('max_iterations');
			});

			it('should run multiple iterations', async () => {
				const mockProcs = [createMockProcess(), createMockProcess(), createMockProcess()];
				let procIndex = 0;
				mockSpawn.mockImplementation(() => {
					return mockProcs[procIndex++] as unknown as childProcess.ChildProcess;
				});

				const runPromise = service.run({
					prompt: 'default',
					iterations: 3,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				// Complete each iteration
				for (const proc of mockProcs) {
					proc.stdout.emit('data', Buffer.from('Done'));
					proc.emit('close', 0);
				}

				const result = await runPromise;

				expect(result.totalIterations).toBe(3);
				expect(result.tasksCompleted).toBe(3);
				expect(mockSpawn).toHaveBeenCalledTimes(3);
			});

			it('should call spawn with claude -p', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.stdout.emit('data', Buffer.from('Done'));
				mockProc.emit('close', 0);

				await runPromise;

				expect(mockSpawn).toHaveBeenCalledWith(
					'claude',
					expect.arrayContaining(['-p', expect.any(String)]),
					expect.objectContaining({
						cwd: '/test/project'
					})
				);
			});
		});

		describe('completion marker detection', () => {
			it('should detect loop-complete marker and exit early', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 5,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.stdout.emit('data', Buffer.from('<loop-complete>ALL_DONE</loop-complete>'));
				mockProc.emit('close', 0);

				const result = await runPromise;

				expect(result.totalIterations).toBe(1);
				expect(result.finalStatus).toBe('all_complete');
			});

			it('should detect loop-blocked marker and exit early', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 5,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.stdout.emit('data', Buffer.from('<loop-blocked>Missing API key</loop-blocked>'));
				mockProc.emit('close', 0);

				const result = await runPromise;

				expect(result.totalIterations).toBe(1);
				expect(result.finalStatus).toBe('blocked');
			});
		});

		describe('error handling', () => {
			it('should handle non-zero exit code', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.emit('close', 1);

				const result = await runPromise;

				expect(result.iterations[0].status).toBe('error');
				expect(result.tasksCompleted).toBe(0);
			});

			it('should handle process spawn error', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.emit('error', new Error('Spawn failed'));

				const result = await runPromise;

				expect(result.iterations[0].status).toBe('error');
				expect(result.iterations[0].message).toBe('Spawn failed');
			});
		});

		describe('progress file operations', () => {
			it('should initialize progress file at start', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'default',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.emit('close', 0);
				await runPromise;

				expect(fsPromises.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
				expect(fsPromises.writeFile).toHaveBeenCalledWith(
					'/test/progress.txt',
					expect.stringContaining('# Task Master Loop Progress'),
					'utf-8'
				);
			});

			it('should append progress after each iteration', async () => {
				const mockProcs = [createMockProcess(), createMockProcess()];
				let procIndex = 0;
				mockSpawn.mockImplementation(() => {
					return mockProcs[procIndex++] as unknown as childProcess.ChildProcess;
				});

				const runPromise = service.run({
					prompt: 'default',
					iterations: 2,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				for (const proc of mockProcs) {
					proc.emit('close', 0);
				}

				await runPromise;

				expect(fsPromises.appendFile).toHaveBeenCalledTimes(2);
			});
		});

		describe('preset resolution', () => {
			it('should resolve built-in preset names', async () => {
				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: 'test-coverage',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.emit('close', 0);
				await runPromise;

				// Verify spawn was called with prompt containing test-coverage content
				const spawnCall = mockSpawn.mock.calls[0];
				const promptArg = spawnCall[1][1]; // Second arg after '-p'
				expect(promptArg).toContain('Loop Iteration 1 of 1');
			});

			it('should load custom prompt from file', async () => {
				vi.mocked(fsPromises.readFile).mockResolvedValue('Custom prompt content');

				const mockProc = createMockProcess();
				mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

				const runPromise = service.run({
					prompt: '/custom/prompt.md',
					iterations: 1,
					sleepSeconds: 0,
					progressFile: '/test/progress.txt'
				});

				mockProc.emit('close', 0);
				await runPromise;

				expect(fsPromises.readFile).toHaveBeenCalledWith('/custom/prompt.md', 'utf-8');
			});
		});
	});

	describe('parseCompletion (inlined)', () => {
		let service: LoopService;
		let parseCompletion: (
			output: string,
			exitCode: number | null
		) => { status: string; message?: string };

		beforeEach(() => {
			service = new LoopService(defaultOptions);
			// Access private method
			parseCompletion = (
				service as unknown as {
					parseCompletion: typeof parseCompletion;
				}
			).parseCompletion.bind(service);
		});

		it('should detect complete marker', () => {
			const result = parseCompletion('<loop-complete>ALL DONE</loop-complete>', 0);
			expect(result.status).toBe('complete');
			expect(result.message).toBe('ALL DONE');
		});

		it('should detect blocked marker', () => {
			const result = parseCompletion('<loop-blocked>STUCK</loop-blocked>', 0);
			expect(result.status).toBe('blocked');
			expect(result.message).toBe('STUCK');
		});

		it('should return error on non-zero exit code', () => {
			const result = parseCompletion('Some output', 1);
			expect(result.status).toBe('error');
			expect(result.message).toBe('Exit code 1');
		});

		it('should return success on zero exit code without markers', () => {
			const result = parseCompletion('Regular output', 0);
			expect(result.status).toBe('success');
		});

		it('should be case-insensitive for markers', () => {
			const result = parseCompletion('<LOOP-COMPLETE>DONE</LOOP-COMPLETE>', 0);
			expect(result.status).toBe('complete');
		});

		it('should trim whitespace from reason', () => {
			const result = parseCompletion('<loop-complete>  trimmed  </loop-complete>', 0);
			expect(result.message).toBe('trimmed');
		});
	});

	describe('isPreset (inlined)', () => {
		let service: LoopService;
		let isPreset: (name: string) => boolean;

		beforeEach(() => {
			service = new LoopService(defaultOptions);
			isPreset = (service as unknown as { isPreset: (n: string) => boolean }).isPreset.bind(
				service
			);
		});

		it('should return true for default preset', () => {
			expect(isPreset('default')).toBe(true);
		});

		it('should return true for test-coverage preset', () => {
			expect(isPreset('test-coverage')).toBe(true);
		});

		it('should return true for linting preset', () => {
			expect(isPreset('linting')).toBe(true);
		});

		it('should return true for duplication preset', () => {
			expect(isPreset('duplication')).toBe(true);
		});

		it('should return true for entropy preset', () => {
			expect(isPreset('entropy')).toBe(true);
		});

		it('should return false for unknown preset', () => {
			expect(isPreset('unknown')).toBe(false);
		});

		it('should return false for file paths', () => {
			expect(isPreset('/path/to/file.md')).toBe(false);
		});
	});


	describe('buildContextHeader (inlined)', () => {
		let service: LoopService;
		let buildContextHeader: (
			config: { iterations: number; progressFile: string; tag?: string },
			iteration: number
		) => string;

		beforeEach(() => {
			service = new LoopService(defaultOptions);
			buildContextHeader = (
				service as unknown as {
					buildContextHeader: typeof buildContextHeader;
				}
			).buildContextHeader.bind(service);
		});

		it('should include iteration info', () => {
			const header = buildContextHeader(
				{ iterations: 5, progressFile: '/test/progress.txt' },
				2
			);
			expect(header).toContain('Loop Iteration 2 of 5');
		});

		it('should include progress file reference', () => {
			const header = buildContextHeader(
				{ iterations: 1, progressFile: '/test/progress.txt' },
				1
			);
			expect(header).toContain('@/test/progress.txt');
		});

		it('should include tasks file reference', () => {
			const header = buildContextHeader(
				{ iterations: 1, progressFile: '/test/progress.txt' },
				1
			);
			expect(header).toContain('@.taskmaster/tasks/tasks.json');
		});

		it('should include tag filter when provided', () => {
			const header = buildContextHeader(
				{ iterations: 1, progressFile: '/test/progress.txt', tag: 'feature-x' },
				1
			);
			expect(header).toContain('Tag filter: feature-x');
		});

		it('should not include tag line when not provided', () => {
			const header = buildContextHeader(
				{ iterations: 1, progressFile: '/test/progress.txt' },
				1
			);
			expect(header).not.toContain('Tag filter');
		});
	});

	describe('buildResult (inlined)', () => {
		let service: LoopService;
		let buildResult: (
			iterations: Array<{ iteration: number; status: string; duration?: number }>,
			tasksCompleted: number,
			finalStatus: string
		) => { iterations: unknown[]; totalIterations: number; tasksCompleted: number; finalStatus: string };

		beforeEach(() => {
			service = new LoopService(defaultOptions);
			buildResult = (
				service as unknown as { buildResult: typeof buildResult }
			).buildResult.bind(service);
		});

		it('should include iterations array', () => {
			const iterations = [{ iteration: 1, status: 'success', duration: 100 }];
			const result = buildResult(iterations, 1, 'max_iterations');
			expect(result.iterations).toEqual(iterations);
		});

		it('should count totalIterations correctly', () => {
			const iterations = [
				{ iteration: 1, status: 'success' },
				{ iteration: 2, status: 'success' }
			];
			const result = buildResult(iterations, 2, 'max_iterations');
			expect(result.totalIterations).toBe(2);
		});

		it('should include tasksCompleted', () => {
			const result = buildResult([], 5, 'max_iterations');
			expect(result.tasksCompleted).toBe(5);
		});

		it('should include finalStatus', () => {
			const result = buildResult([], 0, 'blocked');
			expect(result.finalStatus).toBe('blocked');
		});
	});

	describe('integration: run with stop', () => {
		let service: LoopService;
		let mockSpawn: MockInstance;

		beforeEach(() => {
			vi.useFakeTimers();
			service = new LoopService(defaultOptions);
			mockSpawn = vi.mocked(childProcess.spawn);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should exit gracefully when stop() called', async () => {
			const mockProcs = [createMockProcess(), createMockProcess()];
			let procIndex = 0;
			mockSpawn.mockImplementation(() => {
				return mockProcs[procIndex++] as unknown as childProcess.ChildProcess;
			});

			const runPromise = service.run({
				prompt: 'default',
				iterations: 5,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			// Complete first iteration then stop
			mockProcs[0].emit('close', 0);
			service.stop();

			// Complete second (may or may not run depending on timing)
			if (mockProcs[1]) {
				mockProcs[1].emit('close', 0);
			}

			const result = await runPromise;

			// Should have stopped early
			expect(result.totalIterations).toBeLessThanOrEqual(2);
			expect(service.isRunning).toBe(false);
		});

		it('should set isRunning to false on completion', async () => {
			const mockProc = createMockProcess();
			mockSpawn.mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

			const runPromise = service.run({
				prompt: 'default',
				iterations: 1,
				sleepSeconds: 0,
				progressFile: '/test/progress.txt'
			});

			mockProc.emit('close', 0);
			await runPromise;

			expect(service.isRunning).toBe(false);
		});
	});
});
