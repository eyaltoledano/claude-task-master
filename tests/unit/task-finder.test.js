/**
 * Task finder tests
 */

// Import after mocks are set up - No mocks needed for readComplexityReport anymore
import { findTaskById } from '../../scripts/modules/utils.js';
import { emptySampleTasks, sampleTasks } from '../fixtures/sample-tasks.js';

describe('Task Finder', () => {
	describe('findTaskById function', () => {
		test('should find a task by numeric ID', () => {
			const result = findTaskById(sampleTasks.tasks, 2);
			expect(result.task).toBeDefined();
			expect(result.task.id).toBe(2);
			expect(result.task.title).toBe('Create Core Functionality');
			expect(result.originalSubtaskCount).toBeNull();
		});

		test('should find a task by string ID', () => {
			const result = findTaskById(sampleTasks.tasks, '2');
			expect(result.task).toBeDefined();
			expect(result.task.id).toBe(2);
			expect(result.originalSubtaskCount).toBeNull();
		});

		test('should find a subtask using dot notation', () => {
			const result = findTaskById(sampleTasks.tasks, '3.1');
			expect(result.task).toBeDefined();
			expect(result.task.id).toBe(1);
			expect(result.task.title).toBe('Create Header Component');
			expect(result.task.isSubtask).toBe(true);
			expect(result.task.parentTask.id).toBe(3);
			expect(result.originalSubtaskCount).toBeNull();
		});

		test('should return null for non-existent task ID', () => {
			const result = findTaskById(sampleTasks.tasks, 99);
			expect(result.task).toBeNull();
			expect(result.originalSubtaskCount).toBeNull();
		});

		test('should return null for non-existent subtask ID', () => {
			const result = findTaskById(sampleTasks.tasks, '3.99');
			expect(result.task).toBeNull();
			expect(result.originalSubtaskCount).toBeNull();
		});

		test('should return null for non-existent parent task ID in subtask notation', () => {
			const result = findTaskById(sampleTasks.tasks, '99.1');
			expect(result.task).toBeNull();
			expect(result.originalSubtaskCount).toBeNull();
		});

		test('should return null when tasks array is empty', () => {
			const result = findTaskById(emptySampleTasks.tasks, 1);
			expect(result.task).toBeNull();
			expect(result.originalSubtaskCount).toBeNull();
		});
		test('should work correctly when no complexity report is provided', () => {
			// Pass null as the complexity report
			const result = findTaskById(sampleTasks.tasks, 2, null);

			expect(result.task).toBeDefined();
			expect(result.task.id).toBe(2);
			expect(result.task.complexityScore).toBeUndefined();
		});
		test('should work correctly when task has no complexity data in the provided report', () => {
			// Define a complexity report that doesn't include task 2
			const complexityReport = {
				complexityAnalysis: [{ taskId: 999, complexityScore: 5 }]
			};

			const result = findTaskById(sampleTasks.tasks, 2, complexityReport);

			expect(result.task).toBeDefined();
			expect(result.task.id).toBe(2);
			expect(result.task.complexityScore).toBeUndefined();
		});

		test('should include complexity score when report is provided', () => {
			// Define the complexity report for this test
			const complexityReport = {
				meta: {
					generatedAt: '2023-01-01T00:00:00.000Z',
					tasksAnalyzed: 3,
					thresholdScore: 5
				},
				complexityAnalysis: [
					{
						taskId: 1,
						taskTitle: 'Initialize Project',
						complexityScore: 3,
						recommendedSubtasks: 2
					},
					{
						taskId: 2,
						taskTitle: 'Create Core Functionality',
						complexityScore: 8,
						recommendedSubtasks: 5
					},
					{
						taskId: 3,
						taskTitle: 'Implement UI Components',
						complexityScore: 6,
						recommendedSubtasks: 4
					}
				]
			};

			const result = findTaskById(sampleTasks.tasks, 2, complexityReport);

			expect(result.task).toBeDefined();
			expect(result.task.id).toBe(2);
			expect(result.task.complexityScore).toBe(8);
		});
	});
});
