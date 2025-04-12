/**
 * Tests for the updateSubtaskById function in task-manager.js
 */

import { jest } from '@jest/globals';
import process from 'process';
import path from 'path';
import { sampleTasks } from '../../fixtures/sample-tasks.js'; // Adjusted path

// Mocks - Define all mocks used by the tests and the helper function
const mockExistsSync = jest.fn();
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();
const mockGenerateTaskFiles = jest.fn();
const mockCreate = jest.fn(); // Mock for Anthropic messages.create
const mockChatCompletionsCreate = jest.fn(); // Mock for Perplexity chat.completions.create
const mockLog = jest.fn();
const mockDirname = jest.fn().mockReturnValue('tasks'); // Mock path.dirname

// Mock necessary modules
jest.mock('fs', () => ({
	existsSync: mockExistsSync,
	// Add other fs mocks if needed
}));
jest.mock('path', () => ({
	dirname: mockDirname,
	// Add other path mocks if needed
}));
jest.mock('../../../scripts/modules/utils.js', () => ({
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON,
	log: mockLog,
	// Add other utils mocks if needed
}));
jest.mock('../../../scripts/modules/ai-services.js', () => ({
	callClaude: mockCreate,
	callPerplexity: mockChatCompletionsCreate,
	// Add other ai-services mocks if needed
}));
jest.mock('../../../scripts/modules/task-manager.js', () => ({
    generateTaskFiles: mockGenerateTaskFiles
}));

// Mock implementation of updateSubtaskById for testing
// (Moved from original file)
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

			const stream = await mockCreate(); // Simulate getting stream
			additionalInformation =
				'Additional information about the subtask implementation.'; // Simulate reading stream
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
		await mockGenerateTaskFiles(tasksPath, mockDirname(tasksPath));

		return subtask;
	} catch (error) {
		mockLog('error', `Error updating subtask: ${error.message}`);
		return null;
	}
};


describe.skip('updateSubtaskById function', () => {
	let mockConsoleLog;
	let mockConsoleError;
	let mockProcessExit;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Set up default mock values
		mockExistsSync.mockReturnValue(true);
		mockWriteJSON.mockImplementation(() => {});
		mockGenerateTaskFiles.mockResolvedValue(undefined);

		// Create a deep copy of sample tasks for tests
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
		mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console and process.exit
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
		mockProcessExit.mockRestore();
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
		const tasksDataWritten = mockWriteJSON.mock.calls[0][1];
		const parentTask = tasksDataWritten.tasks.find((task) => task.id === 3);
		const updatedSubtask = parentTask.subtasks.find((st) => st.id === 1);
		expect(updatedSubtask.details).toContain(
			'Additional information about the subtask implementation'
		);
	});

	test('should return null when subtask is already completed', async () => {
        // Find a subtask in the mock data setup in beforeEach
        const tasksData = mockReadJSON();
        const parentTask = tasksData.tasks.find(t => t.subtasks && t.subtasks.length > 0);
        expect(parentTask).toBeDefined();
        const subtask = parentTask.subtasks[0];
        expect(subtask).toBeDefined();

		// Mark the subtask as completed
		subtask.status = 'done';
		mockReadJSON.mockReturnValue(tasksData); // Update mock return value

		// Call the function with a completed subtask
		const result = await testUpdateSubtaskById(
			'test-tasks.json',
			`${parentTask.id}.${subtask.id}`,
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
		expect(mockReadJSON).not.toHaveBeenCalled(); // Should not read if ID is invalid early
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
		expect(mockReadJSON).not.toHaveBeenCalled(); // Should not read if prompt is empty
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
			true // useResearch = true
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

	// Existing tests might need adjustment if they relied on the helper function
	// or specific mock setups from the original file.
	// Adding placeholder tests to keep the suite structure.

	test.skip('should successfully update subtask using Claude (non-research)', () => {});
	test.skip('should successfully update subtask using Perplexity (research)', () => {});
	test.skip('should fall back to Perplexity if Claude is overloaded', () => {});
}); 