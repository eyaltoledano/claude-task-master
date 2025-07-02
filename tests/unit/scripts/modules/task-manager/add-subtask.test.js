/**
 * Tests for the addSubtask function
 */
import { jest } from '@jest/globals';

// Mock dependencies before importing the module
const mockUtils = {
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	getCurrentTag: jest.fn()
};
const mockTaskManager = {
	isTaskDependentOn: jest.fn()
};
const mockGenerateTaskFiles = jest.fn();

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils.js',
	() => mockUtils
);
jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager.js',
	() => mockTaskManager
);
jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: mockGenerateTaskFiles
	})
);

const addSubtask = (
	await import('../../../../../scripts/modules/task-manager/add-subtask.js')
).default;

describe('addSubtask function', () => {
	const multiTagData = {
		master: {
			tasks: [{ id: 1, title: 'Master Task', subtasks: [] }],
			metadata: { description: 'Master tasks' }
		},
		'feature-branch': {
			tasks: [{ id: 1, title: 'Feature Task', subtasks: [] }],
			metadata: { description: 'Feature tasks' }
		}
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockTaskManager.isTaskDependentOn.mockReturnValue(false);
	});

	test('should add a new subtask and preserve other tags', async () => {
		const context = { projectRoot: '/fake/root', tag: 'feature-branch' };
		const newSubtaskData = { title: 'My New Subtask' };
		mockUtils.readJSON.mockReturnValueOnce({
			tasks: [{ id: 1, title: 'Feature Task', subtasks: [] }],
			metadata: { description: 'Feature tasks' }
		});

		await addSubtask('tasks.json', '1', null, newSubtaskData, true, context);

		expect(mockUtils.writeJSON).toHaveBeenCalledWith(
			'tasks.json',
			expect.any(Object),
			'/fake/root',
			'feature-branch'
		);
		const writtenData = mockUtils.writeJSON.mock.calls[0][1];
		const parentTask = writtenData.tasks.find((t) => t.id === 1);
		expect(parentTask.subtasks).toHaveLength(1);
		expect(parentTask.subtasks[0].title).toBe('My New Subtask');
	});

	test('should add a new subtask to a parent task', async () => {
		mockUtils.readJSON.mockReturnValueOnce({
			tasks: [{ id: 1, title: 'Parent Task', subtasks: [] }]
		});
		const context = {};
		const newSubtask = await addSubtask(
			'tasks.json',
			'1',
			null,
			{ title: 'New Subtask' },
			true,
			context
		);
		expect(newSubtask).toBeDefined();
		expect(newSubtask.id).toBe(1);
		expect(newSubtask.parentTaskId).toBe(1);
		expect(mockUtils.writeJSON).toHaveBeenCalled();
		const writeCallArgs = mockUtils.writeJSON.mock.calls[0][1]; // data is the second arg now
		const parentTask = writeCallArgs.tasks.find((t) => t.id === 1);
		expect(parentTask.subtasks).toHaveLength(1);
		expect(parentTask.subtasks[0].title).toBe('New Subtask');
		expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should convert an existing task to a subtask', async () => {
		mockUtils.readJSON.mockReturnValueOnce({
			tasks: [
				{ id: 1, title: 'Parent Task', subtasks: [] },
				{ id: 2, title: 'Existing Task 2', subtasks: [] }
			]
		});
		const context = {};
		const convertedSubtask = await addSubtask(
			'tasks.json',
			'1',
			'2',
			null,
			true,
			context
		);
		expect(convertedSubtask.id).toBe(1);
		expect(convertedSubtask.parentTaskId).toBe(1);
		expect(convertedSubtask.title).toBe('Existing Task 2');
		expect(mockUtils.writeJSON).toHaveBeenCalled();
		const writeCallArgs = mockUtils.writeJSON.mock.calls[0][1];
		const parentTask = writeCallArgs.tasks.find((t) => t.id === 1);
		expect(parentTask.subtasks).toHaveLength(1);
		expect(parentTask.subtasks[0].title).toBe('Existing Task 2');
	});

	test('should throw an error if parent task does not exist', async () => {
		mockUtils.readJSON.mockReturnValueOnce({
			tasks: [{ id: 1, title: 'Task 1', subtasks: [] }]
		});
		const context = {};
		await expect(
			addSubtask(
				'tasks.json',
				'99',
				null,
				{ title: 'New Subtask' },
				true,
				context
			)
		).rejects.toThrow('Parent task with ID 99 not found');
	});

	test('should throw an error if trying to convert a non-existent task', async () => {
		mockUtils.readJSON.mockReturnValueOnce({
			tasks: [{ id: 1, title: 'Parent Task', subtasks: [] }]
		});
		const context = {};
		await expect(
			addSubtask('tasks.json', '1', '99', null, true, context)
		).rejects.toThrow('Task with ID 99 not found');
	});

	test('should throw an error for circular dependency', async () => {
		mockUtils.readJSON.mockReturnValueOnce({
			tasks: [
				{ id: 1, title: 'Parent Task', subtasks: [] },
				{ id: 2, title: 'Child Task', subtasks: [] }
			]
		});
		mockTaskManager.isTaskDependentOn.mockImplementation(
			(tasks, parentTask, existingTaskIdNum) => {
				return parentTask.id === 1 && existingTaskIdNum === 2;
			}
		);
		const context = {};
		await expect(
			addSubtask('tasks.json', '1', '2', null, true, context)
		).rejects.toThrow(
			'Cannot create circular dependency: task 1 is already a subtask or dependent of task 2'
		);
	});
});
