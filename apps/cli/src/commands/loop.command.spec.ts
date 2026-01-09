/**
 * @fileoverview Unit tests for LoopCommand
 */

import { Command } from 'commander';
import {
	type Mock,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest';
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

import type { LoopResult } from '@tm/core';
import { createTmCore } from '@tm/core';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

describe('LoopCommand', () => {
	let loopCommand: LoopCommand;
	let mockTmCore: any;
	let mockLoopRun: Mock;
	let consoleLogSpy: any;
	let processExitSpy: any;

	const createMockResult = (
		overrides: Partial<LoopResult> = {}
	): LoopResult => ({
		iterations: [],
		totalIterations: 3,
		tasksCompleted: 2,
		finalStatus: 'max_iterations',
		...overrides
	});

	beforeEach(() => {
		vi.clearAllMocks();

		// Re-setup mock return values after clearAllMocks
		(getProjectRoot as Mock).mockReturnValue('/test/project');

		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});

		mockLoopRun = vi.fn().mockResolvedValue(createMockResult());
		mockTmCore = {
			loop: {
				run: mockLoopRun,
				checkSandboxAuth: vi.fn().mockReturnValue(true),
				runInteractiveAuth: vi.fn()
			},
			tasks: {
				getStorageType: vi.fn().mockReturnValue('local'),
				getNext: vi.fn().mockResolvedValue({ id: '1', title: 'Test Task' })
			}
		};

		(createTmCore as Mock).mockResolvedValue(mockTmCore);
		loopCommand = new LoopCommand();
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
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
			expect(program.commands.find((c) => c.name() === 'loop')).toBe(
				registered
			);
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
			const option = loopCommand.options.find(
				(o) => o.long === '--progress-file'
			);
			expect(option).toBeDefined();
		});

		it('should have --project option', () => {
			const option = loopCommand.options.find((o) => o.long === '--project');
			expect(option).toBeDefined();
		});
	});

	describe('validateIterations', () => {
		it('should throw error for invalid iterations (non-numeric)', () => {
			const validateIterations = (loopCommand as any).validateIterations.bind(
				loopCommand
			);
			expect(() => validateIterations('abc')).toThrow('Invalid iterations');
		});

		it('should throw error for invalid iterations (negative)', () => {
			const validateIterations = (loopCommand as any).validateIterations.bind(
				loopCommand
			);
			expect(() => validateIterations('-5')).toThrow('Invalid iterations');
		});

		it('should throw error for invalid iterations (zero)', () => {
			const validateIterations = (loopCommand as any).validateIterations.bind(
				loopCommand
			);
			expect(() => validateIterations('0')).toThrow('Invalid iterations');
		});

		it('should allow valid iterations', () => {
			const validateIterations = (loopCommand as any).validateIterations.bind(
				loopCommand
			);
			expect(() => validateIterations('5')).not.toThrow();
		});
	});

	describe('formatStatus', () => {
		it('should format "all_complete" as green', () => {
			const formatStatus = (loopCommand as any).formatStatus.bind(loopCommand);
			const result = formatStatus('all_complete');
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
			const displayResult = (loopCommand as any).displayResult.bind(
				loopCommand
			);
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

	describe('execute integration', () => {
		it('should call tmCore.loop.run with parsed config', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({
				iterations: '5',
				prompt: 'test-coverage',
				tag: 'feature'
			});

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					iterations: 5,
					prompt: 'test-coverage',
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

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({ json: true });

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

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({});

			expect(displayCommandHeader).toHaveBeenCalled();
		});

		it('should NOT display header for JSON output', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({ json: true });

			expect(displayCommandHeader).not.toHaveBeenCalled();
		});

		it('should call displayError on exception', async () => {
			const error = new Error('Test error');
			mockLoopRun.mockRejectedValue(error);

			const execute = (loopCommand as any).execute.bind(loopCommand);

			try {
				await execute({});
			} catch {
				// Expected
			}

			expect(displayError).toHaveBeenCalledWith(error, { skipExit: true });
		});

		it('should exit with code 1 on error', async () => {
			const error = new Error('Test error');
			mockLoopRun.mockRejectedValue(error);

			const execute = (loopCommand as any).execute.bind(loopCommand);

			try {
				await execute({});
			} catch {
				// Expected - our mock throws
			}

			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		it('should use default values when options not provided', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({});

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					iterations: 10,
					prompt: 'default'
				})
			);
		});

		it('should pass progressFile to config when provided', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({ progressFile: '/custom/progress.txt' });

			expect(mockLoopRun).toHaveBeenCalledWith(
				expect.objectContaining({
					progressFile: '/custom/progress.txt'
				})
			);
		});

		it('should check sandbox auth before running', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({});

			expect(mockTmCore.loop.checkSandboxAuth).toHaveBeenCalled();
		});

		it('should run interactive auth when sandbox not ready', async () => {
			mockTmCore.loop.checkSandboxAuth.mockReturnValue(false);
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({});

			expect(mockTmCore.loop.runInteractiveAuth).toHaveBeenCalled();
		});

		it('should show next task before starting loop', async () => {
			const result = createMockResult();
			mockLoopRun.mockResolvedValue(result);

			const execute = (loopCommand as any).execute.bind(loopCommand);
			await execute({});

			expect(mockTmCore.tasks.getNext).toHaveBeenCalled();
			const allOutput = consoleLogSpy.mock.calls.flat().join(' ');
			expect(allOutput).toContain('Next task');
			expect(allOutput).toContain('Test Task');
		});
	});
});
