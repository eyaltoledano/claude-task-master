/**
 * Tests for the validateTaskDependencies function
 */

import { jest } from '@jest/globals';
import { validateTaskDependencies } from '../../../scripts/modules/dependency-manager.js';
import * as utils from '../../../scripts/modules/utils.js'; // Adjusted path
import { sampleTasks } from '../../fixtures/sample-tasks.js'; // Adjusted path

// Mock dependencies (Copied from original, paths assumed correct relative to project root)
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

// Mock utils module (Adjust mocks as needed for validateTaskDependencies)
const mockTaskExists = jest.fn();
const mockFormatTaskId = jest.fn();
const mockLog = jest.fn(); // May be needed if function logs errors

jest.mock('../../../scripts/modules/utils.js', () => ({ // Adjusted path
	log: mockLog,
	taskExists: mockTaskExists,
	formatTaskId: mockFormatTaskId,
}));

// Mock other modules if their mocks are needed
jest.mock('../../../scripts/modules/ui.js', () => ({ // Adjusted path
	displayBanner: jest.fn()
}));

jest.mock('../../../scripts/modules/task-manager.js', () => ({ // Adjusted path
	generateTaskFiles: jest.fn()
}));

// Define a mock taskProvider or TaskManager class instance if needed by validateTaskDependencies
// const mockTaskProvider = {
//     getTasks: jest.fn(),
//     findTaskById: jest.fn((taskId) => {
//         // Simple mock implementation, adjust as needed for tests
//         const tasks = mockTaskProvider.getTasks();
//         if (typeof taskId === 'string' && taskId.includes('.')) {
//             const [pId, sId] = taskId.split('.').map(Number);
//             const parent = tasks.find(t => t.id === pId);
//             return parent?.subtasks?.find(st => st.id === sId);
//         }
//         return tasks.find(t => t.id === parseInt(taskId, 10));
//     })
// };


describe('validateTaskDependencies function', () => {
	beforeEach(() => {
		jest.clearAllMocks();

        // Reset mock task provider data for each test - REMOVE THIS
        // mockTaskProvider.getTasks.mockReturnValue([]);

		// Set default mock implementations relevant to validateTaskDependencies
		mockTaskExists.mockImplementation((tasks, id) => {
            // This mock might be less relevant if taskProvider.findTaskById is used
            // but kept for potential direct uses.
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

        // Mock findCycles to simulate cycle detection results
		// mockFindCycles.mockImplementation((tasks) => {
        //     // Return specific cycle detection results based on test scenarios
        //     // Example: return [[1, 2], [2, 1]] for a simple cycle
        //     return []; // Default: no cycles
        // });

        // Let's rely on the actual isCircularDependency for now. Remove findCycles mock.
        // jest.mock('../../../scripts/modules/utils.js', ...) should NOT mock findCycles
        // jest.mock('../../../scripts/modules/dependency-manager.js', ...) might be needed if we want to mock isCircularDependency

        // Re-mock utils, removing findCycles
        jest.mock('../../../scripts/modules/utils.js', () => ({ // Adjusted path
        	log: mockLog,
        	taskExists: mockTaskExists,
        	formatTaskId: mockFormatTaskId,
            // findCycles: mockFindCycles, // Removed
            // Include other utils mocks if necessary
        }));

	});

	test('should detect missing dependencies', () => {
		const tasks = [
			{ id: 1, dependencies: [2] } // Task 2 does not exist
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation((_, id) => String(id) === '1'); // Only task 1 exists

		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(false);
		// Check the issues array
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'missing',
					message: expect.stringContaining('depends on non-existent task 2')
				})
			])
		);
	});

	test('should detect circular dependencies', () => {
		const tasks = [
			{ id: 1, dependencies: [2] },
			{ id: 2, dependencies: [1] }
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true); // Assume all tasks exist
        // Since validateTaskDependencies uses isCircularDependency internally,
        // we don't need to mock cycle detection separately here.
		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(false);
        // Check the issues array for a circular type
        expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
	});

	test('should detect self-dependencies', () => {
		const tasks = [{ id: 1, dependencies: [1] }];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true);

		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(false);
        // Check the issues array
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'self',
					message: 'Task 1 depends on itself'
				})
			])
		);
	});

	test('should return valid for correct dependencies', () => {
		const tasks = [
			{ id: 1, dependencies: [] },
			{ id: 2, dependencies: [1] }
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true);
		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(true);
		expect(result.issues.length).toBe(0); // Check issues array is empty
	});

	test('should handle tasks with no dependencies property', () => {
		const tasks = [{ id: 1 }, { id: 2, dependencies: [1] }];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true);
		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(true);
        expect(result.issues.length).toBe(0);
	});

	test('should handle subtask dependencies correctly', () => {
		const tasks = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: [] },
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true);
		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(true);
        expect(result.issues.length).toBe(0);
	});

	test('should detect missing subtask dependencies', () => {
		const tasks = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: ['1.2'] } // Subtask 1.2 does not exist
				]
			}
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation((_, id) => String(id) === '1' || String(id) === '1.1'); // Only 1 and 1.1 exist

		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(false);
        // Check the issues array
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'missing',
					message: expect.stringContaining('depends on non-existent task/subtask 1.2')
				})
			])
		);
	});

	test('should detect circular dependencies between subtasks', () => {
		const tasks = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: ['1.2'] },
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true);
		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(false);
		expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
	});

	test('should properly validate dependencies between subtasks of the same parent', () => {
		const tasks = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: [] },
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];
        // REMOVE mockTaskProvider setup
		mockTaskExists.mockImplementation(() => true);
		const result = validateTaskDependencies(tasks); // Removed second argument
		expect(result.valid).toBe(true);
        expect(result.issues.length).toBe(0);
	});

    // Add more edge cases if necessary
}); 