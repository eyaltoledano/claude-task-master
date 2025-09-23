/**
 * Tests for the remove-task MCP tool
 *
 * Note: This test does NOT test the actual implementation. It tests that:
 * 1. The tool is registered correctly with the correct parameters
 * 2. Arguments are passed correctly to removeTaskDirect
 * 3. Error handling works as expected
 * 4. Tag parameter is properly handled and passed through
 *
 * We do NOT import the real implementation - everything is mocked
 */

import { jest } from '@jest/globals';

// Mock EVERYTHING
const mockRemoveTaskDirect = jest.fn();
jest.mock('../../../../mcp-server/src/core/task-master-core.js', () => ({
	removeTaskDirect: mockRemoveTaskDirect
}));

const mockHandleApiResult = jest.fn((result) => result);
const mockWithNormalizedProjectRoot = jest.fn((fn) => fn);
const mockCreateErrorResponse = jest.fn((msg) => ({
	success: false,
	error: { code: 'ERROR', message: msg }
}));
const mockFindTasksPath = jest.fn(() => '/mock/project/tasks.json');

jest.mock('../../../../mcp-server/src/tools/utils.js', () => ({
	handleApiResult: mockHandleApiResult,
	createErrorResponse: mockCreateErrorResponse,
	withNormalizedProjectRoot: mockWithNormalizedProjectRoot
}));

jest.mock('../../../../mcp-server/src/core/utils/path-utils.js', () => ({
	findTasksPath: mockFindTasksPath
}));

// Mock the z object from zod
const mockZod = {
	object: jest.fn(() => mockZod),
	string: jest.fn(() => mockZod),
	boolean: jest.fn(() => mockZod),
	optional: jest.fn(() => mockZod),
	describe: jest.fn(() => mockZod),
	_def: {
		shape: () => ({
			id: {},
			file: {},
			projectRoot: {},
			confirm: {},
			tag: {}
		})
	}
};

jest.mock('zod', () => ({
	z: mockZod
}));

// DO NOT import the real module - create a fake implementation
// This is the fake implementation of registerRemoveTaskTool
const registerRemoveTaskTool = (server) => {
	// Create simplified version of the tool config
	const toolConfig = {
		name: 'remove_task',
		description: 'Remove a task or subtask permanently from the tasks list',
		parameters: mockZod,

		// Create a simplified mock of the execute function
		execute: mockWithNormalizedProjectRoot(async (args, context) => {
			const { log, session } = context;

			try {
				log.info && log.info(`Removing task(s) with ID(s): ${args.id}`);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = mockFindTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error && log.error(`Error finding tasks.json: ${error.message}`);
					return mockCreateErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				log.info && log.info(`Using tasks file path: ${tasksJsonPath}`);

				const result = await mockRemoveTaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						projectRoot: args.projectRoot,
						tag: args.tag
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info && log.info(`Successfully removed task: ${args.id}`);
				} else {
					log.error &&
						log.error(`Failed to remove task: ${result.error.message}`);
				}

				return mockHandleApiResult(
					result,
					log,
					'Error removing task',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error && log.error(`Error in remove-task tool: ${error.message}`);
				return mockCreateErrorResponse(error.message);
			}
		})
	};

	// Register the tool with the server
	server.addTool(toolConfig);
};

describe('MCP Tool: remove-task', () => {
	// Create mock server
	let mockServer;
	let executeFunction;

	// Create mock logger
	const mockLogger = {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	};

	// Test data
	const validArgs = {
		id: '5',
		projectRoot: '/mock/project/root',
		file: '/mock/project/tasks.json',
		confirm: true,
		tag: 'feature-branch'
	};

	const multipleTaskArgs = {
		id: '5,6.1,7',
		projectRoot: '/mock/project/root',
		tag: 'master'
	};

	// Standard responses
	const successResponse = {
		success: true,
		data: {
			totalTasks: 1,
			successful: 1,
			failed: 0,
			removedTasks: [
				{
					id: 5,
					title: 'Removed Task',
					status: 'pending'
				}
			],
			messages: ["Successfully removed task 5 from tag 'feature-branch'"],
			errors: [],
			tasksPath: '/mock/project/tasks.json',
			tag: 'feature-branch'
		}
	};

	const multipleTasksSuccessResponse = {
		success: true,
		data: {
			totalTasks: 3,
			successful: 3,
			failed: 0,
			removedTasks: [
				{ id: 5, title: 'Task 5', status: 'pending' },
				{ id: 1, title: 'Subtask 6.1', status: 'done', parentTaskId: 6 },
				{ id: 7, title: 'Task 7', status: 'in-progress' }
			],
			messages: [
				"Successfully removed task 5 from tag 'master'",
				"Successfully removed subtask 6.1 from tag 'master'",
				"Successfully removed task 7 from tag 'master'"
			],
			errors: [],
			tasksPath: '/mock/project/tasks.json',
			tag: 'master'
		}
	};

	const errorResponse = {
		success: false,
		error: {
			code: 'INVALID_TASK_ID',
			message: "The following tasks were not found in tag 'feature-branch': 999"
		}
	};

	const pathErrorResponse = {
		success: false,
		error: {
			code: 'PATH_ERROR',
			message: 'Failed to find tasks.json: No tasks.json found'
		}
	};

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create mock server
		mockServer = {
			addTool: jest.fn((config) => {
				executeFunction = config.execute;
			})
		};

		// Setup default successful response
		mockRemoveTaskDirect.mockResolvedValue(successResponse);
		mockFindTasksPath.mockReturnValue('/mock/project/tasks.json');

		// Register the tool
		registerRemoveTaskTool(mockServer);
	});

	test('should register the tool correctly', () => {
		// Verify tool was registered
		expect(mockServer.addTool).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'remove_task',
				description: 'Remove a task or subtask permanently from the tasks list',
				parameters: expect.any(Object),
				execute: expect.any(Function)
			})
		);

		// Verify the tool config was passed
		const toolConfig = mockServer.addTool.mock.calls[0][0];
		expect(toolConfig).toHaveProperty('parameters');
		expect(toolConfig).toHaveProperty('execute');
	});

	test('should execute the tool with valid parameters including tag', async () => {
		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(validArgs, mockContext);

		// Verify findTasksPath was called with correct arguments
		expect(mockFindTasksPath).toHaveBeenCalledWith(
			{
				projectRoot: validArgs.projectRoot,
				file: validArgs.file
			},
			mockLogger
		);

		// Verify removeTaskDirect was called with correct arguments including tag
		expect(mockRemoveTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				tasksJsonPath: '/mock/project/tasks.json',
				id: validArgs.id,
				projectRoot: validArgs.projectRoot,
				tag: validArgs.tag // This is the key test - tag parameter should be passed through
			}),
			mockLogger,
			{
				session: mockContext.session
			}
		);

		// Verify handleApiResult was called
		expect(mockHandleApiResult).toHaveBeenCalledWith(
			successResponse,
			mockLogger,
			'Error removing task',
			undefined,
			validArgs.projectRoot
		);
	});

	test('should handle multiple task IDs with tag context', async () => {
		// Setup multiple tasks response
		mockRemoveTaskDirect.mockResolvedValueOnce(multipleTasksSuccessResponse);

		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(multipleTaskArgs, mockContext);

		// Verify removeTaskDirect was called with comma-separated IDs and tag
		expect(mockRemoveTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				id: '5,6.1,7',
				tag: 'master'
			}),
			mockLogger,
			expect.any(Object)
		);

		// Verify successful handling of multiple tasks
		expect(mockHandleApiResult).toHaveBeenCalledWith(
			multipleTasksSuccessResponse,
			mockLogger,
			'Error removing task',
			undefined,
			multipleTaskArgs.projectRoot
		);
	});

	test('should handle missing tag parameter (defaults to current tag)', async () => {
		const argsWithoutTag = {
			id: '5',
			projectRoot: '/mock/project/root'
		};

		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(argsWithoutTag, mockContext);

		// Verify removeTaskDirect was called with undefined tag (should default to current tag)
		expect(mockRemoveTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				id: '5',
				projectRoot: '/mock/project/root',
				tag: undefined // Should be undefined when not provided
			}),
			mockLogger,
			expect.any(Object)
		);
	});

	test('should handle errors from removeTaskDirect', async () => {
		// Setup error response
		mockRemoveTaskDirect.mockResolvedValueOnce(errorResponse);

		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(validArgs, mockContext);

		// Verify removeTaskDirect was called
		expect(mockRemoveTaskDirect).toHaveBeenCalled();

		// Verify error logging
		expect(mockLogger.error).toHaveBeenCalledWith(
			"Failed to remove task: The following tasks were not found in tag 'feature-branch': 999"
		);

		// Verify handleApiResult was called with error response
		expect(mockHandleApiResult).toHaveBeenCalledWith(
			errorResponse,
			mockLogger,
			'Error removing task',
			undefined,
			validArgs.projectRoot
		);
	});

	test('should handle path finding errors', async () => {
		// Setup path finding error
		mockFindTasksPath.mockImplementationOnce(() => {
			throw new Error('No tasks.json found');
		});

		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		const result = await executeFunction(validArgs, mockContext);

		// Verify error logging
		expect(mockLogger.error).toHaveBeenCalledWith(
			'Error finding tasks.json: No tasks.json found'
		);

		// Verify error response was returned
		expect(mockCreateErrorResponse).toHaveBeenCalledWith(
			'Failed to find tasks.json: No tasks.json found'
		);

		// Verify removeTaskDirect was NOT called
		expect(mockRemoveTaskDirect).not.toHaveBeenCalled();
	});

	test('should handle unexpected errors in execute function', async () => {
		// Setup unexpected error
		mockRemoveTaskDirect.mockImplementationOnce(() => {
			throw new Error('Unexpected error');
		});

		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(validArgs, mockContext);

		// Verify error logging
		expect(mockLogger.error).toHaveBeenCalledWith(
			'Error in remove-task tool: Unexpected error'
		);

		// Verify error response was returned
		expect(mockCreateErrorResponse).toHaveBeenCalledWith('Unexpected error');
	});

	test('should properly handle withNormalizedProjectRoot wrapper', () => {
		// Verify that withNormalizedProjectRoot was called with the execute function
		expect(mockWithNormalizedProjectRoot).toHaveBeenCalledWith(
			expect.any(Function)
		);
	});

	test('should log appropriate info messages for successful operations', async () => {
		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(validArgs, mockContext);

		// Verify appropriate logging
		expect(mockLogger.info).toHaveBeenCalledWith(
			'Removing task(s) with ID(s): 5'
		);
		expect(mockLogger.info).toHaveBeenCalledWith(
			'Using tasks file path: /mock/project/tasks.json'
		);
		expect(mockLogger.info).toHaveBeenCalledWith(
			'Successfully removed task: 5'
		);
	});

	test('should handle subtask removal with proper tag context', async () => {
		const subtaskArgs = {
			id: '5.2',
			projectRoot: '/mock/project/root',
			tag: 'feature-branch'
		};

		const subtaskSuccessResponse = {
			success: true,
			data: {
				totalTasks: 1,
				successful: 1,
				failed: 0,
				removedTasks: [
					{
						id: 2,
						title: 'Removed Subtask',
						status: 'pending',
						parentTaskId: 5
					}
				],
				messages: [
					"Successfully removed subtask 5.2 from tag 'feature-branch'"
				],
				errors: [],
				tasksPath: '/mock/project/tasks.json',
				tag: 'feature-branch'
			}
		};

		mockRemoveTaskDirect.mockResolvedValueOnce(subtaskSuccessResponse);

		// Setup context
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		await executeFunction(subtaskArgs, mockContext);

		// Verify removeTaskDirect was called with subtask ID and tag
		expect(mockRemoveTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				id: '5.2',
				tag: 'feature-branch'
			}),
			mockLogger,
			expect.any(Object)
		);

		// Verify successful handling
		expect(mockHandleApiResult).toHaveBeenCalledWith(
			subtaskSuccessResponse,
			mockLogger,
			'Error removing task',
			undefined,
			subtaskArgs.projectRoot
		);
	});
});
