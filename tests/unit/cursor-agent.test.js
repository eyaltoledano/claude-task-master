/**
 * cursor-agent.test.js
 * Unit tests for cursor-agent integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { spawn } from 'child_process';
import fs from 'fs';

// Mock child_process
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
	spawn: mockSpawn
}));

// Mock fs
const mockExistsSync = jest.fn();
jest.mock('fs', () => ({
	existsSync: mockExistsSync
}));

// Mock ora
jest.mock('ora', () => ({
	__esModule: true,
	default: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		text: '',
		succeed: jest.fn(),
		fail: jest.fn(),
		warn: jest.fn(),
		info: jest.fn()
	}))
}));

// Mock task-manager
jest.mock('../../scripts/modules/task-manager.js', () => ({
	setTaskStatus: jest.fn()
}));

// Mock utils
jest.mock('../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	findTaskById: jest.fn(),
	isSilentMode: jest.fn(() => false)
}));

// Import the module after mocking
import { 
	runCursorAgent, 
	isCursorAgentAvailable, 
	generateDirectivePrompt,
	isUpdateTodosToolCall
} from '../../scripts/modules/cursor-agent.js';

describe('cursor-agent integration', () => {
	let mockProcess;
	let mockStdout;
	let mockStderr;
	let mockStdin;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();
		
		// Create mock process
		mockStdout = {
			on: jest.fn(),
			write: jest.fn()
		};
		mockStderr = {
			on: jest.fn()
		};
		mockStdin = {
			write: jest.fn(),
			end: jest.fn()
		};
		
		mockProcess = {
			stdout: mockStdout,
			stderr: mockStderr,
			stdin: mockStdin,
			on: jest.fn(),
			kill: jest.fn()
		};
		
		// Mock spawn function
		mockSpawn.mockReturnValue(mockProcess);
		
		// Mock fs.existsSync
		mockExistsSync.mockReturnValue(true);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('isCursorAgentAvailable', () => {
		it('should return true when cursor-agent is available', async () => {
			// Mock successful process
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}
			});

			const result = await isCursorAgentAvailable();
			expect(result).toBe(true);
			expect(mockSpawn).toHaveBeenCalledWith('cursor-agent', ['--version'], {
				stdio: ['ignore', 'pipe', 'pipe']
			});
		});

		it('should return false when cursor-agent is not available', async () => {
			// Mock process error
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'error') {
					setTimeout(() => callback(new Error('Command not found')), 10);
				}
			});

			const result = await isCursorAgentAvailable();
			expect(result).toBe(false);
		});

		it('should return false on timeout', async () => {
			// Mock timeout scenario
			mockProcess.on.mockImplementation((event, callback) => {
				// Don't call any callbacks to simulate timeout
			});

			const result = await isCursorAgentAvailable();
			expect(result).toBe(false);
			expect(mockProcess.kill).toHaveBeenCalled();
		});
	});

	describe('generateDirectivePrompt', () => {
		it('should generate directive with correct tasks path', () => {
			const tasksPath = '/path/to/tasks.json';
			const prompt = generateDirectivePrompt(tasksPath, false);
			
			expect(prompt).toContain('Tasks file: /path/to/tasks.json');
			expect(prompt).toContain('Repository: the current working directory is the task-master repo');
			expect(prompt).toContain('Sequential Execution');
			expect(prompt).toContain('Status Updates');
		});

		it('should include JSON format instructions for update_todos tool calls', () => {
			const tasksPath = '/path/to/tasks.json';
			const prompt = generateDirectivePrompt(tasksPath, false);
			
			expect(prompt).toContain('{"type": "tool_call", "toolName": "update_todos"');
			expect(prompt).toContain('"args": {"id": "22", "status": "in-progress"}');
			expect(prompt).toContain('"args": {"id": "22", "status": "done"}');
			expect(prompt).toContain('For subtasks, use dot notation: {"id": "22.1", "status": "done"}');
			expect(prompt).toContain('Valid statuses: pending, in-progress, done, review, deferred, cancelled');
		});

		it('should include silent mode instructions when silent is true', () => {
			const tasksPath = '/path/to/tasks.json';
			const prompt = generateDirectivePrompt(tasksPath, true);
			
			expect(prompt).toContain('Silent Mode');
			expect(prompt).toContain('do not output descriptive logs');
			expect(prompt).toContain('spinner: / - \\ | rotating');
		});

		it('should not include silent mode instructions when silent is false', () => {
			const tasksPath = '/path/to/tasks.json';
			const prompt = generateDirectivePrompt(tasksPath, false);
			
			expect(prompt).not.toContain('do not output descriptive logs');
			expect(prompt).not.toContain('spinner: / - \\ | rotating');
		});
	});

	describe('isUpdateTodosToolCall', () => {
		it('should return tool call data for valid update_todos tool calls', () => {
			const validMessage = {
				type: 'tool_call',
				toolName: 'update_todos',
				args: {
					id: '22',
					status: 'done'
				}
			};

			const result = isUpdateTodosToolCall(validMessage);
			expect(result).toEqual({
				taskId: '22',
				status: 'done'
			});
		});

		it('should handle subtask IDs with dot notation', () => {
			const validMessage = {
				type: 'tool_call',
				toolName: 'update_todos',
				args: {
					id: '22.1',
					status: 'in-progress'
				}
			};

			const result = isUpdateTodosToolCall(validMessage);
			expect(result).toEqual({
				taskId: '22.1',
				status: 'in-progress'
			});
		});

		it('should return null for wrong tool name', () => {
			const invalidMessage = {
				type: 'tool_call',
				toolName: 'other_tool',
				args: {
					id: '22',
					status: 'done'
				}
			};

			const result = isUpdateTodosToolCall(invalidMessage);
			expect(result).toBeNull();
		});

		it('should return null for wrong message type', () => {
			const invalidMessage = {
				type: 'assistant',
				toolName: 'update_todos',
				args: {
					id: '22',
					status: 'done'
				}
			};

			const result = isUpdateTodosToolCall(invalidMessage);
			expect(result).toBeNull();
		});

		it('should return null for missing args', () => {
			const invalidMessage = {
				type: 'tool_call',
				toolName: 'update_todos'
			};

			const result = isUpdateTodosToolCall(invalidMessage);
			expect(result).toBeNull();
		});

		it('should return null for missing id in args', () => {
			const invalidMessage = {
				type: 'tool_call',
				toolName: 'update_todos',
				args: {
					status: 'done'
				}
			};

			const result = isUpdateTodosToolCall(invalidMessage);
			expect(result).toBeNull();
		});

		it('should return null for missing status in args', () => {
			const invalidMessage = {
				type: 'tool_call',
				toolName: 'update_todos',
				args: {
					id: '22'
				}
			};

			const result = isUpdateTodosToolCall(invalidMessage);
			expect(result).toBeNull();
		});
	});

	describe('runCursorAgent', () => {
		it('should throw error when tasks file does not exist', async () => {
			// Mock fs.existsSync to return false
			mockExistsSync.mockReturnValue(false);

			await expect(runCursorAgent('/nonexistent/path')).rejects.toThrow('Tasks file not found: /nonexistent/path');
		});

		it('should spawn cursor-agent with correct arguments', async () => {
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock successful completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			const projectRoot = '/project/root';

			await runCursorAgent(tasksPath, false, projectRoot);

			expect(mockSpawn).toHaveBeenCalledWith('cursor-agent', ['--print'], {
				stdio: ['pipe', 'pipe', 'pipe'],
				cwd: projectRoot
			});
		});

		it('should write directive to stdin', async () => {
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock successful completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			await runCursorAgent(tasksPath, false, '/project/root');

			expect(mockStdin.write).toHaveBeenCalledWith(expect.stringContaining('Tasks file: /path/to/tasks.json'));
			expect(mockStdin.end).toHaveBeenCalled();
		});

		it('should resolve with success when process exits with code 0', async () => {
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock successful completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 10);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			const result = await runCursorAgent(tasksPath, false, '/project/root');

			expect(result).toEqual({ success: true, exitCode: 0 });
		});

		it('should reject when process exits with non-zero code', async () => {
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock failure completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(1), 10);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			await expect(runCursorAgent(tasksPath, false, '/project/root'))
				.rejects.toThrow('Cursor Agent exited with code 1');
		});

		it('should reject when process errors', async () => {
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock process error
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'error') {
					setTimeout(() => callback(new Error('Process error')), 10);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			await expect(runCursorAgent(tasksPath, false, '/project/root'))
				.rejects.toThrow('Failed to start cursor-agent: Process error');
		});

		it('should update tasks.json when receiving update_todos tool calls', async () => {
			// Import and mock the setTaskStatus from task-manager module
			const taskManager = await import('../../scripts/modules/task-manager.js');
			const mockSetTaskStatus = jest.fn().mockResolvedValue({
				success: true,
				updatedTasks: [{ id: '22', oldStatus: 'pending', newStatus: 'done' }]
			});
			taskManager.setTaskStatus = mockSetTaskStatus;
			
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock process stdout with update_todos tool call
			mockProcess.stdout.on.mockImplementation((event, callback) => {
				if (event === 'data') {
					// Simulate receiving an update_todos tool call
					const toolCallData = JSON.stringify({
						type: 'tool_call',
						toolName: 'update_todos',
						args: {
							id: '22',
							status: 'done'
						}
					}) + '\n';
					
					setTimeout(() => callback(Buffer.from(toolCallData)), 10);
				}
			});
			
			// Mock successful completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 50);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			const projectRoot = '/project/root';
			
			await runCursorAgent(tasksPath, false, projectRoot);

			// Verify setTaskStatus was called with correct parameters
			expect(mockSetTaskStatus).toHaveBeenCalledWith(
				tasksPath,
				'22',
				'done',
				expect.objectContaining({
					projectRoot,
					mcpLog: null
				})
			);
		});

		it('should handle subtask updates with dot notation', async () => {
			// Import and mock the setTaskStatus from task-manager module
			const taskManager = await import('../../scripts/modules/task-manager.js');
			const mockSetTaskStatus = jest.fn().mockResolvedValue({
				success: true,
				updatedTasks: [{ id: '22.1', oldStatus: 'pending', newStatus: 'in_progress' }]
			});
			taskManager.setTaskStatus = mockSetTaskStatus;
			
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock process stdout with subtask update_todos tool call
			mockProcess.stdout.on.mockImplementation((event, callback) => {
				if (event === 'data') {
					// Simulate receiving an update_todos tool call for a subtask
					const toolCallData = JSON.stringify({
						type: 'tool_call',
						toolName: 'update_todos',
						args: {
							id: '22.1',
							status: 'in_progress'
						}
					}) + '\n';
					
					setTimeout(() => callback(Buffer.from(toolCallData)), 10);
				}
			});
			
			// Mock successful completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 50);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			const projectRoot = '/project/root';
			
			await runCursorAgent(tasksPath, false, projectRoot);

			// Verify setTaskStatus was called with correct subtask ID
			expect(mockSetTaskStatus).toHaveBeenCalledWith(
				tasksPath,
				'22.1',
				'in_progress',
				expect.objectContaining({
					projectRoot,
					mcpLog: null
				})
			);
		});

		it('should work in silent mode while still updating tasks.json', async () => {
			// Mock silent mode through utils module mock
			const utils = await import('../../scripts/modules/utils.js');
			utils.isSilentMode.mockReturnValue(true);
			
			// Import and mock the setTaskStatus from task-manager module
			const taskManager = await import('../../scripts/modules/task-manager.js');
			const mockSetTaskStatus = jest.fn().mockResolvedValue({
				success: true,
				updatedTasks: [{ id: '22', oldStatus: 'pending', newStatus: 'done' }]
			});
			taskManager.setTaskStatus = mockSetTaskStatus;
			
			// Ensure file exists
			mockExistsSync.mockReturnValue(true);
			
			// Mock process stdout with update_todos tool call
			mockProcess.stdout.on.mockImplementation((event, callback) => {
				if (event === 'data') {
					const toolCallData = JSON.stringify({
						type: 'tool_call',
						toolName: 'update_todos',
						args: {
							id: '22',
							status: 'done'
						}
					}) + '\n';
					
					setTimeout(() => callback(Buffer.from(toolCallData)), 10);
				}
			});
			
			// Mock successful completion
			mockProcess.on.mockImplementation((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(0), 50);
				}
			});

			const tasksPath = '/path/to/tasks.json';
			const projectRoot = '/project/root';
			
			await runCursorAgent(tasksPath, true, projectRoot); // silent mode = true

			// Verify setTaskStatus was still called even in silent mode
			expect(mockSetTaskStatus).toHaveBeenCalledWith(
				tasksPath,
				'22',
				'done',
				expect.objectContaining({
					projectRoot,
					mcpLog: null
				})
			);
		});
	});
});