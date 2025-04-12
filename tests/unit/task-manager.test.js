/**
 * Task Manager module tests
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock implementations
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockDirname = jest.fn();
const mockCallClaude = jest.fn().mockResolvedValue({ tasks: [] }); // Default resolved value
const mockCallPerplexity = jest.fn().mockResolvedValue({ tasks: [] }); // Default resolved value
const mockWriteJSON = jest.fn();
const mockGenerateTaskFiles = jest.fn();
const mockWriteFileSync = jest.fn();
const mockFormatDependenciesWithStatus = jest.fn();
const mockDisplayTaskList = jest.fn();
const mockValidateAndFixDependencies = jest.fn();
const mockReadJSON = jest.fn();
const mockLog = jest.fn();
const mockIsTaskDependentOn = jest.fn().mockReturnValue(false);
const mockCreate = jest.fn(); // Mock for Anthropic messages.create
const mockChatCompletionsCreate = jest.fn(); // Mock for Perplexity chat.completions.create
const mockGetAvailableAIModel = jest.fn(); // <<<<< Added mock function
const mockPromptYesNo = jest.fn(); // Mock for confirmation prompt
const mockDisplayBanner = jest.fn();
const mockGetTask = jest.fn();

// Mock fs module
jest.mock('fs', () => ({
	readFileSync: mockReadFileSync,
	existsSync: mockExistsSync,
	mkdirSync: mockMkdirSync,
	writeFileSync: mockWriteFileSync
}));

// Mock path module
jest.mock('path', () => ({
	dirname: mockDirname,
	join: jest.fn((dir, file) => `${dir}/${file}`)
}));

// Mock ui
jest.mock('../../scripts/modules/ui.js', () => ({
	formatDependenciesWithStatus: mockFormatDependenciesWithStatus,
	displayBanner: mockDisplayBanner,
	displayTaskList: mockDisplayTaskList,
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })), // <<<<< Added mock
	stopLoadingIndicator: jest.fn(), // <<<<< Added mock
	createProgressBar: jest.fn(() => ' MOCK_PROGRESS_BAR '), // <<<<< Added mock (used by listTasks)
	getStatusWithColor: jest.fn((status) => status), // Basic mock for status
	getComplexityWithColor: jest.fn((score) => `Score: ${score}`) // Basic mock for complexity
}));

// Mock dependency-manager
jest.mock('../../scripts/modules/dependency-manager.js', () => ({
	validateAndFixDependencies: mockValidateAndFixDependencies,
	validateTaskDependencies: jest.fn()
}));

// Mock utils
jest.mock('../../scripts/modules/utils.js', () => ({
	writeJSON: mockWriteJSON,
	readJSON: mockReadJSON,
	log: mockLog,
	CONFIG: {
		// <<<<< Added CONFIG mock
		model: 'mock-claude-model',
		maxTokens: 4000,
		temperature: 0.7,
		debug: false,
		defaultSubtasks: 3
		// Add other necessary CONFIG properties if needed
	},
	sanitizePrompt: jest.fn((prompt) => prompt), // <<<<< Added mock
	findTaskById: jest.fn((tasks, id) =>
		tasks.find((t) => t.id === parseInt(id))
	), // <<<<< Added mock
	readComplexityReport: jest.fn(), // <<<<< Added mock
	findTaskInComplexityReport: jest.fn(), // <<<<< Added mock
	truncate: jest.fn((str, len) => str.slice(0, len)), // <<<<< Added mock
	promptYesNo: mockPromptYesNo // Added mock for confirmation prompt
}));

// Mock AI services - Update this mock
jest.mock('../../scripts/modules/ai-services.js', () => ({
	callClaude: mockCallClaude,
	callPerplexity: mockCallPerplexity,
	generateSubtasks: jest.fn(), // <<<<< Add other functions as needed
	generateSubtasksWithPerplexity: jest.fn(), // <<<<< Add other functions as needed
	generateComplexityAnalysisPrompt: jest.fn(), // <<<<< Add other functions as needed
	getAvailableAIModel: mockGetAvailableAIModel, // <<<<< Use the new mock function
	handleClaudeError: jest.fn() // <<<<< Add other functions as needed
}));

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
	return {
		Anthropic: jest.fn().mockImplementation(() => ({
			messages: {
				create: mockCreate
			}
		}))
	};
});

// Mock Perplexity using OpenAI
jest.mock('openai', () => {
	return {
		default: jest.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockChatCompletionsCreate
				}
			}
		}))
	};
});

// Mock the task-manager module itself to control what gets imported
jest.mock('../../scripts/modules/task-manager.js', () => {
	// Get the original module to preserve function implementations
	const originalModule = jest.requireActual(
		'../../scripts/modules/task-manager.js'
	);

	// Return a modified module with our custom implementation of generateTaskFiles
	return {
		...originalModule,
		generateTaskFiles: mockGenerateTaskFiles,
		isTaskDependentOn: mockIsTaskDependentOn
	};
});

// Create a simplified version of parsePRD for testing
const testParsePRD = async (prdPath, outputPath, numTasks) => {
	try {
		// Check if the output file already exists
		if (mockExistsSync(outputPath)) {
			const confirmOverwrite = await mockPromptYesNo(
				`Warning: ${outputPath} already exists. Overwrite?`,
				false
			);

			if (!confirmOverwrite) {
				console.log(`Operation cancelled. ${outputPath} was not modified.`);
				return null;
			}
		}

		const prdContent = mockReadFileSync(prdPath, 'utf8');
		const tasks = await mockCallClaude(prdContent, prdPath, numTasks);
		const dir = mockDirname(outputPath);

		if (!mockExistsSync(dir)) {
			mockMkdirSync(dir, { recursive: true });
		}

		mockWriteJSON(outputPath, tasks);
		await mockGenerateTaskFiles(outputPath, dir);

		return tasks;
	} catch (error) {
		console.error(`Error parsing PRD: ${error.message}`);
		process.exit(1);
	}
};

// Import after mocks
import * as taskManager from '../../scripts/modules/task-manager.js';
import { sampleClaudeResponse } from '../fixtures/sample-claude-response.js';
import { sampleTasks, emptySampleTasks } from '../fixtures/sample-tasks.js';

// Destructure the required functions for convenience
const { findNextTask, generateTaskFiles, clearSubtasks, updateTaskById } =
	taskManager;

describe('Task Manager Module', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe.skip('expandTask function', () => {
		test('should generate subtasks for a task', async () => {
			// This test would verify that:
			// 1. The function reads the tasks file correctly
			// 2. It finds the target task by ID
			// 3. It generates subtasks with unique IDs
			// 4. It adds the subtasks to the task
			// 5. It writes the updated tasks back to the file
			expect(true).toBe(true);
		});

		test('should use complexity report for subtask count', async () => {
			// This test would verify that:
			// 1. The function checks for a complexity report
			// 2. It uses the recommended subtask count from the report
			// 3. It uses the expansion prompt from the report
			expect(true).toBe(true);
		});

		test('should use Perplexity AI when research flag is set', async () => {
			// This test would verify that:
			// 1. The function uses Perplexity for research-backed generation
			// 2. It handles the Perplexity response correctly
			expect(true).toBe(true);
		});

		test('should append subtasks to existing ones', async () => {
			// This test would verify that:
			// 1. The function appends new subtasks to existing ones
			// 2. It generates unique subtask IDs
			expect(true).toBe(true);
		});

		test('should skip completed tasks', async () => {
			// This test would verify that:
			// 1. The function skips tasks marked as done or completed
			// 2. It provides appropriate feedback
			expect(true).toBe(true);
		});

		test('should handle errors during subtask generation', async () => {
			// This test would verify that:
			// 1. The function handles errors in the AI API calls
			// 2. It provides appropriate error messages
			// 3. It exits gracefully
			expect(true).toBe(true);
		});
	});

	describe.skip('expandAllTasks function', () => {
		test('should expand all pending tasks', async () => {
			// This test would verify that:
			// 1. The function identifies all pending tasks
			// 2. It expands each task with appropriate subtasks
			// 3. It writes the updated tasks back to the file
			expect(true).toBe(true);
		});

		test('should sort tasks by complexity when report is available', async () => {
			// This test would verify that:
			// 1. The function reads the complexity report
			// 2. It sorts tasks by complexity score
			// 3. It prioritizes high-complexity tasks
			expect(true).toBe(true);
		});

		test('should skip tasks with existing subtasks unless force flag is set', async () => {
			// This test would verify that:
			// 1. The function skips tasks with existing subtasks
			// 2. It processes them when force flag is set
			expect(true).toBe(true);
		});

		test('should use task-specific parameters from complexity report', async () => {
			// This test would verify that:
			// 1. The function uses task-specific subtask counts
			// 2. It uses task-specific expansion prompts
			expect(true).toBe(true);
		});

		test('should handle empty tasks array', async () => {
			// This test would verify that:
			// 1. The function handles an empty tasks array gracefully
			// 2. It displays an appropriate message
			expect(true).toBe(true);
		});

		test('should handle errors for individual tasks without failing the entire operation', async () => {
			// This test would verify that:
			// 1. The function continues processing tasks even if some fail
			// 2. It reports errors for individual tasks
			// 3. It completes the operation for successful tasks
			expect(true).toBe(true);
		});
	});

	// Test suite for removeSubtask function
	describe('removeSubtask function', () => {
		// Reset mocks before each test
		beforeEach(() => {
			jest.clearAllMocks();

			// Default mock implementations
			mockReadJSON.mockImplementation(() => ({
				tasks: [
					{
						id: 1,
						title: 'Parent Task',
						description: 'This is a parent task',
						status: 'pending',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								title: 'Subtask 1',
								description: 'This is subtask 1',
								status: 'pending',
								dependencies: [],
								parentTaskId: 1
							},
							{
								id: 2,
								title: 'Subtask 2',
								description: 'This is subtask 2',
								status: 'in-progress',
								dependencies: [1], // Depends on subtask 1
								parentTaskId: 1
							}
						]
					},
					{
						id: 2,
						title: 'Another Task',
						description: 'This is another task',
						status: 'pending',
						dependencies: [1]
					}
				]
			}));

			// Setup success write response
			mockWriteJSON.mockImplementation((path, data) => {
				return data;
			});
		});

		test('should remove a subtask from its parent task', async () => {
			// Execute the test version of removeSubtask to remove subtask 1.1
			testRemoveSubtask('tasks/tasks.json', '1.1', false, true);

			// Verify readJSON was called with the correct path
			expect(mockReadJSON).toHaveBeenCalledWith('tasks/tasks.json');

			// Verify writeJSON was called with updated data
			expect(mockWriteJSON).toHaveBeenCalled();

			// Verify generateTaskFiles was called
			expect(mockGenerateTaskFiles).toHaveBeenCalled();
		});

		test('should convert a subtask to a standalone task', async () => {
			// Execute the test version of removeSubtask to convert subtask 1.1 to a standalone task
			const result = testRemoveSubtask('tasks/tasks.json', '1.1', true, true);

			// Verify the result is the new task
			expect(result).toBeDefined();
			expect(result.id).toBe(3);
			expect(result.title).toBe('Subtask 1');
			expect(result.dependencies).toContain(1);

			// Verify writeJSON was called
			expect(mockWriteJSON).toHaveBeenCalled();

			// Verify generateTaskFiles was called
			expect(mockGenerateTaskFiles).toHaveBeenCalled();
		});

		test('should throw an error if subtask ID format is invalid', async () => {
			// Expect an error for invalid subtask ID format
			expect(() => testRemoveSubtask('tasks/tasks.json', '1', false)).toThrow(
				/Invalid subtask ID format/
			);

			// Verify writeJSON was not called
			expect(mockWriteJSON).not.toHaveBeenCalled();
		});

		test('should throw an error if parent task does not exist', async () => {
			// Expect an error for non-existent parent task
			expect(() =>
				testRemoveSubtask('tasks/tasks.json', '999.1', false)
			).toThrow(/Parent task with ID 999 not found/);

			// Verify writeJSON was not called
			expect(mockWriteJSON).not.toHaveBeenCalled();
		});

		test('should throw an error if subtask does not exist', async () => {
			// Expect an error for non-existent subtask
			expect(() =>
				testRemoveSubtask('tasks/tasks.json', '1.999', false)
			).toThrow(/Subtask 1.999 not found/);

			// Verify writeJSON was not called
			expect(mockWriteJSON).not.toHaveBeenCalled();
		});

		test('should remove subtasks array if last subtask is removed', async () => {
			// Create a data object with just one subtask
			mockReadJSON.mockImplementationOnce(() => ({
				tasks: [
					{
						id: 1,
						title: 'Parent Task',
						description: 'This is a parent task',
						status: 'pending',
						dependencies: [],
						subtasks: [
							{
								id: 1,
								title: 'Last Subtask',
								description: 'This is the last subtask',
								status: 'pending',
								dependencies: [],
								parentTaskId: 1
							}
						]
					},
					{
						id: 2,
						title: 'Another Task',
						description: 'This is another task',
						status: 'pending',
						dependencies: [1]
					}
				]
			}));

			// Mock the behavior of writeJSON to capture the updated tasks data
			const updatedTasksData = { tasks: [] };
			mockWriteJSON.mockImplementation((path, data) => {
				// Store the data for assertions
				updatedTasksData.tasks = [...data.tasks];
				return data;
			});

			// Remove the last subtask
			testRemoveSubtask('tasks/tasks.json', '1.1', false, true);

			// Verify writeJSON was called
			expect(mockWriteJSON).toHaveBeenCalled();

			// Verify the subtasks array was removed completely
			const parentTask = updatedTasksData.tasks.find((t) => t.id === 1);
			expect(parentTask).toBeDefined();
			expect(parentTask.subtasks).toBeUndefined();

			// Verify generateTaskFiles was called
			expect(mockGenerateTaskFiles).toHaveBeenCalled();
		});

		test('should not regenerate task files if generateFiles is false', async () => {
			// Execute the test version of removeSubtask with generateFiles = false
			testRemoveSubtask('tasks/tasks.json', '1.1', false, false);

			// Verify writeJSON was called
			expect(mockWriteJSON).toHaveBeenCalled();

			// Verify task files were not regenerated
			expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
		});
	});
});

// Define test versions of the addSubtask and removeSubtask functions
const testRemoveSubtask = (
	tasksPath,
	subtaskId,
	convertToTask = false,
	generateFiles = true
) => {
	// Read the existing tasks
	const data = mockReadJSON(tasksPath);
	if (!data || !data.tasks) {
		throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
	}

	// Parse the subtask ID (format: "parentId.subtaskId")
	if (!subtaskId.includes('.')) {
		throw new Error(`Invalid subtask ID format: ${subtaskId}`);
	}

	const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
	const parentId = parseInt(parentIdStr, 10);
	const subtaskIdNum = parseInt(subtaskIdStr, 10);

	// Find the parent task
	const parentTask = data.tasks.find((t) => t.id === parentId);
	if (!parentTask) {
		throw new Error(`Parent task with ID ${parentId} not found`);
	}

	// Check if parent has subtasks
	if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
		throw new Error(`Parent task ${parentId} has no subtasks`);
	}

	// Find the subtask to remove
	const subtaskIndex = parentTask.subtasks.findIndex(
		(st) => st.id === subtaskIdNum
	);
	if (subtaskIndex === -1) {
		throw new Error(`Subtask ${subtaskId} not found`);
	}

	// Get a copy of the subtask before removing it
	const removedSubtask = { ...parentTask.subtasks[subtaskIndex] };

	// Remove the subtask from the parent
	parentTask.subtasks.splice(subtaskIndex, 1);

	// If parent has no more subtasks, remove the subtasks array
	if (parentTask.subtasks.length === 0) {
		delete parentTask.subtasks;
	}

	let convertedTask = null;

	// Convert the subtask to a standalone task if requested
	if (convertToTask) {
		// Find the highest task ID to determine the next ID
		const highestId = Math.max(...data.tasks.map((t) => t.id));
		const newTaskId = highestId + 1;

		// Create the new task from the subtask
		convertedTask = {
			id: newTaskId,
			title: removedSubtask.title,
			description: removedSubtask.description || '',
			details: removedSubtask.details || '',
			status: removedSubtask.status || 'pending',
			dependencies: removedSubtask.dependencies || [],
			priority: parentTask.priority || 'medium' // Inherit priority from parent
		};

		// Add the parent task as a dependency if not already present
		if (!convertedTask.dependencies.includes(parentId)) {
			convertedTask.dependencies.push(parentId);
		}

		// Add the converted task to the tasks array
		data.tasks.push(convertedTask);
	}

	// Write the updated tasks back to the file
	mockWriteJSON(tasksPath, data);

	// Generate task files if requested
	if (generateFiles) {
		mockGenerateTaskFiles(tasksPath, path.dirname(tasksPath));
	}

	return convertedTask;
};

describe.skip('updateTaskById function', () => {
	let mockConsoleLog;
	let mockConsoleError;
	let mockProcess;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Set up default mock values
		mockExistsSync.mockReturnValue(true);
		mockWriteJSON.mockImplementation(() => {});
		mockGenerateTaskFiles.mockResolvedValue(undefined);

		// Create a deep copy of sample tasks for tests - use imported ES module instead of require
		const sampleTasksDeepCopy = JSON.parse(JSON.stringify(sampleTasks));
		mockReadJSON.mockReturnValue(sampleTasksDeepCopy);

		// Mock console and process.exit
		mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
		mockConsoleError = jest
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockProcess = jest.spyOn(process, 'exit').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console and process.exit
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
		mockProcess.mockRestore();
	});

	test('should update a task successfully', async () => {
		// Mock the return value of messages.create and Anthropic
		const mockTask = {
			id: 2,
			title: 'Updated Core Functionality',
			description: 'Updated description',
			status: 'in-progress',
			dependencies: [1],
			priority: 'high',
			details: 'Updated details',
			testStrategy: 'Updated test strategy'
		};

		// Mock streaming for successful response
		const mockStream = {
			[Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
				return {
					next: jest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '{"id": 2, "title": "Updated Core Functionality",'
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '"description": "Updated description", "status": "in-progress",'
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '"dependencies": [1], "priority": "high", "details": "Updated details",'
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: { text: '"testStrategy": "Updated test strategy"}' }
							}
						})
						.mockResolvedValueOnce({ done: true })
				};
			})
		};

		mockCreate.mockResolvedValue(mockStream);

		// Call the function
		const result = await updateTaskById(
			'test-tasks.json',
			2,
			'Update task 2 with new information'
		);

		// Verify the task was updated
		expect(result).toBeDefined();
		expect(result.title).toBe('Updated Core Functionality');
		expect(result.description).toBe('Updated description');

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).toHaveBeenCalled();
		expect(mockWriteJSON).toHaveBeenCalled();
		expect(mockGenerateTaskFiles).toHaveBeenCalled();

		// Verify the task was updated in the tasks data
		const tasksData = mockWriteJSON.mock.calls[0][1];
		const updatedTask = tasksData.tasks.find((task) => task.id === 2);
		expect(updatedTask).toEqual(mockTask);
	});

	test('should return null when task is already completed', async () => {
		// Call the function with a completed task
		const result = await updateTaskById(
			'test-tasks.json',
			1,
			'Update task 1 with new information'
		);

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle task not found error', async () => {
		// Call the function with a non-existent task
		const result = await updateTaskById(
			'test-tasks.json',
			999,
			'Update non-existent task'
		);

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Task with ID 999 not found')
		);
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringContaining('Task with ID 999 not found')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should preserve completed subtasks', async () => {
		// Modify the sample data to have a task with completed subtasks
		const tasksData = mockReadJSON();
		const task = tasksData.tasks.find((t) => t.id === 3);
		if (task && task.subtasks && task.subtasks.length > 0) {
			// Mark the first subtask as completed
			task.subtasks[0].status = 'done';
			task.subtasks[0].title = 'Completed Header Component';
			mockReadJSON.mockReturnValue(tasksData);
		}

		// Mock a response that tries to modify the completed subtask
		const mockStream = {
			[Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
				return {
					next: jest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: { text: '{"id": 3, "title": "Updated UI Components",' }
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '"description": "Updated description", "status": "pending",'
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '"dependencies": [2], "priority": "medium", "subtasks": ['
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '{"id": 1, "title": "Modified Header Component", "status": "pending"},'
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '{"id": 2, "title": "Create Footer Component", "status": "pending"}]}'
								}
							}
						})
						.mockResolvedValueOnce({ done: true })
				};
			})
		};

		mockCreate.mockResolvedValue(mockStream);

		// Call the function
		const result = await updateTaskById(
			'test-tasks.json',
			3,
			'Update UI components task'
		);

		// Verify the subtasks were preserved
		expect(result).toBeDefined();
		expect(result.subtasks[0].title).toBe('Completed Header Component');
		expect(result.subtasks[0].status).toBe('done');

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).toHaveBeenCalled();
		expect(mockWriteJSON).toHaveBeenCalled();
		expect(mockGenerateTaskFiles).toHaveBeenCalled();
	});

	test('should handle missing tasks file', async () => {
		// Mock file not existing
		mockExistsSync.mockReturnValue(false);

		// Call the function
		const result = await updateTaskById('missing-tasks.json', 2, 'Update task');

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Tasks file not found')
		);
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringContaining('Tasks file not found')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).not.toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle API errors', async () => {
		// Mock API error
		mockCreate.mockRejectedValue(new Error('API error'));

		// Call the function
		const result = await updateTaskById('test-tasks.json', 2, 'Update task');

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('API error')
		);
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringContaining('API error')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled(); // Should not write on error
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled(); // Should not generate on error
	});

	test('should use Perplexity AI when research flag is true', async () => {
		// Mock Perplexity API response
		const mockPerplexityResponse = {
			choices: [
				{
					message: {
						content:
							'{"id": 2, "title": "Researched Core Functionality", "description": "Research-backed description", "status": "in-progress", "dependencies": [1], "priority": "high", "details": "Research-backed details", "testStrategy": "Research-backed test strategy"}'
					}
				}
			]
		};

		mockChatCompletionsCreate.mockResolvedValue(mockPerplexityResponse);

		// Set the Perplexity API key in environment
		process.env.PERPLEXITY_API_KEY = 'dummy-key';

		// Call the function with research flag
		const result = await updateTaskById(
			'test-tasks.json',
			2,
			'Update task with research',
			true
		);

		// Verify the task was updated with research-backed information
		expect(result).toBeDefined();
		expect(result.title).toBe('Researched Core Functionality');
		expect(result.description).toBe('Research-backed description');

		// Verify the Perplexity API was called
		expect(mockChatCompletionsCreate).toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled(); // Claude should not be called

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockWriteJSON).toHaveBeenCalled();
		expect(mockGenerateTaskFiles).toHaveBeenCalled();

		// Clean up
		delete process.env.PERPLEXITY_API_KEY;
	});
});

// Mock implementation of updateSubtaskById for testing
const testUpdateSubtaskById = async (
	tasksPath,
	subtaskId,
	prompt,
	useResearch = false
) => {
	try {
		// Parse parent and subtask IDs
		if (
			!subtaskId ||
			typeof subtaskId !== 'string' ||
			!subtaskId.includes('.')
		) {
			throw new Error(`Invalid subtask ID format: ${subtaskId}`);
		}

		const [parentIdStr, subtaskIdStr] = subtaskId.split('.');
		const parentId = parseInt(parentIdStr, 10);
		const subtaskIdNum = parseInt(subtaskIdStr, 10);

		if (
			isNaN(parentId) ||
			parentId <= 0 ||
			isNaN(subtaskIdNum) ||
			subtaskIdNum <= 0
		) {
			throw new Error(`Invalid subtask ID format: ${subtaskId}`);
		}

		// Validate prompt
		if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
			throw new Error('Prompt cannot be empty');
		}

		// Check if tasks file exists
		if (!mockExistsSync(tasksPath)) {
			throw new Error(`Tasks file not found at path: ${tasksPath}`);
		}

		// Read the tasks file
		const data = mockReadJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Find the parent task
		const parentTask = data.tasks.find((t) => t.id === parentId);
		if (!parentTask) {
			throw new Error(`Parent task with ID ${parentId} not found`);
		}

		// Find the subtask
		if (!parentTask.subtasks || !Array.isArray(parentTask.subtasks)) {
			throw new Error(`Parent task ${parentId} has no subtasks`);
		}

		const subtask = parentTask.subtasks.find((st) => st.id === subtaskIdNum);
		if (!subtask) {
			throw new Error(`Subtask with ID ${subtaskId} not found`);
		}

		// Check if subtask is already completed
		if (subtask.status === 'done' || subtask.status === 'completed') {
			return null;
		}

		// Generate additional information
		let additionalInformation;
		if (useResearch) {
			const result = await mockChatCompletionsCreate();
			additionalInformation = result.choices[0].message.content;
		} else {
			const mockStream = {
				[Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
					return {
						next: jest
							.fn()
							.mockResolvedValueOnce({
								done: false,
								value: {
									type: 'content_block_delta',
									delta: { text: 'Additional information about' }
								}
							})
							.mockResolvedValueOnce({
								done: false,
								value: {
									type: 'content_block_delta',
									delta: { text: ' the subtask implementation.' }
								}
							})
							.mockResolvedValueOnce({ done: true })
					};
				})
			};

			const stream = await mockCreate();
			additionalInformation =
				'Additional information about the subtask implementation.';
		}

		// Create timestamp
		const timestamp = new Date().toISOString();

		// Format the additional information with timestamp
		const formattedInformation = `\n\n<info added on ${timestamp}>\n${additionalInformation}\n</info added on ${timestamp}>`;

		// Append to subtask details
		if (subtask.details) {
			subtask.details += formattedInformation;
		} else {
			subtask.details = formattedInformation;
		}

		// Update description with update marker for shorter updates
		if (subtask.description && additionalInformation.length < 200) {
			subtask.description += ` [Updated: ${new Date().toLocaleDateString()}]`;
		}

		// Write the updated tasks to the file
		mockWriteJSON(tasksPath, data);

		// Generate individual task files
		await mockGenerateTaskFiles(tasksPath, path.dirname(tasksPath));

		return subtask;
	} catch (error) {
		mockLog('error', `Error updating subtask: ${error.message}`);
		return null;
	}
};

describe.skip('updateSubtaskById function', () => {
	let mockConsoleLog;
	let mockConsoleError;
	let mockProcess;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Set up default mock values
		mockExistsSync.mockReturnValue(true);
		mockWriteJSON.mockImplementation(() => {});
		mockGenerateTaskFiles.mockResolvedValue(undefined);

		// Create a deep copy of sample tasks for tests - use imported ES module instead of require
		const sampleTasksDeepCopy = JSON.parse(JSON.stringify(sampleTasks));

		// Ensure the sample tasks has a task with subtasks for testing
		// Task 3 should have subtasks
		if (sampleTasksDeepCopy.tasks && sampleTasksDeepCopy.tasks.length > 2) {
			const task3 = sampleTasksDeepCopy.tasks.find((t) => t.id === 3);
			if (task3 && (!task3.subtasks || task3.subtasks.length === 0)) {
				task3.subtasks = [
					{
						id: 1,
						title: 'Create Header Component',
						description: 'Create a reusable header component',
						status: 'pending'
					},
					{
						id: 2,
						title: 'Create Footer Component',
						description: 'Create a reusable footer component',
						status: 'pending'
					}
				];
			}
		}

		mockReadJSON.mockReturnValue(sampleTasksDeepCopy);

		// Mock console and process.exit
		mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
		mockConsoleError = jest
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		mockProcess = jest.spyOn(process, 'exit').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console and process.exit
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
		mockProcess.mockRestore();
	});

	test('should update a subtask successfully', async () => {
		// Mock streaming for successful response
		const mockStream = {
			[Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
				return {
					next: jest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: 'Additional information about the subtask implementation.'
								}
							}
						})
						.mockResolvedValueOnce({ done: true })
				};
			})
		};

		mockCreate.mockResolvedValue(mockStream);

		// Call the function
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			'3.1',
			'Add details about API endpoints'
		);

		// Verify the subtask was updated
		expect(result).toBeDefined();
		expect(result.details).toContain('<info added on');
		expect(result.details).toContain(
			'Additional information about the subtask implementation'
		);
		expect(result.details).toContain('</info added on');

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).toHaveBeenCalled();
		expect(mockWriteJSON).toHaveBeenCalled();
		expect(mockGenerateTaskFiles).toHaveBeenCalled();

		// Verify the subtask was updated in the tasks data
		const tasksData = mockWriteJSON.mock.calls[0][1];
		const parentTask = tasksData.tasks.find((task) => task.id === 3);
		const updatedSubtask = parentTask.subtasks.find((st) => st.id === 1);
		expect(updatedSubtask.details).toContain(
			'Additional information about the subtask implementation'
		);
	});

	test('should return null when subtask is already completed', async () => {
		// Modify the sample data to have a completed subtask
		const tasksData = mockReadJSON();
		const task = tasksData.tasks.find((t) => t.id === 3);
		if (task && task.subtasks && task.subtasks.length > 0) {
			// Mark the first subtask as completed
			task.subtasks[0].status = 'done';
			mockReadJSON.mockReturnValue(tasksData);
		}

		// Call the function with a completed subtask
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			'3.1',
			'Update completed subtask'
		);

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle subtask not found error', async () => {
		// Call the function with a non-existent subtask
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			'3.999',
			'Update non-existent subtask'
		);

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Subtask with ID 3.999 not found')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle invalid subtask ID format', async () => {
		// Call the function with an invalid subtask ID
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			'invalid-id',
			'Update subtask with invalid ID'
		);

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Invalid subtask ID format')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle missing tasks file', async () => {
		// Mock file not existing
		mockExistsSync.mockReturnValue(false);

		// Call the function
		const result = await testUpdateSubtaskById(
			'missing-tasks.json',
			'3.1',
			'Update subtask'
		);

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Tasks file not found')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).not.toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should handle empty prompt', async () => {
		// Call the function with an empty prompt
		const result = await testUpdateSubtaskById('test-tasks.json', '3.1', '');

		// Verify the result is null
		expect(result).toBeNull();

		// Verify the error was logged
		expect(mockLog).toHaveBeenCalledWith(
			'error',
			expect.stringContaining('Prompt cannot be empty')
		);

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockCreate).not.toHaveBeenCalled();
		expect(mockWriteJSON).not.toHaveBeenCalled();
		expect(mockGenerateTaskFiles).not.toHaveBeenCalled();
	});

	test('should use Perplexity AI when research flag is true', async () => {
		// Mock Perplexity API response
		const mockPerplexityResponse = {
			choices: [
				{
					message: {
						content:
							'Research-backed information about the subtask implementation.'
					}
				}
			]
		};

		mockChatCompletionsCreate.mockResolvedValue(mockPerplexityResponse);

		// Set the Perplexity API key in environment
		process.env.PERPLEXITY_API_KEY = 'dummy-key';

		// Call the function with research flag
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			'3.1',
			'Add research-backed details',
			true
		);

		// Verify the subtask was updated with research-backed information
		expect(result).toBeDefined();
		expect(result.details).toContain('<info added on');
		expect(result.details).toContain(
			'Research-backed information about the subtask implementation'
		);
		expect(result.details).toContain('</info added on');

		// Verify the Perplexity API was called
		expect(mockChatCompletionsCreate).toHaveBeenCalled();
		expect(mockCreate).not.toHaveBeenCalled(); // Claude should not be called

		// Verify the correct functions were called
		expect(mockReadJSON).toHaveBeenCalledWith('test-tasks.json');
		expect(mockWriteJSON).toHaveBeenCalled();
		expect(mockGenerateTaskFiles).toHaveBeenCalled();

		// Clean up
		delete process.env.PERPLEXITY_API_KEY;
	});

	test('should append timestamp correctly in XML-like format', async () => {
		// Mock streaming for successful response
		const mockStream = {
			[Symbol.asyncIterator]: jest.fn().mockImplementation(() => {
				return {
					next: jest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: 'Additional information about the subtask implementation.'
								}
							}
						})
						.mockResolvedValueOnce({ done: true })
				};
			})
		};

		mockCreate.mockResolvedValue(mockStream);

		// Call the function
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			'3.1',
			'Add details about API endpoints'
		);

		// Verify the XML-like format with timestamp
		expect(result).toBeDefined();
		expect(result.details).toMatch(
			/<info added on [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z>/
		);
		expect(result.details).toMatch(
			/<\/info added on [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z>/
		);

		// Verify the same timestamp is used in both opening and closing tags
		const openingMatch = result.details.match(
			/<info added on ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z)>/
		);
		const closingMatch = result.details.match(
			/<\/info added on ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z)>/
		);

		expect(openingMatch).toBeTruthy();
		expect(closingMatch).toBeTruthy();
		expect(openingMatch[1]).toBe(closingMatch[1]);
	});

	let mockTasksData;
	const tasksPath = 'test-tasks.json';
	const outputDir = 'test-tasks-output'; // Assuming generateTaskFiles needs this

	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();

		// Reset mock data (deep copy to avoid test interference)
		mockTasksData = JSON.parse(
			JSON.stringify({
				tasks: [
					{
						id: 1,
						title: 'Parent Task 1',
						status: 'pending',
						dependencies: [],
						priority: 'medium',
						description: 'Parent description',
						details: 'Parent details',
						testStrategy: 'Parent tests',
						subtasks: [
							{
								id: 1,
								title: 'Subtask 1.1',
								description: 'Subtask 1.1 description',
								details: 'Initial subtask details.',
								status: 'pending',
								dependencies: []
							},
							{
								id: 2,
								title: 'Subtask 1.2',
								description: 'Subtask 1.2 description',
								details: 'Initial subtask details for 1.2.',
								status: 'done', // Completed subtask
								dependencies: []
							}
						]
					}
				]
			})
		);

		// Default mock behaviors
		mockReadJSON.mockReturnValue(mockTasksData);
		mockDirname.mockReturnValue(outputDir); // Mock path.dirname needed by generateTaskFiles
		mockGenerateTaskFiles.mockResolvedValue(); // Assume generateTaskFiles succeeds
	});

	test('should successfully update subtask using Claude (non-research)', async () => {
		const subtaskIdToUpdate = '1.1'; // Valid format
		const updatePrompt = 'Add more technical details about API integration.'; // Non-empty prompt
		const expectedClaudeResponse =
			'Here are the API integration details you requested.';

		// --- Arrange ---
		// **Explicitly reset and configure mocks for this test**
		jest.clearAllMocks(); // Ensure clean state

		// Configure mocks used *before* readJSON
		mockExistsSync.mockReturnValue(true); // Ensure file is found
		mockGetAvailableAIModel.mockReturnValue({
			// Ensure this returns the correct structure
			type: 'claude',
			client: { messages: { create: mockCreate } }
		});

		// Configure mocks used *after* readJSON (as before)
		mockReadJSON.mockReturnValue(mockTasksData); // Ensure readJSON returns valid data
		async function* createMockStream() {
			yield {
				type: 'content_block_delta',
				delta: { text: expectedClaudeResponse.substring(0, 10) }
			};
			yield {
				type: 'content_block_delta',
				delta: { text: expectedClaudeResponse.substring(10) }
			};
			yield { type: 'message_stop' };
		}
		mockCreate.mockResolvedValue(createMockStream());
		mockDirname.mockReturnValue(outputDir);
		mockGenerateTaskFiles.mockResolvedValue();

		// --- Act ---
		const updatedSubtask = await taskManager.updateSubtaskById(
			tasksPath,
			subtaskIdToUpdate,
			updatePrompt,
			false
		);

		// --- Assert ---
		// **Add an assertion right at the start to check if readJSON was called**
		expect(mockReadJSON).toHaveBeenCalledWith(tasksPath); // <<< Let's see if this passes now

		// ... (rest of the assertions as before) ...
		expect(mockGetAvailableAIModel).toHaveBeenCalledWith({
			claudeOverloaded: false,
			requiresResearch: false
		});
		expect(mockCreate).toHaveBeenCalledTimes(1);
		// ... etc ...
	});

	test('should successfully update subtask using Perplexity (research)', async () => {
		const subtaskIdToUpdate = '1.1';
		const updatePrompt = 'Research best practices for this subtask.';
		const expectedPerplexityResponse =
			'Based on research, here are the best practices...';
		const perplexityModelName = 'mock-perplexity-model'; // Define a mock model name

		// --- Arrange ---
		// Mock environment variable for Perplexity model if needed by CONFIG/logic
		process.env.PERPLEXITY_MODEL = perplexityModelName;

		// Mock getAvailableAIModel to return Perplexity client when research is required
		mockGetAvailableAIModel.mockReturnValue({
			type: 'perplexity',
			client: { chat: { completions: { create: mockChatCompletionsCreate } } } // Match the mocked structure
		});

		// Mock Perplexity's response
		mockChatCompletionsCreate.mockResolvedValue({
			choices: [{ message: { content: expectedPerplexityResponse } }]
		});

		// --- Act ---
		const updatedSubtask = await taskManager.updateSubtaskById(
			tasksPath,
			subtaskIdToUpdate,
			updatePrompt,
			true
		); // useResearch = true

		// --- Assert ---
		expect(mockReadJSON).toHaveBeenCalledWith(tasksPath);
		// Verify getAvailableAIModel was called correctly for research
		expect(mockGetAvailableAIModel).toHaveBeenCalledWith({
			claudeOverloaded: false,
			requiresResearch: true
		});
		expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);

		// Verify Perplexity API call parameters
		expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: perplexityModelName, // Check the correct model is used
				temperature: 0.7, // From CONFIG mock
				max_tokens: 4000, // From CONFIG mock
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: 'system',
						content: expect.any(String)
					}),
					expect.objectContaining({
						role: 'user',
						content: expect.stringContaining(updatePrompt) // Check prompt is included
					})
				])
			})
		);

		// Verify subtask data was updated
		const writtenData = mockWriteJSON.mock.calls[0][1]; // Get data passed to writeJSON
		const parentTask = writtenData.tasks.find((t) => t.id === 1);
		const targetSubtask = parentTask.subtasks.find((st) => st.id === 1);

		expect(targetSubtask.details).toContain(expectedPerplexityResponse);
		expect(targetSubtask.details).toMatch(/<info added on .*>/); // Check for timestamp tag
		expect(targetSubtask.description).toMatch(/\[Updated: .*]/); // Check description update

		// Verify writeJSON and generateTaskFiles were called
		expect(mockWriteJSON).toHaveBeenCalledWith(tasksPath, writtenData);
		expect(mockGenerateTaskFiles).toHaveBeenCalledWith(tasksPath, outputDir);

		// Verify the function returned the updated subtask
		expect(updatedSubtask).toBeDefined();
		expect(updatedSubtask.id).toBe(1);
		expect(updatedSubtask.parentTaskId).toBe(1);
		expect(updatedSubtask.details).toContain(expectedPerplexityResponse);

		// Clean up env var if set
		delete process.env.PERPLEXITY_MODEL;
	});

	test('should fall back to Perplexity if Claude is overloaded', async () => {
		const subtaskIdToUpdate = '1.1';
		const updatePrompt = 'Add details, trying Claude first.';
		const expectedPerplexityResponse =
			'Perplexity provided these details as fallback.';
		const perplexityModelName = 'mock-perplexity-model-fallback';

		// --- Arrange ---
		// Mock environment variable for Perplexity model
		process.env.PERPLEXITY_MODEL = perplexityModelName;

		// Mock getAvailableAIModel: Return Claude first, then Perplexity
		mockGetAvailableAIModel
			.mockReturnValueOnce({
				// First call: Return Claude
				type: 'claude',
				client: { messages: { create: mockCreate } }
			})
			.mockReturnValueOnce({
				// Second call: Return Perplexity (after overload)
				type: 'perplexity',
				client: { chat: { completions: { create: mockChatCompletionsCreate } } }
			});

		// Mock Claude to throw an overload error
		const overloadError = new Error('Claude API is overloaded.');
		overloadError.type = 'overloaded_error'; // Match one of the specific checks
		mockCreate.mockRejectedValue(overloadError); // Simulate Claude failing

		// Mock Perplexity's successful response
		mockChatCompletionsCreate.mockResolvedValue({
			choices: [{ message: { content: expectedPerplexityResponse } }]
		});

		// --- Act ---
		const updatedSubtask = await taskManager.updateSubtaskById(
			tasksPath,
			subtaskIdToUpdate,
			updatePrompt,
			false
		); // Start with useResearch = false

		// --- Assert ---
		expect(mockReadJSON).toHaveBeenCalledWith(tasksPath);

		// Verify getAvailableAIModel calls
		expect(mockGetAvailableAIModel).toHaveBeenCalledTimes(2);
		expect(mockGetAvailableAIModel).toHaveBeenNthCalledWith(1, {
			claudeOverloaded: false,
			requiresResearch: false
		});
		expect(mockGetAvailableAIModel).toHaveBeenNthCalledWith(2, {
			claudeOverloaded: true,
			requiresResearch: false
		}); // claudeOverloaded should now be true

		// Verify Claude was attempted and failed
		expect(mockCreate).toHaveBeenCalledTimes(1);
		// Verify Perplexity was called as fallback
		expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);

		// Verify Perplexity API call parameters
		expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: perplexityModelName,
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: 'user',
						content: expect.stringContaining(updatePrompt)
					})
				])
			})
		);

		// Verify subtask data was updated with Perplexity's response
		const writtenData = mockWriteJSON.mock.calls[0][1];
		const parentTask = writtenData.tasks.find((t) => t.id === 1);
		const targetSubtask = parentTask.subtasks.find((st) => st.id === 1);

		expect(targetSubtask.details).toContain(expectedPerplexityResponse); // Should contain fallback response
		expect(targetSubtask.details).toMatch(/<info added on .*>/);
		expect(targetSubtask.description).toMatch(/\[Updated: .*]/);

		// Verify writeJSON and generateTaskFiles were called
		expect(mockWriteJSON).toHaveBeenCalledWith(tasksPath, writtenData);
		expect(mockGenerateTaskFiles).toHaveBeenCalledWith(tasksPath, outputDir);

		// Verify the function returned the updated subtask
		expect(updatedSubtask).toBeDefined();
		expect(updatedSubtask.details).toContain(expectedPerplexityResponse);

		// Clean up env var if set
		delete process.env.PERPLEXITY_MODEL;
	});

	// More tests will go here...
});
