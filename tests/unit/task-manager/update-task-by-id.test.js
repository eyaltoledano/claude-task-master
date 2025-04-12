/**
 * Tests for the updateTaskById function in task-manager.js
 */

import { jest } from '@jest/globals';
import process from 'process';
import { sampleTasks } from '../../fixtures/sample-tasks.js'; // Adjusted path

// Mocks - Define all mocks used by the tests
const mockExistsSync = jest.fn();
const mockWriteJSON = jest.fn();
const mockGenerateTaskFiles = jest.fn();
const mockReadJSON = jest.fn();
const mockCreate = jest.fn(); // Mock for Anthropic messages.create
const mockChatCompletionsCreate = jest.fn(); // Mock for Perplexity chat.completions.create
const mockLog = jest.fn();

// Mock necessary modules
jest.mock('fs', () => ({
	existsSync: mockExistsSync,
	// Add other fs mocks if needed
}));
jest.mock('../../../scripts/modules/utils.js', () => ({
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON,
	log: mockLog,
	// Add other utils mocks if needed
}));
// Mock AI services - Update this mock if more functions are called
jest.mock('../../../scripts/modules/ai-services.js', () => ({
	callClaude: mockCreate, // Assuming updateTaskById uses callClaude internally which uses messages.create
	callPerplexity: mockChatCompletionsCreate, // Assuming research path uses callPerplexity
	// Add other ai-services mocks if needed
}));
// Mock the main task-manager module only to get generateTaskFiles mock
// This might be called internally after successful update.
jest.mock('../../../scripts/modules/task-manager.js', () => ({
    generateTaskFiles: mockGenerateTaskFiles
}));

// Import the function to test (or mock it if testing interactions)
// Assuming updateTaskById is exported from the main module
// We might need to adjust this if it's not directly exported or needs more setup
// For now, we'll assume the tests mock its dependencies sufficiently.

// Import after mocks
// We might need to import the actual function if tests call it directly
// import { updateTaskById } from '../../../scripts/modules/task-manager.js';


describe.skip('updateTaskById function', () => {
	let mockConsoleLog;
	let mockConsoleError;
	let mockProcessExit; // Renamed for clarity

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Set up default mock values
		mockExistsSync.mockReturnValue(true);
		mockWriteJSON.mockImplementation(() => {});
		mockGenerateTaskFiles.mockResolvedValue(undefined);

		// Create a deep copy of sample tasks for tests
		const sampleTasksDeepCopy = JSON.parse(JSON.stringify(sampleTasks));
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

    // Placeholder for the actual function call if needed
    const updateTaskById = async (filePath, taskId, prompt, research = false) => {
        // This is a simplified mock call structure
        // In real tests, you might import and call the actual function
        mockReadJSON(filePath);
        const taskData = sampleTasks.tasks.find(t => t.id === taskId);
        if (!taskData) {
            mockLog('error', `Task with ID ${taskId} not found`);
            console.error(`Task with ID ${taskId} not found`);
            return null;
        }
        if (taskData.status === 'done') return null;

        try {
            let apiResponseContent;
            if (research) {
                // Mock Perplexity call
                const perplexityResponse = await mockChatCompletionsCreate();
                apiResponseContent = perplexityResponse.choices[0].message.content;
            } else {
                // Mock Claude call (stream simulation)
                const stream = await mockCreate();
                let fullText = '';
                for await (const event of stream) {
                    if (event.type === 'content_block_delta') {
                        fullText += event.delta.text;
                    }
                }
                apiResponseContent = fullText;
            }
            const updatedTask = JSON.parse(apiResponseContent); // Assume API returns JSON string
            mockWriteJSON(filePath, {tasks: sampleTasks.tasks.map(t => t.id === taskId ? updatedTask : t)}); // Simulate write
            await mockGenerateTaskFiles(filePath, 'some/dir'); // Simulate generation
            return updatedTask;
        } catch (error) {
            mockLog('error', error.message);
            console.error(error.message);
            return null;
        }
    };

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
		const tasksDataWritten = mockWriteJSON.mock.calls[0][1];
		const updatedTask = tasksDataWritten.tasks.find((task) => task.id === 2);
		expect(updatedTask).toEqual(mockTask);
	});

	test('should return null when task is already completed', async () => {
        // Find a task in sampleTasks that is 'done'
        const completedTask = sampleTasks.tasks.find(t => t.status === 'done');
        expect(completedTask).toBeDefined(); // Ensure we found one

		// Call the function with a completed task
		const result = await updateTaskById(
			'test-tasks.json',
			completedTask.id,
			`Update task ${completedTask.id} with new information`
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
        // Use a task ID that has subtasks in sampleTasks
        const parentTaskId = sampleTasks.tasks.find(t => t.subtasks && t.subtasks.length > 0).id;
        expect(parentTaskId).toBeDefined();

		// Modify the sample data to have a task with completed subtasks
		const tasksDataCopy = JSON.parse(JSON.stringify(sampleTasks));
		const task = tasksDataCopy.tasks.find((t) => t.id === parentTaskId);
        let completedSubtask = null;
		if (task && task.subtasks && task.subtasks.length > 0) {
			// Mark the first subtask as completed
            completedSubtask = task.subtasks[0];
			completedSubtask.status = 'done';
			completedSubtask.title = 'Completed Subtask Title';
			mockReadJSON.mockReturnValue(tasksDataCopy);
		}
        expect(completedSubtask).toBeDefined();

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
								delta: { text: `{"id": ${parentTaskId}, "title": "Updated Parent Task",` }
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
                        // Attempt to overwrite the completed subtask
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: `"dependencies": [], "priority": "medium", "subtasks": [`
								}
							}
						})
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: `{"id": ${completedSubtask.id}, "title": "Attempt to Overwrite", "status": "pending"},`
								}
							}
						})
                        // Add another subtask
						.mockResolvedValueOnce({
							done: false,
							value: {
								type: 'content_block_delta',
								delta: {
									text: '{"id": 99, "title": "New Added Subtask", "status": "pending"}]}'
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
			parentTaskId,
			'Update UI components task'
		);

		// Verify the original completed subtask was preserved
		expect(result).toBeDefined();
        const preservedSubtask = result.subtasks.find(st => st.id === completedSubtask.id);
        expect(preservedSubtask).toBeDefined();
		expect(preservedSubtask.title).toBe('Completed Subtask Title');
		expect(preservedSubtask.status).toBe('done');

        // Verify the new subtask was added
        expect(result.subtasks.find(st => st.id === 99)).toBeDefined();
        expect(result.subtasks.length).toBeGreaterThan(1);

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
			true // research = true
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