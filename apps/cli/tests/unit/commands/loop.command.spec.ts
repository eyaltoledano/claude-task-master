/**
 * @fileoverview Unit tests for LoopCommand
 */

import type { LoopResult, TmCore } from '@tm/core';
import { Command, type Option } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@tm/core', () => ({
	createTmCore: vi.fn()
}));

vi.mock('../../../src/utils/project-root.js', () => ({
	getProjectRoot: vi.fn((path?: string) => path || '/test/project')
}));

vi.mock('../../../src/utils/error-handler.js', () => ({
	displayError: vi.fn()
}));

vi.mock('../../../src/utils/display-helpers.js', () => ({
	displayCommandHeader: vi.fn()
}));

vi.mock('node:child_process', () => ({
	exec: vi.fn()
}));

vi.mock('node:util', () => ({
	promisify: vi.fn(() => vi.fn().mockResolvedValue({ stdout: '', stderr: '' }))
}));

import { LoopCommand } from '../../../src/commands/loop.command.js';
import { displayError } from '../../../src/utils/error-handler.js';

describe('LoopCommand', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let mockLoopResult: LoopResult;
	let mockTmCore: Partial<TmCore>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});

		mockLoopResult = {
			iterations: [
				{ iteration: 1, status: 'success', taskId: '1', duration: 1000 }
			],
			totalIterations: 1,
			tasksCompleted: 1,
			finalStatus: 'all_complete'
		};

		mockTmCore = {
			loop: {
				run: vi.fn().mockResolvedValue(mockLoopResult)
			} as any,
			tasks: {
				getStorageType: vi.fn().mockReturnValue('json')
			} as any,
			config: {
				getActiveTag: vi.fn().mockReturnValue('master')
			} as any,
			auth: {
				getStorageDisplayInfo: vi.fn().mockReturnValue({
					storageType: 'json',
					filePath: '/test/tasks.json'
				})
			} as any
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
		consoleLogSpy.mockRestore();
	});

	describe('command registration', () => {
		it('should register with default name "loop"', () => {
			const command = new LoopCommand();
			expect(command.name()).toBe('loop');
		});

		it('should register with custom name when provided', () => {
			const command = new LoopCommand('custom-loop');
			expect(command.name()).toBe('custom-loop');
		});

		it('should have correct description', () => {
			const command = new LoopCommand();
			expect(command.description()).toBe(
				'Run Claude Code in a loop, one task per iteration'
			);
		});

		it('should register on parent program via static register()', () => {
			const program = new Command();
			const loopCommand = LoopCommand.register(program);

			expect(loopCommand).toBeInstanceOf(LoopCommand);
			expect(program.commands.find((c) => c.name() === 'loop')).toBe(
				loopCommand
			);
		});
	});

	describe('option parsing', () => {
		it('should have default iterations of 10', () => {
			const command = new LoopCommand();
			const iterationsOption = command.options.find(
				(o: Option) => o.long === '--iterations'
			);
			expect(iterationsOption?.defaultValue).toBe('10');
		});

		it('should have default prompt of "default"', () => {
			const command = new LoopCommand();
			const promptOption = command.options.find(
				(o: Option) => o.long === '--prompt'
			);
			expect(promptOption?.defaultValue).toBe('default');
		});

		it('should have default sleep of 5', () => {
			const command = new LoopCommand();
			const sleepOption = command.options.find(
				(o: Option) => o.long === '--sleep'
			);
			expect(sleepOption?.defaultValue).toBe('5');
		});

		it('should have default status of "pending"', () => {
			const command = new LoopCommand();
			const statusOption = command.options.find(
				(o: Option) => o.long === '--status'
			);
			expect(statusOption?.defaultValue).toBe('pending');
		});

		it('should support short flag -n for iterations', () => {
			const command = new LoopCommand();
			const iterationsOption = command.options.find(
				(o: Option) => o.long === '--iterations'
			);
			expect(iterationsOption?.short).toBe('-n');
		});

		it('should support short flag -p for prompt', () => {
			const command = new LoopCommand();
			const promptOption = command.options.find(
				(o: Option) => o.long === '--prompt'
			);
			expect(promptOption?.short).toBe('-p');
		});

		it('should support short flag -t for tag', () => {
			const command = new LoopCommand();
			const tagOption = command.options.find((o: Option) => o.long === '--tag');
			expect(tagOption?.short).toBe('-t');
		});

		it('should have --json flag without default', () => {
			const command = new LoopCommand();
			const jsonOption = command.options.find(
				(o: Option) => o.long === '--json'
			);
			expect(jsonOption).toBeDefined();
			expect(jsonOption?.defaultValue).toBeUndefined();
		});

		it('should have --on-complete option', () => {
			const command = new LoopCommand();
			const onCompleteOption = command.options.find(
				(o: Option) => o.long === '--on-complete'
			);
			expect(onCompleteOption).toBeDefined();
		});

		it('should have --progress-file option', () => {
			const command = new LoopCommand();
			const progressFileOption = command.options.find(
				(o: Option) => o.long === '--progress-file'
			);
			expect(progressFileOption).toBeDefined();
		});

		it('should have --project option', () => {
			const command = new LoopCommand();
			const projectOption = command.options.find(
				(o: Option) => o.long === '--project'
			);
			expect(projectOption).toBeDefined();
		});
	});

	describe('option validation', () => {
		it('should throw for invalid iterations (non-numeric)', () => {
			const command = new LoopCommand();
			expect(() =>
				(command as any).validateOptions({ iterations: 'abc' })
			).toThrow('Invalid iterations: abc. Must be a positive integer.');
		});

		it('should throw for invalid iterations (zero)', () => {
			const command = new LoopCommand();
			expect(() =>
				(command as any).validateOptions({ iterations: '0' })
			).toThrow('Invalid iterations: 0. Must be a positive integer.');
		});

		it('should throw for invalid iterations (negative)', () => {
			const command = new LoopCommand();
			expect(() =>
				(command as any).validateOptions({ iterations: '-5' })
			).toThrow('Invalid iterations: -5. Must be a positive integer.');
		});

		it('should accept valid iterations', () => {
			const command = new LoopCommand();
			expect(() =>
				(command as any).validateOptions({ iterations: '5' })
			).not.toThrow();
		});

		it('should throw for invalid sleep (non-numeric)', () => {
			const command = new LoopCommand();
			expect(() => (command as any).validateOptions({ sleep: 'abc' })).toThrow(
				'Invalid sleep: abc. Must be a non-negative integer.'
			);
		});

		it('should throw for invalid sleep (negative)', () => {
			const command = new LoopCommand();
			expect(() => (command as any).validateOptions({ sleep: '-1' })).toThrow(
				'Invalid sleep: -1. Must be a non-negative integer.'
			);
		});

		it('should accept valid sleep of 0', () => {
			const command = new LoopCommand();
			expect(() =>
				(command as any).validateOptions({ sleep: '0' })
			).not.toThrow();
		});

		it('should accept valid sleep', () => {
			const command = new LoopCommand();
			expect(() =>
				(command as any).validateOptions({ sleep: '10' })
			).not.toThrow();
		});
	});

	describe('display formatting', () => {
		it('should format all_complete status as green', () => {
			const command = new LoopCommand();
			const formatted = (command as any).formatStatus('all_complete');
			expect(formatted).toContain('All tasks complete');
		});

		it('should format max_iterations status as yellow', () => {
			const command = new LoopCommand();
			const formatted = (command as any).formatStatus('max_iterations');
			expect(formatted).toContain('Max iterations reached');
		});

		it('should format blocked status as red', () => {
			const command = new LoopCommand();
			const formatted = (command as any).formatStatus('blocked');
			expect(formatted).toContain('Blocked');
		});

		it('should format error status as red', () => {
			const command = new LoopCommand();
			const formatted = (command as any).formatStatus('error');
			expect(formatted).toContain('Error');
		});
	});

	describe('executeLoop', () => {
		it('should output JSON when --json flag is set', async () => {
			const command = new LoopCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeLoop({ json: true });

			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls.find((call: unknown[]) => {
				try {
					JSON.parse(call[0] as string);
					return true;
				} catch {
					return false;
				}
			});
			expect(output).toBeDefined();

			const parsed = JSON.parse(output![0] as string);
			expect(parsed).toHaveProperty('totalIterations');
			expect(parsed).toHaveProperty('tasksCompleted');
			expect(parsed).toHaveProperty('finalStatus');
		});

		it('should call tmCore.loop.run with parsed config', async () => {
			const command = new LoopCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeLoop({
				iterations: '5',
				prompt: 'test-coverage',
				sleep: '10',
				tag: 'feature',
				status: 'in-progress',
				json: true
			});

			expect(mockTmCore.loop!.run).toHaveBeenCalledWith({
				iterations: 5,
				prompt: 'test-coverage',
				progressFile: undefined,
				sleepSeconds: 10,
				onComplete: undefined,
				tag: 'feature',
				status: 'in-progress'
			});
		});

		it('should store result for getLastResult()', async () => {
			const command = new LoopCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeLoop({ json: true });

			expect(command.getLastResult()).toEqual(mockLoopResult);
		});

		it('should call displayError on exception', async () => {
			const command = new LoopCommand();
			const testError = new Error('Test error');
			(command as any).tmCore = {
				...mockTmCore,
				loop: {
					run: vi.fn().mockRejectedValue(testError)
				}
			};

			try {
				await (command as any).executeLoop({ json: true });
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(displayError).toHaveBeenCalledWith(testError, { skipExit: true });
		});
	});

	describe('cleanup', () => {
		it('should clear tmCore reference on cleanup', async () => {
			const command = new LoopCommand();
			(command as any).tmCore = mockTmCore;

			await command.cleanup();

			expect((command as any).tmCore).toBeUndefined();
		});
	});
});
