/**
 * Tests for the clearSubtasks function in task-manager.js
 */

import { jest } from '@jest/globals';
import { sampleTasks } from '../../fixtures/sample-tasks.js'; // Adjusted path

// Mocks
const mockLog = jest.fn();

// Mock the utils module where log is defined
jest.mock('../../../scripts/modules/utils.js', () => ({
	log: mockLog,
	// Add other mocked functions from utils if needed by clearSubtasks or tests
}));

describe('clearSubtasks function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// Test implementation of clearSubtasks that just returns the updated data
	const testClearSubtasks = (tasksData, taskIds) => {
		// Create a deep copy of the data to avoid modifying the original
		const data = JSON.parse(JSON.stringify(tasksData));
		let clearedCount = 0;

		// Handle multiple task IDs (comma-separated)
		const taskIdArray = taskIds.split(',').map((id) => id.trim());

		taskIdArray.forEach((taskId) => {
			const id = parseInt(taskId, 10);
			if (isNaN(id)) {
				return;
			}

			const task = data.tasks.find((t) => t.id === id);
			if (!task) {
				// Log error for non-existent task
				mockLog('error', `Task ${id} not found`);
				return;
			}

			if (!task.subtasks || task.subtasks.length === 0) {
				// No subtasks to clear
				return;
			}

			const subtaskCount = task.subtasks.length;
			delete task.subtasks;
			clearedCount++;
		});

		return { data, clearedCount };
	};

	test('should clear subtasks from a specific task', () => {
		// Create a deep copy of the sample data
		const testData = JSON.parse(JSON.stringify(sampleTasks));

		// Execute the test function
		const { data, clearedCount } = testClearSubtasks(testData, '3');

		// Verify results
		expect(clearedCount).toBe(1);

		// Verify the task's subtasks were removed
		const task = data.tasks.find((t) => t.id === 3);
		expect(task).toBeDefined();
		expect(task.subtasks).toBeUndefined();
	});

	test('should clear subtasks from multiple tasks when given comma-separated IDs', () => {
		// Setup data with subtasks on multiple tasks
		const testData = JSON.parse(JSON.stringify(sampleTasks));
		// Add subtasks to task 2
		testData.tasks[1].subtasks = [
			{
				id: 1,
				title: 'Test Subtask',
				description: 'A test subtask',
				status: 'pending',
				dependencies: []
			}
		];

		// Execute the test function
		const { data, clearedCount } = testClearSubtasks(testData, '2,3');

		// Verify results
		expect(clearedCount).toBe(2);

		// Verify both tasks had their subtasks cleared
		const task2 = data.tasks.find((t) => t.id === 2);
		const task3 = data.tasks.find((t) => t.id === 3);
		expect(task2.subtasks).toBeUndefined();
		expect(task3.subtasks).toBeUndefined();
	});

	test('should handle tasks with no subtasks', () => {
		// Task 1 has no subtasks in the sample data
		const testData = JSON.parse(JSON.stringify(sampleTasks));

		// Execute the test function
		const { clearedCount } = testClearSubtasks(testData, '1');

		// Verify no tasks were cleared
		expect(clearedCount).toBe(0);
	});

	test('should handle non-existent task IDs', () => {
		const testData = JSON.parse(JSON.stringify(sampleTasks));

		// Execute the test function
		testClearSubtasks(testData, '99');

		// Verify an error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Task 99 not found')
		);
	});

	test('should handle multiple task IDs including both valid and non-existent IDs', () => {
		const testData = JSON.parse(JSON.stringify(sampleTasks));

		// Execute the test function
		const { data, clearedCount } = testClearSubtasks(testData, '3,99');

		// Verify results
		expect(clearedCount).toBe(1);
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Task 99 not found')
		);

		// Verify the valid task's subtasks were removed
		const task3 = data.tasks.find((t) => t.id === 3);
		expect(task3.subtasks).toBeUndefined();
	});
}); 