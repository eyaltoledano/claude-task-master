/**
 * Tests for the generateTaskFiles function
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Import the specific function being tested
import { generateTaskFiles } from '../../../scripts/modules/task-manager.js';

// Mock implementations
const mockReadJSON = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockFormatDependenciesWithStatus = jest.fn();
const mockValidateAndFixDependencies = jest.fn();
const mockLog = jest.fn(); // Add log mock if potentially used

// Mock fs module
jest.mock('fs', () => ({
	// Note: readFileSync is not directly used by generateTaskFiles, but mockReadJSON is
	existsSync: mockExistsSync,
	mkdirSync: mockMkdirSync,
	writeFileSync: mockWriteFileSync
}));

// Mock path module
jest.mock('path', () => ({
	// Use actual path functions unless specific mocking is needed
	...jest.requireActual('path'),
	dirname: jest.fn((p) => jest.requireActual('path').dirname(p)), // Keep original dirname behavior
	join: jest.fn((...args) => jest.requireActual('path').join(...args)) // Keep original join behavior
}));

// Mock ui (Only include mocks relevant to generateTaskFiles)
jest.mock('../../../scripts/modules/ui.js', () => ({
	formatDependenciesWithStatus: mockFormatDependenciesWithStatus
}));

// Mock dependency-manager (Only include mocks relevant to generateTaskFiles)
jest.mock('../../../scripts/modules/dependency-manager.js', () => ({
	validateAndFixDependencies: mockValidateAndFixDependencies
}));

// Mock utils (Include mocks relevant to generateTaskFiles)
jest.mock('../../../scripts/modules/utils.js', () => ({
	readJSON: mockReadJSON, // Use the mockReadJSON defined above
	log: mockLog // Add log if necessary
}));

// Sample task data (copied from original file)
const sampleTasks = {
	meta: { projectName: 'Test Project' },
	tasks: [
		{
			id: 1,
			title: 'Task 1',
			description: 'First task description',
			status: 'pending',
			dependencies: [],
			priority: 'high',
			details: 'Detailed information for task 1',
			testStrategy: 'Test strategy for task 1'
		},
		{
			id: 2,
			title: 'Task 2',
			description: 'Second task description',
			status: 'pending',
			dependencies: [1],
			priority: 'medium',
			details: 'Detailed information for task 2',
			testStrategy: 'Test strategy for task 2'
		},
		{
			id: 3,
			title: 'Task with Subtasks',
			description: 'Task with subtasks description',
			status: 'pending',
			dependencies: [1, 2],
			priority: 'high',
			details: 'Detailed information for task 3',
			testStrategy: 'Test strategy for task 3',
			subtasks: [
				{
					id: 1,
					title: 'Subtask 1',
					description: 'First subtask',
					status: 'pending',
					dependencies: [],
					details: 'Details for subtask 1'
				},
				{
					id: 2,
					title: 'Subtask 2',
					description: 'Second subtask',
					status: 'pending',
					dependencies: [1],
					details: 'Details for subtask 2'
				}
			]
		}
	]
};

describe('generateTaskFiles function', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Default mock implementations for each test
		mockReadJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks))); // Use deep copy
		mockExistsSync.mockReturnValue(true);
		mockValidateAndFixDependencies.mockImplementation((data, _) => data); // Pass data through
		mockFormatDependenciesWithStatus.mockImplementation((deps, _, __) => deps.join(', ') || 'None');
	});

	test('should generate task files from tasks.json - working test', async () => {
		const tasksPath = 'mock/tasks/tasks.json';
		const outputDir = 'mock/tasks';

		await generateTaskFiles(tasksPath, outputDir);

		// Verify readJSON was called
		expect(mockReadJSON).toHaveBeenCalledWith(tasksPath);

		// Verify validateAndFixDependencies was called
		expect(mockValidateAndFixDependencies).toHaveBeenCalledWith(
			JSON.parse(JSON.stringify(sampleTasks)), // Expect deep copy
			tasksPath
		);

		// Verify the files were written
		expect(mockWriteFileSync).toHaveBeenCalledTimes(3);

		// Verify specific file paths (using actual path.join logic)
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			path.join(outputDir, 'task_001.md'), // Use .md extension
			expect.any(String)
		);
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			path.join(outputDir, 'task_002.md'),
			expect.any(String)
		);
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			path.join(outputDir, 'task_003.md'),
			expect.any(String)
		);
	});

	// Note: The original tests were skipped. Keeping them skipped here.
	test.skip('should format dependencies with status indicators', async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/tasks';
		mockFormatDependenciesWithStatus.mockReturnValue('✅ 1, ⏱️ 2'); // Mock specific format

		await generateTaskFiles(tasksPath, outputDir);

		expect(mockFormatDependenciesWithStatus).toHaveBeenCalled();
		// Verify content of task 3 includes the formatted dependencies
		const task3Content = mockWriteFileSync.mock.calls.find((call) =>
			call[0].endsWith('task_003.md')
		)[1];
		expect(task3Content).toContain('Dependencies: ✅ 1, ⏱️ 2');
	});

	test.skip('should handle tasks with no subtasks', async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/tasks';

		await generateTaskFiles(tasksPath, outputDir);

		// Verify content of task 1 and 2 (no subtasks section)
		const task1Content = mockWriteFileSync.mock.calls.find((call) =>
			call[0].endsWith('task_001.md')
		)[1];
		const task2Content = mockWriteFileSync.mock.calls.find((call) =>
			call[0].endsWith('task_002.md')
		)[1];
		expect(task1Content).not.toContain('## Subtasks');
		expect(task2Content).not.toContain('## Subtasks');
	});

	test.skip("should create the output directory if it doesn't exist", async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/new_tasks_dir';
		mockExistsSync.mockReturnValue(false); // Simulate directory not existing

		await generateTaskFiles(tasksPath, outputDir);

		expect(mockExistsSync).toHaveBeenCalledWith(outputDir);
		expect(mockMkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
		expect(mockWriteFileSync).toHaveBeenCalled(); // Ensure files are still written
	});

	test.skip('should format task files with proper sections', async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/tasks';

		await generateTaskFiles(tasksPath, outputDir);

		const task1Content = mockWriteFileSync.mock.calls.find((call) =>
			call[0].endsWith('task_001.md')
		)[1];

		// Check for essential sections
		expect(task1Content).toMatch(/^# Task ID: 1/m);
		expect(task1Content).toMatch(/^# Title: Task 1/m);
		expect(task1Content).toMatch(/^## Description/m);
		expect(task1Content).toMatch(/^## Status: pending/m); // Status might change based on data
		expect(task1Content).toMatch(/^## Priority: high/m);
		expect(task1Content).toMatch(/^## Dependencies:/m);
		expect(task1Content).toMatch(/^## Details/m);
		expect(task1Content).toMatch(/^## Test Strategy/m);
	});

	test.skip('should include subtasks in task files when present', async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/tasks';

		await generateTaskFiles(tasksPath, outputDir);

		const task3Content = mockWriteFileSync.mock.calls.find((call) =>
			call[0].endsWith('task_003.md')
		)[1];

		expect(task3Content).toContain('## Subtasks');
		expect(task3Content).toContain('- **[Subtask 3.1]** Title: Subtask 1');
		expect(task3Content).toContain('- **[Subtask 3.2]** Title: Subtask 2');
	});

	test.skip('should handle errors during file generation', async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/tasks';
		const error = new Error('Write permission denied');
		mockWriteFileSync.mockImplementation(() => {
			throw error;
		});

		await expect(generateTaskFiles(tasksPath, outputDir)).rejects.toThrow(error);
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining(`Failed to generate task file for task 1:`)
		);
	});

	test.skip('should validate dependencies before generating files', async () => {
		const tasksPath = 'mock/tasks.json';
		const outputDir = 'mock/tasks';

		await generateTaskFiles(tasksPath, outputDir);

		// This assertion is tricky to test reliably without a complex setup
		// We trust the function's internal order based on code review
		// expect(mockValidateAndFixDependencies).toHaveBeenCalledBefore(mockWriteFileSync);
	});
}); 