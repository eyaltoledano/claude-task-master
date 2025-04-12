/**
 * Tests for the ensureAtLeastOneIndependentSubtask function
 */

import { jest } from '@jest/globals';
import { ensureAtLeastOneIndependentSubtask } from '../../../scripts/modules/dependency-manager.js';

// Mock dependencies (minimal, only if needed)
jest.mock('chalk', () => ({ // Basic mock, may not be needed
	green: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	red: jest.fn((text) => text),
	cyan: jest.fn((text) => text),
	bold: jest.fn((text) => text)
}));

// Mock utils if needed
const mockLog = jest.fn();
jest.mock('../../../scripts/modules/utils.js', () => ({ 
   log: mockLog,
   // Add other mocks if required by the function under test
}));

describe('ensureAtLeastOneIndependentSubtask function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('should clear dependencies of first subtask if none are independent', () => {
		const tasksData = {
			tasks: [
				{
					id: 1,
					subtasks: [
						{ id: 1, dependencies: ['1.2'] },
						{ id: 2, dependencies: ['1.1'] }
					]
				}
			]
		};

		const expectedTasks = [
			{
				id: 1,
				subtasks: [
					{ id: 1, dependencies: [] }, // Dependencies cleared
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];

		const result = ensureAtLeastOneIndependentSubtask(tasksData);
		expect(result).toBe(true);
		expect(tasksData.tasks).toEqual(expectedTasks);
	});

	test('should not modify tasks if at least one subtask is independent', () => {
		const tasksData = {
			tasks: [
				{
					id: 1,
					subtasks: [
						{ id: 1, dependencies: [] }, // Independent
						{ id: 2, dependencies: ['1.1'] }
					]
				}
			]
		};
        const originalTasksDataClone = JSON.parse(JSON.stringify(tasksData)); // Deep clone for comparison

		const result = ensureAtLeastOneIndependentSubtask(tasksData);
		expect(result).toBe(false);
		expect(tasksData).toEqual(originalTasksDataClone);
        expect(mockLog).not.toHaveBeenCalled();
	});

	test('should handle tasks without subtasks', () => {
		const tasksData = {
			tasks: [
				{ id: 1, dependencies: [] },
				{ id: 2, dependencies: [1] }
			]
		};
        const originalTasksDataClone = JSON.parse(JSON.stringify(tasksData)); // Deep clone

		const result = ensureAtLeastOneIndependentSubtask(tasksData);
		expect(result).toBe(false);
		expect(tasksData).toEqual(originalTasksDataClone);
        expect(mockLog).not.toHaveBeenCalled();
    });

	test('should handle empty subtasks array', () => {
		const tasksData = {
			tasks: [
				{
					id: 1,
					subtasks: []
				}
			]
		};
        const originalTasksDataClone = JSON.parse(JSON.stringify(tasksData)); // Deep clone

		const result = ensureAtLeastOneIndependentSubtask(tasksData);
		expect(result).toBe(false);
		expect(tasksData).toEqual(originalTasksDataClone);
        expect(mockLog).not.toHaveBeenCalled();
    });

    test('should handle task with multiple subtasks, none independent', () => {
        const tasksData = {
            tasks: [
                {
                    id: 1,
                    subtasks: [
                        { id: 1, dependencies: ['1.2'] },
                        { id: 2, dependencies: ['1.3'] },
                        { id: 3, dependencies: ['1.1'] }
                    ]
                }
            ]
        };
        const expectedTasks = [
            {
                id: 1,
                subtasks: [
                    { id: 1, dependencies: [] }, // First subtask's deps cleared
                    { id: 2, dependencies: ['1.3'] },
                    { id: 3, dependencies: ['1.1'] }
                ]
            }
        ];
        const result = ensureAtLeastOneIndependentSubtask(tasksData);
        expect(result).toBe(true);
        expect(tasksData.tasks).toEqual(expectedTasks);
    });

    test('should handle tasks with no dependencies property in subtasks', () => {
        const tasksData = {
            tasks: [
                {
                    id: 1,
                    subtasks: [
                        { id: 1 }, // No dependencies property
                        { id: 2, dependencies: ['1.1'] }
                    ]
                }
            ]
        };
        const originalTasksDataClone = JSON.parse(JSON.stringify(tasksData)); // Deep clone
        const result = ensureAtLeastOneIndependentSubtask(tasksData);
        expect(result).toBe(false);
        expect(tasksData).toEqual(originalTasksDataClone);
        expect(mockLog).not.toHaveBeenCalled();
    });
}); 