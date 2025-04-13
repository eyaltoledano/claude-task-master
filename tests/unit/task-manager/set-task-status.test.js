/**
 * Tests for the setTaskStatus functionality
 */

import { jest } from '@jest/globals';

// Import the fixture
import { sampleTasks } from '../../fixtures/sample-tasks.js'; 

// Note: Assuming setTaskStatus itself isn't directly tested, but the helpers are.
// If setTaskStatus is exported and needs testing, uncomment its import.
// import { setTaskStatus } from '../../../scripts/modules/task-manager.js';

// Mock implementations needed (if any)
// const mockWriteJSON = jest.fn();
// const mockGenerateTaskFiles = jest.fn();
// jest.mock('../../../scripts/modules/utils.js', () => ({ writeJSON: mockWriteJSON }));
// jest.mock('../../../scripts/modules/task-manager.js', () => ({ 
//   ...jest.requireActual('../../../scripts/modules/task-manager.js'),
//   generateTaskFiles: mockGenerateTaskFiles 
// }));

// Helper function copied from original task-manager.test.js (lines 185-240)
const testUpdateSingleTaskStatus = (tasksData, taskIdInput, newStatus) => {
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

// Helper function copied from original task-manager.test.js (lines 170-183)
const testSetTaskStatus = (tasksData, taskIdInput, newStatus) => {
	// Handle multiple task IDs (comma-separated)
	const taskIds = taskIdInput.split(',').map((id) => id.trim());
	const updatedTasks = []; // This wasn't used in the original, but keeping for structure

	// Update each task using the single task helper
	for (const id of taskIds) {
		testUpdateSingleTaskStatus(tasksData, id, newStatus);
        // updatedTasks.push(id); // Original line, seems unused
	}

    // NOTE: This helper *modifies* the input tasksData object directly.
    // It doesn't save to file or call generateTaskFiles.
	return tasksData; 
};



describe('setTaskStatus function', () => {
    // Use beforeEach to ensure a fresh copy of sampleTasks for each test
    let currentSampleTasks;
    beforeEach(() => {
        currentSampleTasks = JSON.parse(JSON.stringify(sampleTasks));
    });

	test('should update task status in tasks.json', async () => {
		// Arrange - uses currentSampleTasks from beforeEach
		// Act
		const updatedData = testSetTaskStatus(currentSampleTasks, '2', 'done');

		// Assert
		expect(updatedData.tasks[1].id).toBe(2);
		expect(updatedData.tasks[1].status).toBe('done');
	});

	test('should update subtask status when using dot notation', async () => {
		// Arrange - uses currentSampleTasks
		// Act
		const updatedData = testSetTaskStatus(currentSampleTasks, '3.1', 'done');

		// Assert
		const subtaskParent = updatedData.tasks.find((t) => t.id === 3);
		expect(subtaskParent).toBeDefined();
		expect(subtaskParent.subtasks[0].status).toBe('done');
	});

	test('should update multiple tasks when given comma-separated IDs', async () => {
		// Arrange - uses currentSampleTasks
		// Act - Set back to pending for assertion
		const updatedData = testSetTaskStatus(currentSampleTasks, '1,2', 'pending');

		// Assert
		expect(updatedData.tasks[0].status).toBe('pending');
		expect(updatedData.tasks[1].status).toBe('pending');
	});

	test('should automatically mark subtasks as done when parent is marked done', async () => {
		// Arrange - uses currentSampleTasks
		// Act
		const updatedData = testSetTaskStatus(currentSampleTasks, '3', 'done');

		// Assert
		const parentTask = updatedData.tasks.find((t) => t.id === 3);
		expect(parentTask.status).toBe('done');
		expect(parentTask.subtasks[0].status).toBe('done');
		expect(parentTask.subtasks[1].status).toBe('done');
	});

	test('should throw error for non-existent task ID', async () => {
		// Arrange - uses currentSampleTasks
		// Assert
		expect(() => testSetTaskStatus(currentSampleTasks, '99', 'done')).toThrow(
			'Task 99 not found'
		);
	});
}); 