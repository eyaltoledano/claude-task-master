/**
 * @fileoverview Integration tests for autopilot workflow commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WorkflowState } from '@tm/core';

// Track file system state in memory - must be in vi.hoisted() for mock access
const {
	mockFileSystem,
	pathExistsFn,
	readJSONFn,
	writeJSONFn,
	ensureDirFn,
	removeFn
} = vi.hoisted(() => {
	const mockFileSystem = new Map<string, string>();

	return {
		mockFileSystem,
		pathExistsFn: vi.fn((path: string) =>
			Promise.resolve(mockFileSystem.has(path))
		),
		readJSONFn: vi.fn((path: string) => {
			const data = mockFileSystem.get(path);
			return data
				? Promise.resolve(JSON.parse(data))
				: Promise.reject(new Error('File not found'));
		}),
		writeJSONFn: vi.fn((path: string, data: any) => {
			mockFileSystem.set(path, JSON.stringify(data));
			return Promise.resolve();
		}),
		ensureDirFn: vi.fn(() => Promise.resolve()),
		removeFn: vi.fn((path: string) => {
			mockFileSystem.delete(path);
			return Promise.resolve();
		})
	};
});

// Mock fs-extra before any imports
vi.mock('fs-extra', () => ({
	default: {
		pathExists: pathExistsFn,
		readJSON: readJSONFn,
		writeJSON: writeJSONFn,
		ensureDir: ensureDirFn,
		remove: removeFn
	}
}));

vi.mock('@tm/core', () => ({
	WorkflowOrchestrator: vi.fn().mockImplementation((context) => ({
		getCurrentPhase: vi.fn().mockReturnValue('SUBTASK_LOOP'),
		getCurrentTDDPhase: vi.fn().mockReturnValue('RED'),
		getContext: vi.fn().mockReturnValue(context),
		transition: vi.fn(),
		restoreState: vi.fn(),
		getState: vi.fn().mockReturnValue({ phase: 'SUBTASK_LOOP', context }),
		enableAutoPersist: vi.fn(),
		canResumeFromState: vi.fn().mockReturnValue(true),
		getCurrentSubtask: vi.fn().mockReturnValue({
			id: '1',
			title: 'Test Subtask',
			status: 'pending',
			attempts: 0
		}),
		getProgress: vi.fn().mockReturnValue({
			completed: 0,
			total: 3,
			current: 1,
			percentage: 0
		}),
		canProceed: vi.fn().mockReturnValue(false)
	})),
	GitAdapter: vi.fn().mockImplementation(() => ({
		ensureGitRepository: vi.fn().mockResolvedValue(undefined),
		ensureCleanWorkingTree: vi.fn().mockResolvedValue(undefined),
		createAndCheckoutBranch: vi.fn().mockResolvedValue(undefined),
		hasStagedChanges: vi.fn().mockResolvedValue(true),
		getStatus: vi.fn().mockResolvedValue({
			staged: ['file1.ts'],
			modified: ['file2.ts']
		}),
		createCommit: vi.fn().mockResolvedValue(undefined),
		getLastCommit: vi.fn().mockResolvedValue({
			hash: 'abc123def456',
			message: 'test commit'
		}),
		stageFiles: vi.fn().mockResolvedValue(undefined)
	})),
	CommitMessageGenerator: vi.fn().mockImplementation(() => ({
		generateMessage: vi.fn().mockReturnValue('feat: test commit message')
	})),
	createTaskMasterCore: vi.fn().mockResolvedValue({
		getTaskWithSubtask: vi.fn().mockResolvedValue({
			task: {
				id: '1',
				title: 'Test Task',
				subtasks: [
					{ id: '1', title: 'Subtask 1', status: 'pending' },
					{ id: '2', title: 'Subtask 2', status: 'pending' },
					{ id: '3', title: 'Subtask 3', status: 'pending' }
				],
				tag: 'test'
			}
		}),
		close: vi.fn().mockResolvedValue(undefined)
	})
}));

// Import after mocks are set up
import { Command } from 'commander';
import { AutopilotCommand } from '../../../../src/commands/autopilot/index.js';

describe('Autopilot Workflow Integration Tests', () => {
	const projectRoot = '/test/project';
	let program: Command;

	beforeEach(() => {
		mockFileSystem.clear();

		// Clear mock call history
		pathExistsFn.mockClear();
		readJSONFn.mockClear();
		writeJSONFn.mockClear();
		ensureDirFn.mockClear();
		removeFn.mockClear();

		program = new Command();
		AutopilotCommand.register(program);

		// Use exitOverride to handle Commander exits in tests
		program.exitOverride();
	});

	afterEach(() => {
		mockFileSystem.clear();
		vi.restoreAllMocks();
	});

	describe('start command', () => {
		it('should initialize workflow and create branch', async () => {
			const consoleLogSpy = vi
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await program.parseAsync([
				'node',
				'test',
				'autopilot',
				'start',
				'1',
				'--project-root',
				projectRoot,
				'--json'
			]);

			// Verify writeJSON was called with state
			expect(writeJSONFn).toHaveBeenCalledWith(
				expect.stringContaining('workflow-state.json'),
				expect.objectContaining({
					phase: expect.any(String),
					context: expect.any(Object)
				}),
				expect.any(Object)
			);

			consoleLogSpy.mockRestore();
		});

		it('should reject invalid task ID', async () => {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			await expect(
				program.parseAsync([
					'node',
					'test',
					'autopilot',
					'start',
					'invalid',
					'--project-root',
					projectRoot,
					'--json'
				])
			).rejects.toMatchObject({ exitCode: 1 });

			consoleErrorSpy.mockRestore();
		});

		it('should reject starting when workflow exists without force', async () => {
			// Create existing state
			const mockState: WorkflowState = {
				phase: 'SUBTASK_LOOP',
				context: {
					taskId: '1',
					subtasks: [],
					currentSubtaskIndex: 0,
					errors: [],
					metadata: {}
				}
			};

			mockFileSystem.set(
				`${projectRoot}/.taskmaster/workflow-state.json`,
				JSON.stringify(mockState)
			);

			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			await expect(
				program.parseAsync([
					'node',
					'test',
					'autopilot',
					'start',
					'1',
					'--project-root',
					projectRoot,
					'--json'
				])
			).rejects.toMatchObject({ exitCode: 1 });

			consoleErrorSpy.mockRestore();
		});
	});

	describe('resume command', () => {
		beforeEach(() => {
			// Create saved state
			const mockState: WorkflowState = {
				phase: 'SUBTASK_LOOP',
				context: {
					taskId: '1',
					subtasks: [
						{
							id: '1',
							title: 'Test Subtask',
							status: 'pending',
							attempts: 0
						}
					],
					currentSubtaskIndex: 0,
					currentTDDPhase: 'RED',
					branchName: 'task-1',
					errors: [],
					metadata: {}
				}
			};

			mockFileSystem.set(
				`${projectRoot}/.taskmaster/workflow-state.json`,
				JSON.stringify(mockState)
			);
		});

		it('should restore workflow from saved state', async () => {
			const consoleLogSpy = vi
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await program.parseAsync([
				'node',
				'test',
				'autopilot',
				'resume',
				'--project-root',
				projectRoot,
				'--json'
			]);

			expect(consoleLogSpy).toHaveBeenCalled();
			const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
			expect(output.success).toBe(true);
			expect(output.taskId).toBe('1');

			consoleLogSpy.mockRestore();
		});

		it('should error when no state exists', async () => {
			mockFileSystem.clear();

			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			await expect(
				program.parseAsync([
					'node',
					'test',
					'autopilot',
					'resume',
					'--project-root',
					projectRoot,
					'--json'
				])
			).rejects.toMatchObject({ exitCode: 1 });

			consoleErrorSpy.mockRestore();
		});
	});

	describe('next command', () => {
		beforeEach(() => {
			const mockState: WorkflowState = {
				phase: 'SUBTASK_LOOP',
				context: {
					taskId: '1',
					subtasks: [
						{
							id: '1',
							title: 'Test Subtask',
							status: 'pending',
							attempts: 0
						}
					],
					currentSubtaskIndex: 0,
					currentTDDPhase: 'RED',
					branchName: 'task-1',
					errors: [],
					metadata: {}
				}
			};

			mockFileSystem.set(
				`${projectRoot}/.taskmaster/workflow-state.json`,
				JSON.stringify(mockState)
			);
		});

		it('should return next action in JSON format', async () => {
			const consoleLogSpy = vi
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await program.parseAsync([
				'node',
				'test',
				'autopilot',
				'next',
				'--project-root',
				projectRoot,
				'--json'
			]);

			expect(consoleLogSpy).toHaveBeenCalled();
			const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
			expect(output.action).toBe('generate_test');
			expect(output.phase).toBe('SUBTASK_LOOP');
			expect(output.tddPhase).toBe('RED');

			consoleLogSpy.mockRestore();
		});
	});

	describe('status command', () => {
		beforeEach(() => {
			const mockState: WorkflowState = {
				phase: 'SUBTASK_LOOP',
				context: {
					taskId: '1',
					subtasks: [
						{ id: '1', title: 'Subtask 1', status: 'completed', attempts: 1 },
						{ id: '2', title: 'Subtask 2', status: 'pending', attempts: 0 },
						{ id: '3', title: 'Subtask 3', status: 'pending', attempts: 0 }
					],
					currentSubtaskIndex: 1,
					currentTDDPhase: 'RED',
					branchName: 'task-1',
					errors: [],
					metadata: {}
				}
			};

			mockFileSystem.set(
				`${projectRoot}/.taskmaster/workflow-state.json`,
				JSON.stringify(mockState)
			);
		});

		it('should display workflow progress', async () => {
			const consoleLogSpy = vi
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await program.parseAsync([
				'node',
				'test',
				'autopilot',
				'status',
				'--project-root',
				projectRoot,
				'--json'
			]);

			expect(consoleLogSpy).toHaveBeenCalled();
			const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
			expect(output.taskId).toBe('1');
			expect(output.phase).toBe('SUBTASK_LOOP');
			expect(output.progress).toBeDefined();
			expect(output.subtasks).toHaveLength(3);

			consoleLogSpy.mockRestore();
		});
	});

	describe('complete command', () => {
		beforeEach(() => {
			const mockState: WorkflowState = {
				phase: 'SUBTASK_LOOP',
				context: {
					taskId: '1',
					subtasks: [
						{
							id: '1',
							title: 'Test Subtask',
							status: 'in-progress',
							attempts: 0
						}
					],
					currentSubtaskIndex: 0,
					currentTDDPhase: 'RED',
					branchName: 'task-1',
					errors: [],
					metadata: {}
				}
			};

			mockFileSystem.set(
				`${projectRoot}/.taskmaster/workflow-state.json`,
				JSON.stringify(mockState)
			);
		});

		it('should validate RED phase has failures', async () => {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});

			await expect(
				program.parseAsync([
					'node',
					'test',
					'autopilot',
					'complete',
					'--project-root',
					projectRoot,
					'--results',
					'{"total":10,"passed":10,"failed":0,"skipped":0}',
					'--json'
				])
			).rejects.toMatchObject({ exitCode: 1 });

			consoleErrorSpy.mockRestore();
		});

		it('should complete RED phase with failures', async () => {
			const consoleLogSpy = vi
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await program.parseAsync([
				'node',
				'test',
				'autopilot',
				'complete',
				'--project-root',
				projectRoot,
				'--results',
				'{"total":10,"passed":9,"failed":1,"skipped":0}',
				'--json'
			]);

			expect(consoleLogSpy).toHaveBeenCalled();
			const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
			expect(output.success).toBe(true);
			expect(output.nextPhase).toBe('GREEN');

			consoleLogSpy.mockRestore();
		});
	});

	describe('abort command', () => {
		beforeEach(() => {
			const mockState: WorkflowState = {
				phase: 'SUBTASK_LOOP',
				context: {
					taskId: '1',
					subtasks: [
						{
							id: '1',
							title: 'Test Subtask',
							status: 'pending',
							attempts: 0
						}
					],
					currentSubtaskIndex: 0,
					currentTDDPhase: 'RED',
					branchName: 'task-1',
					errors: [],
					metadata: {}
				}
			};

			mockFileSystem.set(
				`${projectRoot}/.taskmaster/workflow-state.json`,
				JSON.stringify(mockState)
			);
		});

		it('should abort workflow and delete state', async () => {
			const consoleLogSpy = vi
				.spyOn(console, 'log')
				.mockImplementation(() => {});

			await program.parseAsync([
				'node',
				'test',
				'autopilot',
				'abort',
				'--project-root',
				projectRoot,
				'--force',
				'--json'
			]);

			// Verify remove was called
			expect(removeFn).toHaveBeenCalledWith(
				expect.stringContaining('workflow-state.json')
			);

			consoleLogSpy.mockRestore();
		});
	});
});
