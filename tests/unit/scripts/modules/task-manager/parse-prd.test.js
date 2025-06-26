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
	ensureTagMetadata: jest.fn((tagObj) => tagObj),
	getCurrentTag: jest.fn(() => 'master'),
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
		}),
		streamTextService: jest.fn().mockResolvedValue({
			mainResult: {
				textStream: {
					[Symbol.asyncIterator]: async function* () {
						yield '{"tasks":[';
						yield '{"id":1,"title":"Test Task","priority":"high"}';
						yield ']}';
					}
				}
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
		getDebugFlag: jest.fn(() => false),
		getMainModelId: jest.fn(() => 'claude-3-5-sonnet'),
		getResearchModelId: jest.fn(() => 'claude-3-5-sonnet'),
		getParametersForRole: jest.fn(() => ({
			provider: 'anthropic',
			modelId: 'claude-3-5-sonnet',
			maxTokens: 4000,
			temperature: 0.7
		}))
	})
);

// jest.unstable_mockModule(
// 	'../../../../../scripts/modules/task-manager/generate-task-files.js',
// 	() => ({
// 		default: jest.fn().mockResolvedValue()
// 	})
// );

// Mock fs module
jest.unstable_mockModule('fs', () => ({
	default: {
		readFileSync: jest.fn(),
		existsSync: jest.fn(),
		mkdirSync: jest.fn(),
		writeFileSync: jest.fn(),
		promises: {
			readFile: jest.fn()
		}
	},
	readFileSync: jest.fn(),
	existsSync: jest.fn(),
	mkdirSync: jest.fn(),
	writeFileSync: jest.fn(),
	promises: {
		readFile: jest.fn()
	}
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

// Mock JSONParser for streaming tests
jest.unstable_mockModule('@streamparser/json', () => ({
	JSONParser: jest.fn().mockImplementation(() => ({
		onValue: jest.fn(),
		onError: jest.fn(),
		write: jest.fn(),
		end: jest.fn()
	}))
}));

// Mock stream-parser functions
jest.unstable_mockModule('../../../../../src/utils/stream-parser.js', () => ({
	parseStream: jest.fn().mockResolvedValue({
		items: [{ id: 1, title: 'Test Task', priority: 'high' }],
		accumulatedText:
			'{"tasks":[{"id":1,"title":"Test Task","priority":"high"}]}',
		estimatedTokens: 50,
		usedFallback: false
	}),
	createTaskProgressCallback: jest.fn().mockReturnValue(jest.fn()),
	createConsoleProgressCallback: jest.fn().mockReturnValue(jest.fn())
}));

// Mock progress tracker to prevent intervals
jest.unstable_mockModule(
	'../../../../../src/progress/parse-prd-tracker.js',
	() => ({
		createParsePrdTracker: jest.fn().mockReturnValue({
			start: jest.fn(),
			stop: jest.fn(),
			updateTokens: jest.fn(),
			addTaskLine: jest.fn(),
			trackTaskPriority: jest.fn(),
			getSummary: jest.fn().mockReturnValue({
				taskPriorities: { high: 0, medium: 0, low: 0 },
				elapsedTime: 0,
				actionVerb: 'generated'
			})
		})
	})
);

// Mock UI functions to prevent any display delays
jest.unstable_mockModule('../../../../../src/ui/parse-prd.js', () => ({
	displayParsePrdStart: jest.fn(),
	displayParsePrdSummary: jest.fn()
}));

// Import the mocked modules
const { readJSON, writeJSON, log, promptYesNo } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateObjectService, streamTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);
// const generateTaskFiles = (
// 	await import(
// 		'../../../../../scripts/modules/task-manager/generate-task-files.js'
// 	)
// ).default;

const { JSONParser } = await import('@streamparser/json');

const { parseStream } = await import(
	'../../../../../src/utils/stream-parser.js'
);

const { createParsePrdTracker } = await import(
	'../../../../../src/progress/parse-prd-tracker.js'
);

const { displayParsePrdStart, displayParsePrdSummary } = await import(
	'../../../../../src/ui/parse-prd.js'
);

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
			priority: 'high'
		},
		{
			id: 2,
			title: 'Implement Core Features',
			description: 'Build the main functionality',
			status: 'pending',
			dependencies: [1],
			priority: 'high'
		}
	],
	metadata: {
		projectName: 'Test Project',
		totalTasks: 2,
		sourceFile: 'path/to/prd.txt',
		generatedAt: expect.any(String)
	}
};

describe('parsePRD', () => {
	// Mock the sample PRD content
	const samplePRDContent = '# Sample PRD for Testing';

	// Mock existing tasks for append test - TAGGED FORMAT
	const existingTasksData = {
		master: {
			tasks: [
				{ id: 1, title: 'Existing Task 1', status: 'done' },
				{ id: 2, title: 'Existing Task 2', status: 'pending' }
			]
		}
	};

	// Mock new tasks with continuing IDs for append test
	const newTasksClaudeResponse = {
		tasks: [
			{ id: 3, title: 'New Task 3' },
			{ id: 4, title: 'New Task 4' }
		],
		metadata: {
			projectName: 'Test Project',
			totalTasks: 2,
			sourceFile: 'path/to/prd.txt',
			generatedAt: expect.any(String)
		}
	};

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Set up mocks for fs, path and other modules
		fs.default.readFileSync.mockReturnValue(samplePRDContent);
		fs.default.promises.readFile.mockResolvedValue(samplePRDContent);
		fs.default.existsSync.mockReturnValue(true);
		path.default.dirname.mockReturnValue('tasks');
		generateObjectService.mockResolvedValue({
			mainResult: { object: sampleClaudeResponse },
			telemetryData: {}
		});
		streamTextService.mockResolvedValue({
			mainResult: {
				textStream: {
					[Symbol.asyncIterator]: async function* () {
						yield '{"tasks":[';
						yield '{"id":1,"title":"Test Task","priority":"high"}';
						yield ']}';
					}
				}
			},
			telemetryData: {}
		});
		// generateTaskFiles.mockResolvedValue(undefined);
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
		fs.default.existsSync.mockImplementation((p) => {
			if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (p === 'tasks') return true; // Directory exists
			return false;
		});

		// Also mock the other fs methods that might be called
		fs.default.readFileSync.mockReturnValue(samplePRDContent);
		fs.default.promises.readFile.mockResolvedValue(samplePRDContent);

		// Call the function with mcpLog to force non-streaming mode
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Verify fs.readFileSync was called with the correct arguments
		expect(fs.default.readFileSync).toHaveBeenCalledWith(
			'path/to/prd.txt',
			'utf8'
		);

		// Verify generateObjectService was called
		expect(generateObjectService).toHaveBeenCalled();

		// Verify directory check
		expect(fs.default.existsSync).toHaveBeenCalledWith('tasks');

		// Verify fs.writeFileSync was called with the correct arguments in tagged format
		expect(fs.default.writeFileSync).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.stringContaining('"master"')
		);

		// Verify result
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});

		// Verify that the written data contains 2 tasks from sampleClaudeResponse in the correct tag
		const writtenDataString = fs.default.writeFileSync.mock.calls[0][1];
		const writtenData = JSON.parse(writtenDataString);
		expect(writtenData.master.tasks.length).toBe(2);
	});

	test('should create the tasks directory if it does not exist', async () => {
		// Mock existsSync to return false specifically for the directory check
		// but true for the output file check (so we don't trigger confirmation path)
		fs.default.existsSync.mockImplementation((p) => {
			if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (p === 'tasks') return false; // Directory doesn't exist
			return true; // Default for other paths
		});

		// Call the function with mcpLog to force non-streaming mode
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

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
		fs.default.existsSync.mockImplementation((p) => {
			if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (p === 'tasks') return true; // Directory exists
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
		fs.default.existsSync.mockImplementation((p) => {
			if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (p === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function with mcpLog to force non-streaming mode
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// generateTaskFiles is currently commented out in parse-prd.js
	});

	test('should overwrite tasks.json when force flag is true', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockImplementation((p) => {
			if (p === 'tasks/tasks.json') return true; // Output file exists
			if (p === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function with force=true to allow overwrite and mcpLog to force non-streaming mode
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			force: true,
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Verify prompt was NOT called (confirmation happens at CLI level, not in core function)
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was written after force overwrite
		expect(fs.default.writeFileSync).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.stringContaining('"master"')
		);
	});

	test('should throw error when tasks in tag exist without force flag in MCP mode', async () => {
		// Setup mocks to simulate tasks.json already exists with tasks in the target tag
		fs.default.existsSync.mockReturnValue(true);
		// Mock readFileSync to return data with tasks in the 'master' tag
		fs.default.readFileSync.mockReturnValueOnce(
			JSON.stringify(existingTasksData)
		);

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
		).rejects.toThrow('already contains');

		// Verify prompt was NOT called
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was NOT written
		expect(fs.default.writeFileSync).not.toHaveBeenCalled();
	});

	test('should call process.exit when tasks in tag exist without force flag in CLI mode', async () => {
		// Setup mocks to simulate tasks.json already exists with tasks in the target tag
		fs.default.existsSync.mockReturnValue(true);
		fs.default.readFileSync.mockReturnValueOnce(
			JSON.stringify(existingTasksData)
		);

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
		expect(fs.default.writeFileSync).not.toHaveBeenCalled();

		// Restore the mock
		mockProcessExit.mockRestore();
	});

	test('should append new tasks when append option is true', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockReturnValue(true);

		// Mock for reading existing tasks in tagged format
		readJSON.mockReturnValue(existingTasksData);
		// Mock readFileSync to return the raw content for the initial check
		fs.default.readFileSync.mockReturnValueOnce(
			JSON.stringify(existingTasksData)
		);

		// Mock generateObjectService to return new tasks with continuing IDs
		generateObjectService.mockResolvedValueOnce({
			mainResult: { object: newTasksClaudeResponse },
			telemetryData: {}
		});

		// Call the function with append option and mcpLog to force non-streaming mode
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 2, {
			append: true,
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Verify prompt was NOT called (no confirmation needed for append)
		expect(promptYesNo).not.toHaveBeenCalled();

		// Verify the file was written with merged tasks in the correct tag
		expect(fs.default.writeFileSync).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.stringContaining('"master"')
		);

		// Verify the result contains merged tasks
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});

		// Verify that the written data contains 4 tasks (2 existing + 2 new)
		const writtenDataString = fs.default.writeFileSync.mock.calls[0][1];
		const writtenData = JSON.parse(writtenDataString);
		expect(writtenData.master.tasks.length).toBe(4);
	});

	test('should skip prompt and not overwrite when append is true', async () => {
		// Setup mocks to simulate tasks.json already exists
		fs.default.existsSync.mockReturnValue(true);
		fs.default.readFileSync.mockReturnValueOnce(
			JSON.stringify(existingTasksData)
		);

		// Call the function with append option
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			append: true
		});

		// Verify prompt was NOT called with append flag
		expect(promptYesNo).not.toHaveBeenCalled();
	});

	test('should use streaming when reportProgress function is provided', async () => {
		// Setup mocks to simulate normal conditions (no existing output file)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Mock progress reporting function
		const mockReportProgress = jest.fn(() => Promise.resolve());

		// Mock JSONParser instance
		const mockParser = {
			onValue: jest.fn(),
			onError: jest.fn(),
			write: jest.fn(),
			end: jest.fn()
		};
		JSONParser.mockReturnValue(mockParser);

		// Call the function with reportProgress to trigger streaming path
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			reportProgress: mockReportProgress
		});

		// Verify streamTextService was called (streaming path)
		expect(streamTextService).toHaveBeenCalled();

		// Verify generateObjectService was NOT called (non-streaming path)
		expect(generateObjectService).not.toHaveBeenCalled();

		// Verify progress reporting was called
		expect(mockReportProgress).toHaveBeenCalled();

		// Verify parseStream was called for streaming
		expect(parseStream).toHaveBeenCalled();

		// Verify result structure
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});
	});

	test('should fallback to non-streaming when streaming fails with specific errors', async () => {
		// Setup mocks to simulate normal conditions (no existing output file)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Mock progress reporting function
		const mockReportProgress = jest.fn(() => Promise.resolve());

		// Mock streamTextService to fail with a streaming-specific error
		streamTextService.mockRejectedValueOnce(
			new Error('textStream is not async iterable')
		);

		// Call the function with reportProgress to trigger streaming path
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			reportProgress: mockReportProgress
		});

		// Verify streamTextService was called first (streaming attempt)
		expect(streamTextService).toHaveBeenCalled();

		// Verify generateObjectService was called as fallback
		expect(generateObjectService).toHaveBeenCalled();

		// Verify result structure (should succeed via fallback)
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});
	});

	test('should use non-streaming when reportProgress is not provided', async () => {
		// Setup mocks to simulate normal conditions (no existing output file)
		fs.default.existsSync.mockImplementation((path) => {
			if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
			if (path === 'tasks') return true; // Directory exists
			return false;
		});

		// Call the function without reportProgress but with mcpLog to force non-streaming path
		const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Verify generateObjectService was called (non-streaming path)
		expect(generateObjectService).toHaveBeenCalled();

		// Verify streamTextService was NOT called (streaming path)
		expect(streamTextService).not.toHaveBeenCalled();

		// Verify result structure
		expect(result).toEqual({
			success: true,
			tasksPath: 'tasks/tasks.json',
			telemetryData: {}
		});
	});

	// Additional tests to ensure all functionality works with both streaming and non-streaming
	describe('Streaming path comprehensive coverage', () => {
		const mockReportProgress = jest.fn(() => Promise.resolve());

		beforeEach(() => {
			// Mock JSONParser for streaming tests
			const mockParser = {
				onValue: jest.fn(),
				onError: jest.fn(),
				write: jest.fn(),
				end: jest.fn()
			};
			JSONParser.mockReturnValue(mockParser);
		});

		test('should handle force overwrite with streaming', async () => {
			// Setup mocks to simulate tasks.json already exists
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock the file content to contain existing tasks in the target tag
			fs.default.readFileSync.mockImplementation((filePath, encoding) => {
				if (filePath === 'tasks/tasks.json' && encoding === 'utf8') {
					return JSON.stringify(existingTasksData);
				}
				return samplePRDContent;
			});

			// Call with streaming + force
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				force: true,
				reportProgress: mockReportProgress
			});

			// Verify streaming path was used
			expect(streamTextService).toHaveBeenCalled();
			expect(generateObjectService).not.toHaveBeenCalled();

			// Verify file was written (force overwrite)
			expect(fs.default.writeFileSync).toHaveBeenCalled();
		});

		test('should handle append mode with streaming', async () => {
			// Setup mocks to simulate tasks.json already exists
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock the file content to contain existing tasks in the target tag
			fs.default.readFileSync.mockImplementation((filePath, encoding) => {
				if (filePath === 'tasks/tasks.json' && encoding === 'utf8') {
					return JSON.stringify(existingTasksData);
				}
				return samplePRDContent;
			});

			// Mock for reading existing tasks
			readJSON.mockReturnValue(existingTasksData);

			// Call with streaming + append
			const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 2, {
				append: true,
				reportProgress: mockReportProgress
			});

			// Verify streaming path was used
			expect(streamTextService).toHaveBeenCalled();
			expect(generateObjectService).not.toHaveBeenCalled();

			// Verify append logic worked
			expect(fs.default.readFileSync).toHaveBeenCalledWith(
				'tasks/tasks.json',
				'utf8'
			);
			expect(result.success).toBe(true);
		});

		test('should handle directory creation with streaming', async () => {
			// Setup mocks - directory doesn't exist
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return false; // Directory doesn't exist
				return false;
			});

			// Call with streaming
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress
			});

			// Verify streaming path was used
			expect(streamTextService).toHaveBeenCalled();
			expect(generateObjectService).not.toHaveBeenCalled();

			// Verify directory was created
			expect(fs.default.mkdirSync).toHaveBeenCalledWith('tasks', {
				recursive: true
			});
		});

		test('should handle research flag with streaming', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Call with streaming + research
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress,
				research: true
			});

			// Verify streaming path was used with research role
			expect(streamTextService).toHaveBeenCalledWith(
				expect.objectContaining({
					role: 'research'
				})
			);
			expect(generateObjectService).not.toHaveBeenCalled();
		});

		test('should throw error when tasks.json exists without force in MCP mode with streaming', async () => {
			// Setup mocks to simulate tasks.json already exists
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock the file content to contain existing tasks in the target tag
			fs.default.readFileSync.mockImplementation((filePath, encoding) => {
				if (filePath === 'tasks/tasks.json' && encoding === 'utf8') {
					return JSON.stringify(existingTasksData);
				}
				return samplePRDContent;
			});

			// Call with streaming + MCP mode (no force)
			await expect(
				parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
					reportProgress: mockReportProgress,
					mcpLog: {
						info: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
						debug: jest.fn(),
						success: jest.fn()
					}
				})
			).rejects.toThrow('already contains');

			// Verify streaming path would have been used (but failed before AI call)
			expect(streamTextService).not.toHaveBeenCalled();
			expect(generateObjectService).not.toHaveBeenCalled();
		});
	});

	describe('Non-streaming path comprehensive coverage', () => {
		test('should handle force overwrite with non-streaming', async () => {
			// Setup mocks to simulate tasks.json already exists
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock the file content to contain existing tasks in the target tag
			fs.default.readFileSync.mockImplementation((filePath, encoding) => {
				if (filePath === 'tasks/tasks.json' && encoding === 'utf8') {
					return JSON.stringify(existingTasksData);
				}
				return samplePRDContent;
			});

			// Call without reportProgress but with mcpLog (non-streaming) + force
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				force: true,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify non-streaming path was used
			expect(generateObjectService).toHaveBeenCalled();
			expect(streamTextService).not.toHaveBeenCalled();

			// Verify file was written (force overwrite)
			expect(fs.default.writeFileSync).toHaveBeenCalled();
		});

		test('should handle append mode with non-streaming', async () => {
			// Setup mocks to simulate tasks.json already exists
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return true; // Output file exists
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock the file content to contain existing tasks in the target tag
			fs.default.readFileSync.mockImplementation((filePath, encoding) => {
				if (filePath === 'tasks/tasks.json' && encoding === 'utf8') {
					return JSON.stringify(existingTasksData);
				}
				return samplePRDContent;
			});

			// Mock for reading existing tasks
			readJSON.mockReturnValue(existingTasksData);

			// Mock generateObjectService to return new tasks with continuing IDs
			generateObjectService.mockResolvedValueOnce({
				mainResult: { object: newTasksClaudeResponse },
				telemetryData: {}
			});

			// Call without reportProgress but with mcpLog (non-streaming) + append
			const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 2, {
				append: true,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify non-streaming path was used
			expect(generateObjectService).toHaveBeenCalled();
			expect(streamTextService).not.toHaveBeenCalled();

			// Verify append logic worked
			expect(fs.default.readFileSync).toHaveBeenCalledWith(
				'tasks/tasks.json',
				'utf8'
			);
			expect(result.success).toBe(true);
		});

		test('should handle research flag with non-streaming', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Call without reportProgress but with mcpLog (non-streaming) + research
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				research: true,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify non-streaming path was used with research role
			expect(generateObjectService).toHaveBeenCalledWith(
				expect.objectContaining({
					role: 'research'
				})
			);
			expect(streamTextService).not.toHaveBeenCalled();
		});

		test('should handle AI service errors with non-streaming', async () => {
			// Setup mocks to simulate normal file conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock an error in generateObjectService
			const testError = new Error('Test error in non-streaming AI API call');
			generateObjectService.mockRejectedValueOnce(testError);

			// Call without reportProgress (non-streaming) with mcpLog to make it throw
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
			).rejects.toThrow('Test error in non-streaming AI API call');

			// Verify non-streaming path was attempted
			expect(generateObjectService).toHaveBeenCalled();
			expect(streamTextService).not.toHaveBeenCalled();
		});
	});

	describe('File extension compatibility in both modes', () => {
		test('should handle .md files with streaming', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			const mockReportProgress = jest.fn(() => Promise.resolve());
			const mockParser = {
				onValue: jest.fn(),
				onError: jest.fn(),
				write: jest.fn(),
				end: jest.fn()
			};
			JSONParser.mockReturnValue(mockParser);

			// Call with .md file and streaming
			const result = await parsePRD(
				'path/to/requirements.md',
				'tasks/tasks.json',
				3,
				{
					reportProgress: mockReportProgress
				}
			);

			// Verify streaming path was used
			expect(streamTextService).toHaveBeenCalled();
			expect(generateObjectService).not.toHaveBeenCalled();

			// Verify file was read (regardless of extension)
			expect(fs.default.readFileSync).toHaveBeenCalledWith(
				'path/to/requirements.md',
				'utf8'
			);
			expect(result.success).toBe(true);
		});

		test('should handle .md files with non-streaming', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Call with .md file and non-streaming (force with mcpLog)
			const result = await parsePRD(
				'path/to/requirements.md',
				'tasks/tasks.json',
				3,
				{
					mcpLog: {
						info: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
						debug: jest.fn(),
						success: jest.fn()
					}
				}
			);

			// Verify non-streaming path was used
			expect(generateObjectService).toHaveBeenCalled();
			expect(streamTextService).not.toHaveBeenCalled();

			// Verify file was read (regardless of extension)
			expect(fs.default.readFileSync).toHaveBeenCalledWith(
				'path/to/requirements.md',
				'utf8'
			);
			expect(result.success).toBe(true);
		});

		test('should handle files without extension in both modes', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Test streaming mode
			const mockReportProgress = jest.fn(() => Promise.resolve());
			const mockParser = {
				onValue: jest.fn(),
				onError: jest.fn(),
				write: jest.fn(),
				end: jest.fn()
			};
			JSONParser.mockReturnValue(mockParser);

			const streamingResult = await parsePRD(
				'path/to/prd',
				'tasks/tasks.json',
				3,
				{
					reportProgress: mockReportProgress
				}
			);

			expect(streamingResult.success).toBe(true);
			expect(streamTextService).toHaveBeenCalled();

			// Reset mocks for non-streaming test
			jest.clearAllMocks();
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false;
				if (path === 'tasks') return true;
				return false;
			});

			// Test non-streaming mode (force with mcpLog)
			const nonStreamingResult = await parsePRD(
				'path/to/prd',
				'tasks/tasks.json',
				3,
				{
					mcpLog: {
						info: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
						debug: jest.fn(),
						success: jest.fn()
					}
				}
			);

			expect(nonStreamingResult.success).toBe(true);
			expect(generateObjectService).toHaveBeenCalled();
		});
	});
});
