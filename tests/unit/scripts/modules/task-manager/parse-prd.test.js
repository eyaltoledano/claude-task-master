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
			tasks: [
				{
					id: 1,
					title: 'Test Task 1',
					priority: 'high',
					description: 'Test description 1',
					status: 'pending',
					dependencies: []
				},
				{
					id: 2,
					title: 'Test Task 2',
					priority: 'medium',
					description: 'Test description 2',
					status: 'pending',
					dependencies: []
				},
				{
					id: 3,
					title: 'Test Task 3',
					priority: 'low',
					description: 'Test description 3',
					status: 'pending',
					dependencies: []
				}
			]
		}),
		streamObjectService: jest.fn().mockImplementation(async () => {
			// Return an object with partialObjectStream as a getter that returns the async generator
			return {
				mainResult: {
					get partialObjectStream() {
						return (async function* () {
							yield { tasks: [] };
							yield {
								tasks: [
									{
										id: 1,
										title: 'Test Task 1',
										priority: 'high',
										description: 'Test description 1',
										status: 'pending',
										dependencies: []
									}
								]
							};
							yield {
								tasks: [
									{
										id: 1,
										title: 'Test Task 1',
										priority: 'high',
										description: 'Test description 1',
										status: 'pending',
										dependencies: []
									},
									{
										id: 2,
										title: 'Test Task 2',
										priority: 'medium',
										description: 'Test description 2',
										status: 'pending',
										dependencies: []
									}
								]
							};
							yield {
								tasks: [
									{
										id: 1,
										title: 'Test Task 1',
										priority: 'high',
										description: 'Test description 1',
										status: 'pending',
										dependencies: []
									},
									{
										id: 2,
										title: 'Test Task 2',
										priority: 'medium',
										description: 'Test description 2',
										status: 'pending',
										dependencies: []
									},
									{
										id: 3,
										title: 'Test Task 3',
										priority: 'low',
										description: 'Test description 3',
										status: 'pending',
										dependencies: []
									}
								]
							};
						})();
					},
					usage: Promise.resolve({
						promptTokens: 100,
						completionTokens: 200,
						totalTokens: 300
					}),
					object: Promise.resolve({
						tasks: [
							{
								id: 1,
								title: 'Test Task 1',
								priority: 'high',
								description: 'Test description 1',
								status: 'pending',
								dependencies: []
							},
							{
								id: 2,
								title: 'Test Task 2',
								priority: 'medium',
								description: 'Test description 2',
								status: 'pending',
								dependencies: []
							},
							{
								id: 3,
								title: 'Test Task 3',
								priority: 'low',
								description: 'Test description 3',
								status: 'pending',
								dependencies: []
							}
						]
					})
				},
				providerName: 'anthropic',
				modelId: 'claude-3-5-sonnet-20241022',
				telemetryData: {}
			};
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
			modelId: 'claude-3-5-sonnet'
		})),
		getDefaultNumTasks: jest.fn(() => 10),
		getDefaultPriority: jest.fn(() => 'medium'),
		getMainProvider: jest.fn(() => 'openai'),
		getResearchProvider: jest.fn(() => 'perplexity'),
		hasCodebaseAnalysis: jest.fn(() => false)
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

jest.unstable_mockModule(
	'../../../../../scripts/modules/prompt-manager.js',
	() => ({
		getPromptManager: jest.fn().mockReturnValue({
			loadPrompt: jest.fn().mockImplementation((templateName, params) => {
				// Create dynamic mock prompts based on the parameters
				const { numTasks } = params || {};
				let numTasksText = '';

				if (numTasks > 0) {
					numTasksText = `approximately ${numTasks}`;
				} else {
					numTasksText = 'an appropriate number of';
				}

				return Promise.resolve({
					systemPrompt: 'Mocked system prompt for parse-prd',
					userPrompt: `Generate ${numTasksText} top-level development tasks from the PRD content.`
				});
			})
		})
	})
);

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
jest.unstable_mockModule('../../../../../src/utils/stream-parser.js', () => {
	// Define mock StreamingError class
	class StreamingError extends Error {
		constructor(message, code) {
			super(message);
			this.name = 'StreamingError';
			this.code = code;
		}
	}

	// Define mock error codes
	const STREAMING_ERROR_CODES = {
		NOT_ASYNC_ITERABLE: 'STREAMING_NOT_SUPPORTED',
		STREAM_PROCESSING_FAILED: 'STREAM_PROCESSING_FAILED',
		STREAM_NOT_ITERABLE: 'STREAM_NOT_ITERABLE'
	};

	return {
		parseStream: jest.fn().mockResolvedValue({
			items: [{ id: 1, title: 'Test Task', priority: 'high' }],
			accumulatedText:
				'{"tasks":[{"id":1,"title":"Test Task","priority":"high"}]}',
			estimatedTokens: 50,
			usedFallback: false
		}),
		createTaskProgressCallback: jest.fn().mockReturnValue(jest.fn()),
		createConsoleProgressCallback: jest.fn().mockReturnValue(jest.fn()),
		StreamingError,
		STREAMING_ERROR_CODES
	};
});

// Mock progress tracker to prevent intervals
jest.unstable_mockModule(
	'../../../../../src/progress/parse-prd-tracker.js',
	() => ({
		createParsePrdTracker: jest.fn().mockReturnValue({
			start: jest.fn(),
			stop: jest.fn(),
			cleanup: jest.fn(),
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
const { readJSON, promptYesNo } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateObjectService, streamObjectService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

const { JSONParser } = await import('@streamparser/json');

const { parseStream, StreamingError, STREAMING_ERROR_CODES } = await import(
	'../../../../../src/utils/stream-parser.js'
);

const { createParsePrdTracker } = await import(
	'../../../../../src/progress/parse-prd-tracker.js'
);

const { displayParsePrdStart, displayParsePrdSummary } = await import(
	'../../../../../src/ui/parse-prd.js'
);

// Note: getDefaultNumTasks validation happens at CLI/MCP level, not in the main parse-prd module
const generateTaskFiles = (
	await import(
		'../../../../../scripts/modules/task-manager/generate-task-files.js'
	)
).default;

const fs = await import('fs');
const path = await import('path');

// Import the module under test
const { default: parsePRD } = await import(
	'../../../../../scripts/modules/task-manager/parse-prd/parse-prd.js'
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
			mainResult: sampleClaudeResponse,
			telemetryData: {}
		});
		// Reset streamObjectService mock to working implementation
		streamObjectService.mockImplementation(async () => {
			return {
				mainResult: {
					get partialObjectStream() {
						return (async function* () {
							yield { tasks: [] };
							yield { tasks: [sampleClaudeResponse.tasks[0]] };
							yield {
								tasks: [
									sampleClaudeResponse.tasks[0],
									sampleClaudeResponse.tasks[1]
								]
							};
							yield sampleClaudeResponse;
						})();
					},
					usage: Promise.resolve({
						promptTokens: 100,
						completionTokens: 200,
						totalTokens: 300
					}),
					object: Promise.resolve(sampleClaudeResponse)
				},
				providerName: 'anthropic',
				modelId: 'claude-3-5-sonnet-20241022',
				telemetryData: {}
			};
		});
		// generateTaskFiles.mockResolvedValue(undefined);
		promptYesNo.mockResolvedValue(true); // Default to "yes" for confirmation

		// Mock process.exit to prevent actual exit and throw error instead for CLI tests
		jest.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`process.exit was called with code ${code}`);
		});

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
			tag: 'master',
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
			tag: 'master',
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
				tag: 'master',
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
			tag: 'master',
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
			tag: 'master',
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
				tag: 'master',
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

	test('should throw error when tasks in tag exist without force flag in CLI mode', async () => {
		// Setup mocks to simulate tasks.json already exists with tasks in the target tag
		fs.default.existsSync.mockReturnValue(true);
		fs.default.readFileSync.mockReturnValueOnce(
			JSON.stringify(existingTasksData)
		);

		// Call the function without mcpLog (CLI mode) and expect it to throw an error
		// In test environment, process.exit is prevented and error is thrown instead
		await expect(
			parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, { tag: 'master' })
		).rejects.toThrow('process.exit was called with code 1');

		// Verify the file was NOT written
		expect(fs.default.writeFileSync).not.toHaveBeenCalled();
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
			tag: 'master',
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

		// Ensure generateObjectService returns proper tasks
		generateObjectService.mockResolvedValue({
			mainResult: {
				tasks: [
					{
						id: 1,
						title: 'Test Task 1',
						priority: 'high',
						description: 'Test description 1',
						status: 'pending',
						dependencies: []
					},
					{
						id: 2,
						title: 'Test Task 2',
						priority: 'medium',
						description: 'Test description 2',
						status: 'pending',
						dependencies: []
					},
					{
						id: 3,
						title: 'Test Task 3',
						priority: 'low',
						description: 'Test description 3',
						status: 'pending',
						dependencies: []
					}
				]
			},
			telemetryData: {}
		});

		// Call the function with append option
		await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
			tag: 'master',
			append: true
		});

		// Verify prompt was NOT called with append flag
		expect(promptYesNo).not.toHaveBeenCalled();
	});

	describe('Streaming vs Non-Streaming Modes', () => {
		test('should use non-streaming when reportProgress function is provided (streaming disabled)', async () => {
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

			// Call the function with reportProgress - with streaming disabled, should use non-streaming
			const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress
			});

			// With streaming disabled, should use generateObjectService instead
			expect(generateObjectService).toHaveBeenCalled();

			// Verify streamObjectService was NOT called (streaming is disabled)
			expect(streamObjectService).not.toHaveBeenCalled();

			// Verify progress reporting was still called
			expect(mockReportProgress).toHaveBeenCalled();

			// Verify result structure
			expect(result).toEqual({
				success: true,
				tasksPath: 'tasks/tasks.json',
				telemetryData: {}
			});
		});

		test.skip('should fallback to non-streaming when streaming fails with specific errors (streaming disabled)', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock progress reporting function
			const mockReportProgress = jest.fn(() => Promise.resolve());

			// Mock streamObjectService to return a stream that fails during processing
			streamObjectService.mockImplementationOnce(async () => {
				return {
					mainResult: {
						get partialObjectStream() {
							return (async function* () {
								throw new Error('Stream processing failed');
							})();
						},
						usage: Promise.resolve(null),
						object: Promise.resolve(null)
					},
					providerName: 'anthropic',
					modelId: 'claude-3-5-sonnet-20241022',
					telemetryData: {}
				};
			});

			// Ensure generateObjectService returns tasks for fallback
			generateObjectService.mockResolvedValue({
				mainResult: {
					tasks: [
						{
							id: 1,
							title: 'Test Task 1',
							priority: 'high',
							description: 'Test description 1',
							status: 'pending',
							dependencies: []
						},
						{
							id: 2,
							title: 'Test Task 2',
							priority: 'medium',
							description: 'Test description 2',
							status: 'pending',
							dependencies: []
						},
						{
							id: 3,
							title: 'Test Task 3',
							priority: 'low',
							description: 'Test description 3',
							status: 'pending',
							dependencies: []
						}
					]
				},
				telemetryData: {}
			});

			// Call the function with reportProgress to trigger streaming path
			const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress
			});

			// Verify streamObjectService was called first (streaming attempt)
			expect(streamObjectService).toHaveBeenCalled();

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

			// Verify streamObjectService was NOT called (streaming path)
			expect(streamObjectService).not.toHaveBeenCalled();

			// Verify result structure
			expect(result).toEqual({
				success: true,
				tasksPath: 'tasks/tasks.json',
				telemetryData: {}
			});
		});

		test('should handle research flag with non-streaming (streaming disabled)', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock progress reporting function
			const mockReportProgress = jest.fn(() => Promise.resolve());

			// Call with reportProgress + research - with streaming disabled, should use non-streaming
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress,
				research: true
			});

			// With streaming disabled, should use generateObjectService with research role
			expect(generateObjectService).toHaveBeenCalledWith(
				expect.objectContaining({
					role: 'research'
				})
			);
			expect(streamObjectService).not.toHaveBeenCalled();
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
			expect(streamObjectService).not.toHaveBeenCalled();
		});

		test('should use non-streaming for CLI text mode (streaming disabled)', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Call without mcpLog and without reportProgress (CLI text mode)
			const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

			// With streaming disabled, should use generateObjectService even in CLI text mode
			expect(generateObjectService).toHaveBeenCalled();
			expect(streamObjectService).not.toHaveBeenCalled();

			// Progress tracker components may still be called for CLI mode display
			// but the actual parsing uses non-streaming

			expect(result).toEqual({
				success: true,
				tasksPath: 'tasks/tasks.json',
				telemetryData: {}
			});
		});

		test.skip('should handle parseStream with usedFallback flag - needs rewrite for streamObject', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock progress reporting function
			const mockReportProgress = jest.fn(() => Promise.resolve());

			// Mock parseStream to return usedFallback: true
			parseStream.mockResolvedValueOnce({
				items: [{ id: 1, title: 'Test Task', priority: 'high' }],
				accumulatedText:
					'{"tasks":[{"id":1,"title":"Test Task","priority":"high"}]}',
				estimatedTokens: 50,
				usedFallback: true // This triggers fallback reporting
			});

			// Call with streaming
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress
			});

			// Verify that usedFallback scenario was handled
			expect(parseStream).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					jsonPaths: ['$.tasks.*'],
					onProgress: expect.any(Function),
					onError: expect.any(Function),
					estimateTokens: expect.any(Function),
					expectedTotal: 3,
					fallbackItemExtractor: expect.any(Function)
				})
			);
		});

		test.skip('should handle StreamingError types for fallback - needs rewrite for streamObject', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Test different StreamingError types that should trigger fallback
			const streamingErrors = [
				{
					message: 'Stream object is not iterable',
					code: STREAMING_ERROR_CODES.STREAM_NOT_ITERABLE
				},
				{
					message: 'Failed to process AI text stream',
					code: STREAMING_ERROR_CODES.STREAM_PROCESSING_FAILED
				},
				{
					message: 'textStream is not async iterable',
					code: STREAMING_ERROR_CODES.NOT_ASYNC_ITERABLE
				}
			];

			for (const errorConfig of streamingErrors) {
				// Clear mocks for each iteration
				jest.clearAllMocks();

				// Setup mocks again
				fs.default.existsSync.mockImplementation((path) => {
					if (path === 'tasks/tasks.json') return false;
					if (path === 'tasks') return true;
					return false;
				});
				fs.default.readFileSync.mockReturnValue(samplePRDContent);
				generateObjectService.mockResolvedValue({
					mainResult: { object: sampleClaudeResponse },
					telemetryData: {}
				});

				// Mock streamTextService to fail with StreamingError
				const error = new StreamingError(errorConfig.message, errorConfig.code);
				streamTextService.mockRejectedValueOnce(error);

				// Mock progress reporting function
				const mockReportProgress = jest.fn(() => Promise.resolve());

				// Call with streaming (should fallback to non-streaming)
				const result = await parsePRD(
					'path/to/prd.txt',
					'tasks/tasks.json',
					3,
					{
						reportProgress: mockReportProgress
					}
				);

				// Verify streaming was attempted first
				expect(streamTextService).toHaveBeenCalled();

				// Verify fallback to non-streaming occurred
				expect(generateObjectService).toHaveBeenCalled();

				// Verify successful result despite streaming failure
				expect(result).toEqual({
					success: true,
					tasksPath: 'tasks/tasks.json',
					telemetryData: {}
				});
			}
		});

		test.skip('should handle progress tracker integration in CLI streaming mode - needs rewrite for streamObject', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock progress tracker methods
			const mockProgressTracker = {
				start: jest.fn(),
				stop: jest.fn(),
				cleanup: jest.fn(),
				addTaskLine: jest.fn(),
				updateTokens: jest.fn(),
				getSummary: jest.fn().mockReturnValue({
					taskPriorities: { high: 1, medium: 0, low: 0 },
					elapsedTime: 1000,
					actionVerb: 'generated'
				})
			};
			createParsePrdTracker.mockReturnValue(mockProgressTracker);

			// Call in CLI text mode (no mcpLog, no reportProgress)
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3);

			// Verify progress tracker was created and used
			expect(createParsePrdTracker).toHaveBeenCalledWith({
				numUnits: 3,
				unitName: 'task',
				append: false
			});
			expect(mockProgressTracker.start).toHaveBeenCalled();
			expect(mockProgressTracker.cleanup).toHaveBeenCalled();

			// Verify UI display functions were called
			expect(displayParsePrdStart).toHaveBeenCalled();
			expect(displayParsePrdSummary).toHaveBeenCalled();
		});

		test.skip('should handle onProgress callback during streaming - needs rewrite for streamObject', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock progress reporting function
			const mockReportProgress = jest.fn(() => Promise.resolve());

			// Mock parseStream to call onProgress
			parseStream.mockImplementation(async (stream, options) => {
				// Simulate calling onProgress during parsing
				if (options.onProgress) {
					await options.onProgress(
						{ title: 'Test Task', priority: 'high' },
						{ currentCount: 1, estimatedTokens: 50 }
					);
				}
				return {
					items: [{ id: 1, title: 'Test Task', priority: 'high' }],
					accumulatedText:
						'{"tasks":[{"id":1,"title":"Test Task","priority":"high"}]}',
					estimatedTokens: 50,
					usedFallback: false
				};
			});

			// Call with streaming
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
				reportProgress: mockReportProgress
			});

			// Verify parseStream was called with correct onProgress callback
			expect(parseStream).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					onProgress: expect.any(Function)
				})
			);

			// Verify progress was reported during streaming
			expect(mockReportProgress).toHaveBeenCalled();
		});

		test.skip('should not re-throw non-streaming errors during fallback - needs rewrite for streamObject', async () => {
			// Setup mocks to simulate normal conditions
			fs.default.existsSync.mockImplementation((path) => {
				if (path === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (path === 'tasks') return true; // Directory exists
				return false;
			});

			// Mock progress reporting function
			const mockReportProgress = jest.fn(() => Promise.resolve());

			// Mock streamTextService to fail with NON-streaming error
			streamTextService.mockRejectedValueOnce(
				new Error('AI API rate limit exceeded')
			);

			// Call with streaming - should re-throw non-streaming errors
			await expect(
				parsePRD('path/to/prd.txt', 'tasks/tasks.json', 3, {
					reportProgress: mockReportProgress
				})
			).rejects.toThrow('AI API rate limit exceeded');

			// Verify streaming was attempted
			expect(streamTextService).toHaveBeenCalled();

			// Verify fallback was NOT attempted (error was re-thrown)
			expect(generateObjectService).not.toHaveBeenCalled();
		});
	});

	describe('Dynamic Task Generation', () => {
		test('should use dynamic prompting when numTasks is 0', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((p) => {
				if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (p === 'tasks') return true; // Directory exists
				return false;
			});

			// Call the function with numTasks=0 for dynamic generation and mcpLog to force non-streaming mode
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 0, {
				tag: 'master',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify generateObjectService was called
			expect(generateObjectService).toHaveBeenCalled();

			// Get the call arguments to verify the prompt
			const callArgs = generateObjectService.mock.calls[0][0];
			expect(callArgs.prompt).toContain('an appropriate number of');
			expect(callArgs.prompt).not.toContain('approximately 0');
		});

		test('should use specific count prompting when numTasks is positive', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((p) => {
				if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (p === 'tasks') return true; // Directory exists
				return false;
			});

			// Call the function with specific numTasks and mcpLog to force non-streaming mode
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 5, {
				tag: 'master',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify generateObjectService was called
			expect(generateObjectService).toHaveBeenCalled();

			// Get the call arguments to verify the prompt
			const callArgs = generateObjectService.mock.calls[0][0];
			expect(callArgs.prompt).toContain('approximately 5');
			expect(callArgs.prompt).not.toContain('an appropriate number of');
		});

		test('should accept 0 as valid numTasks value', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((p) => {
				if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (p === 'tasks') return true; // Directory exists
				return false;
			});

			// Call the function with numTasks=0 and mcpLog to force non-streaming mode - should not throw error
			const result = await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 0, {
				tag: 'master',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify it completed successfully
			expect(result).toEqual({
				success: true,
				tasksPath: 'tasks/tasks.json',
				telemetryData: {}
			});
		});

		test('should use dynamic prompting when numTasks is negative (no validation in main module)', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((p) => {
				if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (p === 'tasks') return true; // Directory exists
				return false;
			});

			// Call the function with negative numTasks and mcpLog to force non-streaming mode
			// Note: The main parse-prd.js module doesn't validate numTasks - validation happens at CLI/MCP level
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', -5, {
				tag: 'master',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify generateObjectService was called
			expect(generateObjectService).toHaveBeenCalled();
			const callArgs = generateObjectService.mock.calls[0][0];
			// Negative values are treated as <= 0, so should use dynamic prompting
			expect(callArgs.prompt).toContain('an appropriate number of');
			expect(callArgs.prompt).not.toContain('approximately -5');
		});
	});

	describe('Configuration Integration', () => {
		test('should use dynamic prompting when numTasks is null', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((p) => {
				if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (p === 'tasks') return true; // Directory exists
				return false;
			});

			// Call the function with null numTasks and mcpLog to force non-streaming mode
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', null, {
				tag: 'master',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify generateObjectService was called with dynamic prompting
			expect(generateObjectService).toHaveBeenCalled();
			const callArgs = generateObjectService.mock.calls[0][0];
			expect(callArgs.prompt).toContain('an appropriate number of');
		});

		test('should use dynamic prompting when numTasks is invalid string', async () => {
			// Setup mocks to simulate normal conditions (no existing output file)
			fs.default.existsSync.mockImplementation((p) => {
				if (p === 'tasks/tasks.json') return false; // Output file doesn't exist
				if (p === 'tasks') return true; // Directory exists
				return false;
			});

			// Call the function with invalid numTasks (string that's not a number) and mcpLog to force non-streaming mode
			await parsePRD('path/to/prd.txt', 'tasks/tasks.json', 'invalid', {
				tag: 'master',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify generateObjectService was called with dynamic prompting
			// Note: The main module doesn't validate - it just uses the value as-is
			// Since 'invalid' > 0 is false, it uses dynamic prompting
			expect(generateObjectService).toHaveBeenCalled();
			const callArgs = generateObjectService.mock.calls[0][0];
			expect(callArgs.prompt).toContain('an appropriate number of');
		});
	});
});
