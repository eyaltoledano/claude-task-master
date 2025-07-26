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

		test('should find tasks when JSON contains string IDs (normalized to numbers)', () => {
			// Simulate tasks loaded from JSON with string IDs
			const tasksWithStringIds = [
				{ id: "1", title: 'First Task' },
				{ id: "2", title: 'Second Task', subtasks: [
					{ id: "1", title: 'Subtask One' },
					{ id: "2", title: 'Subtask Two' }
				]},
				{ id: "5", title: 'Fifth Task' }
			];
			
			// The readJSON function should normalize these IDs to numbers
			// For this test, we'll manually normalize them to simulate what happens
			tasksWithStringIds.forEach(task => {
				task.id = parseInt(task.id, 10);
				if (task.subtasks) {
					task.subtasks.forEach(subtask => {
						subtask.id = parseInt(subtask.id, 10);
					});
				}
			});

			// Test finding tasks by numeric ID
			const result1 = findTaskById(tasksWithStringIds, 5);
			expect(result1.task).toBeDefined();
			expect(result1.task.id).toBe(5);
			expect(result1.task.title).toBe('Fifth Task');

			// Test finding tasks by string ID  
			const result2 = findTaskById(tasksWithStringIds, '5');
			expect(result2.task).toBeDefined();
			expect(result2.task.id).toBe(5);

			// Test finding subtasks
			const result3 = findTaskById(tasksWithStringIds, '2.1');
			expect(result3.task).toBeDefined();
			expect(result3.task.id).toBe(1);
			expect(result3.task.title).toBe('Subtask One');
			expect(result3.task.isSubtask).toBe(true);
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
