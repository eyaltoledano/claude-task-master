/**
 * Tests for the validateTaskDependencies function
 */

import { jest } from '@jest/globals';
import { validateTaskDependencies } from '../../../scripts/modules/dependency-manager.js';
import { sampleTasks } from '../../fixtures/sample-tasks.js'; // Adjusted path

// Define mocks directly
const mockTaskExists = jest.fn();
const mockFormatTaskId = jest.fn(); // Keep this? Check if needed by tests
const mockLog = jest.fn(); 
const mockIsCircularDependency = jest.fn().mockReturnValue(false); // Add mock for cycle check

// Mock other dependencies
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

// Mock other modules if their mocks are needed
jest.mock('../../../scripts/modules/ui.js', () => ({ // Adjusted path
	displayBanner: jest.fn()
}));

jest.mock('../../../scripts/modules/task-manager.js', () => ({ // Adjusted path
	generateTaskFiles: jest.fn()
}));

// Define a mock task provider
let mockTaskProvider;

describe('validateTaskDependencies function', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Reset and configure mock task provider for each test
		mockTaskProvider = {
			getTasks: jest.fn()
		};

		// Reset mock task provider data for each test - REMOVE THIS
		// mockTaskProvider.getTasks.mockReturnValue([]);

		// Reset mocks
		mockTaskExists.mockClear();
		mockFormatTaskId.mockClear(); 
		mockLog.mockClear();
		mockIsCircularDependency.mockClear(); // Clear cycle mock

		// Configure default mock implementations
		mockTaskExists.mockImplementation((tasks, id) => { // Default implementation
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
		mockFormatTaskId.mockImplementation((id) => { // Default implementation
			if (typeof id === 'string' && id.includes('.')) { return id; }
			return parseInt(id, 10); // Or keep original simpler mock
		});
        // Default: no cycles
        mockIsCircularDependency.mockReturnValue(false);
	});

	test('should detect missing dependencies', async () => {
		const tasksData = [
			{ id: 1, dependencies: [2] } // Task 2 does not exist
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		// Explicitly mock task existence for this specific test case
        mockTaskExists.mockImplementation((tasks, id) => {
            // For this test, only task 1 exists.
            return String(id) === '1';
        });

		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass cycle mock
		}); // Pass provider
		expect(result.valid).toBe(false); // Check valid property
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

	test('should detect circular dependencies', async () => {
		const tasksData = [
			{ id: 1, dependencies: [2] },
			{ id: 2, dependencies: [1] }
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation(() => true); // Assume all tasks exist
        mockIsCircularDependency.mockImplementation((_, id) => String(id) === '1' || String(id) === '2'); // Simulate cycle

		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass cycle mock
		}); // Pass provider
		expect(result.valid).toBe(false); // Check valid property
        // Check the issues array for a circular type
        expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
	});

	test('should detect self-dependencies', async () => {
		const tasksData = [{ id: 1, dependencies: [1] }];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation(() => true);

		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		}); // Pass provider
		expect(result.valid).toBe(false); // Check valid property
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

	test('should return valid for correct dependencies', async () => {
		const tasksData = [
			{ id: 1, dependencies: [] },
			{ id: 2, dependencies: [1] }
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation(() => true);
		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		}); // Pass provider
		expect(result.valid).toBe(true); // Check valid property
		expect(result.issues.length).toBe(0); // Check issues array is empty
	});

	test('should handle tasks with no dependencies property', async () => {
		const tasksData = [{ id: 1 }, { id: 2, dependencies: [1] }];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation(() => true);
		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		}); // Pass provider
		expect(result.valid).toBe(true); // Check valid property
        expect(result.issues.length).toBe(0);
	});

	test('should handle subtask dependencies correctly', async () => {
		const tasksData = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: [] },
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation(() => true);
		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		}); // Pass provider
		expect(result.valid).toBe(true); // Check valid property
        expect(result.issues.length).toBe(0);
	});

	test('should detect missing subtask dependencies', async () => {
		const tasksData = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: ['1.2'] } // Subtask 1.2 does not exist
				]
			}
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation((_, id) => String(id) === '1' || String(id) === '1.1'); // Only 1 and 1.1 exist

		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		}); // Pass provider
		expect(result.valid).toBe(false); // Check valid property
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

	test('should detect circular dependencies between subtasks', async () => {
		const tasksData = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: ['1.2'] },
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
        mockTaskExists.mockImplementation(() => true); // Assume all exist
        // Simulate cycle involving 1.1 and 1.2
        mockIsCircularDependency.mockImplementation((_, id) => String(id) === '1.1' || String(id) === '1.2');

		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass cycle mock
		}); // Pass provider
		expect(result.valid).toBe(false); // Check valid property
		expect(result.issues.some(issue => issue.type === 'circular')).toBe(true);
	});

	test('should properly validate dependencies between subtasks of the same parent', async () => {
		const tasksData = [
			{
				id: 1,
				dependencies: [],
				subtasks: [
					{ id: 1, dependencies: [] },
					{ id: 2, dependencies: ['1.1'] }
				]
			}
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }
		mockTaskExists.mockImplementation(() => true);
		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		}); // Pass provider
		expect(result.valid).toBe(true); // Check valid property
        expect(result.issues.length).toBe(0);
	});

	test('should report success when dependencies are valid', async () => {
		const tasksData = [
			{ id: 1, dependencies: [] },
			{ id: 2, dependencies: [1] }
		];
		mockTaskProvider.getTasks.mockResolvedValue({ tasks: tasksData }); // Wrap in { tasks: ... }

		const result = await validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		});

		expect(result.valid).toBe(true); // Check valid property
		expect(result.issues.length).toBe(0);
	});

	test('should handle missing task provider gracefully', async () => {
		// Expect validateTaskDependencies to throw an error when taskProvider is missing
		await expect(validateTaskDependencies({})).rejects.toThrow(
			'Task provider is required'
		);
	});

	test('should handle errors during task fetching', async () => {
		mockTaskProvider.getTasks.mockRejectedValue(new Error('Fetch failed')); // Configure mock

		await expect(validateTaskDependencies({ 
			taskProvider: mockTaskProvider,
			taskExistsFunc: mockTaskExists,
			logFunc: mockLog,
			isCircularDependencyFunc: mockIsCircularDependency // Pass default mock
		})).rejects.toThrow(
			'Fetch failed'
		);
	});

	// Add more edge cases if necessary
}); 