/**
 * @fileoverview Unit tests for LoopCommand
 *
 * Tests the loop command's option parsing, validation, display formatting,
 * and integration with TmCore's LoopDomain.
 */

import { Command } from 'commander';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopCommand, type LoopCommandOptions } from './loop.command.js';

// Mock @tm/core
vi.mock('@tm/core', () => ({
	createTmCore: vi.fn()
}));

// Mock display utilities
vi.mock('../utils/display-helpers.js', () => ({
	displayCommandHeader: vi.fn()
}));

vi.mock('../utils/error-handler.js', () => ({
	displayError: vi.fn()
}));

vi.mock('../utils/project-root.js', () => ({
	getProjectRoot: vi.fn().mockReturnValue('/test/project')
}));

// Mock child_process exec
vi.mock('node:child_process', () => ({
	exec: vi.fn()
}));

vi.mock('node:util', () => ({
	promisify: () => vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
}));

import type { LoopResult } from '@tm/core';
import { createTmCore } from '@tm/core';
import { promisify } from 'node:util';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';

describe('LoopCommand', () => {
	let loopCommand: LoopCommand;
	let mockTmCore: any;
	let mockLoopRun: Mock;
	let consoleLogSpy: any;
	let consoleErrorSpy: any;
	let processExitSpy: any;

	const createMockResult = (overrides: Partial<LoopResult> = {}): LoopResult => ({
		iterations: [],
		totalIterations: 3,
		tasksCompleted: 2,
		finalStatus: 'max_iterations',
		...overrides
	});

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Mock console methods
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});

		// Setup mock TmCore
		mockLoopRun = vi.fn().mockResolvedValue(createMockResult());
		mockTmCore = {
			loop: {
				run: mockLoopRun
			},
			tasks: {
				getStorageType: vi.fn().mockReturnValue('local')
			}
		};

		(createTmCore as Mock).mockResolvedValue(mockTmCore);

		// Create command instance
		loopCommand = new LoopCommand();
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
	});

	describe('command registration', () => {
		it('should create command with correct name', () => {
			expect(loopCommand.name()).toBe('loop');
		});

		it('should have correct description', () => {
			expect(loopCommand.description()).toContain('loop');
		});

		it('should register on parent program via static register()', () => {
			const program = new Command();
			const registered = LoopCommand.register(program);

			expect(registered).toBeInstanceOf(LoopCommand);
			expect(program.commands.find((c) => c.name() === 'loop')).toBe(registered);
		});

		it('should allow custom name via static register()', () => {
			const program = new Command();
			const registered = LoopCommand.register(program, 'custom-loop');

			expect(registered.name()).toBe('custom-loop');
		});
	});

	describe('option parsing', () => {
		it('should have default iterations of 10', () => {
			const option = loopCommand.options.find((o) => o.long === '--iterations');
			expect(option?.defaultValue).toBe('10');
		});

		it('should have default prompt of "default"', () => {
			const option = loopCommand.options.find((o) => o.long === '--prompt');
			expect(option?.defaultValue).toBe('default');
		});

		it('should have default sleep of 5', () => {
			const option = loopCommand.options.find((o) => o.long === '--sleep');
			expect(option?.defaultValue).toBe('5');
		});

		it('should have default status of "pending"', () => {
			const option = loopCommand.options.find((o) => o.long === '--status');
			expect(option?.defaultValue).toBe('pending');
		});

		it('should have -n as short flag for iterations', () => {
			const option = loopCommand.options.find((o) => o.long === '--iterations');
			expect(option?.short).toBe('-n');
		});

		it('should have -p as short flag for prompt', () => {
			const option = loopCommand.options.find((o) => o.long === '--prompt');
			expect(option?.short).toBe('-p');
		});

		it('should have -t as short flag for tag', () => {
			const option = loopCommand.options.find((o) => o.long === '--tag');
			expect(option?.short).toBe('-t');
		});

		it('should have --json flag', () => {
			const option = loopCommand.options.find((o) => o.long === '--json');
			expect(option).toBeDefined();
		});

		it('should have --progress-file option', () => {
			const option = loopCommand.options.find((o) => o.long === '--progress-file');
			expect(option).toBeDefined();
		});

		it('should have --on-complete option', () => {
			const option = loopCommand.options.find((o) => o.long === '--on-complete');
			expect(option).toBeDefined();
		});

		it('should have --project option', () => {
			const option = loopCommand.options.find((o) => o.long === '--project');
			expect(option).toBeDefined();
		});
	});

	describe('validation', () => {
		it('should throw error for invalid iterations (non-numeric)', async () => {
			const options: LoopCommandOptions = { iterations: 'abc' };

			// Access private method via type assertion
			const validateOptions = (loopCommand as any).validateOptions.bind(loopCommand);

			expect(() => validateOptions(options)).toThrow('Invalid iterations');
		});

		it('should throw error for invalid iterations (negative)', async () => {
			const options: LoopCommandOptions = { iterations: '-5' };

			const validateOptions = (loopCommand as any).validateOptions.bind(loopCommand);

			expect(() => validateOptions(options)).toThrow('Invalid iterations');
		});

		it('should throw error for invalid iterations (zero)', async () => {
			const options: LoopCommandOptions = { iterations: '0' };

			const validateOptions = (loopCommand as any).validateOptions.bind(loopCommand);

			expect(() => validateOptions(options)).toThrow('Invalid iterations');
		});

		it('should allow valid iterations', () => {
			const options: LoopCommandOptions = { iterations: '5' };

			const validateOptions = (loopCommand as any).validateOptions.bind(loopCommand);

			expect(() => validateOptions(options)).not.toThrow();
		});
	});

	describe('formatStatus', () => {
		it('should format "all_complete" as green', () => {
			const formatStatus = (loopCommand as any).formatStatus.bind(loopCommand);
			const result = formatStatus('all_complete');

			// chalk.green adds ANSI codes, just verify it contains expected text
			expect(result).toContain('All tasks complete');
		});

		it('should format "max_iterations" as yellow', () => {
			const formatStatus = (loopCommand as any).formatStatus.bind(loopCommand);
			const result = formatStatus('max_iterations');

			expect(result).toContain('Max iterations reached');
		});

		it('should format "blocked" as red', () => {
			const formatStatus = (loopCommand as any).formatStatus.bind(loopCommand);
			const result = formatStatus('blocked');

			expect(result).toContain('Blocked');
		});

		it('should format "error" as red', () => {
			const formatStatus = (loopCommand as any).formatStatus.bind(loopCommand);
			const result = formatStatus('error');

			expect(result).toContain('Error');
		});

		it('should pass through unknown status', () => {
			const formatStatus = (loopCommand as any).formatStatus.bind(loopCommand);
			const result = formatStatus('unknown_status');

			expect(result).toBe('unknown_status');
		});
	});

	describe('displayResult', () => {
		it('should display loop completion summary', () => {
			const displayResult = (loopCommand as any).displayResult.bind(loopCommand);
			const mockResult: LoopResult = {
				iterations: [],
				totalIterations: 5,
				tasksCompleted: 3,
				finalStatus: 'max_iterations'
			};

			displayResult(mockResult);

			expect(consoleLogSpy).toHaveBeenCalled();
			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).toContain('Loop Complete');
			expect(allOutput).toContain('5');
			expect(allOutput).toContain('3');
		});
	});

	describe('executeLoop integration', () => {
		it('should call tmCore.loop.run with parsed config', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			// Call executeLoop via the action handler
			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({
				iterations: '5',
				prompt: 'test-coverage',
				sleep: '10',
				tag: 'feature'
			});

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					iterations: 5,
					prompt: 'test-coverage',
					sleepSeconds: 10,
					tag: 'feature'
				})
			);
		});

		it('should output JSON when --json flag is set', async () => {
			const result = createMockResult({
				finalStatus: 'all_complete',
				totalIterations: 2,
				tasksCompleted: 2
			});
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ json: true });

			const jsonOutput = consoleLogSpy.mock.calls.find((call: any[]) => {
				try {
					JSON.parse(call[0]);
					return true;
				} catch {
					return false;
				}
			});

			expect(jsonOutput).toBeDefined();
			const parsed = JSON.parse(jsonOutput[0]);
			expect(parsed.finalStatus).toBe('all_complete');
			expect(parsed.totalIterations).toBe(2);
			expect(parsed.tasksCompleted).toBe(2);
		});

		it('should display header for non-JSON output', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({});

			expect(displayCommandHeader).toHaveBeenCalled();
		});

		it('should NOT display header for JSON output', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ json: true });

			expect(displayCommandHeader).not.toHaveBeenCalled();
		});

		it('should call displayError on exception', async () => {
			const error = new Error('Test error');
			mockLoopRun.mockRejectedValue(error);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);

			// process.exit is mocked to throw, so catch that
			try {
				await executeLoop({});
			} catch {
				// Expected
			}

			expect(displayError).toHaveBeenCalledWith(error, { skipExit: true });
		});

		it('should exit with code 1 on error', async () => {
			const error = new Error('Test error');
			mockLoopRun.mockRejectedValue(error);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);

			try {
				await executeLoop({});
			} catch {
				// Expected - our mock throws
			}

			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it('should use default values when options not provided', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({});

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					iterations: 10,
					prompt: 'default',
					sleepSeconds: 5
				})
			);
		});

		it('should pass progressFile to config when provided', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ progressFile: '/custom/progress.txt' });

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					progressFile: '/custom/progress.txt'
				})
			);
		});

		it('should pass status filter to config', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ status: 'in-progress' });

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'in-progress'
				})
			);
		});
	});

	describe('on-complete command execution', () => {
		// Create execAsync mock manually for these tests
		let execAsyncMock: Mock;

		beforeEach(() => {
			execAsyncMock = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
			// Override the promisify mock for these tests
			vi.mocked(promisify).mockReturnValue(execAsyncMock);
		});

		it('should run on-complete when finalStatus is all_complete', async () => {
			const result = createMockResult({ finalStatus: 'all_complete' });
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ onComplete: 'echo done' });

			// Check console output shows running the command
			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).toContain('Running on-complete command');
			expect(allOutput).toContain('echo done');
		});

		it('should NOT run on-complete when not specified even for all_complete', async () => {
			const result = createMockResult({ finalStatus: 'all_complete' });
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({}); // No onComplete option

			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).not.toContain('Running on-complete command');
		});

		it('should NOT run on-complete when finalStatus is max_iterations', async () => {
			const result = createMockResult({ finalStatus: 'max_iterations' });
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ onComplete: 'echo done' });

			// The promisified exec shouldn't be called for on-complete
			// Check console output doesn't show running the command
			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).not.toContain('Running on-complete command');
		});

		it('should NOT run on-complete when finalStatus is blocked', async () => {
			const result = createMockResult({ finalStatus: 'blocked' });
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ onComplete: 'echo done' });

			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).not.toContain('Running on-complete command');
		});

		it('should NOT run on-complete when finalStatus is error', async () => {
			const result = createMockResult({ finalStatus: 'error' });
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ onComplete: 'echo done' });

			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).not.toContain('Running on-complete command');
		});

		it('should log warning when on-complete command fails', async () => {
			const result = createMockResult({ finalStatus: 'all_complete' });
			mockLoopRun.mockResolvedValue(result);

			// Mock execAsync to reject
			const failingExec = vi.fn().mockRejectedValue(new Error('Command failed'));
			vi.mocked(promisify).mockReturnValue(failingExec);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({ onComplete: 'failing-command' });

			// Should log warning but not throw
			const allErrorOutput = consoleErrorSpy.mock.calls.flat().join(' ');
			expect(allErrorOutput).toContain('Warning');
			expect(allErrorOutput).toContain('on-complete');
			expect(allErrorOutput).toContain('failed');
		});
	});

	describe('getLastResult', () => {
		it('should return undefined before executeLoop', () => {
			expect(loopCommand.getLastResult()).toBeUndefined();
		});

		it('should return result after executeLoop', async () => {
			const result = createMockResult({ finalStatus: 'all_complete' });
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({});

			expect(loopCommand.getLastResult()).toEqual(result);
		});
	});

	describe('cleanup', () => {
		it('should clear tmCore reference', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const executeLoop = (loopCommand as any).executeLoop.bind(loopCommand);
			await executeLoop({});

			// After executeLoop, cleanup should have been called
			// tmCore should be undefined
			expect((loopCommand as any).tmCore).toBeUndefined();
		});
	});
});

describe('LoopCommand exports', () => {
	it('should be exported from @tm/cli package index', async () => {
		// This test verifies the export is accessible via the package entry point
		const cliExports = await import('../index.js');
		expect(cliExports.LoopCommand).toBe(LoopCommand);
	});

	it('should be registered in CommandRegistry', async () => {
		const { CommandRegistry } = await import('../command-registry.js');
		expect(CommandRegistry.hasCommand('loop')).toBe(true);
	});

	it('should be in development category', async () => {
		const { CommandRegistry } = await import('../command-registry.js');
		const devCommands = CommandRegistry.getCommandsByCategory('development');
		const loopCmd = devCommands.find((cmd) => cmd.name === 'loop');
		expect(loopCmd).toBeDefined();
		expect(loopCmd?.description).toContain('loop');
	});
});
