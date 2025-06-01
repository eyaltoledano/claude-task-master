/**
 * Tests for the addSubtask function
 */
import { jest } from '@jest/globals';
import path from 'path';

// Mock dependencies
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();
const mockGenerateTaskFiles = jest.fn();
const mockIsTaskDependentOn = jest.fn().mockReturnValue(false);

// Mock path module
jest.mock('path', () => ({
	dirname: jest.fn()
}));

// Define test version of the addSubtask function
const testAddSubtask = (
	tasksPath,
	parentId,
	existingTaskId,
	newSubtaskData,
	generateFiles = true
) => {
	// Read the existing tasks
	const data = mockReadJSON(tasksPath);
	if (!data || !data.tasks) {
		throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
	}

	// Convert parent ID to number
	const parentIdNum = parseInt(parentId, 10);

	// Find the parent task
	const parentTask = data.tasks.find((t) => t.id === parentIdNum);
	if (!parentTask) {
		throw new Error(`Parent task with ID ${parentIdNum} not found`);
	}

	// Initialize subtasks array if it doesn't exist
	if (!parentTask.subtasks) {
		parentTask.subtasks = [];
	}

	let newSubtask;

	// Case 1: Convert an existing task to a subtask
	if (existingTaskId !== null) {
		const existingTaskIdNum = parseInt(existingTaskId, 10);

		// Find the existing task
		const existingTaskIndex = data.tasks.findIndex(
			(t) => t.id === existingTaskIdNum
		);
		if (existingTaskIndex === -1) {
			throw new Error(`Task with ID ${existingTaskIdNum} not found`);
		}

		const existingTask = data.tasks[existingTaskIndex];

		// Check if task is already a subtask
		if (existingTask.parentTaskId) {
			throw new Error(
				`Task ${existingTaskIdNum} is already a subtask of task ${existingTask.parentTaskId}`
			);
		}

		// Check for circular dependency
		if (existingTaskIdNum === parentIdNum) {
			throw new Error(`Cannot make a task a subtask of itself`);
		}

		// Check for circular dependency using mockIsTaskDependentOn
		if (mockIsTaskDependentOn()) {
			throw new Error(
				`Cannot create circular dependency: task ${parentIdNum} is already a subtask or dependent of task ${existingTaskIdNum}`
			);
		}

		// Find the highest subtask ID to determine the next ID
		const highestSubtaskId =
			parentTask.subtasks.length > 0
				? Math.max(...parentTask.subtasks.map((st) => st.id))
				: 0;
		const newSubtaskId = highestSubtaskId + 1;

		// Clone the existing task to be converted to a subtask
		newSubtask = {
			...existingTask,
			id: newSubtaskId,
			parentTaskId: parentIdNum
		};

		// Add to parent's subtasks
		parentTask.subtasks.push(newSubtask);

		// Remove the task from the main tasks array
		data.tasks.splice(existingTaskIndex, 1);
	}
	// Case 2: Create a new subtask
	else if (newSubtaskData) {
		// Find the highest subtask ID to determine the next ID
		const highestSubtaskId =
			parentTask.subtasks.length > 0
				? Math.max(...parentTask.subtasks.map((st) => st.id))
				: 0;
		const newSubtaskId = highestSubtaskId + 1;

		// Create the new subtask object
		newSubtask = {
			id: newSubtaskId,
			title: newSubtaskData.title,
			description: newSubtaskData.description || '',
			details: newSubtaskData.details || '',
			status: newSubtaskData.status || 'pending',
			dependencies: newSubtaskData.dependencies || [],
			parentTaskId: parentIdNum
		};

		// Add to parent's subtasks
		parentTask.subtasks.push(newSubtask);
	} else {
		throw new Error('Either existingTaskId or newSubtaskData must be provided');
	}

	// Write the updated tasks back to the file
	mockWriteJSON(tasksPath, data);

	// Generate task files if requested
	if (generateFiles) {
		mockGenerateTaskFiles(tasksPath, path.dirname(tasksPath));
	}

	return newSubtask;
};

describe('addSubtask function', () => {
	// Reset mocks before each test
	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock implementations
		mockReadJSON.mockImplementation(() => ({
			tasks: [
				{
					id: 1,
					title: 'Parent Task',
					description: 'This is a parent task',
					status: 'pending',
					dependencies: []
				},
				{
					id: 2,
					title: 'Existing Task',
					description: 'This is an existing task',
					status: 'pending',
					dependencies: []
				},
				{
					id: 3,
					title: 'Another Task',
					description: 'This is another task',
					status: 'pending',
					dependencies: [1]
				}
			]
		}));

		// Setup success write response
		mockWriteJSON.mockImplementation((path, data) => {
			return data;
		});

		// Set up default behavior for dependency check
		mockIsTaskDependentOn.mockReturnValue(false);
	});

	test('should add a new subtask to a parent task', async () => {
		// Create new subtask data
		const newSubtaskData = {
			title: 'New Subtask',
			description: 'This is a new subtask',
			details: 'Implementation details for the subtask',
			status: 'pending',
			dependencies: []
		};

		// Execute the test version of addSubtask
		const newSubtask = testAddSubtask(
			'tasks/tasks.json',
			1,
			null,
			newSubtaskData,
			true
		);

		// Verify readJSON was called with the correct path
		expect(mockReadJSON).toHaveBeenCalledWith('tasks/tasks.json');

		// Verify writeJSON was called with the correct path
		expect(mockWriteJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.any(Object)
		);

		// Verify the subtask was created with correct data
		expect(newSubtask).toBeDefined();
		expect(newSubtask.id).toBe(1);
		expect(newSubtask.title).toBe('New Subtask');
		expect(newSubtask.parentTaskId).toBe(1);

		// Verify generateTaskFiles was called
		expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should convert an existing task to a subtask', async () => {
		// Execute the test version of addSubtask to convert task 2 to a subtask of task 1
		const convertedSubtask = testAddSubtask(
			'tasks/tasks.json',
			1,
			2,
			null,
			true
		);

		// Verify readJSON was called with the correct path
		expect(mockReadJSON).toHaveBeenCalledWith('tasks/tasks.json');

		// Verify writeJSON was called
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify the subtask was created with correct data
		expect(convertedSubtask).toBeDefined();
		expect(convertedSubtask.id).toBe(1);
		expect(convertedSubtask.title).toBe('Existing Task');
		expect(convertedSubtask.parentTaskId).toBe(1);

		// Verify generateTaskFiles was called
		expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should throw an error if parent task does not exist', async () => {
		// Create new subtask data
		const newSubtaskData = {
			title: 'New Subtask',
			description: 'This is a new subtask'
		};

		// Override mockReadJSON for this specific test case
		mockReadJSON.mockImplementationOnce(() => ({
			tasks: [
				{
					id: 1,
					title: 'Task 1',
					status: 'pending'
				}
			]
		}));

		// Expect an error when trying to add a subtask to a non-existent parent
		expect(() =>
			testAddSubtask('tasks/tasks.json', 999, null, newSubtaskData)
		).toThrow(/Parent task with ID 999 not found/);

		// Verify writeJSON was not called
		expect(mockWriteJSON).not.toHaveBeenCalled();
	});

	test('should throw an error if existing task does not exist', async () => {
		// Expect an error when trying to convert a non-existent task
		expect(() => testAddSubtask('tasks/tasks.json', 1, 999, null)).toThrow(
			/Task with ID 999 not found/
		);

		// Verify writeJSON was not called
		expect(mockWriteJSON).not.toHaveBeenCalled();
	});

	test('should throw an error if trying to create a circular dependency', async () => {
		// Force the isTaskDependentOn mock to return true for this test only
		mockIsTaskDependentOn.mockReturnValueOnce(true);

		// Expect an error when trying to create a circular dependency
		expect(() => testAddSubtask('tasks/tasks.json', 3, 1, null)).toThrow(
			/circular dependency/
		);

		// Verify writeJSON was not called
		expect(mockWriteJSON).not.toHaveBeenCalled();
	});

	test('should not regenerate task files if generateFiles is false', async () => {
		// Create new subtask data
		const newSubtaskData = {
			title: 'New Subtask',
			description: 'This is a new subtask'
		};

		// Execute the test version of addSubtask with generateFiles = false
		testAddSubtask('tasks/tasks.json', 1, null, newSubtaskData, false);

		// Verify writeJSON was called
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify task files were not regenerated
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});
});
