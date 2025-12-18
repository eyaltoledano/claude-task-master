/**
 * @fileoverview Unit tests for ListTasksCommand
 */

import type { TmCore } from '@tm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Terminal complete statuses
const TERMINAL_COMPLETE_STATUSES = ['done', 'cancelled'] as const;

// Mock dependencies
vi.mock('@tm/core', () => ({
	createTmCore: vi.fn(),
	OUTPUT_FORMATS: ['text', 'json', 'compact'],
	TASK_STATUSES: [
		'pending',
		'in-progress',
		'done',
		'review',
		'deferred',
		'cancelled'
	],
	STATUS_ICONS: {
		pending: '⏳',
		'in-progress': '🔄',
		done: '✅',
		review: '👀',
		deferred: '⏸️',
		cancelled: '❌'
	},
	TERMINAL_COMPLETE_STATUSES: ['done', 'cancelled'],
	isTaskComplete: (status: string) =>
		TERMINAL_COMPLETE_STATUSES.includes(status as any)
}));

vi.mock('../../../src/utils/project-root.js', () => ({
	getProjectRoot: vi.fn((path?: string) => path || '/test/project')
}));

vi.mock('../../../src/utils/task-status.js', () => ({
	TERMINAL_COMPLETE_STATUSES: ['done', 'cancelled'],
	isTaskComplete: (status: string) =>
		['done', 'cancelled'].includes(status)
}));

vi.mock('../../../src/utils/error-handler.js', () => ({
	displayError: vi.fn()
}));

vi.mock('../../../src/utils/display-helpers.js', () => ({
	displayCommandHeader: vi.fn()
}));

vi.mock('../../../src/ui/index.js', () => ({
	calculateDependencyStatistics: vi.fn(() => ({ total: 0, blocked: 0 })),
	calculateSubtaskStatistics: vi.fn(() => ({ total: 0, completed: 0 })),
	calculateTaskStatistics: vi.fn(() => ({ total: 0, completed: 0 })),
	displayDashboards: vi.fn(),
	displayRecommendedNextTask: vi.fn(),
	displaySuggestedNextSteps: vi.fn(),
	getPriorityBreakdown: vi.fn(() => ({})),
	getTaskDescription: vi.fn(() => 'Test description')
}));

vi.mock('../../../src/utils/ui.js', () => ({
	createTaskTable: vi.fn(() => 'Table output'),
	displayWarning: vi.fn()
}));

import { ListTasksCommand } from '../../../src/commands/list.command.js';

describe('ListTasksCommand', () => {
	let consoleLogSpy: any;
	let mockTmCore: Partial<TmCore>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		mockTmCore = {
			tasks: {
				list: vi.fn().mockResolvedValue({
					tasks: [{ id: '1', title: 'Test Task', status: 'pending' }],
					total: 1,
					filtered: 1,
					storageType: 'json'
				}),
				getStorageType: vi.fn().mockReturnValue('json')
			} as any,
			config: {
				getActiveTag: vi.fn().mockReturnValue('master')
			} as any
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
		consoleLogSpy.mockRestore();
	});

	describe('JSON output format', () => {
		it('should use JSON format when --json flag is set', async () => {
			const command = new ListTasksCommand();

			// Mock the tmCore initialization
			(command as any).tmCore = mockTmCore;

			// Execute with --json flag
			await (command as any).executeCommand({
				json: true,
				format: 'text' // Should be overridden by --json
			});

			// Verify JSON output was called
			expect(consoleLogSpy).toHaveBeenCalled();
			const output = consoleLogSpy.mock.calls[0][0];

			// Should be valid JSON
			expect(() => JSON.parse(output)).not.toThrow();

			const parsed = JSON.parse(output);
			expect(parsed).toHaveProperty('tasks');
			expect(parsed).toHaveProperty('metadata');
		});

		it('should override --format when --json is set', async () => {
			const command = new ListTasksCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand({
				json: true,
				format: 'compact' // Should be overridden
			});

			// Should output JSON, not compact format
			const output = consoleLogSpy.mock.calls[0][0];
			expect(() => JSON.parse(output)).not.toThrow();
		});

		it('should use specified format when --json is not set', async () => {
			const command = new ListTasksCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand({
				format: 'compact'
			});

			// Should use compact format (not JSON)
			const output = consoleLogSpy.mock.calls;
			// In compact mode, output is not JSON
			expect(output.length).toBeGreaterThan(0);
		});

		it('should default to text format when neither flag is set', async () => {
			const command = new ListTasksCommand();
			(command as any).tmCore = mockTmCore;

			await (command as any).executeCommand({});

			// Should use text format (not JSON)
			// If any console.log was called, verify it's not JSON
			if (consoleLogSpy.mock.calls.length > 0) {
				const output = consoleLogSpy.mock.calls[0][0];
				// Text format output should not be parseable JSON
				// or should be the table string we mocked
				expect(
					output === 'Table output' ||
						(() => {
							try {
								JSON.parse(output);
								return false;
							} catch {
								return true;
							}
						})()
				).toBe(true);
			}
		});
	});

	describe('format validation', () => {
		it('should accept valid formats', () => {
			const command = new ListTasksCommand();

			expect((command as any).validateOptions({ format: 'text' })).toBe(true);
			expect((command as any).validateOptions({ format: 'json' })).toBe(true);
			expect((command as any).validateOptions({ format: 'compact' })).toBe(
				true
			);
		});

		it('should reject invalid formats', () => {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const command = new ListTasksCommand();

			expect((command as any).validateOptions({ format: 'invalid' })).toBe(
				false
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Invalid format: invalid')
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe('--ready filter', () => {
		it('should filter to only tasks with all dependencies satisfied', async () => {
			const command = new ListTasksCommand();

			// Mock tasks where some have satisfied deps and some don't
			const mockTasks = [
				{ id: '1', title: 'Task 1', status: 'done', dependencies: [] },
				{ id: '2', title: 'Task 2', status: 'pending', dependencies: ['1'] }, // deps satisfied (1 is done)
				{ id: '3', title: 'Task 3', status: 'pending', dependencies: ['2'] }, // deps NOT satisfied (2 is pending)
				{ id: '4', title: 'Task 4', status: 'pending', dependencies: [] } // no deps, ready
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 4,
						filtered: 4,
						storageType: 'json'
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				ready: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Should only include tasks 2 and 4 (ready to work on)
			expect(parsed.tasks).toHaveLength(2);
			expect(parsed.tasks.map((t: any) => t.id)).toEqual(
				expect.arrayContaining(['2', '4'])
			);
			expect(parsed.tasks.map((t: any) => t.id)).not.toContain('3');
		});

		it('should exclude done/cancelled tasks from ready filter', async () => {
			const command = new ListTasksCommand();

			const mockTasks = [
				{ id: '1', title: 'Task 1', status: 'done', dependencies: [] },
				{ id: '2', title: 'Task 2', status: 'cancelled', dependencies: [] },
				{ id: '3', title: 'Task 3', status: 'pending', dependencies: [] }
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 3,
						filtered: 3,
						storageType: 'json'
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				ready: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Should only include task 3 (pending with no deps)
			expect(parsed.tasks).toHaveLength(1);
			expect(parsed.tasks[0].id).toBe('3');
		});
	});

	describe('--blocking filter', () => {
		it('should filter to only tasks that block other tasks', async () => {
			const command = new ListTasksCommand();

			const mockTasks = [
				{ id: '1', title: 'Task 1', status: 'pending', dependencies: [] }, // blocks 2, 3
				{ id: '2', title: 'Task 2', status: 'pending', dependencies: ['1'] }, // blocks 4
				{ id: '3', title: 'Task 3', status: 'pending', dependencies: ['1'] }, // blocks nothing
				{ id: '4', title: 'Task 4', status: 'pending', dependencies: ['2'] } // blocks nothing
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 4,
						filtered: 4,
						storageType: 'json'
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				blocking: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Should only include tasks 1 and 2 (they block other tasks)
			expect(parsed.tasks).toHaveLength(2);
			expect(parsed.tasks.map((t: any) => t.id)).toEqual(
				expect.arrayContaining(['1', '2'])
			);
		});
	});

	describe('--ready --blocking combined filter', () => {
		it('should show high-impact tasks (ready AND blocking)', async () => {
			const command = new ListTasksCommand();

			const mockTasks = [
				{ id: '1', title: 'Task 1', status: 'done', dependencies: [] },
				{ id: '2', title: 'Task 2', status: 'pending', dependencies: ['1'] }, // ready (1 done), blocks 3,4
				{ id: '3', title: 'Task 3', status: 'pending', dependencies: ['2'] }, // not ready, blocks 5
				{ id: '4', title: 'Task 4', status: 'pending', dependencies: ['2'] }, // not ready, blocks nothing
				{ id: '5', title: 'Task 5', status: 'pending', dependencies: ['3'] }, // not ready, blocks nothing
				{ id: '6', title: 'Task 6', status: 'pending', dependencies: [] } // ready, blocks nothing
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 6,
						filtered: 6,
						storageType: 'json'
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				ready: true,
				blocking: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Should only include task 2 (ready AND blocks other tasks)
			expect(parsed.tasks).toHaveLength(1);
			expect(parsed.tasks[0].id).toBe('2');
		});
	});

	describe('blocks field in output', () => {
		it('should include blocks field showing which tasks depend on each task', async () => {
			const command = new ListTasksCommand();

			const mockTasks = [
				{ id: '1', title: 'Task 1', status: 'pending', dependencies: [] },
				{ id: '2', title: 'Task 2', status: 'pending', dependencies: ['1'] },
				{ id: '3', title: 'Task 3', status: 'pending', dependencies: ['1'] },
				{ id: '4', title: 'Task 4', status: 'pending', dependencies: ['2', '3'] }
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 4,
						filtered: 4,
						storageType: 'json'
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Task 1 blocks tasks 2 and 3
			const task1 = parsed.tasks.find((t: any) => t.id === '1');
			expect(task1.blocks).toEqual(expect.arrayContaining(['2', '3']));

			// Task 2 blocks task 4
			const task2 = parsed.tasks.find((t: any) => t.id === '2');
			expect(task2.blocks).toEqual(['4']);

			// Task 3 blocks task 4
			const task3 = parsed.tasks.find((t: any) => t.id === '3');
			expect(task3.blocks).toEqual(['4']);

			// Task 4 blocks nothing
			const task4 = parsed.tasks.find((t: any) => t.id === '4');
			expect(task4.blocks).toEqual([]);
		});
	});
});
