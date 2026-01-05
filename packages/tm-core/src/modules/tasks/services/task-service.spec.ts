/**
 * @fileoverview Unit tests for TaskService
 * Tests task operations including getNextTasks method
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskService } from './task-service.js';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import type { Task } from '../../../common/types/index.js';
import type { ConfigManager } from '../../config/managers/config-manager.js';

/**
 * Mock storage implementation for testing
 */
function createMockStorage(tasks: Task[] = []): IStorage {
	return {
		loadTasks: vi.fn().mockResolvedValue(tasks),
		loadTask: vi.fn(),
		saveTasks: vi.fn(),
		appendTasks: vi.fn(),
		updateTask: vi.fn(),
		updateTaskWithPrompt: vi.fn(),
		expandTaskWithPrompt: vi.fn(),
		updateTaskStatus: vi.fn(),
		deleteTask: vi.fn(),
		exists: vi.fn().mockResolvedValue(true),
		loadMetadata: vi.fn(),
		saveMetadata: vi.fn(),
		getAllTags: vi.fn().mockResolvedValue(['master']),
		createTag: vi.fn(),
		deleteTag: vi.fn(),
		renameTag: vi.fn(),
		copyTag: vi.fn(),
		initialize: vi.fn(),
		close: vi.fn(),
		getStats: vi.fn(),
		getStorageType: vi.fn().mockReturnValue('file'),
		getCurrentBriefName: vi.fn().mockReturnValue(null),
		getTagsWithStats: vi.fn(),
		watch: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() })
	};
}

/**
 * Mock ConfigManager for testing
 */
function createMockConfigManager(): Partial<ConfigManager> {
	return {
		getStorageConfig: vi.fn().mockReturnValue({
			type: 'file',
			filePath: '/tmp/tasks.json'
		}),
		getProjectRoot: vi.fn().mockReturnValue('/tmp/project'),
		getActiveTag: vi.fn().mockReturnValue('master'),
		setActiveTag: vi.fn().mockResolvedValue(undefined)
	};
}

describe('TaskService - getNextTasks', () => {
	let taskService: TaskService;
	let mockStorage: IStorage;
	let mockConfigManager: Partial<ConfigManager>;

	beforeEach(() => {
		mockConfigManager = createMockConfigManager();
		taskService = new TaskService(mockConfigManager as ConfigManager);
		mockStorage = createMockStorage();
	});

	afterEach(async () => {
		await taskService.close();
	});

	/**
	 * FR-001: Method exists with correct signature
	 */
	describe('Method signature and basic functionality', () => {
		it('should have getNextTasks method that accepts concurrency and tag', async () => {
			// Arrange
			mockStorage = createMockStorage([]);
			(taskService as any).storage = mockStorage;
			await taskService.initialize();

			// Act & Assert
			expect(typeof taskService.getNextTasks).toBe('function');
			const result = await taskService.getNextTasks(2);
			expect(Array.isArray(result)).toBe(true);
		});

		it('should return Promise<Task[]>', async () => {
			// Arrange
			mockStorage = createMockStorage([]);
			(taskService as any).storage = mockStorage;
			await taskService.initialize();

			// Act
			const result = taskService.getNextTasks(1);

			// Assert
			expect(result).toBeInstanceOf(Promise);
			const tasks = await result;
			expect(Array.isArray(tasks)).toBe(true);
		});

		it('should accept tag parameter', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'Description for task 1',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(1, 'custom-tag');

			// Assert
			expect(result).toHaveLength(1);
			expect(mockStorage.loadTasks).toHaveBeenCalledWith('custom-tag', expect.any(Object));
		});
	});

	/**
	 * FR-003: Validate concurrency parameter
	 */
	describe('Concurrency parameter validation', () => {
		beforeEach(async () => {
			mockStorage = createMockStorage([]);
			(taskService as any).storage = mockStorage;
			await taskService.initialize();
		});

		it('should throw error if concurrency < 1', async () => {
			await expect(taskService.getNextTasks(0)).rejects.toThrow(
				'Concurrency must be at least 1'
			);
			await expect(taskService.getNextTasks(-1)).rejects.toThrow(
				'Concurrency must be at least 1'
			);
		});

		it('should throw error if concurrency is not a number', async () => {
			await expect(taskService.getNextTasks(NaN as any)).rejects.toThrow(
				"Invalid concurrency value: 'NaN'"
			);
			await expect(taskService.getNextTasks('abc' as any)).rejects.toThrow(
				"Invalid concurrency value: 'abc'"
			);
		});

		it('should cap concurrency at 10 with warning', async () => {
			// Arrange
			const loggerWarnSpy = vi.spyOn((taskService as any).logger, 'warn');

			// Act
			const result = await taskService.getNextTasks(15);

			// Assert
			expect(result).toHaveLength(0); // No tasks available
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				'Concurrency capped at maximum of 10. Requested: 15, using: 10'
			);
		});

		it('should accept concurrency = 1', async () => {
			const result = await taskService.getNextTasks(1);
			expect(Array.isArray(result)).toBe(true);
		});

		it('should accept valid concurrency values up to 10', async () => {
			const values = [1, 2, 5, 10];
			for (const concurrency of values) {
				const result = await taskService.getNextTasks(concurrency);
				expect(Array.isArray(result)).toBe(true);
			}
		});
	});

	/**
	 * FR-002: Implement concurrent task selection algorithm
	 */
	describe('Task selection algorithm', () => {
		beforeEach(async () => {
			(taskService as any).storage = mockStorage;
			await taskService.initialize();
		});

		it('should return empty array when no eligible tasks exist', async () => {
			// Arrange
			mockStorage = createMockStorage([]);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(3);

			// Assert
			expect(result).toEqual([]);
		});

		it('should return single task when only one eligible', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'Description for task 1',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(3);

			// Assert
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1');
		});

		it('should return fewer tasks than requested when insufficient eligible tasks', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'Description for task 1',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: 'Description for task 2',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(5);

			// Assert
			expect(result).toHaveLength(2); // Only 2 tasks available
		});

		it('should prioritize tasks by critical > high > medium > low', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Low Priority',
					description: 'Low priority task',
					status: 'pending',
					priority: 'low',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Critical Priority',
					description: 'Critical priority task',
					status: 'pending',
					priority: 'critical',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '3',
					title: 'Medium Priority',
					description: 'Medium priority task',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '4',
					title: 'High Priority',
					description: 'High priority task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(4);

			// Assert
			expect(result).toHaveLength(4);
			expect(result[0].id).toBe('2'); // critical
			expect(result[1].id).toBe('4'); // high
			expect(result[2].id).toBe('3'); // medium
			expect(result[3].id).toBe('1'); // low
		});

		it('should ensure all returned tasks have satisfied dependencies', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Completed Task',
					description: 'Completed task',
					status: 'done',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task with satisfied dependency',
					description: 'Task depending on 1',
					status: 'pending',
					priority: 'high',
					dependencies: ['1'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '3',
					title: 'Task with unsatisfied dependency',
					description: 'Task depending on non-existent 99',
					status: 'pending',
					priority: 'high',
					dependencies: ['99'],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(5);

			// Assert
			expect(result.length).toBeGreaterThan(0);
			result.forEach((task) => {
				// None should have unsatisfied dependencies
				if (task.dependencies && task.dependencies.length > 0) {
					// Task 2 should be included, Task 3 should not
					expect(task.id).not.toBe('3');
				}
			});
		});

		it('should ensure no returned task depends on another returned task', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'First task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task 2 depends on 1',
					description: 'Second task depending on 1',
					status: 'pending',
					priority: 'high',
					dependencies: ['1'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '3',
					title: 'Task 3',
					description: 'Third independent task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(3);

			// Assert
			const returnedIds = result.map((t) => String(t.id));

			// Should include Task 1 and Task 3, but not Task 2 (which depends on 1)
			expect(returnedIds).toContain('1');
			expect(returnedIds).toContain('3');

			// If Task 1 is included, Task 2 should not be
			if (returnedIds.includes('1')) {
				expect(returnedIds).not.toContain('2');
			}
		});

		it('should handle bidirectional dependency conflicts', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'First task',
					status: 'pending',
					priority: 'high',
					dependencies: ['2'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task 2',
					description: 'Second task',
					status: 'pending',
					priority: 'high',
					dependencies: ['1'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '3',
					title: 'Task 3',
					description: 'Third independent task',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(5);

			// Assert
			const returnedIds = result.map((t) => String(t.id));

			// Only Task 3 should be returned (Tasks 1 and 2 depend on each other)
			expect(returnedIds).not.toContain('1');
			expect(returnedIds).not.toContain('2');
			expect(returnedIds).toContain('3');
		});
	});

	/**
	 * FR-004: Handle mixed task/subtask dependencies
	 */
	describe('Subtask handling', () => {
		beforeEach(async () => {
			(taskService as any).storage = mockStorage;
			await taskService.initialize();
		});

		it('should prioritize subtasks from in-progress parents', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'In-Progress Parent',
					description: 'Parent task in progress',
					status: 'in-progress',
					priority: 'critical',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: [
						{
							id: 1,
							parentId: '1',
							title: 'Subtask 1.1',
							description: 'First subtask',
							status: 'pending',
							priority: 'critical',
							dependencies: [],
							details: '',
							testStrategy: ''
						}
					]
				},
				{
					id: '2',
					title: 'Top-level task',
					description: 'Top level task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(2);

			// Assert
			// Subtask from in-progress parent should come first (critical > high)
			expect(result[0].id).toBe('1.1');
			expect(result[1].id).toBe('2');
		});

		it('should handle subtask dependencies correctly', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Parent Task',
					description: 'Parent task',
					status: 'in-progress',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: [
						{
							id: 1,
							parentId: '1',
							title: 'Subtask 1.1 - Done',
							description: 'First subtask done',
							status: 'done',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: ''
						},
						{
							id: 2,
							parentId: '1',
							title: 'Subtask 1.2 - Pending',
							description: 'Second subtask pending',
							status: 'pending',
							priority: 'high',
							dependencies: ['1'],
							details: '',
							testStrategy: ''
						}
					]
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(2);

			// Assert
			// Subtask 1.2 should be returned (dependency 1.1 is done)
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1.2');
		});

		it('should normalize subtask dependencies to full dotted notation', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Parent Task',
					description: 'Parent task',
					status: 'in-progress',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: [
						{
							id: 1,
							parentId: '1',
							title: 'Subtask 1.1',
							description: 'First subtask',
							status: 'done',
							priority: 'high',
							dependencies: [],
							details: '',
							testStrategy: ''
						},
						{
							id: 2,
							parentId: '1',
							title: 'Subtask 1.2 with numeric dep',
							description: 'Second subtask with numeric dep',
							status: 'pending',
							priority: 'high',
							dependencies: ['1'], // String reference
							details: '',
							testStrategy: ''
						}
					]
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(2);

			// Assert
			// Should handle numeric dependency reference correctly
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('1.2');
		});
	});

	/**
	 * Edge cases and complex scenarios
	 */
	describe('Edge cases', () => {
		beforeEach(async () => {
			(taskService as any).storage = mockStorage;
			await taskService.initialize();
		});

		it('should return only pending and in-progress tasks', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Pending Task',
					description: 'Pending task',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'In-Progress Task',
					description: 'In-progress task',
					status: 'in-progress',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '3',
					title: 'Done Task',
					description: 'Completed task',
					status: 'done',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '4',
					title: 'Blocked Task',
					description: 'Blocked task',
					status: 'blocked',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(10);

			// Assert
			expect(result.length).toBeLessThanOrEqual(2);
			result.forEach((task) => {
				expect(['pending', 'in-progress']).toContain(task.status);
			});
		});

		it('should handle projects with only completed tasks', async () => {
			// Arrange
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Completed Task',
					description: 'First completed task',
					status: 'done',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Another Completed',
					description: 'Second completed task',
					status: 'done',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(5);

			// Assert
			expect(result).toEqual([]);
		});

		it('should handle complex dependency chains', async () => {
			// Arrange: 1 -> 2 -> 3 (chain), 4 (independent)
			const tasks: Task[] = [
				{
					id: '1',
					title: 'Task 1',
					description: 'First task in chain',
					status: 'pending',
					priority: 'high',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '2',
					title: 'Task 2 depends on 1',
					description: 'Second task in chain',
					status: 'pending',
					priority: 'high',
					dependencies: ['1'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '3',
					title: 'Task 3 depends on 2',
					description: 'Third task in chain',
					status: 'pending',
					priority: 'high',
					dependencies: ['2'],
					details: '',
					testStrategy: '',
					subtasks: []
				},
				{
					id: '4',
					title: 'Task 4 independent',
					description: 'Independent task',
					status: 'pending',
					priority: 'medium',
					dependencies: [],
					details: '',
					testStrategy: '',
					subtasks: []
				}
			];
			mockStorage = createMockStorage(tasks);
			(taskService as any).storage = mockStorage;

			// Act
			const result = await taskService.getNextTasks(5);
			const returnedIds = result.map((t) => String(t.id));

			// Assert
			// Should return Task 1 and Task 4 (both independent of each other)
			// Task 2 and 3 should not be returned (dependencies not satisfied)
			expect(returnedIds).toContain('1');
			expect(returnedIds).toContain('4');
			expect(returnedIds).not.toContain('2');
			expect(returnedIds).not.toContain('3');
		});
	});
});
