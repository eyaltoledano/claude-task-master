/**
 * Tests for the slim-task.js module
 *
 * Covers:
 * - Description truncation at 200 chars + ellipsis
 * - details and testStrategy cleared to empty string
 * - Slimming only occurs on transition TO done (not already-done tasks)
 * - Subtask slimming behavior
 */
import { jest } from '@jest/globals';

// Mock the utils.js log function before importing the module under test
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	log: jest.fn()
}));

const {
	DESCRIPTION_TRUNCATE_LENGTH,
	slimTask,
	slimSubtask,
	slimTaskOnComplete,
	slimSubtaskOnComplete
} = await import('../../../../../scripts/modules/task-manager/slim-task.js');

describe('slim-task module', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('slimTask', () => {
		test('should clear details field to empty string', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Short description',
				details: 'This is a very detailed explanation of the task.',
				testStrategy: '',
				status: 'done'
			};

			slimTask(task);

			expect(task.details).toBe('');
		});

		test('should clear testStrategy field to empty string', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Short description',
				details: '',
				testStrategy:
					'Run unit tests, integration tests, and manual QA testing.',
				status: 'done'
			};

			slimTask(task);

			expect(task.testStrategy).toBe('');
		});

		test('should truncate description longer than 200 chars and append ellipsis', () => {
			const longDescription = 'A'.repeat(250);
			const task = {
				id: 1,
				title: 'Test Task',
				description: longDescription,
				details: '',
				testStrategy: '',
				status: 'done'
			};

			slimTask(task);

			expect(task.description.length).toBe(
				DESCRIPTION_TRUNCATE_LENGTH + 3
			); // 200 + '...'
			expect(task.description).toBe('A'.repeat(200) + '...');
		});

		test('should not truncate description that is exactly 200 chars', () => {
			const exactDescription = 'B'.repeat(200);
			const task = {
				id: 1,
				title: 'Test Task',
				description: exactDescription,
				details: '',
				testStrategy: '',
				status: 'done'
			};

			slimTask(task);

			expect(task.description).toBe(exactDescription);
			expect(task.description.length).toBe(200);
		});

		test('should not truncate description shorter than 200 chars', () => {
			const shortDescription = 'Short description that is well under the limit.';
			const task = {
				id: 1,
				title: 'Test Task',
				description: shortDescription,
				details: 'some details',
				testStrategy: 'some strategy',
				status: 'done'
			};

			slimTask(task);

			expect(task.description).toBe(shortDescription);
			// But details and testStrategy should still be cleared
			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
		});

		test('should handle null task gracefully', () => {
			expect(slimTask(null)).toBeNull();
		});

		test('should handle undefined task gracefully', () => {
			expect(slimTask(undefined)).toBeUndefined();
		});

		test('should handle task with no details or testStrategy fields', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Some description',
				status: 'done'
			};

			const result = slimTask(task);

			expect(result).toBe(task);
			expect(task.description).toBe('Some description');
		});

		test('should return the same task object (mutated in place)', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Desc',
				details: 'Details',
				testStrategy: 'Strategy',
				status: 'done'
			};

			const result = slimTask(task);

			expect(result).toBe(task); // Same reference
		});
	});

	describe('slimSubtask', () => {
		test('should clear details and testStrategy on subtask', () => {
			const subtask = {
				id: 1,
				title: 'Subtask 1',
				description: 'A subtask description',
				details: 'Subtask details here',
				testStrategy: 'Subtask test strategy',
				status: 'done'
			};

			slimSubtask(subtask);

			expect(subtask.details).toBe('');
			expect(subtask.testStrategy).toBe('');
			expect(subtask.description).toBe('A subtask description');
		});

		test('should truncate long subtask description', () => {
			const subtask = {
				id: 1,
				title: 'Subtask 1',
				description: 'C'.repeat(300),
				details: '',
				testStrategy: '',
				status: 'done'
			};

			slimSubtask(subtask);

			expect(subtask.description).toBe('C'.repeat(200) + '...');
		});

		test('should handle null subtask gracefully', () => {
			expect(slimSubtask(null)).toBeNull();
		});
	});

	describe('slimTaskOnComplete', () => {
		test('should slim task when transitioning from pending to done', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'D'.repeat(250),
				details: 'Detailed info',
				testStrategy: 'Test strategy',
				status: 'done',
				subtasks: []
			};

			slimTaskOnComplete(task, 'pending', 'done');

			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
			expect(task.description).toBe('D'.repeat(200) + '...');
		});

		test('should slim task when transitioning from in-progress to done', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Short desc',
				details: 'Some details',
				testStrategy: 'Strategy',
				status: 'done',
				subtasks: []
			};

			slimTaskOnComplete(task, 'in-progress', 'done');

			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
		});

		test('should slim task when transitioning to completed status', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Short desc',
				details: 'Some details',
				testStrategy: 'Strategy',
				status: 'completed',
				subtasks: []
			};

			slimTaskOnComplete(task, 'pending', 'completed');

			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
		});

		test('should NOT slim task when already done (done -> done)', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'E'.repeat(250),
				details: 'Should remain',
				testStrategy: 'Should remain',
				status: 'done',
				subtasks: []
			};

			slimTaskOnComplete(task, 'done', 'done');

			expect(task.details).toBe('Should remain');
			expect(task.testStrategy).toBe('Should remain');
			expect(task.description).toBe('E'.repeat(250));
		});

		test('should NOT slim task when transitioning away from done', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'E'.repeat(250),
				details: 'Should remain',
				testStrategy: 'Should remain',
				status: 'pending',
				subtasks: []
			};

			slimTaskOnComplete(task, 'done', 'pending');

			expect(task.details).toBe('Should remain');
			expect(task.testStrategy).toBe('Should remain');
		});

		test('should NOT slim task when transitioning between non-done statuses', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'E'.repeat(250),
				details: 'Should remain',
				testStrategy: 'Should remain',
				status: 'in-progress',
				subtasks: []
			};

			slimTaskOnComplete(task, 'pending', 'in-progress');

			expect(task.details).toBe('Should remain');
			expect(task.testStrategy).toBe('Should remain');
		});

		test('should also slim all subtasks when parent transitions to done', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Short desc',
				details: 'Parent details',
				testStrategy: 'Parent strategy',
				status: 'done',
				subtasks: [
					{
						id: 1,
						title: 'Subtask 1',
						description: 'F'.repeat(250),
						details: 'Subtask 1 details',
						testStrategy: 'Subtask 1 strategy',
						status: 'done'
					},
					{
						id: 2,
						title: 'Subtask 2',
						description: 'Short subtask desc',
						details: 'Subtask 2 details',
						testStrategy: 'Subtask 2 strategy',
						status: 'done'
					}
				]
			};

			slimTaskOnComplete(task, 'pending', 'done');

			// Parent slimmed
			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');

			// Subtask 1 slimmed (long description truncated)
			expect(task.subtasks[0].details).toBe('');
			expect(task.subtasks[0].testStrategy).toBe('');
			expect(task.subtasks[0].description).toBe('F'.repeat(200) + '...');

			// Subtask 2 slimmed (short description preserved)
			expect(task.subtasks[1].details).toBe('');
			expect(task.subtasks[1].testStrategy).toBe('');
			expect(task.subtasks[1].description).toBe('Short subtask desc');
		});

		test('should handle task with no subtasks', () => {
			const task = {
				id: 1,
				title: 'Test Task',
				description: 'Desc',
				details: 'Details',
				testStrategy: 'Strategy',
				status: 'done'
			};

			const result = slimTaskOnComplete(task, 'pending', 'done');

			expect(result).toBe(task);
			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
		});
	});

	describe('slimSubtaskOnComplete', () => {
		test('should slim subtask when transitioning to done', () => {
			const subtask = {
				id: 1,
				title: 'Subtask 1',
				description: 'G'.repeat(250),
				details: 'Subtask details',
				testStrategy: 'Subtask strategy',
				status: 'done'
			};

			slimSubtaskOnComplete(subtask, 'pending', 'done');

			expect(subtask.details).toBe('');
			expect(subtask.testStrategy).toBe('');
			expect(subtask.description).toBe('G'.repeat(200) + '...');
		});

		test('should NOT slim subtask when already done', () => {
			const subtask = {
				id: 1,
				title: 'Subtask 1',
				description: 'G'.repeat(250),
				details: 'Should remain',
				testStrategy: 'Should remain',
				status: 'done'
			};

			slimSubtaskOnComplete(subtask, 'done', 'done');

			expect(subtask.details).toBe('Should remain');
			expect(subtask.testStrategy).toBe('Should remain');
		});

		test('should NOT slim subtask when transitioning to non-done status', () => {
			const subtask = {
				id: 1,
				title: 'Subtask 1',
				description: 'Short desc',
				details: 'Should remain',
				testStrategy: 'Should remain',
				status: 'in-progress'
			};

			slimSubtaskOnComplete(subtask, 'pending', 'in-progress');

			expect(subtask.details).toBe('Should remain');
			expect(subtask.testStrategy).toBe('Should remain');
		});
	});

	describe('DESCRIPTION_TRUNCATE_LENGTH constant', () => {
		test('should be 200', () => {
			expect(DESCRIPTION_TRUNCATE_LENGTH).toBe(200);
		});
	});
});
