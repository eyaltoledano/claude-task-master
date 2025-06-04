/**
 * Tests for the updateSingleTaskStatus function
 */
import { jest } from '@jest/globals';

// Import test fixtures
import {
	isValidTaskStatus,
	TASK_STATUS_OPTIONS
} from '../../../../../src/constants/task-status.js';

// Sample tasks data for testing
const sampleTasks = {
	tasks: [
		{
			id: 1,
			title: 'Task 1',
			description: 'First task',
			status: 'pending',
			dependencies: []
		},
		{
			id: 2,
			title: 'Task 2',
			description: 'Second task',
			status: 'pending',
			dependencies: []
		},
		{
			id: 3,
			title: 'Task 3',
			description: 'Third task with subtasks',
			status: 'pending',
			dependencies: [],
			subtasks: [
				{
					id: 1,
					title: 'Subtask 3.1',
					description: 'First subtask',
					status: 'pending',
					dependencies: []
				},
				{
					id: 2,
					title: 'Subtask 3.2',
					description: 'Second subtask',
					status: 'pending',
					dependencies: []
				}
			]
		}
	]
};

// Simplified version of updateSingleTaskStatus for testing
const testUpdateSingleTaskStatus = (tasksData, taskIdInput, newStatus) => {
	if (!isValidTaskStatus(newStatus)) {
		throw new Error(
			`Error: Invalid status value: ${newStatus}. Use one of: ${TASK_STATUS_OPTIONS.join(', ')}`
		);
	}

	// Check if it's a subtask (e.g., "1.2")
	if (taskIdInput.includes('.')) {
		const [parentId, subtaskId] = taskIdInput
			.split('.')
			.map((id) => parseInt(id, 10));

		// Find the parent task
		const parentTask = tasksData.tasks.find((t) => t.id === parentId);
		if (!parentTask) {
			throw new Error(`Parent task ${parentId} not found`);
		}

		// Find the subtask
		if (!parentTask.subtasks) {
			throw new Error(`Parent task ${parentId} has no subtasks`);
		}

		const subtask = parentTask.subtasks.find((st) => st.id === subtaskId);
		if (!subtask) {
			throw new Error(
				`Subtask ${subtaskId} not found in parent task ${parentId}`
			);
		}

		// Update the subtask status
		subtask.status = newStatus;

		// Check if all subtasks are done (if setting to 'done')
		if (
			newStatus.toLowerCase() === 'done' ||
			newStatus.toLowerCase() === 'completed'
		) {
			const allSubtasksDone = parentTask.subtasks.every(
				(st) => st.status === 'done' || st.status === 'completed'
			);

			// For testing, we don't need to output suggestions
		}
	} else {
		// Handle regular task
		const taskId = parseInt(taskIdInput, 10);
		const task = tasksData.tasks.find((t) => t.id === taskId);

		if (!task) {
			throw new Error(`Task ${taskId} not found`);
		}

		// Update the task status
		task.status = newStatus;

		// If marking as done, also mark all subtasks as done
		if (
			(newStatus.toLowerCase() === 'done' ||
				newStatus.toLowerCase() === 'completed') &&
			task.subtasks &&
			task.subtasks.length > 0
		) {
			task.subtasks.forEach((subtask) => {
				subtask.status = newStatus;
			});
		}
	}

	return true;
};

describe('updateSingleTaskStatus function', () => {
	test('should update regular task status', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Act
		const result = testUpdateSingleTaskStatus(testTasksData, '2', 'done');

		// Assert
		expect(result).toBe(true);
		expect(testTasksData.tasks[1].status).toBe('done');
	});

	test('should throw error for invalid status', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Assert
		expect(() =>
			testUpdateSingleTaskStatus(testTasksData, '2', 'Done')
		).toThrow(/Error: Invalid status value: Done./);
	});

	test('should update subtask status', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Act
		const result = testUpdateSingleTaskStatus(testTasksData, '3.1', 'done');

		// Assert
		expect(result).toBe(true);
		expect(testTasksData.tasks[2].subtasks[0].status).toBe('done');
	});

	test('should handle parent tasks without subtasks', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Remove subtasks from task 3
		const taskWithoutSubtasks = { ...testTasksData.tasks[2] };
		delete taskWithoutSubtasks.subtasks;
		testTasksData.tasks[2] = taskWithoutSubtasks;

		// Assert
		expect(() =>
			testUpdateSingleTaskStatus(testTasksData, '3.1', 'done')
		).toThrow('has no subtasks');
	});

	test('should handle non-existent subtask ID', async () => {
		// Arrange
		const testTasksData = JSON.parse(JSON.stringify(sampleTasks));

		// Assert
		expect(() =>
			testUpdateSingleTaskStatus(testTasksData, '3.99', 'done')
		).toThrow('Subtask 99 not found');
	});
});
