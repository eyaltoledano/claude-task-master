/**
 * Tests for the isCircularDependency function
 */

import { jest } from '@jest/globals';
import { isCircularDependency } from '../../../scripts/modules/dependency-manager.js';
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

// Mock utils module (Copied from original, paths assumed correct relative to project root)
const mockTaskExists = jest.fn();
const mockFormatTaskId = jest.fn();
const mockFindCycles = jest.fn(); // Keep relevant mocks if needed by the tested function
const mockLog = jest.fn(); // Keep relevant mocks if needed

jest.mock('../../../scripts/modules/utils.js', () => ({ // Adjusted path
	log: mockLog,
	// Only include mocks actually needed by isCircularDependency or its setup, if any
	// readJSON: jest.fn(), // Likely not needed here
	// writeJSON: jest.fn(), // Likely not needed here
	taskExists: mockTaskExists,
	formatTaskId: mockFormatTaskId,
	findCycles: mockFindCycles
}));

// Mock other modules if their mocks are needed by the setup/tested function
jest.mock('../../../scripts/modules/ui.js', () => ({ // Adjusted path
	displayBanner: jest.fn()
}));

jest.mock('../../../scripts/modules/task-manager.js', () => ({ // Adjusted path
	generateTaskFiles: jest.fn()
}));


describe('isCircularDependency function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Set default mock implementations relevant to isCircularDependency
		mockTaskExists.mockImplementation((tasks, id) => {
			// Default simple existence check for tests
			const idStr = String(id);
			if (idStr.includes('.')) {
				const [pId, sId] = idStr.split('.').map(Number);
				const parent = tasks.find(t => t.id === pId);
				return !!parent?.subtasks?.some(st => st.id === sId);
			}
			return tasks.some(t => String(t.id) === idStr);
		});
	});

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
		const result = isCircularDependency(tasks, '1.1');
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
		const result = isCircularDependency(tasks, '1.1');
		expect(result).toBe(false);
        const result3 = isCircularDependency(tasks, '1.3');
        expect(result3).toBe(false);
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
        // Override mock for this specific test if needed
        mockTaskExists.mockImplementation(() => true);
		const result = isCircularDependency(tasks, '1.3', ['1.2']); // Simulate adding 1.3 -> 1.2
		expect(result).toBe(false);
	});

	test('should correctly detect circular dependencies in subtasks of the same parent', () => {
		const tasks = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: ['1.3'] }, // 1 -> 3
					{ id: 2, dependencies: ['1.1'] }, // 2 -> 1
					{ id: 3, dependencies: ['1.2'] }  // 3 -> 2  => Cycle: 1->3->2->1
				]
			}
		];
		const result = isCircularDependency(tasks, '1.1');
		expect(result).toBe(true);
	});

    // Add more edge cases if necessary
}); 