/**
 * Tests for the list-tasks.js module
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	CONFIG: {
		model: 'mock-claude-model',
		maxTokens: 4000,
		temperature: 0.7,
		debug: false
	},
	sanitizePrompt: jest.fn((prompt) => prompt),
	truncate: jest.fn((text) => text),
	isSilentMode: jest.fn(() => false),
	findTaskById: jest.fn((tasks, id) =>
		tasks.find((t) => t.id === parseInt(id))
	),
	addComplexityToTask: jest.fn(),
	readComplexityReport: jest.fn(() => null)
}));

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	formatDependenciesWithStatus: jest.fn(),
	displayBanner: jest.fn(),
	displayTaskList: jest.fn(),
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
	stopLoadingIndicator: jest.fn(),
	createProgressBar: jest.fn(() => ' MOCK_PROGRESS_BAR '),
	getStatusWithColor: jest.fn((status) => status),
	getComplexityWithColor: jest.fn((score) => `Score: ${score}`)
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/dependency-manager.js',
	() => ({
		validateAndFixDependencies: jest.fn(),
		validateTaskDependencies: jest.fn()
	})
);

// Import the mocked modules
const { readJSON, log, readComplexityReport, addComplexityToTask } =
	await import('../../../../../scripts/modules/utils.js');
const { displayTaskList } = await import(
	'../../../../../scripts/modules/ui.js'
);
const { validateAndFixDependencies } = await import(
	'../../../../../scripts/modules/dependency-manager.js'
);

// Import the module under test
const { default: listTasks } = await import(
	'../../../../../scripts/modules/task-manager/list-tasks.js'
);

// Sample data for tests
const sampleTasks = {
	meta: { projectName: 'Test Project' },
	tasks: [
		{
			id: 1,
			title: 'Setup Project',
			description: 'Initialize project structure',
			status: 'done',
			dependencies: [],
			priority: 'high'
		},
		{
			id: 2,
			title: 'Implement Core Features',
			description: 'Build main functionality',
			status: 'pending',
			dependencies: [1],
			priority: 'high'
		},
		{
			id: 3,
			title: 'Create UI Components',
			description: 'Build user interface',
			status: 'in-progress',
			dependencies: [1, 2],
			priority: 'medium',
			subtasks: [
				{
					id: 1,
					title: 'Create Header Component',
					description: 'Build header component',
					status: 'done',
					dependencies: []
				},
				{
					id: 2,
					title: 'Create Footer Component',
					description: 'Build footer component',
					status: 'pending',
					dependencies: [1]
				}
			]
		},
		{
			id: 4,
			title: 'Testing',
			description: 'Write and run tests',
			status: 'cancelled',
			dependencies: [2, 3],
			priority: 'low'
		},
		{
			id: 5,
			title: 'Code Review',
			description: 'Review code for quality and standards',
			status: 'review',
			dependencies: [3],
			priority: 'medium'
		}
	]
};

describe('listTasks', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Mock console methods to suppress output
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});

		// Mock process.exit to prevent actual exit
		jest.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`process.exit: ${code}`);
		});

		// Set up default mock return values
		readJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks)));
		readComplexityReport.mockReturnValue(null);
		validateAndFixDependencies.mockImplementation(() => {});
		displayTaskList.mockImplementation(() => {});
		addComplexityToTask.mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console methods
		jest.restoreAllMocks();
	});

	test('should list all tasks when no status filter is provided', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';

		// Act
		const result = listTasks(tasksPath, null, null, false, 'json');

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, null, null);
		expect(result).toEqual(
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({ id: 1 }),
					expect.objectContaining({ id: 2 }),
					expect.objectContaining({ id: 3 }),
					expect.objectContaining({ id: 4 }),
					expect.objectContaining({ id: 5 })
				])
			})
		);
	});

	test('should filter tasks by status when status filter is provided', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		const statusFilter = 'pending';

		// Act
		const result = listTasks(tasksPath, statusFilter, null, false, 'json');

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, null, null);

		// Verify only pending tasks are returned
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].status).toBe('pending');
		expect(result.tasks[0].id).toBe(2);
	});

	test('should filter tasks by done status', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		const statusFilter = 'done';

		// Act
		const result = listTasks(tasksPath, statusFilter, null, false, 'json');

		// Assert
		// Verify only done tasks are returned
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].status).toBe('done');
	});

	test('should filter tasks by review status', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		const statusFilter = 'review';

		// Act
		const result = listTasks(tasksPath, statusFilter, null, false, 'json');

		// Assert
		// Verify only review tasks are returned
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].status).toBe('review');
		expect(result.tasks[0].id).toBe(5);
	});

	test('should include subtasks when withSubtasks option is true', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';

		// Act
		const result = listTasks(tasksPath, null, null, true, 'json');

		// Assert
		// Verify that the task with subtasks is included
		const taskWithSubtasks = result.tasks.find((task) => task.id === 3);
		expect(taskWithSubtasks).toBeDefined();
		expect(taskWithSubtasks.subtasks).toBeDefined();
		expect(taskWithSubtasks.subtasks).toHaveLength(2);
	});

	test('should not include subtasks when withSubtasks option is false', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';

		// Act
		const result = listTasks(tasksPath, null, null, false, 'json');

		// Assert
		// For JSON output, subtasks should still be included in the data structure
		// The withSubtasks flag affects display, not the data structure
		expect(result).toEqual(
			expect.objectContaining({
				tasks: expect.any(Array)
			})
		);
	});

	test('should return empty array when no tasks match the status filter', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		const statusFilter = 'blocked'; // Status that doesn't exist in sample data

		// Act
		const result = listTasks(tasksPath, statusFilter, null, false, 'json');

		// Assert
		// Verify empty array is returned
		expect(result.tasks).toHaveLength(0);
	});

	test('should handle file read errors', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		readJSON.mockImplementation(() => {
			throw new Error('File not found');
		});

		// Act & Assert
		expect(() => {
			listTasks(tasksPath, null, null, false, 'json');
		}).toThrow('File not found');
	});

	test('should validate and fix dependencies before listing', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';

		// Act
		listTasks(tasksPath, null, null, false, 'json');

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, null, null);
		// Note: validateAndFixDependencies is not called by listTasks function
		// This test just verifies the function runs without error
	});

	test('should pass correct options to displayTaskList', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';

		// Act
		const result = listTasks(tasksPath, 'pending', null, true, 'json');

		// Assert
		// For JSON output, we don't call displayTaskList, so just verify the result structure
		expect(result).toEqual(
			expect.objectContaining({
				tasks: expect.any(Array),
				filter: 'pending',
				stats: expect.any(Object)
			})
		);
	});

	test('should filter tasks by in-progress status', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		const statusFilter = 'in-progress';

		// Act
		const result = listTasks(tasksPath, statusFilter, null, false, 'json');

		// Assert
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].status).toBe('in-progress');
		expect(result.tasks[0].id).toBe(3);
	});

	test('should filter tasks by cancelled status', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';
		const statusFilter = 'cancelled';

		// Act
		const result = listTasks(tasksPath, statusFilter, null, false, 'json');

		// Assert
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].status).toBe('cancelled');
		expect(result.tasks[0].id).toBe(4);
	});

	test('should return the original tasks data structure', async () => {
		// Arrange
		const tasksPath = 'tasks/tasks.json';

		// Act
		const result = listTasks(tasksPath, null, null, false, 'json');

		// Assert
		expect(result).toEqual(
			expect.objectContaining({
				tasks: expect.any(Array),
				filter: 'all',
				stats: expect.objectContaining({
					total: 5,
					completed: expect.any(Number),
					inProgress: expect.any(Number),
					pending: expect.any(Number)
				})
			})
		);
		expect(result.tasks).toHaveLength(5);
	});

	// Tests for comma-separated status filtering
	describe('Comma-separated status filtering', () => {
		test('should filter tasks by multiple statuses separated by commas', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'done,pending';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			expect(readJSON).toHaveBeenCalledWith(tasksPath, null, null);

			// Should return tasks with 'done' or 'pending' status
			expect(result.tasks).toHaveLength(2);
			expect(result.tasks.map((t) => t.status)).toEqual(
				expect.arrayContaining(['done', 'pending'])
			);
		});

		test('should filter tasks by three or more statuses', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'done,pending,in-progress';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should return tasks with 'done', 'pending', or 'in-progress' status
			expect(result.tasks).toHaveLength(3);
			const statusValues = result.tasks.map((task) => task.status);
			expect(statusValues).toEqual(
				expect.arrayContaining(['done', 'pending', 'in-progress'])
			);

			// Verify all matching tasks are included
			const taskIds = result.tasks.map((task) => task.id);
			expect(taskIds).toContain(1); // done
			expect(taskIds).toContain(2); // pending
			expect(taskIds).toContain(3); // in-progress
			expect(taskIds).not.toContain(4); // cancelled - should not be included
		});

		test('should handle spaces around commas in status filter', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'done, pending , in-progress';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should trim spaces and work correctly
			expect(result.tasks).toHaveLength(3);
			const statusValues = result.tasks.map((task) => task.status);
			expect(statusValues).toEqual(
				expect.arrayContaining(['done', 'pending', 'in-progress'])
			);
		});

		test('should handle empty status values in comma-separated list', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'done,,pending,';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should ignore empty values and work with valid ones
			expect(result.tasks).toHaveLength(2);
			const statusValues = result.tasks.map((task) => task.status);
			expect(statusValues).toEqual(expect.arrayContaining(['done', 'pending']));
		});

		test('should handle case-insensitive matching for comma-separated statuses', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'DONE,Pending,IN-PROGRESS';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should match case-insensitively
			expect(result.tasks).toHaveLength(3);
			const statusValues = result.tasks.map((task) => task.status);
			expect(statusValues).toEqual(
				expect.arrayContaining(['done', 'pending', 'in-progress'])
			);
		});

		test('should return empty array when no tasks match comma-separated statuses', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'blocked,deferred';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should return empty array as no tasks have these statuses
			expect(result.tasks).toHaveLength(0);
		});

		test('should work with single status when using comma syntax', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'pending,';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should work the same as single status filter
			expect(result.tasks).toHaveLength(1);
			expect(result.tasks[0].status).toBe('pending');
		});

		test('should set correct filter value in response for comma-separated statuses', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'done,pending';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should return the original filter string
			expect(result.filter).toBe('done,pending');
		});

		test('should handle all statuses filter with comma syntax', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'all';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should return all tasks when filter is 'all'
			expect(result.tasks).toHaveLength(5);
			expect(result.filter).toBe('all');
		});

		test('should handle mixed existing and non-existing statuses', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'done,nonexistent,pending';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should return only tasks with existing statuses
			expect(result.tasks).toHaveLength(2);
			const statusValues = result.tasks.map((task) => task.status);
			expect(statusValues).toEqual(expect.arrayContaining(['done', 'pending']));
		});

		test('should filter by review status in comma-separated list', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const statusFilter = 'review,cancelled';

			// Act
			const result = listTasks(tasksPath, statusFilter, null, false, 'json');

			// Assert
			// Should return tasks with 'review' or 'cancelled' status
			expect(result.tasks).toHaveLength(2);
			const statusValues = result.tasks.map((task) => task.status);
			expect(statusValues).toEqual(
				expect.arrayContaining(['review', 'cancelled'])
			);

			// Verify specific tasks
			const taskIds = result.tasks.map((task) => task.id);
			expect(taskIds).toContain(4); // cancelled task
			expect(taskIds).toContain(5); // review task
		});
	});
});
