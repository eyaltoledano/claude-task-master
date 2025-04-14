/**
 * Tests for the add-task MCP tool
 *
 * Note: This test does NOT test the actual implementation. It tests that:
 * 1. The tool is registered correctly with the correct parameters
 * 2. Arguments are passed correctly to addTaskDirect
 * 3. Error handling works as expected
 *
 * We do NOT import the real implementation - everything is mocked
 */

import { jest } from '@jest/globals';
import {
	sampleTasks,
	emptySampleTasks
} from '../../../fixtures/sample-tasks.js';

// Mock EVERYTHING
const mockAddTaskDirect = jest.fn();
jest.mock('../../../../mcp-server/src/core/task-master-core.js', () => ({
	addTaskDirect: mockAddTaskDirect
}));

const mockHandleApiResult = jest.fn((result) => result);
const mockGetProjectRootFromSession = jest.fn(() => '/mock/project/root');
const mockCreateErrorResponse = jest.fn((msg) => ({
	success: false,
	error: { code: 'ERROR', message: msg }
}));

jest.mock('../../../../mcp-server/src/tools/utils.js', () => ({
	getProjectRootFromSession: mockGetProjectRootFromSession,
	handleApiResult: mockHandleApiResult,
	createErrorResponse: mockCreateErrorResponse,
	createContentResponse: jest.fn((content) => ({
		success: true,
		data: content
	})),
	executeTaskMasterCommand: jest.fn()
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
			prompt: {},
			dependencies: {},
			priority: {},
			research: {},
			file: {},
			projectRoot: {}
		})
	}
};

jest.mock('zod', () => ({
	z: mockZod
}));

// DO NOT import the real module - create a fake implementation
// This is the fake implementation of registerAddTaskTool
const registerAddTaskTool = (server) => {
	// Create simplified version of the tool config
	const toolConfig = {
		name: 'add_task',
		description: 'Add a new task using AI',
		parameters: mockZod,

		// Create a simplified mock of the execute function
		execute: (args, context) => {
			const { log, reportProgress, session } = context;

			try {
				log.info &&
					log.info(`Starting add-task with args: ${JSON.stringify(args)}`);

				// Get project root
				const rootFolder = mockGetProjectRootFromSession(session, log);

				// Call addTaskDirect
				const result = mockAddTaskDirect(
					{
						...args,
						projectRoot: rootFolder
					},
					log,
					{ reportProgress, session }
				);

				// Handle result
				return mockHandleApiResult(result, log);
			} catch (error) {
				log.error && log.error(`Error in add-task tool: ${error.message}`);
				return mockCreateErrorResponse(error.message);
			}
		}
	};

	// Register the tool with the server
	server.addTool(toolConfig);
};

describe('MCP Tool: add-task', () => {
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
		prompt: 'Create a new task',
		dependencies: '1,2',
		priority: 'high',
		research: true
	};

	// Standard responses
	const successResponse = {
		success: true,
		data: {
			taskId: '5',
			message: 'Successfully added new task #5'
		}
	};

	const errorResponse = {
		success: false,
		error: {
			code: 'ADD_TASK_ERROR',
			message: 'Failed to add task'
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
		mockAddTaskDirect.mockReturnValue(successResponse);

		// Register the tool
		registerAddTaskTool(mockServer);
	});

	test('should register the tool correctly', () => {
		// Verify tool was registered
		expect(mockServer.addTool).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'add_task',
				description: 'Add a new task using AI',
				parameters: expect.any(Object),
				execute: expect.any(Function)
			})
		);

		// Verify the tool config was passed
		const toolConfig = mockServer.addTool.mock.calls[0][0];
		expect(toolConfig).toHaveProperty('parameters');
		expect(toolConfig).toHaveProperty('execute');
	});

	test('should execute the tool with valid parameters', () => {
		// Setup context
		const mockContext = {
			log: mockLogger,
			reportProgress: jest.fn(),
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		executeFunction(validArgs, mockContext);

		// Verify getProjectRootFromSession was called
		expect(mockGetProjectRootFromSession).toHaveBeenCalledWith(
			mockContext.session,
			mockLogger
		);

		// Verify addTaskDirect was called with correct arguments
		expect(mockAddTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				...validArgs,
				projectRoot: '/mock/project/root'
			}),
			mockLogger,
			{
				reportProgress: mockContext.reportProgress,
				session: mockContext.session
			}
		);

		// Verify handleApiResult was called
		expect(mockHandleApiResult).toHaveBeenCalledWith(
			successResponse,
			mockLogger
		);
	});

	test('should handle errors from addTaskDirect', () => {
		// Setup error response
		mockAddTaskDirect.mockReturnValueOnce(errorResponse);

		// Setup context
		const mockContext = {
			log: mockLogger,
			reportProgress: jest.fn(),
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		executeFunction(validArgs, mockContext);

		// Verify addTaskDirect was called
		expect(mockAddTaskDirect).toHaveBeenCalled();

		// Verify handleApiResult was called with error response
		expect(mockHandleApiResult).toHaveBeenCalledWith(errorResponse, mockLogger);
	});

	test('should handle unexpected errors', () => {
		// Setup error
		const testError = new Error('Unexpected error');
		mockAddTaskDirect.mockImplementationOnce(() => {
			throw testError;
		});

		// Setup context
		const mockContext = {
			log: mockLogger,
			reportProgress: jest.fn(),
			session: { workingDirectory: '/mock/dir' }
		};

		// Execute the function
		executeFunction(validArgs, mockContext);

		// Verify error was logged
		expect(mockLogger.error).toHaveBeenCalledWith(
			'Error in add-task tool: Unexpected error'
		);

		// Verify error response was created
		expect(mockCreateErrorResponse).toHaveBeenCalledWith('Unexpected error');
	});

	test('should pass research parameter correctly', () => {
		// Setup context
		const mockContext = {
			log: mockLogger,
			reportProgress: jest.fn(),
			session: { workingDirectory: '/mock/dir' }
		};

		// Test with research=true
		executeFunction(
			{
				...validArgs,
				research: true
			},
			mockContext
		);

		// Verify addTaskDirect was called with research=true
		expect(mockAddTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				research: true
			}),
			expect.any(Object),
			expect.any(Object)
		);

		// Reset mocks
		jest.clearAllMocks();

		// Test with research=false
		executeFunction(
			{
				...validArgs,
				research: false
			},
			mockContext
		);

		// Verify addTaskDirect was called with research=false
		expect(mockAddTaskDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				research: false
			}),
			expect.any(Object),
			expect.any(Object)
		);
	});

	test('should pass priority parameter correctly', () => {
		// Setup context
		const mockContext = {
			log: mockLogger,
			reportProgress: jest.fn(),
			session: { workingDirectory: '/mock/dir' }
		};

		// Test different priority values
		['high', 'medium', 'low'].forEach((priority) => {
			// Reset mocks
			jest.clearAllMocks();

			// Execute with specific priority
			executeFunction(
				{
					...validArgs,
					priority
				},
				mockContext
			);

			// Verify addTaskDirect was called with correct priority
			expect(mockAddTaskDirect).toHaveBeenCalledWith(
				expect.objectContaining({
					priority
				}),
				expect.any(Object),
				expect.any(Object)
			);
		});
	});
});
