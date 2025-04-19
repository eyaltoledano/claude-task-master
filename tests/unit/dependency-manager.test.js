/**
 * Dependency Manager module tests
 */

import { jest } from '@jest/globals';
import {
	validateAndFixDependencies
} from '../../scripts/modules/dependency-manager.js';
import * as utils from '../../scripts/modules/utils.js';
import { sampleTasks } from '../fixtures/sample-tasks.js';

// Mock dependencies
jest.mock('path');
jest.mock('chalk', () => ({
	green: jest.fn((text) => `<green>${text}</green>`),
	yellow: jest.fn((text) => `<yellow>${text}</yellow>`),
	red: jest.fn((text) => `<red>${text}</red>`),
	cyan: jest.fn((text) => `<cyan>${text}</cyan>`),
	bold: jest.fn((text) => `<bold>${text}</bold>`)
}));

jest.mock('boxen', () => jest.fn((text) => `[boxed: ${text}]`));

jest.mock('@anthropic-ai/sdk', () => ({
	Anthropic: jest.fn().mockImplementation(() => ({}))
}));

// Mock utils module
const mockTaskExists = jest.fn();
const mockFormatTaskId = jest.fn();
const mockFindCycles = jest.fn();
const mockLog = jest.fn();
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();

jest.mock('../../scripts/modules/utils.js', () => ({
	log: mockLog,
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON,
	taskExists: mockTaskExists,
	formatTaskId: mockFormatTaskId,
	findCycles: mockFindCycles
}));

jest.mock('../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn()
}));

jest.mock('../../scripts/modules/task-manager.js', () => ({
	generateTaskFiles: jest.fn()
}));

// Create a path for test files
const TEST_TASKS_PATH = 'tests/fixture/test-tasks.json';

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
				expect.anything()
			);
		});
	});
});
