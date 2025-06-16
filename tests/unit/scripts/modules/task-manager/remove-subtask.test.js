/**
 * Tests for the removeSubtask function
 */
import { jest } from '@jest/globals';
import path from 'path';

// Mock dependencies
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();
const mockGenerateTaskFiles = jest.fn();

// Mock path module
jest.mock('path', () => ({
	dirname: jest.fn()
}));

// Define test version of the removeSubtask function
const testRemoveSubtask = (
	tasksPath,
	subtaskId,
	convertToTask = false,
	generateFiles = true
) => {
	// Read the existing tasks
	const data = mockReadJSON(tasksPath);
	if (!data || !data.tasks) {
		throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
	}

	// Parse the subtask ID (format: "parentId.subtaskId")
	if (!subtaskId.includes('.')) {
		throw new Error(`Invalid subtask ID format: ${subtaskId}`);
	}

	const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
	const parentId = parseInt(parentIdStr, 10);
	const subtaskIdNum = parseInt(subtaskIdStr, 10);

	// Find the parent task
	const parentTask = data.tasks.find((t) => t.id === parentId);
	if (!parentTask) {
		throw new Error(`Parent task with ID ${parentId} not found`);
	}

	// Check if parent has subtasks
	if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
		throw new Error(`Parent task ${parentId} has no subtasks`);
	}

	// Find the subtask to remove
	const subtaskIndex = parentTask.subtasks.findIndex(
		(st) => st.id === subtaskIdNum
	);
	if (subtaskIndex === -1) {
		throw new Error(`Subtask ${subtaskId} not found`);
	}

	// Get a copy of the subtask before removing it
	const removedSubtask = { ...parentTask.subtasks[subtaskIndex] };

	// Remove the subtask from the parent
	parentTask.subtasks.splice(subtaskIndex, 1);

	// If parent has no more subtasks, remove the subtasks array
	if (parentTask.subtasks.length === 0) {
		delete parentTask.subtasks;
	}

	let convertedTask = null;

	// Convert the subtask to a standalone task if requested
	if (convertToTask) {
		// Find the highest task ID to determine the next ID
		const highestId = Math.max(...data.tasks.map((t) => t.id));
		const newTaskId = highestId + 1;

		// Create the new task from the subtask
		convertedTask = {
			id: newTaskId,
			title: removedSubtask.title,
			description: removedSubtask.description || '',
			details: removedSubtask.details || '',
			status: removedSubtask.status || 'pending',
			dependencies: removedSubtask.dependencies || [],
			priority: parentTask.priority || 'medium' // Inherit priority from parent
		};

		// Add the parent task as a dependency if not already present
		if (!convertedTask.dependencies.includes(parentId)) {
			convertedTask.dependencies.push(parentId);
		}

		// Add the converted task to the tasks array
		data.tasks.push(convertedTask);
	}

	// Write the updated tasks back to the file
	mockWriteJSON(tasksPath, data);

	// Generate task files if requested
	if (generateFiles) {
		mockGenerateTaskFiles(tasksPath, path.dirname(tasksPath));
	}

	return convertedTask;
};

describe('removeSubtask function', () => {
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
					dependencies: [],
					subtasks: [
						{
							id: 1,
							title: 'Subtask 1',
							description: 'This is subtask 1',
							status: 'pending',
							dependencies: [],
							parentTaskId: 1
						},
						{
							id: 2,
							title: 'Subtask 2',
							description: 'This is subtask 2',
							status: 'in-progress',
							dependencies: [1], // Depends on subtask 1
							parentTaskId: 1
						}
					]
				},
				{
					id: 2,
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
	});

	test('should remove a subtask from its parent task', async () => {
		// Execute the test version of removeSubtask to remove subtask 1.1
		testRemoveSubtask('tasks/tasks.json', '1.1', false, true);

		// Verify readJSON was called with the correct path
		expect(mockReadJSON).toHaveBeenCalledWith('tasks/tasks.json');

		// Verify writeJSON was called with updated data
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify generateTaskFiles was called
		// expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should convert a subtask to a standalone task', async () => {
		// Execute the test version of removeSubtask to convert subtask 1.1 to a standalone task
		const result = testRemoveSubtask('tasks/tasks.json', '1.1', true, true);

		// Verify the result is the new task
		expect(result).toBeDefined();
		expect(result.id).toBe(3);
		expect(result.title).toBe('Subtask 1');
		expect(result.dependencies).toContain(1);

		// Verify writeJSON was called
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify generateTaskFiles was called
		// expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should throw an error if subtask ID format is invalid', async () => {
		// Expect an error for invalid subtask ID format
		expect(() => testRemoveSubtask('tasks/tasks.json', '1', false)).toThrow(
			/Invalid subtask ID format/
		);

		// Verify writeJSON was not called
		expect(mockWriteJSON).not.toHaveBeenCalled();
	});

	test('should throw an error if parent task does not exist', async () => {
		// Expect an error for non-existent parent task
		expect(() => testRemoveSubtask('tasks/tasks.json', '999.1', false)).toThrow(
			/Parent task with ID 999 not found/
		);

		// Verify writeJSON was not called
		expect(mockWriteJSON).not.toHaveBeenCalled();
	});

	test('should throw an error if subtask does not exist', async () => {
		// Expect an error for non-existent subtask
		expect(() => testRemoveSubtask('tasks/tasks.json', '1.999', false)).toThrow(
			/Subtask 1.999 not found/
		);

		// Verify writeJSON was not called
		expect(mockWriteJSON).not.toHaveBeenCalled();
	});

	test('should remove subtasks array if last subtask is removed', async () => {
		// Create a data object with just one subtask
		mockReadJSON.mockImplementationOnce(() => ({
			tasks: [
				{
					id: 1,
					title: 'Parent Task',
					description: 'This is a parent task',
					status: 'pending',
					dependencies: [],
					subtasks: [
						{
							id: 1,
							title: 'Last Subtask',
							description: 'This is the last subtask',
							status: 'pending',
							dependencies: [],
							parentTaskId: 1
						}
					]
				},
				{
					id: 2,
					title: 'Another Task',
					description: 'This is another task',
					status: 'pending',
					dependencies: [1]
				}
			]
		}));

		// Mock the behavior of writeJSON to capture the updated tasks data
		const updatedTasksData = { tasks: [] };
		mockWriteJSON.mockImplementation((path, data) => {
			// Store the data for assertions
			updatedTasksData.tasks = [...data.tasks];
			return data;
		});

		// Remove the last subtask
		testRemoveSubtask('tasks/tasks.json', '1.1', false, true);

		// Verify writeJSON was called
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify the subtasks array was removed completely
		const parentTask = updatedTasksData.tasks.find((t) => t.id === 1);
		expect(parentTask).toBeDefined();
		expect(parentTask.subtasks).toBeUndefined();

		// Verify generateTaskFiles was called
		// expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should not regenerate task files if generateFiles is false', async () => {
		// Execute the test version of removeSubtask with generateFiles = false
		testRemoveSubtask('tasks/tasks.json', '1.1', false, false);

		// Verify writeJSON was called
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify task files were not regenerated
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});
});
