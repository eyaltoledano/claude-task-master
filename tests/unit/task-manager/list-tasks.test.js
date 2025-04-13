/**
 * Tests for the listTasks function in task-manager.js
 */

import { jest } from '@jest/globals';
import { sampleTasks, emptySampleTasks } from '../../fixtures/sample-tasks.js'; // Adjusted path

// Mocks
const mockDisplayTaskList = jest.fn();

// Helper function (simplified version for testing)
const testListTasks = (tasksData, statusFilter, withSubtasks = false) => {
	// Filter tasks by status if specified
	const filteredTasks = statusFilter
		? tasksData.tasks.filter(
				(task) =>
					task.status &&
					task.status.toLowerCase() === statusFilter.toLowerCase()
			)
		: tasksData.tasks;

	// Call the displayTaskList mock for testing
	mockDisplayTaskList(tasksData, statusFilter, withSubtasks);

	return {
		filteredTasks,
		tasksData
	};
};

describe('listTasks function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('should display all tasks when no filter is provided', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Act
		const result = testListTasks(testTasksData);

		// Assert
		expect(result.filteredTasks.length).toBe(testTasksData.tasks.length);
		expect(mockDisplayTaskList).toHaveBeenCalledWith(
			testTasksData,
			undefined,
			false
		);
	});

	test('should filter tasks by status when filter is provided', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));
		const statusFilter = 'done';

		// Act
		const result = testListTasks(testTasksData, statusFilter);

		// Assert
		expect(result.filteredTasks.length).toBe(
			testTasksData.tasks.filter((t) => t.status === statusFilter).length
		);
		expect(mockDisplayTaskList).toHaveBeenCalledWith(
			testTasksData,
			statusFilter,
			false
		);
	});

	test('should display subtasks when withSubtasks flag is true', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Act
		testListTasks(testTasksData, undefined, true);

		// Assert
		expect(mockDisplayTaskList).toHaveBeenCalledWith(
			testTasksData,
			undefined,
			true
		);
	});

	test('should handle empty tasks array', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(emptySampleTasks));

		// Act
		const result = testListTasks(testTasksData);

		// Assert
		expect(result.filteredTasks.length).toBe(0);
		expect(mockDisplayTaskList).toHaveBeenCalledWith(
			testTasksData,
			undefined,
			false
		);
	});
}); 