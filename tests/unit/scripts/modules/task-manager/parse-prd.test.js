/**
 * Tests for the parse-prd.js module
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
	sanitizePrompt: jest.fn((prompt) => prompt),
	truncate: jest.fn((text) => text),
	isSilentMode: jest.fn(() => false),
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn(),
	findTaskById: jest.fn(),
	promptYesNo: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateObjectService: jest.fn().mockResolvedValue({
			mainResult: {
				tasks: []
			},
			telemetryData: {}
		})
	})
);

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	getStatusWithColor: jest.fn((status) => status),
	startLoadingIndicator: jest.fn(),
	stopLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/models.js',
	() => ({
		getModelConfiguration: jest.fn(() => ({
			model: 'mock-model',
			maxTokens: 4000,
			temperature: 0.7
		}))
	})
);

// Mock fs module
jest.unstable_mockModule('fs', () => ({
	default: {
		readFileSync: jest.fn(),
		existsSync: jest.fn(),
		mkdirSync: jest.fn(),
		writeFileSync: jest.fn()
	},
	readFileSync: jest.fn(),
	existsSync: jest.fn(),
	mkdirSync: jest.fn(),
	writeFileSync: jest.fn()
}));

// Mock path module
jest.unstable_mockModule('path', () => ({
	default: {
		dirname: jest.fn(),
		join: jest.fn((dir, file) => `${dir}/${file}`)
	},
	dirname: jest.fn(),
	join: jest.fn((dir, file) => `${dir}/${file}`)
}));

// Import the mocked modules
const { readJSON, writeJSON, log, promptYesNo } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateObjectService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);
const generateTaskFiles = (
	await import(
		'../../../../../scripts/modules/task-manager/generate-task-files.js'
	)
).default;

const fs = await import('fs');
const path = await import('path');

// Import the module under test
const { default: parsePRD } = await import(
	'../../../../../scripts/modules/task-manager/parse-prd.js'
);

// Sample data for tests (from main test file)
const sampleClaudeResponse = {
	tasks: [
		{
			id: 1,
			title: 'Setup Project Structure',
			description: 'Initialize the project with necessary files and folders',
			status: 'pending',
			dependencies: [],
			priority: 'high',
			subtasks: []
		},
		{
			id: 2,
			title: 'Implement Core Features',
			description: 'Build the main functionality',
			status: 'pending',
			dependencies: [1],
			priority: 'high',
			subtasks: []
		}
	]
};

describe('parsePRD', () => {
	// Mock the sample PRD content
	const samplePRDContent = '# Sample PRD for Testing';

	// Mock existing tasks for append test
	const existingTasks = {
		tasks: [
			{ id: 1, title: 'Existing Task 1', status: 'done' },
			{ id: 2, title: 'Existing Task 2', status: 'pending' }
		]
	};

	// Mock new tasks with continuing IDs for append test
	const newTasksWithContinuedIds = {
		tasks: [
			{ id: 3, title: 'New Task 3' },
			{ id: 4, title: 'New Task 4' }
		]
	};

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Set up mocks for fs, path and other modules
		fs.default.readFileSync.mockReturnValue(samplePRDContent);
		fs.default.existsSync.mockReturnValue(true);
		path.default.dirname.mockReturnValue('tasks');
		generateObjectService.mockResolvedValue({
			mainResult: sampleClaudeResponse,
			telemetryData: {}
		});
		generateTaskFiles.mockResolvedValue(undefined);
		promptYesNo.mockResolvedValue(true); // Default to "yes" for confirmation

		// Mock console.error to prevent output
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore all mocks after each test
		jest.restoreAllMocks();
	});

	test('should parse a PRD file and generate tasks', async () => {
		// Setup mocks to simulate normal conditions (no existing output file)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

		// Verify fs.readFileSync was called with the correct arguments
		expect(fs.default.readFileSync).toHaveBeenCalledWith(
			'path/to/prd.txt',
			'utf8'
		);

		// Verify generateObjectService was called
		expect(generateObjectService).toHaveBeenCalled();

		// Verify directory check
		expect(fs.default.existsSync).toHaveBeenCalledWith('tasks');

		// Verify writeJSON was called with the correct arguments
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			sampleClaudeResponse
		);

		// Verify generateTaskFiles was called
		expect(generateTaskFiles).toHaveBeenCalledWith(
			'tasks/tasks.json',
			'tasks',
			{ mcpLog: undefined }
		);

		// Verify result
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});

		// Verify that the written data contains 2 tasks from sampleClaudeResponse
		const writtenData = writeJSON.mock.calls[0][1];
		expect(writtenData.tasks.length).toBe(2);
	});

	test('should create the tasks directory if it does not exist', async () => {
		// Mock existsSync to return false specifically for the directory check
		// but true for the output file check (so we don't trigger confirmation path)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return false; // Directory doesn't exist
			return true; // Default for other paths
		});

		// Call the function
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

		// Verify mkdir was called
		expect(fs.default.mkdirSync).toHaveBeenCalledWith('tasks', {
			recursive: true
		});
	});

	test('should handle errors in the PRD parsing process', async () => {
		// Mock an error in generateObjectService
		const testError = new Error('Test error in AI API call');
		generateObjectService.mockRejectedValueOnce(testError);

		// Setup mocks to simulate normal file conditions (no existing file)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function with mcpLog to make it think it's in MCP mode (which throws instead of process.exit)
		await expect(
			parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			})
		).rejects.toThrow('Test error in AI API call');
	});

	test('should generate individual task files after creating tasks.json', async () => {
		// Setup mocks to simulate normal conditions (no existing output file)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

		// Verify generateTaskFiles was called
		expect(generateTaskFiles).toHaveBeenCalledWith(
			'tasks/tasks.json',
			'tasks',
			{ mcpLog: undefined }
		);
	});

	test('should overwrite tasks.json when force flag is true', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return true; // Output file exists
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function with force=true to allow overwrite
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, { force: true });

		// Verify prompt was NOT called (confirmation happens at CLI level, not in core function)
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was written after force overwrite
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			sampleClaudeResponse
		);
	});

	test('should throw error when tasks.json exists without force flag in MCP mode', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return true; // Output file exists
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function with mcpLog to make it think it's in MCP mode (which throws instead of process.exit)
		await expect(
			parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			})
		).rejects.toThrow('Output file tasks/tasks.json already exists');

		// Verify prompt was NOT called (confirmation happens at CLI level, not in core function)
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was NOT written
		expect(writeJSON).not.toHaveBeenCalled();
	});

	test('should call process.exit when tasks.json exists without force flag in CLI mode', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return true; // Output file exists
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Mock process.exit for this specific test
		const mockProcessExit = jest
			.spyOn(process, 'exit')
			.mockImplementation((code) => {
				throw new Error(`process.exit: ${code}`);
			});

		// Call the function without mcpLog (CLI mode) and expect it to throw due to mocked process.exit
		await expect(
			parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3)
		).rejects.toThrow('process.exit: 1');

		// Verify process.exit was called with code 1
		expect(mockProcessExit).toHaveBeenCalledWith(1);

		// Verify the file was NOT written
		expect(writeJSON).not.toHaveBeenCalled();

		// Restore the mock
		mockProcessExit.mockRestore();
	});

	test('should not prompt for confirmation when tasks.json does not exist', async () => {
		// Setup mocks to simulate tasks.json does not exist
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

		// Verify prompt was NOT called
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was written without confirmation
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			sampleClaudeResponse
		);
	});

	test('should append new tasks when append option is true', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return true; // Output file exists
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Mock for reading existing tasks
		readJSON.mockReturnValue(existingTasks);

		// Mock generateObjectService to return new tasks with continuing IDs
		generateObjectService.mockResolvedValueOnce({
			mainResult: newTasksWithContinuedIds,
			telemetryData: {}
		});

		// Call the function with append option
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 2, {
			append: true
		});

		// Verify prompt was NOT called (no confirmation needed for append)
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was written with merged tasks
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({ id: 1 }),
					expect.objectContaining({ id: 2 }),
					expect.objectContaining({ id: 3 }),
					expect.objectContaining({ id: 4 })
				])
			})
		);

		// Verify the result contains merged tasks
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});

		// Verify that the written data contains 4 tasks (2 existing + 2 new)
		const writtenData = writeJSON.mock.calls[0][1];
		expect(writtenData.tasks.length).toBe(4);
	});

	test('should skip prompt and not overwrite when append is true', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return true; // Output file exists
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function with append option
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			append: true
		});

		// Verify prompt was NOT called with append flag
		expect(promptYesNo).not.toHaveBeenCalled();
	});
});
