/**
 * @fileoverview Unit tests for LoopExecutorService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'node:events';
import { LoopExecutorService } from './loop-executor.service.js';
import { LoopCompletionService } from './loop-completion.service.js';

// Mock child_process
vi.mock('node:child_process', () => ({
	spawn: vi.fn()
}));

import { spawn } from 'node:child_process';

/**
 * Create a mock process with stdout/stderr as event emitters
 */
function createMockProcess() {
	const process = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter;
		stderr: EventEmitter;
		kill: Mock;
	};
	process.stdout = new EventEmitter();
	process.stderr = new EventEmitter();
	process.kill = vi.fn();
	return process;
}

describe('LoopExecutorService', () => {
	let service: LoopExecutorService;
	let completionService: LoopCompletionService;
	let mockProcess: ReturnType<typeof createMockProcess>;

	beforeEach(() => {
		vi.clearAllMocks();
		completionService = new LoopCompletionService();
		service = new LoopExecutorService(completionService);
		mockProcess = createMockProcess();
		(spawn as Mock).mockReturnValue(mockProcess);
	});

	describe('constructor', () => {
		it('creates instance with completion service', () => {
			expect(service).toBeInstanceOf(LoopExecutorService);
		});
	});

	describe('executeIteration', () => {
		it('spawns claude with correct arguments', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			// Emit successful close
			mockProcess.emit('close', 0);

			await promise;

			expect(spawn).toHaveBeenCalledWith('claude', ['-p', 'test prompt'], {
				cwd: '/project',
				shell: false,
				stdio: ['ignore', 'pipe', 'pipe']
			});
		});

		it('captures stdout output', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			// Emit stdout data
			mockProcess.stdout.emit('data', Buffer.from('stdout output'));
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.output).toBe('stdout output');
		});

		it('captures stderr output', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			// Emit stderr data
			mockProcess.stderr.emit('data', Buffer.from('stderr output'));
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.output).toBe('stderr output');
		});

		it('combines stdout and stderr output', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			// Emit mixed output
			mockProcess.stdout.emit('data', Buffer.from('stdout '));
			mockProcess.stderr.emit('data', Buffer.from('stderr'));
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.output).toBe('stdout stderr');
		});

		it('returns success status for exit code 0', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.exitCode).toBe(0);
			expect(result.iteration.status).toBe('success');
		});

		it('returns error status for non-zero exit code', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.emit('close', 1);

			const result = await promise;

			expect(result.exitCode).toBe(1);
			expect(result.iteration.status).toBe('error');
		});

		it('returns correct iteration number', async () => {
			const promise = service.executeIteration('test prompt', 5, '/project');

			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.iteration.iteration).toBe(5);
		});

		it('calculates duration', async () => {
			vi.useFakeTimers();

			const promise = service.executeIteration('test prompt', 1, '/project');

			// Advance time by 1000ms
			vi.advanceTimersByTime(1000);
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.iteration.duration).toBe(1000);

			vi.useRealTimers();
		});

		it('handles null exit code as 1', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.emit('close', null);

			const result = await promise;

			expect(result.exitCode).toBe(1);
		});
	});

	describe('completion detection', () => {
		it('detects complete marker and returns complete status', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.stdout.emit(
				'data',
				Buffer.from('Done! <loop-complete>ALL_DONE</loop-complete>')
			);
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.completionCheck.isComplete).toBe(true);
			expect(result.completionCheck.isBlocked).toBe(false);
			expect(result.iteration.status).toBe('complete');
			expect(result.iteration.message).toBe('ALL_DONE');
		});

		it('detects blocked marker and returns blocked status', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.stdout.emit(
				'data',
				Buffer.from('Cannot continue <loop-blocked>Missing API key</loop-blocked>')
			);
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.completionCheck.isComplete).toBe(false);
			expect(result.completionCheck.isBlocked).toBe(true);
			expect(result.iteration.status).toBe('blocked');
			expect(result.iteration.message).toBe('Missing API key');
		});

		it('returns no message when no marker found', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.stdout.emit('data', Buffer.from('Regular output without markers'));
			mockProcess.emit('close', 0);

			const result = await promise;

			expect(result.completionCheck.isComplete).toBe(false);
			expect(result.completionCheck.isBlocked).toBe(false);
			expect(result.iteration.message).toBeUndefined();
		});

		it('complete marker overrides non-zero exit code', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.stdout.emit(
				'data',
				Buffer.from('<loop-complete>DONE</loop-complete>')
			);
			// Even with non-zero exit, complete marker takes precedence
			mockProcess.emit('close', 1);

			const result = await promise;

			expect(result.iteration.status).toBe('complete');
		});

		it('blocked marker overrides non-zero exit code', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.stdout.emit(
				'data',
				Buffer.from('<loop-blocked>STUCK</loop-blocked>')
			);
			mockProcess.emit('close', 1);

			const result = await promise;

			expect(result.iteration.status).toBe('blocked');
		});
	});

	describe('error handling', () => {
		it('handles process spawn error', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.emit('error', new Error('spawn ENOENT'));

			const result = await promise;

			expect(result.iteration.status).toBe('error');
			expect(result.iteration.message).toBe('spawn ENOENT');
			expect(result.exitCode).toBe(1);
			expect(result.completionCheck.isComplete).toBe(false);
			expect(result.completionCheck.isBlocked).toBe(false);
		});

		it('preserves partial output on error', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			mockProcess.stdout.emit('data', Buffer.from('partial output'));
			mockProcess.emit('error', new Error('Process killed'));

			const result = await promise;

			expect(result.output).toBe('partial output');
			expect(result.iteration.status).toBe('error');
		});
	});

	describe('stop', () => {
		it('kills running process with SIGTERM', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			// Process is running, call stop
			await service.stop();

			expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

			// Clean up the test
			mockProcess.emit('close', 0);
			await promise;
		});

		it('does nothing when no process is running', async () => {
			// No process started yet
			await service.stop();

			// Should not throw or call kill
			expect(mockProcess.kill).not.toHaveBeenCalled();
		});

		it('clears currentProcess reference after stop', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');

			await service.stop();

			// Second stop should not call kill again
			await service.stop();
			expect(mockProcess.kill).toHaveBeenCalledTimes(1);

			// Clean up
			mockProcess.emit('close', 0);
			await promise;
		});
	});

	describe('process lifecycle', () => {
		it('clears currentProcess after close', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');
			mockProcess.emit('close', 0);
			await promise;

			// After close, stop should not call kill
			await service.stop();
			expect(mockProcess.kill).not.toHaveBeenCalled();
		});

		it('clears currentProcess after error', async () => {
			const promise = service.executeIteration('test prompt', 1, '/project');
			mockProcess.emit('error', new Error('test'));
			await promise;

			// After error, stop should not call kill
			await service.stop();
			expect(mockProcess.kill).not.toHaveBeenCalled();
		});
	});
});
