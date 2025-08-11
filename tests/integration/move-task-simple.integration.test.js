import { jest } from '@jest/globals';
import path from 'path';
import mockFs from 'mock-fs';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import the actual move task functionality
import moveTask, {
	moveTasksBetweenTags
} from '../../scripts/modules/task-manager/move-task.js';
import { readJSON, writeJSON } from '../../scripts/modules/utils.js';

// Mock console to avoid conflicts with mock-fs
const originalConsole = { ...console };
beforeAll(() => {
	global.console = {
		...console,
		log: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn()
	};
});

afterAll(() => {
	global.console = originalConsole;
});

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Cross-Tag Task Movement Simple Integration Tests', () => {
	const testDataDir = path.join(__dirname, 'fixtures');
	const testTasksPath = path.join(testDataDir, 'tasks.json');

	// Test data structure with proper tagged format
	const testData = {
		backlog: {
			tasks: [
				{ id: 1, title: 'Task 1', dependencies: [], status: 'pending' },
				{ id: 2, title: 'Task 2', dependencies: [], status: 'pending' }
			]
		},
		'in-progress': {
			tasks: [
				{ id: 3, title: 'Task 3', dependencies: [], status: 'in-progress' }
			]
		}
	};

	beforeEach(() => {
		// Set up mock file system with test data
		mockFs({
			[testDataDir]: {
				'tasks.json': JSON.stringify(testData, null, 2)
			}
		});
	});

	afterEach(() => {
		// Clean up mock file system
		mockFs.restore();
	});

	describe('Real Module Integration Tests', () => {
		it('should move task within same tag using actual moveTask function', async () => {
			// Test moving Task 1 from position 1 to position 5 within backlog tag
			const result = await moveTask(
				testTasksPath,
				'1',
				'5',
				false, // Don't generate files for this test
				{ tag: 'backlog' }
			);

			// Verify the move operation was successful
			expect(result).toBeDefined();
			expect(result.message).toContain('Moved task 1 to new ID 5');

			// Read the updated data to verify the move actually happened
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			const rawData = updatedData._rawTaggedData || updatedData;
			const backlogTasks = rawData.backlog.tasks;

			// Verify Task 1 is no longer at position 1
			const taskAtPosition1 = backlogTasks.find((t) => t.id === 1);
			expect(taskAtPosition1).toBeUndefined();

			// Verify Task 1 is now at position 5
			const taskAtPosition5 = backlogTasks.find((t) => t.id === 5);
			expect(taskAtPosition5).toBeDefined();
			expect(taskAtPosition5.title).toBe('Task 1');
			expect(taskAtPosition5.status).toBe('pending');
		});

		it('should move tasks between tags using moveTasksBetweenTags function', async () => {
			// Test moving Task 1 from backlog to in-progress tag
			const result = await moveTasksBetweenTags(
				testTasksPath,
				['1'], // Task IDs to move (as strings)
				'backlog', // Source tag
				'in-progress', // Target tag
				{ withDependencies: false, ignoreDependencies: false },
				{ projectRoot: testDataDir }
			);

			// Verify the cross-tag move operation was successful
			expect(result).toBeDefined();
			expect(result.message).toContain(
				'Successfully moved 1 tasks from "backlog" to "in-progress"'
			);
			expect(result.movedTasks).toHaveLength(1);
			expect(result.movedTasks[0].id).toBe('1');
			expect(result.movedTasks[0].fromTag).toBe('backlog');
			expect(result.movedTasks[0].toTag).toBe('in-progress');

			// Read the updated data to verify the move actually happened
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			// readJSON returns resolved data, so we need to access the raw tagged data
			const rawData = updatedData._rawTaggedData || updatedData;
			const backlogTasks = rawData.backlog?.tasks || [];
			const inProgressTasks = rawData['in-progress']?.tasks || [];

			// Verify Task 1 is no longer in backlog
			const taskInBacklog = backlogTasks.find((t) => t.id === 1);
			expect(taskInBacklog).toBeUndefined();

			// Verify Task 1 is now in in-progress
			const taskInProgress = inProgressTasks.find((t) => t.id === 1);
			expect(taskInProgress).toBeDefined();
			expect(taskInProgress.title).toBe('Task 1');
			expect(taskInProgress.status).toBe('pending');
		});

		it('should handle subtask movement restrictions', async () => {
			// Create data with subtasks
			const dataWithSubtasks = {
				backlog: {
					tasks: [
						{
							id: 1,
							title: 'Task 1',
							dependencies: [],
							status: 'pending',
							subtasks: [
								{ id: '1.1', title: 'Subtask 1.1', status: 'pending' },
								{ id: '1.2', title: 'Subtask 1.2', status: 'pending' }
							]
						}
					]
				},
				'in-progress': {
					tasks: [
						{ id: 2, title: 'Task 2', dependencies: [], status: 'in-progress' }
					]
				}
			};

			// Write subtask data to mock file system
			mockFs({
				[testDataDir]: {
					'tasks.json': JSON.stringify(dataWithSubtasks, null, 2)
				}
			});

			// Try to move a subtask directly - this should actually work (converts subtask to task)
			const result = await moveTask(
				testTasksPath,
				'1.1', // Subtask ID
				'5', // New task ID
				false,
				{ tag: 'backlog' }
			);

			// Verify the subtask was converted to a task
			expect(result).toBeDefined();
			expect(result.message).toContain('Converted subtask 1.1 to task 5');

			// Verify the subtask was removed from the parent and converted to a standalone task
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			const rawData = updatedData._rawTaggedData || updatedData;
			const task1 = rawData.backlog?.tasks?.find((t) => t.id === 1);
			const newTask5 = rawData.backlog?.tasks?.find((t) => t.id === 5);

			expect(task1).toBeDefined();
			expect(task1.subtasks).toHaveLength(1); // Only 1.2 remains
			expect(task1.subtasks[0].id).toBe(2);

			expect(newTask5).toBeDefined();
			expect(newTask5.title).toBe('Subtask 1.1');
			expect(newTask5.status).toBe('pending');
		});

		it('should handle missing source tag errors', async () => {
			// Try to move from a non-existent tag
			await expect(
				moveTasksBetweenTags(
					testTasksPath,
					['1'],
					'non-existent-tag', // Source tag doesn't exist
					'in-progress',
					{ withDependencies: false, ignoreDependencies: false },
					{ projectRoot: testDataDir }
				)
			).rejects.toThrow();
		});

		it('should handle missing task ID errors', async () => {
			// Try to move a non-existent task
			await expect(
				moveTask(
					testTasksPath,
					'999', // Non-existent task ID
					'5',
					false,
					{ tag: 'backlog' }
				)
			).rejects.toThrow();
		});

		it('should handle ignoreDependencies option correctly', async () => {
			// Create data with dependencies
			const dataWithDependencies = {
				backlog: {
					tasks: [
						{ id: 1, title: 'Task 1', dependencies: [2], status: 'pending' },
						{ id: 2, title: 'Task 2', dependencies: [], status: 'pending' }
					]
				},
				'in-progress': {
					tasks: [
						{ id: 3, title: 'Task 3', dependencies: [], status: 'in-progress' }
					]
				}
			};

			// Write dependency data to mock file system
			mockFs({
				[testDataDir]: {
					'tasks.json': JSON.stringify(dataWithDependencies, null, 2)
				}
			});

			// Move Task 1 while ignoring its dependencies
			const result = await moveTasksBetweenTags(
				testTasksPath,
				['1'], // Only Task 1
				'backlog',
				'in-progress',
				{ withDependencies: false, ignoreDependencies: true },
				{ projectRoot: testDataDir }
			);

			expect(result).toBeDefined();
			expect(result.movedTasks).toHaveLength(1);

			// Verify Task 1 moved but Task 2 stayed
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			const rawData = updatedData._rawTaggedData || updatedData;
			expect(rawData.backlog.tasks).toHaveLength(1); // Task 2 remains
			expect(rawData['in-progress'].tasks).toHaveLength(2); // Task 3 + Task 1

			// Verify Task 1 has no dependencies (they were ignored)
			const movedTask = rawData['in-progress'].tasks.find((t) => t.id === 1);
			expect(movedTask.dependencies).toEqual([]);
		});
	});

	describe('Complex Dependency Scenarios', () => {
		beforeAll(() => {
			// Document the mock-fs limitation for complex dependency scenarios
			console.warn(
				'⚠️  Complex dependency tests are skipped due to mock-fs limitations. ' +
					'These tests require real filesystem operations for proper dependency resolution. ' +
					'Consider using real temporary filesystem setup for these scenarios.'
			);
		});

		it.skip('should handle dependency conflicts during cross-tag moves', async () => {
			// For now, skip this test as the mock setup is not working correctly
			// TODO: Fix mock-fs setup for complex dependency scenarios
		});

		it.skip('should handle withDependencies option correctly', async () => {
			// For now, skip this test as the mock setup is not working correctly
			// TODO: Fix mock-fs setup for complex dependency scenarios
		});
	});

	describe('Complex Dependency Integration Tests with Mock-fs', () => {
		const complexTestData = {
			backlog: {
				tasks: [
					{ id: 1, title: 'Task 1', dependencies: [2, 3], status: 'pending' },
					{ id: 2, title: 'Task 2', dependencies: [4], status: 'pending' },
					{ id: 3, title: 'Task 3', dependencies: [], status: 'pending' },
					{ id: 4, title: 'Task 4', dependencies: [], status: 'pending' }
				]
			},
			'in-progress': {
				tasks: [
					{ id: 5, title: 'Task 5', dependencies: [], status: 'in-progress' }
				]
			}
		};

		beforeEach(() => {
			// Set up mock file system with complex dependency data
			mockFs({
				[testDataDir]: {
					'tasks.json': JSON.stringify(complexTestData, null, 2)
				}
			});
		});

		afterEach(() => {
			// Clean up mock file system
			mockFs.restore();
		});

		it('should handle dependency conflicts during cross-tag moves using actual move functions', async () => {
			// Test moving Task 1 which has dependencies on Tasks 2 and 3
			// This should fail because Task 1 depends on Tasks 2 and 3 which are in the same tag
			await expect(
				moveTasksBetweenTags(
					testTasksPath,
					['1'], // Task 1 with dependencies
					'backlog',
					'in-progress',
					{ withDependencies: false, ignoreDependencies: false },
					{ projectRoot: testDataDir }
				)
			).rejects.toThrow(
				'Cannot move tasks: 2 cross-tag dependency conflicts found'
			);
		});

		it('should handle withDependencies option correctly using actual move functions', async () => {
			// Test moving Task 1 with its dependencies (Tasks 2 and 3)
			// Task 2 also depends on Task 4, so all 4 tasks should move
			const result = await moveTasksBetweenTags(
				testTasksPath,
				['1'], // Task 1
				'backlog',
				'in-progress',
				{ withDependencies: true, ignoreDependencies: false },
				{ projectRoot: testDataDir }
			);

			// Verify the move operation was successful
			expect(result).toBeDefined();
			expect(result.message).toContain(
				'Successfully moved 4 tasks from "backlog" to "in-progress"'
			);
			expect(result.movedTasks).toHaveLength(4); // Task 1 + Tasks 2, 3, 4

			// Read the updated data to verify all dependent tasks moved
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			const rawData = updatedData._rawTaggedData || updatedData;

			// Verify all tasks moved from backlog
			expect(rawData.backlog?.tasks || []).toHaveLength(0); // All tasks moved

			// Verify all tasks are now in in-progress
			expect(rawData['in-progress']?.tasks || []).toHaveLength(5); // Task 5 + Tasks 1, 2, 3, 4

			// Verify dependency relationships are preserved
			const task1 = rawData['in-progress']?.tasks?.find((t) => t.id === 1);
			const task2 = rawData['in-progress']?.tasks?.find((t) => t.id === 2);
			const task3 = rawData['in-progress']?.tasks?.find((t) => t.id === 3);
			const task4 = rawData['in-progress']?.tasks?.find((t) => t.id === 4);

			expect(task1?.dependencies).toEqual([2, 3]);
			expect(task2?.dependencies).toEqual([4]);
			expect(task3?.dependencies).toEqual([]);
			expect(task4?.dependencies).toEqual([]);
		});

		it('should handle circular dependency detection using actual move functions', async () => {
			// Create data with circular dependencies
			const circularData = {
				backlog: {
					tasks: [
						{ id: 1, title: 'Task 1', dependencies: [2], status: 'pending' },
						{ id: 2, title: 'Task 2', dependencies: [3], status: 'pending' },
						{ id: 3, title: 'Task 3', dependencies: [1], status: 'pending' } // Circular dependency
					]
				},
				'in-progress': {
					tasks: [
						{ id: 4, title: 'Task 4', dependencies: [], status: 'in-progress' }
					]
				}
			};

			// Set up mock file system with circular dependency data
			mockFs({
				[testDataDir]: {
					'tasks.json': JSON.stringify(circularData, null, 2)
				}
			});

			// Attempt to move Task 1 with dependencies should fail due to circular dependency
			await expect(
				moveTasksBetweenTags(
					testTasksPath,
					['1'],
					'backlog',
					'in-progress',
					{ withDependencies: true, ignoreDependencies: false },
					{ projectRoot: testDataDir }
				)
			).rejects.toThrow();
		});

		it('should handle nested dependency chains using actual move functions', async () => {
			// Create data with nested dependency chains
			const nestedData = {
				backlog: {
					tasks: [
						{ id: 1, title: 'Task 1', dependencies: [2], status: 'pending' },
						{ id: 2, title: 'Task 2', dependencies: [3], status: 'pending' },
						{ id: 3, title: 'Task 3', dependencies: [4], status: 'pending' },
						{ id: 4, title: 'Task 4', dependencies: [], status: 'pending' }
					]
				},
				'in-progress': {
					tasks: [
						{ id: 5, title: 'Task 5', dependencies: [], status: 'in-progress' }
					]
				}
			};

			// Set up mock file system with nested dependency data
			mockFs({
				[testDataDir]: {
					'tasks.json': JSON.stringify(nestedData, null, 2)
				}
			});

			// Test moving Task 1 with all its nested dependencies
			const result = await moveTasksBetweenTags(
				testTasksPath,
				['1'], // Task 1
				'backlog',
				'in-progress',
				{ withDependencies: true, ignoreDependencies: false },
				{ projectRoot: testDataDir }
			);

			// Verify the move operation was successful
			expect(result).toBeDefined();
			expect(result.message).toContain(
				'Successfully moved 4 tasks from "backlog" to "in-progress"'
			);
			expect(result.movedTasks).toHaveLength(4); // Tasks 1, 2, 3, 4

			// Read the updated data to verify all tasks moved
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			const rawData = updatedData._rawTaggedData || updatedData;

			// Verify all tasks moved from backlog
			expect(rawData.backlog?.tasks || []).toHaveLength(0); // All tasks moved

			// Verify all tasks are now in in-progress
			expect(rawData['in-progress']?.tasks || []).toHaveLength(5); // Task 5 + Tasks 1, 2, 3, 4

			// Verify dependency relationships are preserved
			const task1 = rawData['in-progress']?.tasks?.find((t) => t.id === 1);
			const task2 = rawData['in-progress']?.tasks?.find((t) => t.id === 2);
			const task3 = rawData['in-progress']?.tasks?.find((t) => t.id === 3);
			const task4 = rawData['in-progress']?.tasks?.find((t) => t.id === 4);

			expect(task1?.dependencies).toEqual([2]);
			expect(task2?.dependencies).toEqual([3]);
			expect(task3?.dependencies).toEqual([4]);
			expect(task4?.dependencies).toEqual([]);
		});

		it('should handle cross-tag dependency resolution using actual move functions', async () => {
			// Create data with cross-tag dependencies
			const crossTagData = {
				backlog: {
					tasks: [
						{ id: 1, title: 'Task 1', dependencies: [5], status: 'pending' }, // Depends on task in in-progress
						{ id: 2, title: 'Task 2', dependencies: [], status: 'pending' }
					]
				},
				'in-progress': {
					tasks: [
						{ id: 5, title: 'Task 5', dependencies: [], status: 'in-progress' }
					]
				}
			};

			// Set up mock file system with cross-tag dependency data
			mockFs({
				[testDataDir]: {
					'tasks.json': JSON.stringify(crossTagData, null, 2)
				}
			});

			// Test moving Task 1 which depends on Task 5 in another tag
			const result = await moveTasksBetweenTags(
				testTasksPath,
				['1'], // Task 1
				'backlog',
				'in-progress',
				{ withDependencies: false, ignoreDependencies: false },
				{ projectRoot: testDataDir }
			);

			// Verify the move operation was successful
			expect(result).toBeDefined();
			expect(result.message).toContain(
				'Successfully moved 1 tasks from "backlog" to "in-progress"'
			);

			// Read the updated data to verify the move actually happened
			const updatedData = readJSON(testTasksPath, null, 'backlog');
			const rawData = updatedData._rawTaggedData || updatedData;

			// Verify Task 1 is no longer in backlog
			const taskInBacklog = rawData.backlog?.tasks?.find((t) => t.id === 1);
			expect(taskInBacklog).toBeUndefined();

			// Verify Task 1 is now in in-progress with its dependency preserved
			const taskInProgress = rawData['in-progress']?.tasks?.find(
				(t) => t.id === 1
			);
			expect(taskInProgress).toBeDefined();
			expect(taskInProgress.title).toBe('Task 1');
			expect(taskInProgress.dependencies).toEqual([5]); // Cross-tag dependency preserved
		});
	});
});
