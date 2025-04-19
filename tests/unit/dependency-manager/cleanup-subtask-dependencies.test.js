/**
 * Tests for the cleanupSubtaskDependencies function
 */

import { jest } from '@jest/globals';
import { cleanupSubtaskDependencies } from '../../../scripts/modules/dependency-manager.js';
import * as utils from '../../../scripts/modules/utils.js'; // Needed for taskExists mock

// Mock dependencies
jest.mock('chalk', () => ({
	green: jest.fn((text) => `<green>${text}</green>`),
	yellow: jest.fn((text) => `<yellow>${text}</yellow>`),
	red: jest.fn((text) => `<red>${text}</red>`),
	cyan: jest.fn((text) => `<cyan>${text}</cyan>`),
	bold: jest.fn((text) => `<bold>${text}</bold>`)
}));

// Mock utils module
const mockTaskExists = jest.fn();

jest.mock('../../../scripts/modules/utils.js', () => ({ 
   taskExists: mockTaskExists,
   // Add other necessary mocks from utils if needed
   log: jest.fn(),
   formatTaskId: jest.fn((id) => {
       if (typeof id === 'string' && id.includes('.')) {
           return id;
       }
       return parseInt(id, 10);
   })
}));

describe('cleanupSubtaskDependencies function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Set default mock behavior for taskExists
		mockTaskExists.mockReturnValue(true); // Assume tasks exist by default
	});

	test('should remove dependencies to non-existent subtasks', () => {
		const tasksData = {
			tasks: [
				{
					id: 1,
					dependencies: [2], // Valid task dependency
					subtasks: [
						{ id: 1, dependencies: ['1.2', '1.99', 2] }, // 1.99 is non-existent, 2 is task
						{ id: 2, dependencies: ['1.1'] }
					]
				},
                { id: 2, dependencies: [] }
			]
		};

        // Configure mockTaskExists for this specific test case
        mockTaskExists.mockImplementation((tasks, id) => {
            const idStr = String(id);
            if (idStr === '1.1') return true;
            if (idStr === '1.2') return true;
            if (idStr === '1.99') return false; // Simulate non-existent subtask
            if (idStr === '2') return true; // Task 2 exists
            if (idStr === '1') return true; // Task 1 exists
            return false;
        });

		const expectedTasks = [
			{
				id: 1,
				dependencies: [2],
				subtasks: [
					{ id: 1, dependencies: ['1.2', 2] }, // 1.99 removed
					{ id: 2, dependencies: ['1.1'] }
				]
			},
            { id: 2, dependencies: [] }
		];

		const result = cleanupSubtaskDependencies(tasksData);
        // Sort dependencies for consistent comparison
        result.tasks.forEach(task => {
            task.dependencies?.sort();
            task.subtasks?.forEach(st => st.dependencies?.sort());
        });
        expectedTasks.forEach(task => {
            task.dependencies?.sort();
            task.subtasks?.forEach(st => st.dependencies?.sort());
        });

		expect(result.tasks).toEqual(expectedTasks);
	});

	test('should handle tasks without subtasks', () => {
		const tasksData = {
			tasks: [
				{ id: 1, dependencies: [99] }, // 99 doesn't exist
				{ id: 2, dependencies: [1] }
			]
		};

        mockTaskExists.mockImplementation((tasks, id) => String(id) === '1' || String(id) === '2');

		const expectedTasks = [
			{ id: 1, dependencies: [] }, // Dependency 99 removed
			{ id: 2, dependencies: [1] }
		];

		const result = cleanupSubtaskDependencies(tasksData);
		expect(result.tasks).toEqual(expectedTasks);
	});

    test('should handle tasks with subtasks but no invalid dependencies', () => {
        const tasksData = {
            tasks: [
                {
                    id: 1,
                    dependencies: [],
                    subtasks: [
                        { id: 1, dependencies: ['1.2'] },
                        { id: 2, dependencies: [] }
                    ]
                }
            ]
        };
        mockTaskExists.mockReturnValue(true);
        const result = cleanupSubtaskDependencies(JSON.parse(JSON.stringify(tasksData))); // Clone data
        expect(result).toEqual(tasksData);
    });

    test('should handle empty tasks array', () => {
        const tasksData = { tasks: [] };
        const result = cleanupSubtaskDependencies(tasksData);
        expect(result.tasks).toEqual([]);
    });
}); 