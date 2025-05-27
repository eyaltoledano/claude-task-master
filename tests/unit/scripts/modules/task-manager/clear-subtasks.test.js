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
	truncate: jest.fn((text) => text)
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

// Import the mocked modules
const { readJSON, writeJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);

const generateTaskFiles = await import(
	'../../../../../scripts/modules/task-manager/generate-task-files.js'
);

// Import the module under test
const { default: clearSubtasks } = await import(
	'../../../../../scripts/modules/task-manager/clear-subtasks.js'
);

describe('clearSubtasks', () => {
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
				dependencies: [],
				subtasks: [
					{
						id: 1,
						title: 'Subtask 2.1',
						description: 'First subtask of task 2',
						status: 'pending',
						dependencies: []
					}
				]
			},
			{
				id: 3,
				title: 'Task 3',
				description: 'Third task',
				status: 'pending',
				dependencies: [],
				subtasks: [
					{
						id: 1,
						title: 'Subtask 3.1',
						description: 'First subtask of task 3',
						status: 'pending',
						dependencies: []
					},
					{
						id: 2,
						title: 'Subtask 3.2',
						description: 'Second subtask of task 3',
						status: 'done',
						dependencies: []
					}
				]
			}
		]
	};

	beforeEach(() => {
		jest.clearAllMocks();
		readJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks)));

		// Mock process.exit since this function doesn't have MCP mode support
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});

		// Mock console.log to avoid output during tests
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore process.exit
		process.exit.mockRestore();
		console.log.mockRestore();
	});

	test('should clear subtasks from a specific task', () => {
		// Act
		clearSubtasks('tasks/tasks.json', '3');

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json');
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({
						id: 3,
						subtasks: []
					})
				])
			})
		);
		expect(generateTaskFiles.default).toHaveBeenCalled();
	});

	test('should clear subtasks from multiple tasks when given comma-separated IDs', () => {
		// Act
		clearSubtasks('tasks/tasks.json', '2,3');

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json');
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({
						id: 2,
						subtasks: []
					}),
					expect.objectContaining({
						id: 3,
						subtasks: []
					})
				])
			})
		);
		expect(generateTaskFiles.default).toHaveBeenCalled();
	});

	test('should handle tasks with no subtasks', () => {
		// Act
		clearSubtasks('tasks/tasks.json', '1');

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json');
		// Should not write the file if no changes were made
		expect(writeJSON).not.toHaveBeenCalled();
		expect(generateTaskFiles.default).not.toHaveBeenCalled();
	});

	test('should handle non-existent task IDs gracefully', () => {
		// Act
		clearSubtasks('tasks/tasks.json', '99');

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json');
		expect(log).toHaveBeenCalledWith('error', 'Task 99 not found');
		// Should not write the file if no changes were made
		expect(writeJSON).not.toHaveBeenCalled();
	});

	test('should handle multiple task IDs including both valid and non-existent IDs', () => {
		// Act
		clearSubtasks('tasks/tasks.json', '3,99');

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json');
		expect(log).toHaveBeenCalledWith('error', 'Task 99 not found');
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({
						id: 3,
						subtasks: []
					})
				])
			})
		);
		expect(generateTaskFiles.default).toHaveBeenCalled();
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
		writeJSON.mockImplementation(() => {
			throw new Error('File write failed');
		});

		// Act & Assert
		expect(() => {
			clearSubtasks('tasks/tasks.json', '3');
		}).toThrow('File write failed');
	});
});
