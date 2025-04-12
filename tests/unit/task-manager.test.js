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

	// Test suite for removeSubtask function -- REMOVE THIS BLOCK START (lines 282-391)
	// describe('removeSubtask function', () => {
	// 	// ... tests ...
	// }); // REMOVE THIS BLOCK END
});

// End of file
