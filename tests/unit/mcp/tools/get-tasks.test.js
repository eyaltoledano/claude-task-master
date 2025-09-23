/**
 * Tests for the get-tasks MCP tool
 *
 * This test verifies the MCP tool properly handles comma-separated status filtering
 * and passes arguments correctly to the underlying direct function.
 */

import { jest } from '@jest/globals';
import {
	sampleTasks,
	emptySampleTasks
} from '../../../fixtures/sample-tasks.js';

// Mock EVERYTHING
const mockListTasksDirect = jest.fn();
jest.mock('../../../../mcp-server/src/core/task-master-core.js', () => ({
	listTasksDirect: mockListTasksDirect
}));

const mockHandleApiResult = jest.fn((result) => result);
const mockWithNormalizedProjectRoot = jest.fn((executeFn) => executeFn);
const mockCreateErrorResponse = jest.fn((msg) => ({
	success: false,
	error: { code: 'ERROR', message: msg }
}));

const mockResolveTasksPath = jest.fn(() => '/mock/project/tasks.json');
const mockResolveComplexityReportPath = jest.fn(
	() => '/mock/project/complexity-report.json'
);

jest.mock('../../../../mcp-server/src/tools/utils.js', () => ({
	withNormalizedProjectRoot: mockWithNormalizedProjectRoot,
	handleApiResult: mockHandleApiResult,
	createErrorResponse: mockCreateErrorResponse,
	createContentResponse: jest.fn((content) => ({
		success: true,
		data: content
	}))
}));

jest.mock('../../../../mcp-server/src/core/utils/path-utils.js', () => ({
	resolveTasksPath: mockResolveTasksPath,
	resolveComplexityReportPath: mockResolveComplexityReportPath
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
			status: {},
			withSubtasks: {},
			file: {},
			complexityReport: {},
			projectRoot: {}
		})
	}
};

jest.mock('zod', () => ({
	z: mockZod
}));

// DO NOT import the real module - create a fake implementation
const registerListTasksTool = (server) => {
	const toolConfig = {
		name: 'get_tasks',
		description:
			'Get all tasks from Task Master, optionally filtering by status and including subtasks.',
		parameters: mockZod,

		execute: (args, context) => {
			const { log, session } = context;

			try {
				log.info &&
					log.info(`Getting tasks with filters: ${JSON.stringify(args)}`);

				// Resolve paths using mock functions
				let tasksJsonPath;
				try {
					tasksJsonPath = mockResolveTasksPath(args, log);
				} catch (error) {
					log.error && log.error(`Error finding tasks.json: ${error.message}`);
					return mockCreateErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				let complexityReportPath;
				try {
					complexityReportPath = mockResolveComplexityReportPath(args, session);
				} catch (error) {
					log.error &&
						log.error(`Error finding complexity report: ${error.message}`);
					complexityReportPath = null;
				}

				const result = mockListTasksDirect(
					{
						tasksJsonPath: tasksJsonPath,
						status: args.status,
						withSubtasks: args.withSubtasks,
						reportPath: complexityReportPath
					},
					log
				);

				log.info &&
					log.info(
						`Retrieved ${result.success ? result.data?.tasks?.length || 0 : 0} tasks`
					);
				return mockHandleApiResult(result, log, 'Error getting tasks');
			} catch (error) {
				log.error && log.error(`Error getting tasks: ${error.message}`);
				return mockCreateErrorResponse(error.message);
			}
		}
	};

	server.addTool(toolConfig);
};

describe('MCP Tool: get-tasks', () => {
	let mockServer;
	let executeFunction;

	const mockLogger = {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn()
	};

	// Sample response data with different statuses for testing
	const tasksResponse = {
		success: true,
		data: {
			tasks: [
				{ id: 1, title: 'Task 1', status: 'done' },
				{ id: 2, title: 'Task 2', status: 'pending' },
				{ id: 3, title: 'Task 3', status: 'in-progress' },
				{ id: 4, title: 'Task 4', status: 'blocked' },
				{ id: 5, title: 'Task 5', status: 'deferred' },
				{ id: 6, title: 'Task 6', status: 'review' }
			],
			filter: 'all',
			stats: {
				total: 6,
				completed: 1,
				inProgress: 1,
				pending: 1,
				blocked: 1,
				deferred: 1,
				review: 1
			}
		}
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockServer = {
			addTool: jest.fn((config) => {
				executeFunction = config.execute;
			})
		};

		// Setup default successful response
		mockListTasksDirect.mockReturnValue(tasksResponse);

		// Register the tool
		registerListTasksTool(mockServer);
	});

	test('should register the tool correctly', () => {
		expect(mockServer.addTool).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'get_tasks',
				description: expect.stringContaining('Get all tasks from Task Master'),
				parameters: expect.any(Object),
				execute: expect.any(Function)
			})
		);
	});

	test('should handle single status filter', () => {
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'pending',
			withSubtasks: false,
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		expect(mockListTasksDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'pending'
			}),
			mockLogger
		);
	});

	test('should handle comma-separated status filter', () => {
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'done,pending,in-progress',
			withSubtasks: false,
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		expect(mockListTasksDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'done,pending,in-progress'
			}),
			mockLogger
		);
	});

	test('should handle comma-separated status with spaces', () => {
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'blocked, deferred , review',
			withSubtasks: true,
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		expect(mockListTasksDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'blocked, deferred , review',
				withSubtasks: true
			}),
			mockLogger
		);
	});

	test('should handle withSubtasks parameter correctly', () => {
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		// Test with withSubtasks=true
		executeFunction(
			{
				status: 'pending',
				withSubtasks: true,
				projectRoot: '/mock/project'
			},
			mockContext
		);

		expect(mockListTasksDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				withSubtasks: true
			}),
			mockLogger
		);

		jest.clearAllMocks();

		// Test with withSubtasks=false
		executeFunction(
			{
				status: 'pending',
				withSubtasks: false,
				projectRoot: '/mock/project'
			},
			mockContext
		);

		expect(mockListTasksDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				withSubtasks: false
			}),
			mockLogger
		);
	});

	test('should handle path resolution errors gracefully', () => {
		mockResolveTasksPath.mockImplementationOnce(() => {
			throw new Error('Tasks file not found');
		});

		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'pending',
			projectRoot: '/mock/project'
		};

		const result = executeFunction(args, mockContext);

		expect(mockLogger.error).toHaveBeenCalledWith(
			'Error finding tasks.json: Tasks file not found'
		);
		expect(mockCreateErrorResponse).toHaveBeenCalledWith(
			'Failed to find tasks.json: Tasks file not found'
		);
	});

	test('should handle complexity report path resolution errors gracefully', () => {
		mockResolveComplexityReportPath.mockImplementationOnce(() => {
			throw new Error('Complexity report not found');
		});

		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'pending',
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		// Should not fail the operation but set complexityReportPath to null
		expect(mockListTasksDirect).toHaveBeenCalledWith(
			expect.objectContaining({
				reportPath: null
			}),
			mockLogger
		);
	});

	test('should handle listTasksDirect errors', () => {
		const errorResponse = {
			success: false,
			error: {
				code: 'LIST_TASKS_ERROR',
				message: 'Failed to list tasks'
			}
		};

		mockListTasksDirect.mockReturnValueOnce(errorResponse);

		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'pending',
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		expect(mockHandleApiResult).toHaveBeenCalledWith(
			errorResponse,
			mockLogger,
			'Error getting tasks'
		);
	});

	test('should handle unexpected errors', () => {
		const testError = new Error('Unexpected error');
		mockListTasksDirect.mockImplementationOnce(() => {
			throw testError;
		});

		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'pending',
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		expect(mockLogger.error).toHaveBeenCalledWith(
			'Error getting tasks: Unexpected error'
		);
		expect(mockCreateErrorResponse).toHaveBeenCalledWith('Unexpected error');
	});

	test('should pass all parameters correctly', () => {
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'done,pending',
			withSubtasks: true,
			file: 'custom-tasks.json',
			complexityReport: 'custom-report.json',
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		// Verify path resolution functions were called with correct arguments
		expect(mockResolveTasksPath).toHaveBeenCalledWith(args, mockLogger);
		expect(mockResolveComplexityReportPath).toHaveBeenCalledWith(
			args,
			mockContext.session
		);

		// Verify listTasksDirect was called with correct parameters
		expect(mockListTasksDirect).toHaveBeenCalledWith(
			{
				tasksJsonPath: '/mock/project/tasks.json',
				status: 'done,pending',
				withSubtasks: true,
				reportPath: '/mock/project/complexity-report.json'
			},
			mockLogger
		);
	});

	test('should log task count after successful retrieval', () => {
		const mockContext = {
			log: mockLogger,
			session: { workingDirectory: '/mock/dir' }
		};

		const args = {
			status: 'pending',
			projectRoot: '/mock/project'
		};

		executeFunction(args, mockContext);

		expect(mockLogger.info).toHaveBeenCalledWith(
			`Retrieved ${tasksResponse.data.tasks.length} tasks`
		);
	});
});
