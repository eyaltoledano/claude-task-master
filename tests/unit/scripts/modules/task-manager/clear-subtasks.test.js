/**
 * Tests for the clear-subtasks.js module
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	CONFIG: {
		model: 'mock-claude-model',
		maxTokens: 4000,
		temperature: 0.7,
		debug: false
	},
	findTaskById: jest.fn(),
	isSilentMode: jest.fn(() => false),
	truncate: jest.fn((text) => text),
	ensureTagMetadata: jest.fn()
}));

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

// Mock external UI libraries
jest.unstable_mockModule('chalk', () => ({
	default: {
		white: {
			bold: jest.fn((text) => text)
		},
		cyan: Object.assign(
			jest.fn((text) => text),
			{
				bold: jest.fn((text) => text)
			}
		),
		green: jest.fn((text) => text),
		yellow: jest.fn((text) => text),
		bold: jest.fn((text) => text)
	}
}));

jest.unstable_mockModule('boxen', () => ({
	default: jest.fn((text) => text)
}));

jest.unstable_mockModule('cli-table3', () => ({
	default: jest.fn().mockImplementation(() => ({
		push: jest.fn(),
		toString: jest.fn(() => 'mocked table')
	}))
}));

// Mock process.exit to prevent Jest worker crashes
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
	throw new Error(`process.exit called with "${code}"`);
});

// Import the mocked modules
const { readJSON, writeJSON, log, findTaskById, ensureTagMetadata } =
	await import('../../../../../scripts/modules/utils.js');
const generateTaskFiles = (
	await import(
		'../../../../../scripts/modules/task-manager/generate-task-files.js'
	)
).default;

// Import the module under test
const { default: clearSubtasks } = await import(
	'../../../../../scripts/modules/task-manager/clear-subtasks.js'
);

describe('clearSubtasks', () => {
	const sampleTasks = {
		master: {
			tasks: [
				{ id: 1, title: 'Task 1', subtasks: [] },
				{ id: 2, title: 'Task 2', subtasks: [] },
				{
					id: 3,
					title: 'Task 3',
					subtasks: [{ id: 1, title: 'Subtask 3.1' }]
				},
				{
					id: 4,
					title: 'Task 4',
					subtasks: [{ id: 1, title: 'Subtask 4.1' }]
				}
			]
		}
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockExit.mockClear();
		readJSON.mockImplementation((tasksPath, projectRoot, tag) => {
			// Create a deep copy to avoid mutation issues between tests
			const sampleTasksCopy = JSON.parse(JSON.stringify(sampleTasks));
			// Return the data for the 'master' tag, which is what the tests use
			return {
				...sampleTasksCopy.master,
				tag: tag || 'master',
				_rawTaggedData: sampleTasksCopy
			};
		});
		writeJSON.mockResolvedValue();
		generateTaskFiles.mockResolvedValue();
		log.mockImplementation(() => {});
	});

	test('should clear subtasks from a specific task', () => {
		// Arrange
		const taskId = '3';
		const tasksPath = 'tasks/tasks.json';

		// Act
		clearSubtasks(tasksPath, taskId);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, undefined, undefined);
		expect(writeJSON).toHaveBeenCalledWith(
			tasksPath,
			expect.objectContaining({
				_rawTaggedData: expect.objectContaining({
					master: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({
								id: 3,
								subtasks: [] // Should be empty
							})
						])
					})
				})
			}),
			undefined,
			undefined
		);
	});

	test('should clear subtasks from multiple tasks when given comma-separated IDs', () => {
		// Arrange
		const taskIds = '3,4';
		const tasksPath = 'tasks/tasks.json';

		// Act
		clearSubtasks(tasksPath, taskIds);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, undefined, undefined);
		expect(writeJSON).toHaveBeenCalledWith(
			tasksPath,
			expect.objectContaining({
				_rawTaggedData: expect.objectContaining({
					master: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 3, subtasks: [] }),
							expect.objectContaining({ id: 4, subtasks: [] })
						])
					})
				})
			}),
			undefined,
			undefined
		);
	});

	test('should handle tasks with no subtasks', () => {
		// Arrange
		const taskId = '1'; // Task 1 already has no subtasks
		const tasksPath = 'tasks/tasks.json';

		// Act
		clearSubtasks(tasksPath, taskId);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, undefined, undefined);
		// Should not write the file if no changes were made
		expect(writeJSON).not.toHaveBeenCalled();
		expect(generateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle non-existent task IDs gracefully', () => {
		// Arrange
		const taskId = '99'; // Non-existent task
		const tasksPath = 'tasks/tasks.json';

		// Act
		clearSubtasks(tasksPath, taskId);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, undefined, undefined);
		expect(log).toHaveBeenCalledWith('error', 'Task 99 not found');
		// Should not write the file if no changes were made
		expect(writeJSON).not.toHaveBeenCalled();
		expect(generateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle multiple task IDs including both valid and non-existent IDs', () => {
		// Arrange
		const taskIds = '3,99'; // Mix of valid and invalid IDs
		const tasksPath = 'tasks/tasks.json';

		// Act
		clearSubtasks(tasksPath, taskIds);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(tasksPath, undefined, undefined);
		expect(log).toHaveBeenCalledWith('error', 'Task 99 not found');
		// Since task 3 has subtasks that should be cleared, writeJSON should be called
		expect(writeJSON).toHaveBeenCalledWith(
			tasksPath,
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({ id: 3, subtasks: [] })
				]),
				tag: 'master',
				_rawTaggedData: expect.objectContaining({
					master: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 3, subtasks: [] })
						])
					})
				})
			}),
			undefined,
			undefined
		);
	});

	test('should handle file read errors', () => {
		// Arrange
		readJSON.mockImplementation(() => {
			throw new Error('File read failed');
		});

		// Act & Assert
		expect(() => {
			clearSubtasks('tasks/tasks.json', '3');
		}).toThrow('File read failed');
	});

	test('should handle invalid tasks data', () => {
		// Arrange
		readJSON.mockReturnValue(null);

		// Act & Assert
		expect(() => {
			clearSubtasks('tasks/tasks.json', '3');
		}).toThrow('process.exit called');

		expect(log).toHaveBeenCalledWith('error', 'No valid tasks found.');
	});

	test('should handle file write errors', () => {
		// Arrange
		// Ensure task 3 has subtasks to clear so writeJSON gets called
		readJSON.mockReturnValue({
			...sampleTasks.master,
			tag: 'master',
			_rawTaggedData: sampleTasks,
			tasks: [
				...sampleTasks.master.tasks.slice(0, 2),
				{
					...sampleTasks.master.tasks[2],
					subtasks: [{ id: 1, title: 'Subtask to clear' }]
				},
				...sampleTasks.master.tasks.slice(3)
			]
		});

		writeJSON.mockImplementation(() => {
			throw new Error('File write failed');
		});

		// Act & Assert
		expect(() => {
			clearSubtasks('tasks/tasks.json', '3');
		}).toThrow('File write failed');
	});
});
