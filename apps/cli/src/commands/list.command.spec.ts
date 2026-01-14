/**
 * @fileoverview Unit tests for ListTasksCommand
 */

import type { TmCore } from '@tm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies - use importOriginal to preserve real implementations
// Only mock createTmCore since we inject a mock tmCore directly in tests
vi.mock('@tm/core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@tm/core')>();
	return {
		...actual,
		createTmCore: vi.fn()
	};
});

vi.mock('../utils/project-root.js', () => ({
	getProjectRoot: vi.fn((path?: string) => path || '/test/project')
}));

vi.mock('../utils/error-handler.js', () => ({
	displayError: vi.fn()
}));

vi.mock('../utils/display-helpers.js', () => ({
	displayCommandHeader: vi.fn()
}));

vi.mock('../ui/index.js', () => ({
	calculateDependencyStatistics: vi.fn(() => ({ total: 0, blocked: 0 })),
	calculateSubtaskStatistics: vi.fn(() => ({ total: 0, completed: 0 })),
	calculateTaskStatistics: vi.fn(() => ({ total: 0, completed: 0 })),
	displayDashboards: vi.fn(),
	displayRecommendedNextTask: vi.fn(),
	displaySuggestedNextSteps: vi.fn(),
	getPriorityBreakdown: vi.fn(() => ({})),
	getTaskDescription: vi.fn(() => 'Test description')
}));

vi.mock('../utils/ui.js', () => ({
	createTaskTable: vi.fn(() => 'Table output'),
	displayWarning: vi.fn()
}));

import { ListTasksCommand } from './list.command.js';

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

		it('should exclude deferred and blocked tasks from ready filter', async () => {
			const command = new ListTasksCommand();

			const mockTasks = [
				{ id: '1', title: 'Task 1', status: 'pending', dependencies: [] },
				{ id: '2', title: 'Task 2', status: 'deferred', dependencies: [] },
				{ id: '3', title: 'Task 3', status: 'blocked', dependencies: [] },
				{ id: '4', title: 'Task 4', status: 'in-progress', dependencies: [] },
				{ id: '5', title: 'Task 5', status: 'review', dependencies: [] }
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 5,
						filtered: 5,
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

			// Should only include pending, in-progress, and review tasks
			expect(parsed.tasks).toHaveLength(3);
			const ids = parsed.tasks.map((t: any) => t.id);
			expect(ids).toContain('1'); // pending
			expect(ids).toContain('4'); // in-progress
			expect(ids).toContain('5'); // review
			expect(ids).not.toContain('2'); // deferred - excluded
			expect(ids).not.toContain('3'); // blocked - excluded
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
				{
					id: '4',
					title: 'Task 4',
					status: 'pending',
					dependencies: ['2', '3']
				}
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

	describe('--ready filter edge cases', () => {
		it('should treat cancelled dependencies as satisfied for --ready filter', async () => {
			const command = new ListTasksCommand();

			// Task 1 is cancelled, Task 2 depends on Task 1
			// Task 2 should be considered "ready" because cancelled = complete
			const mockTasks = [
				{
					id: '1',
					title: 'Cancelled Task',
					status: 'cancelled',
					dependencies: []
				},
				{
					id: '2',
					title: 'Dependent Task',
					status: 'pending',
					dependencies: ['1']
				}
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 2,
						filtered: 2,
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

			// Task 2 should be ready because task 1 (cancelled) counts as complete
			expect(parsed.tasks).toHaveLength(1);
			expect(parsed.tasks[0].id).toBe('2');
			expect(parsed.tasks[0].status).toBe('pending');
		});

		it('should apply status filter after ready filter', async () => {
			const command = new ListTasksCommand();

			// Multiple ready tasks with different statuses
			const mockTasks = [
				{ id: '1', title: 'Done', status: 'done', dependencies: [] },
				{
					id: '2',
					title: 'Pending ready',
					status: 'pending',
					dependencies: ['1']
				},
				{
					id: '3',
					title: 'In-progress ready',
					status: 'in-progress',
					dependencies: ['1']
				}
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
				status: 'pending',
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// With --ready --status=pending, should only show task 2
			// Task 2 is ready (dep 1 is done) and pending
			// Task 3 is ready but in-progress, not pending
			expect(parsed.tasks).toHaveLength(1);
			expect(parsed.tasks[0].id).toBe('2');
			expect(parsed.tasks[0].status).toBe('pending');
		});
	});

	describe('buildBlocksMap validation', () => {
		it('should warn about dependencies to non-existent tasks', async () => {
			const consoleWarnSpy = vi
				.spyOn(console, 'warn')
				.mockImplementation(() => {});
			const command = new ListTasksCommand();

			const mockTasks = [
				{
					id: '1',
					title: 'Task with bad dep',
					status: 'pending',
					dependencies: ['999']
				}
			];

			(command as any).tmCore = {
				tasks: {
					list: vi.fn().mockResolvedValue({
						tasks: mockTasks,
						total: 1,
						filtered: 1,
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

			// Verify console.warn was called with warning about invalid dependency
			expect(consoleWarnSpy).toHaveBeenCalled();

			// Find the call that mentions invalid dependency references
			const warnCalls = consoleWarnSpy.mock.calls.map((call) => call[0]);
			const hasInvalidDepWarning = warnCalls.some(
				(msg) =>
					typeof msg === 'string' &&
					msg.includes('invalid dependency reference')
			);
			const hasSpecificTaskWarning = warnCalls.some(
				(msg) =>
					typeof msg === 'string' &&
					msg.includes('Task 1') &&
					msg.includes('999')
			);

			expect(hasInvalidDepWarning).toBe(true);
			expect(hasSpecificTaskWarning).toBe(true);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('--all-tags option', () => {
		it('should fetch tasks from multiple tags and include tagName field', async () => {
			const command = new ListTasksCommand();

			// Mock tasks for different tags
			const featureATasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Feature A Task 1',
						status: 'pending',
						dependencies: []
					},
					{
						id: '2',
						title: 'Feature A Task 2',
						status: 'done',
						dependencies: []
					}
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			const featureBTasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Feature B Task 1',
						status: 'in-progress',
						dependencies: []
					},
					{
						id: '2',
						title: 'Feature B Task 2',
						status: 'pending',
						dependencies: ['1']
					}
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			const listMock = vi
				.fn()
				.mockResolvedValueOnce(featureATasksResponse)
				.mockResolvedValueOnce(featureBTasksResponse);

			(command as any).tmCore = {
				tasks: {
					list: listMock,
					getTagsWithStats: vi.fn().mockResolvedValue({
						tags: [
							{ name: 'feature-a', taskCount: 2 },
							{ name: 'feature-b', taskCount: 2 }
						]
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				allTags: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Should include tasks from both tags
			expect(parsed.tasks).toHaveLength(4);

			// Each task should have tagName field
			const featureATasks = parsed.tasks.filter(
				(t: any) => t.tagName === 'feature-a'
			);
			const featureBTasks = parsed.tasks.filter(
				(t: any) => t.tagName === 'feature-b'
			);

			expect(featureATasks).toHaveLength(2);
			expect(featureBTasks).toHaveLength(2);

			// Verify metadata indicates all tags
			expect(parsed.metadata.allTags).toBe(true);
			expect(parsed.metadata.tag).toBe('all');
			expect(parsed.metadata.total).toBe(4);
		});

		it('should apply --ready filter per-tag when combined with --all-tags', async () => {
			const command = new ListTasksCommand();

			// Tag A: Task 1 is done, Task 2 depends on Task 1 (ready)
			const tagATasksResponse = {
				tasks: [
					{ id: '1', title: 'Tag A Task 1', status: 'done', dependencies: [] },
					{
						id: '2',
						title: 'Tag A Task 2',
						status: 'pending',
						dependencies: ['1']
					}
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			// Tag B: Task 1 is pending (ready), Task 2 depends on Task 1 (not ready)
			// Note: Task IDs can overlap between tags, but dependencies are tag-scoped
			const tagBTasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Tag B Task 1',
						status: 'pending',
						dependencies: []
					},
					{
						id: '2',
						title: 'Tag B Task 2',
						status: 'pending',
						dependencies: ['1']
					}
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			const listMock = vi
				.fn()
				.mockResolvedValueOnce(tagATasksResponse)
				.mockResolvedValueOnce(tagBTasksResponse);

			(command as any).tmCore = {
				tasks: {
					list: listMock,
					getTagsWithStats: vi.fn().mockResolvedValue({
						tags: [
							{ name: 'tag-a', taskCount: 2 },
							{ name: 'tag-b', taskCount: 2 }
						]
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				allTags: true,
				ready: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Tag A: Task 2 is ready (Task 1 is done)
			// Tag B: Task 1 is ready (no deps), Task 2 is NOT ready (Task 1 is pending)
			expect(parsed.tasks).toHaveLength(2);

			const taskIds = parsed.tasks.map((t: any) => `${t.tagName}:${t.id}`);
			expect(taskIds).toContain('tag-a:2'); // Ready: deps satisfied
			expect(taskIds).toContain('tag-b:1'); // Ready: no deps
			expect(taskIds).not.toContain('tag-b:2'); // Not ready: depends on pending task
		});

		it('should reject --all-tags combined with --watch', () => {
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const command = new ListTasksCommand();

			const isValid = (command as any).validateOptions({
				allTags: true,
				watch: true
			});

			expect(isValid).toBe(false);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('--all-tags cannot be used with --watch mode')
			);

			consoleErrorSpy.mockRestore();
		});

		it('should apply --blocking filter with --all-tags', async () => {
			const command = new ListTasksCommand();

			// Tag A: Task 1 blocks Task 2
			const tagATasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Tag A Task 1',
						status: 'pending',
						dependencies: []
					},
					{
						id: '2',
						title: 'Tag A Task 2',
						status: 'pending',
						dependencies: ['1']
					}
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			// Tag B: Task 1 blocks nothing (no other tasks depend on it)
			const tagBTasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Tag B Task 1',
						status: 'pending',
						dependencies: []
					}
				],
				total: 1,
				filtered: 1,
				storageType: 'json'
			};

			const listMock = vi
				.fn()
				.mockResolvedValueOnce(tagATasksResponse)
				.mockResolvedValueOnce(tagBTasksResponse);

			(command as any).tmCore = {
				tasks: {
					list: listMock,
					getTagsWithStats: vi.fn().mockResolvedValue({
						tags: [
							{ name: 'tag-a', taskCount: 2 },
							{ name: 'tag-b', taskCount: 1 }
						]
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				allTags: true,
				blocking: true,
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Only Tag A Task 1 blocks other tasks
			expect(parsed.tasks).toHaveLength(1);
			expect(parsed.tasks[0].tagName).toBe('tag-a');
			expect(parsed.tasks[0].id).toBe('1');
			expect(parsed.tasks[0].blocks).toContain('2');
		});

		it('should apply status filter with --all-tags', async () => {
			const command = new ListTasksCommand();

			const tagATasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Tag A Task 1',
						status: 'pending',
						dependencies: []
					},
					{ id: '2', title: 'Tag A Task 2', status: 'done', dependencies: [] }
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			const tagBTasksResponse = {
				tasks: [
					{
						id: '1',
						title: 'Tag B Task 1',
						status: 'in-progress',
						dependencies: []
					},
					{
						id: '2',
						title: 'Tag B Task 2',
						status: 'pending',
						dependencies: []
					}
				],
				total: 2,
				filtered: 2,
				storageType: 'json'
			};

			const listMock = vi
				.fn()
				.mockResolvedValueOnce(tagATasksResponse)
				.mockResolvedValueOnce(tagBTasksResponse);

			(command as any).tmCore = {
				tasks: {
					list: listMock,
					getTagsWithStats: vi.fn().mockResolvedValue({
						tags: [
							{ name: 'tag-a', taskCount: 2 },
							{ name: 'tag-b', taskCount: 2 }
						]
					}),
					getStorageType: vi.fn().mockReturnValue('json')
				},
				config: {
					getActiveTag: vi.fn().mockReturnValue('master')
				}
			};

			await (command as any).executeCommand({
				allTags: true,
				status: 'pending',
				json: true
			});

			const output = consoleLogSpy.mock.calls[0][0];
			const parsed = JSON.parse(output);

			// Only pending tasks should be included
			expect(parsed.tasks).toHaveLength(2);
			expect(parsed.tasks.every((t: any) => t.status === 'pending')).toBe(true);

			const taskIds = parsed.tasks.map((t: any) => `${t.tagName}:${t.id}`);
			expect(taskIds).toContain('tag-a:1');
			expect(taskIds).toContain('tag-b:2');
		});
	});
});
