/**
 * Tests for the removeDuplicateDependencies function
 */

import { jest } from '@jest/globals';
import { removeDuplicateDependencies } from '../../../scripts/modules/dependency-manager.js';
// No other specific imports from dependency-manager needed

// Mock dependencies (Only include necessary mocks, if any)
jest.mock('chalk', () => ({
	green: jest.fn((text) => `<green>${text}</green>`),
	yellow: jest.fn((text) => `<yellow>${text}</yellow>`),
	red: jest.fn((text) => `<red>${text}</red>`),
	cyan: jest.fn((text) => `<cyan>${text}</cyan>`),
	bold: jest.fn((text) => `<bold>${text}</bold>`)
}));

// Mock utils module (Include only if needed by the function or setup)
// const mockLog = jest.fn();
// jest.mock('../../../scripts/modules/utils.js', () => ({ 
//    log: mockLog 
// }));

describe('removeDuplicateDependencies function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// No specific mock setup needed for this simple function
	});

	test('should remove duplicate dependencies from tasks', () => {
		const tasksData = {
			tasks: [
				{ id: 1, dependencies: [2, 3, 2, 4, 3] },
				{ id: 2, dependencies: [3] },
				{ id: 3, dependencies: [4, 4] },
				{ id: 4, dependencies: [] }
			]
		};

		const expectedTasks = [
			{ id: 1, dependencies: [2, 3, 4] }, // Duplicates removed, order might change based on Set
			{ id: 2, dependencies: [3] },
			{ id: 3, dependencies: [4] },
			{ id: 4, dependencies: [] }
		];

		const result = removeDuplicateDependencies(tasksData);
        // Sort dependencies for consistent comparison as Set order isn't guaranteed
        result.tasks.forEach(task => task.dependencies?.sort());
        expectedTasks.forEach(task => task.dependencies?.sort());

		expect(result.tasks).toEqual(expectedTasks);
	});

	test('should handle empty dependencies array', () => {
		const tasksData = {
			tasks: [
				{ id: 1, dependencies: [] },
				{ id: 2, dependencies: [1] }
			]
		};

		const expectedTasks = [
			{ id: 1, dependencies: [] },
			{ id: 2, dependencies: [1] }
		];

		const result = removeDuplicateDependencies(tasksData);
		expect(result.tasks).toEqual(expectedTasks);
	});

	test('should handle tasks with no dependencies property', () => {
		const tasksData = {
			tasks: [
				{ id: 1 }, // No dependencies property
				{ id: 2, dependencies: [1, 1] }
			]
		};

		const expectedTasks = [
			{ id: 1 },
			{ id: 2, dependencies: [1] }
		];

		const result = removeDuplicateDependencies(tasksData);
        result.tasks[1]?.dependencies?.sort(); // Sort for comparison
        expectedTasks[1]?.dependencies?.sort();

		expect(result.tasks).toEqual(expectedTasks);
	});
}); 