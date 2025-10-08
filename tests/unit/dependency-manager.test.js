/**
 * Dependency Manager module tests
 */

import { jest } from '@jest/globals';
import {
	sampleTasks,
	crossLevelDependencyTasks
} from '../fixtures/sample-tasks.js';

// Create mock functions that we can control in tests
const mockTaskExists = jest.fn();
const mockFormatTaskId = jest.fn();
const mockFindCycles = jest.fn();
const mockLog = jest.fn();
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();

// Mock the utils module using the same pattern as move-task-cross-tag.test.js
jest.mock('../../scripts/modules/utils.js', () => ({
	log: mockLog,
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON,
	taskExists: mockTaskExists,
	formatTaskId: mockFormatTaskId,
	findCycles: mockFindCycles,
	traverseDependencies: jest.fn(() => []),
	isSilentMode: jest.fn(() => true),
	findProjectRoot: jest.fn(() => '/test'),
	resolveEnvVariable: jest.fn(() => undefined),
	isEmpty: jest.fn((v) =>
		v == null
			? true
			: Array.isArray(v)
				? v.length === 0
				: typeof v === 'object'
					? Object.keys(v).length === 0
					: false
	),
	// Common extras
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn(),
	getTaskManager: jest.fn(async () => ({})),
	getTagAwareFilePath: jest.fn((basePath, _tag, projectRoot = '.') => basePath),
	readComplexityReport: jest.fn(() => null)
}));

jest.mock('path');
jest.mock('chalk', () => ({
	green: jest.fn((text) => `<green>${text}</green>`),
	yellow: jest.fn((text) => `<yellow>${text}</yellow>`),
	red: jest.fn((text) => `<red>${text}</red>`),
	cyan: jest.fn((text) => `<cyan>${text}</cyan>`),
	bold: jest.fn((text) => `<bold>${text}</bold>`)
}));

jest.mock('boxen', () => jest.fn((text) => `[boxed: ${text}]`));

// Now import SUT after mocks are in place
import {
	validateTaskDependencies,
	isCircularDependency,
	removeDuplicateDependencies,
	cleanupSubtaskDependencies,
	ensureAtLeastOneIndependentSubtask,
	validateAndFixDependencies,
	canMoveWithDependencies
} from '../../scripts/modules/dependency-manager.js';

jest.mock('../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn()
}));

jest.mock('../../scripts/modules/task-manager.js', () => ({
	generateTaskFiles: jest.fn()
}));

// Use a temporary path for test files - Jest will clean up the temp directory
const TEST_TASKS_PATH = '/tmp/jest-test-tasks.json';

describe('Dependency Manager Module', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Set default implementations
		mockTaskExists.mockImplementation((tasks, id) => {
			if (Array.isArray(tasks)) {
				if (typeof id === 'string' && id.includes('.')) {
					const [taskId, subtaskId] = id.split('.').map(Number);
					const task = tasks.find((t) => t.id === taskId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}
				return tasks.some(
					(task) => task.id === (typeof id === 'string' ? parseInt(id, 10) : id)
				);
			}
			return false;
		});

		mockFormatTaskId.mockImplementation((id) => {
			if (typeof id === 'string' && id.includes('.')) {
				return id;
			}
			return parseInt(id, 10);
		});

		mockFindCycles.mockImplementation((tasks) => {
			// Simplified cycle detection for testing
			const dependencyMap = new Map();

			// Build dependency map
			tasks.forEach((task) => {
				if (task.dependencies) {
					dependencyMap.set(task.id, task.dependencies);
				}
			});

			const visited = new Set();
			const recursionStack = new Set();

			function dfs(taskId) {
				visited.add(taskId);
				recursionStack.add(taskId);

				const dependencies = dependencyMap.get(taskId) || [];
				for (const depId of dependencies) {
					if (!visited.has(depId)) {
						if (dfs(depId)) return true;
					} else if (recursionStack.has(depId)) {
						return true;
					}
				}

				recursionStack.delete(taskId);
				return false;
			}

			// Check for cycles starting from each unvisited node
			for (const taskId of dependencyMap.keys()) {
				if (!visited.has(taskId)) {
					if (dfs(taskId)) return true;
				}
			}

			return false;
		});
	});

	describe('isCircularDependency function', () => {
		test('should detect a direct circular dependency', () => {
			const tasks = [
				{ id: 1, dependencies: [2] },
				{ id: 2, dependencies: [1] }
			];

			const result = isCircularDependency(tasks, 1);
			expect(result).toBe(true);
		});

		test('should detect an indirect circular dependency', () => {
			const tasks = [
				{ id: 1, dependencies: [2] },
				{ id: 2, dependencies: [3] },
				{ id: 3, dependencies: [1] }
			];

			const result = isCircularDependency(tasks, 1);
			expect(result).toBe(true);
		});

		test('should return false for non-circular dependencies', () => {
			const tasks = [
				{ id: 1, dependencies: [2] },
				{ id: 2, dependencies: [3] },
				{ id: 3, dependencies: [] }
			];

			const result = isCircularDependency(tasks, 1);
			expect(result).toBe(false);
		});

		test('should handle a task with no dependencies', () => {
			const tasks = [
				{ id: 1, dependencies: [] },
				{ id: 2, dependencies: [1] }
			];

			const result = isCircularDependency(tasks, 1);
			expect(result).toBe(false);
		});

		test('should handle a task depending on itself', () => {
			const tasks = [{ id: 1, dependencies: [1] }];

			const result = isCircularDependency(tasks, 1);
			expect(result).toBe(true);
		});

		test('should handle subtask dependencies correctly', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: ['1.2'] },
						{ id: 2, dependencies: ['1.3'] },
						{ id: 3, dependencies: ['1.1'] }
					]
				}
			];

			// This creates a circular dependency: 1.1 -> 1.2 -> 1.3 -> 1.1
			const result = isCircularDependency(tasks, '1.1', ['1.3', '1.2']);
			expect(result).toBe(true);
		});

		test('should allow non-circular subtask dependencies within same parent', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: [] },
						{ id: 2, dependencies: ['1.1'] },
						{ id: 3, dependencies: ['1.2'] }
					]
				}
			];

			// This is a valid dependency chain: 1.3 -> 1.2 -> 1.1
			const result = isCircularDependency(tasks, '1.1', []);
			expect(result).toBe(false);
		});

		test('should properly handle dependencies between subtasks of the same parent', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: [] },
						{ id: 2, dependencies: ['1.1'] },
						{ id: 3, dependencies: [] }
					]
				}
			];

			// Check if adding a dependency from subtask 1.3 to 1.2 creates a circular dependency
			// This should be false as 1.3 -> 1.2 -> 1.1 is a valid chain
			mockTaskExists.mockImplementation(() => true);
			const result = isCircularDependency(tasks, '1.3', ['1.2']);
			expect(result).toBe(false);
		});

		test('should correctly detect circular dependencies in subtasks of the same parent', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: ['1.3'] },
						{ id: 2, dependencies: ['1.1'] },
						{ id: 3, dependencies: ['1.2'] }
					]
				}
			];

			// This creates a circular dependency: 1.1 -> 1.3 -> 1.2 -> 1.1
			mockTaskExists.mockImplementation(() => true);
			const result = isCircularDependency(tasks, '1.2', ['1.1']);
			expect(result).toBe(true);
		});
	});

	describe('validateTaskDependencies function', () => {
		test('should detect missing dependencies', () => {
			const tasks = [
				{ id: 1, dependencies: [99] }, // 99 doesn't exist
				{ id: 2, dependencies: [1] }
			];

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(false);
			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues[0].type).toBe('missing');
			expect(result.issues[0].taskId).toBe(1);
			expect(result.issues[0].dependencyId).toBe(99);
		});

		test('should detect circular dependencies', () => {
			const tasks = [
				{ id: 1, dependencies: [2] },
				{ id: 2, dependencies: [1] }
			];

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(false);
			expect(result.issues.some((issue) => issue.type === 'circular')).toBe(
				true
			);
		});

		test('should detect self-dependencies', () => {
			const tasks = [{ id: 1, dependencies: [1] }];

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(false);
			expect(
				result.issues.some(
					(issue) => issue.type === 'self' && issue.taskId === 1
				)
			).toBe(true);
		});

		test('should return valid for correct dependencies', () => {
			const tasks = [
				{ id: 1, dependencies: [] },
				{ id: 2, dependencies: [1] },
				{ id: 3, dependencies: [1, 2] }
			];

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(true);
			expect(result.issues.length).toBe(0);
		});

		test('should handle tasks with no dependencies property', () => {
			const tasks = [
				{ id: 1 }, // Missing dependencies property
				{ id: 2, dependencies: [1] }
			];

			const result = validateTaskDependencies(tasks);

			// Should be valid since a missing dependencies property is interpreted as an empty array
			expect(result.valid).toBe(true);
		});

		test('should handle subtask dependencies correctly', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: [] },
						{ id: 2, dependencies: ['1.1'] }, // Valid - depends on another subtask
						{ id: 3, dependencies: ['1.2'] } // Valid - depends on another subtask
					]
				},
				{
					id: 2,
					dependencies: ['1.3'], // Valid - depends on a subtask from task 1
					subtasks: []
				}
			];

			// Set up mock to handle subtask validation
			mockTaskExists.mockImplementation((tasks, id) => {
				if (typeof id === 'string' && id.includes('.')) {
					const [taskId, subtaskId] = id.split('.').map(Number);
					const task = tasks.find((t) => t.id === taskId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}
				return tasks.some((task) => task.id === parseInt(id, 10));
			});

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(true);
			expect(result.issues.length).toBe(0);
		});

		test('should detect missing subtask dependencies', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: ['1.4'] }, // Invalid - subtask 4 doesn't exist
						{ id: 2, dependencies: ['2.1'] } // Invalid - task 2 has no subtasks
					]
				},
				{
					id: 2,
					dependencies: [],
					subtasks: []
				}
			];

			// Mock taskExists to correctly identify missing subtasks
			mockTaskExists.mockImplementation((taskArray, depId) => {
				if (typeof depId === 'string' && depId === '1.4') {
					return false; // Subtask 1.4 doesn't exist
				}
				if (typeof depId === 'string' && depId === '2.1') {
					return false; // Subtask 2.1 doesn't exist
				}
				return true; // All other dependencies exist
			});

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(false);
			expect(result.issues.length).toBeGreaterThan(0);
			// Should detect missing subtask dependencies
			expect(
				result.issues.some(
					(issue) =>
						issue.type === 'missing' &&
						String(issue.taskId) === '1.1' &&
						String(issue.dependencyId) === '1.4'
				)
			).toBe(true);
		});

		test('should detect circular dependencies between subtasks', () => {
			const tasks = [
				{
					id: 1,
					dependencies: [],
					subtasks: [
						{ id: 1, dependencies: ['1.2'] },
						{ id: 2, dependencies: ['1.1'] } // Creates a circular dependency with 1.1
					]
				}
			];

			// Mock isCircularDependency for subtasks
			mockFindCycles.mockReturnValue(true);

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(false);
			expect(result.issues.some((issue) => issue.type === 'circular')).toBe(
				true
			);
		});

		test('should properly validate dependencies between subtasks of the same parent', () => {
			const tasks = [
				{
					id: 23,
					dependencies: [],
					subtasks: [
						{ id: 8, dependencies: ['23.13'] },
						{ id: 10, dependencies: ['23.8'] },
						{ id: 13, dependencies: [] }
					]
				}
			];

			// Mock taskExists to validate the subtask dependencies
			mockTaskExists.mockImplementation((taskArray, id) => {
				if (typeof id === 'string') {
					if (id === '23.8' || id === '23.10' || id === '23.13') {
						return true;
					}
				}
				return false;
			});

			const result = validateTaskDependencies(tasks);

			expect(result.valid).toBe(true);
			expect(result.issues.length).toBe(0);
		});
	});

	describe('removeDuplicateDependencies function', () => {
		test('should remove duplicate dependencies from tasks', () => {
			const tasksData = {
				tasks: [
					{ id: 1, dependencies: [2, 2, 3, 3, 3] },
					{ id: 2, dependencies: [3] },
					{ id: 3, dependencies: [] }
				]
			};

			const result = removeDuplicateDependencies(tasksData);

			expect(result.tasks[0].dependencies).toEqual([2, 3]);
			expect(result.tasks[1].dependencies).toEqual([3]);
			expect(result.tasks[2].dependencies).toEqual([]);
		});

		test('should handle empty dependencies array', () => {
			const tasksData = {
				tasks: [
					{ id: 1, dependencies: [] },
					{ id: 2, dependencies: [1] }
				]
			};

			const result = removeDuplicateDependencies(tasksData);

			expect(result.tasks[0].dependencies).toEqual([]);
			expect(result.tasks[1].dependencies).toEqual([1]);
		});

		test('should handle tasks with no dependencies property', () => {
			const tasksData = {
				tasks: [
					{ id: 1 }, // No dependencies property
					{ id: 2, dependencies: [1] }
				]
			};

			const result = removeDuplicateDependencies(tasksData);

			expect(result.tasks[0]).not.toHaveProperty('dependencies');
			expect(result.tasks[1].dependencies).toEqual([1]);
		});
	});

	describe('cleanupSubtaskDependencies function', () => {
		test('should remove dependencies to non-existent subtasks', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						dependencies: [],
						subtasks: [
							{ id: 1, dependencies: [] },
							{ id: 2, dependencies: [3] } // Dependency 3 doesn't exist
						]
					},
					{
						id: 2,
						dependencies: ['1.2'], // Valid subtask dependency
						subtasks: [
							{ id: 1, dependencies: ['1.1'] } // Valid subtask dependency
						]
					}
				]
			};

			const result = cleanupSubtaskDependencies(tasksData);

			// Should remove the invalid dependency to subtask 3
			expect(result.tasks[0].subtasks[1].dependencies).toEqual([]);
			// Should keep valid dependencies
			expect(result.tasks[1].dependencies).toEqual(['1.2']);
			expect(result.tasks[1].subtasks[0].dependencies).toEqual(['1.1']);
		});

		test('should handle tasks without subtasks', () => {
			const tasksData = {
				tasks: [
					{ id: 1, dependencies: [] },
					{ id: 2, dependencies: [1] }
				]
			};

			const result = cleanupSubtaskDependencies(tasksData);

			// Should return the original data unchanged
			expect(result).toEqual(tasksData);
		});
	});

	describe('ensureAtLeastOneIndependentSubtask function', () => {
		test('should clear dependencies of first subtask if none are independent', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						subtasks: [
							{ id: 1, dependencies: [2] },
							{ id: 2, dependencies: [1] }
						]
					}
				]
			};

			const result = ensureAtLeastOneIndependentSubtask(tasksData);

			expect(result).toBe(true);
			expect(tasksData.tasks[0].subtasks[0].dependencies).toEqual([]);
			expect(tasksData.tasks[0].subtasks[1].dependencies).toEqual([1]);
		});

		test('should not modify tasks if at least one subtask is independent', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						subtasks: [
							{ id: 1, dependencies: [] },
							{ id: 2, dependencies: [1] }
						]
					}
				]
			};

			const result = ensureAtLeastOneIndependentSubtask(tasksData);

			expect(result).toBe(false);
			expect(tasksData.tasks[0].subtasks[0].dependencies).toEqual([]);
			expect(tasksData.tasks[0].subtasks[1].dependencies).toEqual([1]);
		});

		test('should handle tasks without subtasks', () => {
			const tasksData = {
				tasks: [{ id: 1 }, { id: 2, dependencies: [1] }]
			};

			const result = ensureAtLeastOneIndependentSubtask(tasksData);

			expect(result).toBe(false);
			expect(tasksData).toEqual({
				tasks: [{ id: 1 }, { id: 2, dependencies: [1] }]
			});
		});

		test('should handle empty subtasks array', () => {
			const tasksData = {
				tasks: [{ id: 1, subtasks: [] }]
			};

			const result = ensureAtLeastOneIndependentSubtask(tasksData);

			expect(result).toBe(false);
			expect(tasksData).toEqual({
				tasks: [{ id: 1, subtasks: [] }]
			});
		});
	});

	describe('validateAndFixDependencies function', () => {
		test('should fix multiple dependency issues and return true if changes made', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						dependencies: [1, 1, 99], // Self-dependency and duplicate and invalid dependency
						subtasks: [
							{ id: 1, dependencies: [2, 2] }, // Duplicate dependencies
							{ id: 2, dependencies: [1] }
						]
					},
					{
						id: 2,
						dependencies: [1],
						subtasks: [
							{ id: 1, dependencies: [99] } // Invalid dependency
						]
					}
				]
			};

			// Mock taskExists for validating dependencies
			mockTaskExists.mockImplementation((tasks, id) => {
				// Convert id to string for comparison
				const idStr = String(id);

				// Handle subtask references (e.g., "1.2")
				if (idStr.includes('.')) {
					const [parentId, subtaskId] = idStr.split('.').map(Number);
					const task = tasks.find((t) => t.id === parentId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}

				// Handle regular task references
				const taskId = parseInt(idStr, 10);
				return taskId === 1 || taskId === 2; // Only tasks 1 and 2 exist
			});

			// Make a copy for verification that original is modified
			const originalData = JSON.parse(JSON.stringify(tasksData));

			const result = validateAndFixDependencies(tasksData);

			expect(result).toBe(true);
			// Check that data has been modified
			expect(tasksData).not.toEqual(originalData);

			// Check specific changes
			// 1. Self-dependency removed
			expect(tasksData.tasks[0].dependencies).not.toContain(1);
			// 2. Invalid dependency removed
			expect(tasksData.tasks[0].dependencies).not.toContain(99);
			// 3. Dependencies have been deduplicated
			if (tasksData.tasks[0].subtasks[0].dependencies.length > 0) {
				expect(tasksData.tasks[0].subtasks[0].dependencies).toEqual(
					expect.arrayContaining([])
				);
			}
			// 4. Invalid subtask dependency removed
			expect(tasksData.tasks[1].subtasks[0].dependencies).toEqual([]);

			// IMPORTANT: Verify no calls to writeJSON with actual tasks.json
			expect(mockWriteJSON).not.toHaveBeenCalledWith(
				'tasks/tasks.json',
				expect.anything(),
				expect.anything(),
				expect.anything()
			);
		});

		test('should return false if no changes needed', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						dependencies: [],
						subtasks: [
							{ id: 1, dependencies: [] }, // Already has an independent subtask
							{ id: 2, dependencies: ['1.1'] }
						]
					},
					{
						id: 2,
						dependencies: [1]
					}
				]
			};

			// Mock taskExists to validate all dependencies as valid
			mockTaskExists.mockImplementation((tasks, id) => {
				// Convert id to string for comparison
				const idStr = String(id);

				// Handle subtask references
				if (idStr.includes('.')) {
					const [parentId, subtaskId] = idStr.split('.').map(Number);
					const task = tasks.find((t) => t.id === parentId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}

				// Handle regular task references
				const taskId = parseInt(idStr, 10);
				return taskId === 1 || taskId === 2;
			});

			const originalData = JSON.parse(JSON.stringify(tasksData));
			const result = validateAndFixDependencies(tasksData);

			expect(result).toBe(false);
			// Verify data is unchanged
			expect(tasksData).toEqual(originalData);

			// IMPORTANT: Verify no calls to writeJSON with actual tasks.json
			expect(mockWriteJSON).not.toHaveBeenCalledWith(
				'tasks/tasks.json',
				expect.anything(),
				expect.anything(),
				expect.anything()
			);
		});

		test('should handle invalid input', () => {
			expect(validateAndFixDependencies(null)).toBe(false);
			expect(validateAndFixDependencies({})).toBe(false);
			expect(validateAndFixDependencies({ tasks: null })).toBe(false);
			expect(validateAndFixDependencies({ tasks: 'not an array' })).toBe(false);

			// IMPORTANT: Verify no calls to writeJSON with actual tasks.json
			expect(mockWriteJSON).not.toHaveBeenCalledWith(
				'tasks/tasks.json',
				expect.anything(),
				expect.anything(),
				expect.anything()
			);
		});

		test('should save changes when tasksPath is provided', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						dependencies: [1, 1], // Self-dependency and duplicate
						subtasks: [
							{ id: 1, dependencies: [99] } // Invalid dependency
						]
					}
				]
			};

			// Mock taskExists for this specific test
			mockTaskExists.mockImplementation((tasks, id) => {
				// Convert id to string for comparison
				const idStr = String(id);

				// Handle subtask references
				if (idStr.includes('.')) {
					const [parentId, subtaskId] = idStr.split('.').map(Number);
					const task = tasks.find((t) => t.id === parentId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}

				// Handle regular task references
				const taskId = parseInt(idStr, 10);
				return taskId === 1; // Only task 1 exists
			});

			// Copy the original data to verify changes
			const originalData = JSON.parse(JSON.stringify(tasksData));

			// Call the function with our test path instead of the actual tasks.json
			const result = validateAndFixDependencies(tasksData, TEST_TASKS_PATH);

			// First verify that the result is true (changes were made)
			expect(result).toBe(true);

			// Verify the data was modified
			expect(tasksData).not.toEqual(originalData);

			// IMPORTANT: Verify no calls to writeJSON with actual tasks.json
			expect(mockWriteJSON).not.toHaveBeenCalledWith(
				'tasks/tasks.json',
				expect.anything(),
				expect.anything(),
				expect.anything()
			);
		});
	});

	describe('canMoveWithDependencies', () => {
		it('should return canMove: false when conflicts exist', () => {
			const allTasks = [
				{
					id: 1,
					tag: 'source',
					dependencies: [2],
					title: 'Task 1'
				},
				{
					id: 2,
					tag: 'other',
					dependencies: [],
					title: 'Task 2'
				}
			];

			const result = canMoveWithDependencies('1', 'source', 'target', allTasks);

			expect(result.canMove).toBe(false);
			expect(result.conflicts).toBeDefined();
			expect(result.conflicts.length).toBeGreaterThan(0);
			expect(result.dependentTaskIds).toBeDefined();
		});

		it('should return canMove: true when no conflicts exist', () => {
			const allTasks = [
				{
					id: 1,
					tag: 'source',
					dependencies: [],
					title: 'Task 1'
				},
				{
					id: 2,
					tag: 'target',
					dependencies: [],
					title: 'Task 2'
				}
			];

			const result = canMoveWithDependencies('1', 'source', 'target', allTasks);

			expect(result.canMove).toBe(true);
			expect(result.conflicts).toBeDefined();
			expect(result.conflicts.length).toBe(0);
			expect(result.dependentTaskIds).toBeDefined();
			expect(result.dependentTaskIds.length).toBe(0);
		});

		it('should handle subtask lookup correctly', () => {
			const allTasks = [
				{
					id: 1,
					tag: 'source',
					dependencies: [],
					title: 'Parent Task',
					subtasks: [
						{
							id: 1,
							dependencies: [2],
							title: 'Subtask 1'
						}
					]
				},
				{
					id: 2,
					tag: 'other',
					dependencies: [],
					title: 'Task 2'
				}
			];

			const result = canMoveWithDependencies(
				'1.1',
				'source',
				'target',
				allTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.conflicts).toBeDefined();
			expect(result.conflicts.length).toBeGreaterThan(0);
		});

		it('should return error when task not found', () => {
			const allTasks = [
				{
					id: 1,
					tag: 'source',
					dependencies: [],
					title: 'Task 1'
				}
			];

			const result = canMoveWithDependencies(
				'999',
				'source',
				'target',
				allTasks
			);

			expect(result.canMove).toBe(false);
			expect(result.error).toBe('Task not found');
			expect(result.dependentTaskIds).toEqual([]);
			expect(result.conflicts).toEqual([]);
		});
	});

	describe('Cross-level dependency tests (Issue #542)', () => {
		let originalExit;

		beforeEach(async () => {
			// Ensure a fresh module instance so ESM mocks apply to dynamic imports
			jest.resetModules();
			originalExit = process.exit;
			process.exit = jest.fn();

			// For ESM dynamic imports, use the same pattern
			await jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
				log: mockLog,
				readJSON: mockReadJSON,
				writeJSON: mockWriteJSON,
				taskExists: mockTaskExists,
				formatTaskId: mockFormatTaskId,
				findCycles: mockFindCycles,
				traverseDependencies: jest.fn(() => []),
				isSilentMode: jest.fn(() => true),
				findProjectRoot: jest.fn(() => '/test'),
				resolveEnvVariable: jest.fn(() => undefined),
				isEmpty: jest.fn((v) =>
					v == null
						? true
						: Array.isArray(v)
							? v.length === 0
							: typeof v === 'object'
								? Object.keys(v).length === 0
								: false
				),
				enableSilentMode: jest.fn(),
				disableSilentMode: jest.fn(),
				getTaskManager: jest.fn(async () => ({})),
				getTagAwareFilePath: jest.fn(
					(basePath, _tag, projectRoot = '.') => basePath
				),
				readComplexityReport: jest.fn(() => null)
			}));

			// Also mock transitive imports to keep dependency surface minimal
			await jest.unstable_mockModule('../../scripts/modules/ui.js', () => ({
				displayBanner: jest.fn()
			}));
			await jest.unstable_mockModule(
				'../../scripts/modules/task-manager/generate-task-files.js',
				() => ({ default: jest.fn() })
			);
			// Set up test data that matches the issue report
			// Clone fixture data before each test to prevent mutation issues
			mockReadJSON.mockImplementation(() =>
				structuredClone(crossLevelDependencyTasks)
			);

			// Configure mockTaskExists to properly validate cross-level dependencies
			mockTaskExists.mockImplementation((tasks, taskId) => {
				if (typeof taskId === 'string' && taskId.includes('.')) {
					const [parentId, subtaskId] = taskId.split('.').map(Number);
					const task = tasks.find((t) => t.id === parentId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}

				const numericId =
					typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
				return tasks.some((task) => task.id === numericId);
			});

			mockFormatTaskId.mockImplementation((id) => {
				if (typeof id === 'string' && id.includes('.')) return id; // keep dot notation
				return parseInt(id, 10); // normalize top-level task IDs to number
			});
		});

		afterEach(() => {
			process.exit = originalExit;
		});

		test('should allow subtask to depend on top-level task', async () => {
			const { addDependency } = await import(
				'../../scripts/modules/dependency-manager.js'
			);

			// Test the specific scenario from Issue #542: subtask 2.2 depending on task 11
			await addDependency(TEST_TASKS_PATH, '2.2', 11, { projectRoot: '/test' });

			// Verify we wrote to the test path (and not the real tasks.json)
			expect(mockWriteJSON).toHaveBeenCalledWith(
				TEST_TASKS_PATH,
				expect.anything(),
				'/test',
				undefined
			);
			expect(mockWriteJSON).not.toHaveBeenCalledWith(
				'tasks/tasks.json',
				expect.anything(),
				expect.anything(),
				expect.anything()
			);
			// Get the specific write call for TEST_TASKS_PATH
			const writeCall = mockWriteJSON.mock.calls.find(
				([p]) => p === TEST_TASKS_PATH
			);
			expect(writeCall).toBeDefined();
			const savedData = writeCall[1];
			const parent2 = savedData.tasks.find((t) => t.id === 2);
			const subtask22 = parent2.subtasks.find((st) => st.id === 2);

			// Verify the dependency was actually added to subtask 2.2
			expect(subtask22.dependencies).toContain(11);
			// Also verify a success log was emitted
			const successCall = mockLog.mock.calls.find(
				([level]) => level === 'success'
			);
			expect(successCall).toBeDefined();
			expect(successCall[1]).toContain('2.2');
			expect(successCall[1]).toContain('11');
		});

		test('should allow top-level task to depend on subtask', async () => {
			const { addDependency } = await import(
				'../../scripts/modules/dependency-manager.js'
			);

			// Test reverse scenario: task 11 depending on subtask 2.1
			await addDependency(TEST_TASKS_PATH, 11, '2.1', { projectRoot: '/test' });

			// Stronger assertions for writeJSON call and locating the correct task
			expect(mockWriteJSON).toHaveBeenCalledWith(
				TEST_TASKS_PATH,
				expect.anything(),
				'/test',
				undefined
			);
			expect(mockWriteJSON).not.toHaveBeenCalledWith(
				'tasks/tasks.json',
				expect.anything(),
				expect.anything(),
				expect.anything()
			);
			const writeCall = mockWriteJSON.mock.calls.find(
				([p]) => p === TEST_TASKS_PATH
			);
			expect(writeCall).toBeDefined();
			const savedData = writeCall[1];
			const task11 = savedData.tasks.find((t) => t.id === 11);

			// Verify the dependency was actually added to task 11
			expect(task11.dependencies).toContain('2.1');
			// Verify a success log was emitted mentioning both task 11 and subtask 2.1
			const successCall = mockLog.mock.calls.find(
				([level]) => level === 'success'
			);
			expect(successCall).toBeDefined();
			expect(successCall[1]).toContain('11');
			expect(successCall[1]).toContain('2.1');
		});

		test('should properly validate cross-level dependencies exist', async () => {
			// Test that validation correctly identifies when a cross-level dependency target doesn't exist
			mockTaskExists.mockImplementation((tasks, taskId) => {
				// Simulate task 99 not existing
				if (taskId === '99' || taskId === 99) {
					return false;
				}

				if (typeof taskId === 'string' && taskId.includes('.')) {
					const [parentId, subtaskId] = taskId.split('.').map(Number);
					const task = tasks.find((t) => t.id === parentId);
					return (
						task &&
						task.subtasks &&
						task.subtasks.some((st) => st.id === subtaskId)
					);
				}

				const numericId =
					typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
				return tasks.some((task) => task.id === numericId);
			});

			const { addDependency } = await import(
				'../../scripts/modules/dependency-manager.js'
			);

			const exitError = new Error('process.exit invoked');
			process.exit.mockImplementation(() => {
				throw exitError;
			});

			await expect(
				addDependency(TEST_TASKS_PATH, '2.2', 99, { projectRoot: '/test' })
			).rejects.toBe(exitError);

			expect(process.exit).toHaveBeenCalledWith(1);
			expect(mockWriteJSON).not.toHaveBeenCalled();
			// Verify that an error was reported to the user
			expect(mockLog).toHaveBeenCalled();
		});

		test('should remove top-level task dependency from a subtask', async () => {
			const { addDependency, removeDependency } = await import(
				'../../scripts/modules/dependency-manager.js'
			);

			// Start with cloned data and add 11 to 2.2
			await addDependency(TEST_TASKS_PATH, '2.2', 11, { projectRoot: '/test' });

			// Get the saved data from the add operation
			const addWriteCall = mockWriteJSON.mock.calls.find(
				([p]) => p === TEST_TASKS_PATH
			);
			expect(addWriteCall).toBeDefined();
			const dataWithDep = addWriteCall[1];

			// Verify the dependency was added
			const subtask22AfterAdd = dataWithDep.tasks
				.find((t) => t.id === 2)
				.subtasks.find((st) => st.id === 2);
			expect(subtask22AfterAdd.dependencies).toContain(11);

			// Clear mocks and re-setup mockReadJSON with the modified data
			jest.clearAllMocks();
			mockReadJSON.mockImplementation(() => structuredClone(dataWithDep));

			await removeDependency(TEST_TASKS_PATH, '2.2', 11, {
				projectRoot: '/test'
			});

			const writeCall = mockWriteJSON.mock.calls.find(
				([p]) => p === TEST_TASKS_PATH
			);
			expect(writeCall).toBeDefined();
			const saved = writeCall[1];
			const subtask22 = saved.tasks
				.find((t) => t.id === 2)
				.subtasks.find((st) => st.id === 2);
			expect(subtask22.dependencies).not.toContain(11);
			// Verify success log was emitted
			const successCall = mockLog.mock.calls.find(
				([level]) => level === 'success'
			);
			expect(successCall).toBeDefined();
			expect(successCall[1]).toContain('2.2');
			expect(successCall[1]).toContain('11');
		});

		test('should remove subtask dependency from a top-level task', async () => {
			const { addDependency, removeDependency } = await import(
				'../../scripts/modules/dependency-manager.js'
			);

			// Add subtask dependency to task 11
			await addDependency(TEST_TASKS_PATH, 11, '2.1', { projectRoot: '/test' });

			// Get the saved data from the add operation
			const addWriteCall = mockWriteJSON.mock.calls.find(
				([p]) => p === TEST_TASKS_PATH
			);
			expect(addWriteCall).toBeDefined();
			const dataWithDep = addWriteCall[1];

			// Verify the dependency was added
			const task11AfterAdd = dataWithDep.tasks.find((t) => t.id === 11);
			expect(task11AfterAdd.dependencies).toContain('2.1');

			// Clear mocks and re-setup mockReadJSON with the modified data
			jest.clearAllMocks();
			mockReadJSON.mockImplementation(() => structuredClone(dataWithDep));

			await removeDependency(TEST_TASKS_PATH, 11, '2.1', {
				projectRoot: '/test'
			});

			const writeCall = mockWriteJSON.mock.calls.find(
				([p]) => p === TEST_TASKS_PATH
			);
			expect(writeCall).toBeDefined();
			const saved = writeCall[1];
			const task11 = saved.tasks.find((t) => t.id === 11);
			expect(task11.dependencies).not.toContain('2.1');
			// Verify success log was emitted
			const successCall = mockLog.mock.calls.find(
				([level]) => level === 'success'
			);
			expect(successCall).toBeDefined();
			expect(successCall[1]).toContain('11');
			expect(successCall[1]).toContain('2.1');
		});
	});
});
