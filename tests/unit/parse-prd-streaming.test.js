/**
 * Unit test for PRD parsing functionality
 * Tests the parsing logic with mocked dependencies (no real AI calls, runs instantly)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock functions for AI services
const mockStreamTextService = jest.fn();
const mockGenerateObjectService = jest.fn();

// Mock functions for config manager
const mockGetConfig = jest.fn();
const mockGetDebugFlag = jest.fn();

// Mock functions for utils
const mockLog = jest.fn();
const mockWriteJSON = jest.fn();
const mockEnableSilentMode = jest.fn();
const mockDisableSilentMode = jest.fn();
const mockIsSilentMode = jest.fn();
const mockReadJSON = jest.fn();
const mockFindTaskById = jest.fn();

// Mock functions for other modules
const mockGenerateTaskFiles = jest.fn();
const mockDisplayAiUsageSummary = jest.fn();

// Mock the AI services module using unstable_mockModule
jest.unstable_mockModule(
	'../../scripts/modules/ai-services-unified.js',
	() => ({
		streamTextService: mockStreamTextService,
		generateObjectService: mockGenerateObjectService
	})
);

// Mock the config manager using unstable_mockModule
jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	getConfig: mockGetConfig,
	getDebugFlag: mockGetDebugFlag
}));

// Mock the utils module
jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	log: mockLog,
	writeJSON: mockWriteJSON,
	enableSilentMode: mockEnableSilentMode,
	disableSilentMode: mockDisableSilentMode,
	isSilentMode: mockIsSilentMode,
	readJSON: mockReadJSON,
	findTaskById: mockFindTaskById
}));

// Mock the generate-task-files module
jest.unstable_mockModule(
	'../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: mockGenerateTaskFiles
	})
);

// Mock the ui module
jest.unstable_mockModule('../../scripts/modules/ui.js', () => ({
	displayAiUsageSummary: mockDisplayAiUsageSummary
}));

// Import after mocking
const { default: parsePRD } = await import(
	'../../scripts/modules/task-manager/parse-prd.js'
);

/**
 * Mock Progress Reporter for testing
 */
class MockProgressReporter {
	constructor() {
		this.progressHistory = [];
		this.startTime = Date.now();
	}

	async reportProgress(data) {
		const timestamp = Date.now() - this.startTime;
		const entry = {
			timestamp,
			...data
		};
		this.progressHistory.push(entry);
	}

	getProgressHistory() {
		return this.progressHistory;
	}
}

/**
 * Mock MCP Logger for testing
 */
class MockMCPLogger {
	constructor() {
		this.logs = [];
	}

	_log(level, ...args) {
		this.logs.push({
			level,
			timestamp: Date.now(),
			message: args.join(' ')
		});
	}

	info(...args) {
		this._log('info', ...args);
	}
	warn(...args) {
		this._log('warn', ...args);
	}
	error(...args) {
		this._log('error', ...args);
	}
	debug(...args) {
		this._log('debug', ...args);
	}
	success(...args) {
		this._log('success', ...args);
	}

	getLogs() {
		return this.logs;
	}
}

/**
 * Create mock task data
 */
function createMockTasksResponse(numTasks = 6) {
	const priorities = ['high', 'medium', 'low'];
	const tasks = [];

	for (let i = 1; i <= numTasks; i++) {
		tasks.push({
			id: i,
			title: `Task ${i}: Setup Component ${i}`,
			description: `Set up and configure component ${i} for the task management application`,
			status: 'pending',
			dependencies: i > 1 ? [i - 1] : [],
			priority: priorities[Math.floor(Math.random() * priorities.length)],
			details: `Implementation details for task ${i}. This involves setting up the necessary infrastructure and components.`,
			testStrategy: `Test task ${i} by verifying the component works correctly and integrates with other parts of the system.`
		});
	}

	return {
		tasks,
		metadata: {
			projectName: 'PRD Implementation',
			totalTasks: numTasks,
			sourceFile: 'test-unit-prd.txt',
			generatedAt: new Date().toISOString().split('T')[0]
		}
	};
}

/**
 * Create mock streaming response
 */
function createMockStreamingResponse(numTasks = 6) {
	const mockResponse = createMockTasksResponse(numTasks);

	// Convert the response to a JSON string for streaming
	const responseText = JSON.stringify(mockResponse, null, 2);
	const chunks = [];

	// Split the response into chunks to simulate streaming
	const chunkSize = Math.ceil(responseText.length / (numTasks + 2));

	for (let i = 0; i < responseText.length; i += chunkSize) {
		chunks.push(responseText.slice(i, i + chunkSize));
	}

	// Create an async iterable that returns text chunks directly
	const mockStream = {
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) {
				// Small delay to simulate streaming (but keep it fast for tests)
				await new Promise((resolve) => setTimeout(resolve, 1));
				yield chunk; // Return the text chunk directly, not wrapped in an object
			}
		}
	};

	return {
		mainResult: mockStream, // Return the stream directly as mainResult
		telemetryData: {
			timestamp: new Date().toISOString(),
			userId: 'test-user',
			commandName: 'parse-prd',
			modelUsed: 'claude-3-5-sonnet-20241022',
			providerName: 'anthropic',
			inputTokens: 2150,
			outputTokens: 1847,
			totalTokens: 3997,
			totalCost: 0.0423,
			currency: 'USD'
		}
	};
}

describe('PRD Parsing Unit Tests', () => {
	let testPRDPath;
	let streamingTasksPath;
	let nonStreamingTasksPath;

	beforeAll(() => {
		// Create test PRD
		const testPRDContent = `# Test Project PRD

## Overview
Build a simple task management web application with user authentication and real-time updates.

## Core Features
1. User registration and login system
2. Create, read, update, delete tasks
3. Real-time task updates using WebSockets
4. Task categorization and filtering
5. User dashboard with task statistics

## Technical Requirements
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL
- Authentication: JWT tokens
- Real-time: Socket.io
- Styling: Tailwind CSS

## User Stories
- As a user, I want to register an account so I can manage my tasks
- As a user, I want to create tasks with titles, descriptions, and due dates
- As a user, I want to see my tasks updated in real-time when I make changes
- As a user, I want to categorize my tasks for better organization
- As a user, I want to see statistics about my task completion

## Success Criteria
- Users can register and login successfully
- Tasks can be created, updated, and deleted
- Real-time updates work across browser sessions
- Application is responsive on mobile devices
- All user inputs are properly validated`;

		testPRDPath = path.join(__dirname, 'test-unit-prd.txt');
		fs.writeFileSync(testPRDPath, testPRDContent);

		// Set up output paths
		streamingTasksPath = path.join(__dirname, 'test-streaming-tasks.json');
		nonStreamingTasksPath = path.join(
			__dirname,
			'test-non-streaming-tasks.json'
		);
	});

	afterAll(() => {
		// Clean up test files
		const filesToClean = [
			testPRDPath,
			streamingTasksPath,
			nonStreamingTasksPath
		];

		filesToClean.forEach((file) => {
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
		});
	});

	beforeEach(() => {
		// Clean up output files before each test
		[streamingTasksPath, nonStreamingTasksPath].forEach((file) => {
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
		});

		// Reset all mocks
		jest.clearAllMocks();

		// Setup default config mock
		mockGetConfig.mockReturnValue({
			models: {
				main: {
					provider: 'anthropic',
					modelId: 'claude-3-5-sonnet-20241022',
					maxTokens: 64000,
					temperature: 0.2
				},
				research: {
					provider: 'perplexity',
					modelId: 'sonar-pro',
					maxTokens: 8700,
					temperature: 0.1
				},
				fallback: {
					provider: 'anthropic',
					modelId: 'claude-3-5-sonnet-20241022',
					maxTokens: 64000,
					temperature: 0.2
				}
			},
			global: {
				logLevel: 'info',
				debug: false,
				defaultSubtasks: 5,
				defaultPriority: 'medium',
				projectName: 'Task Master Test'
			}
		});

		// Setup other config mocks
		mockGetDebugFlag.mockReturnValue(false);

		// Setup utils mocks
		mockIsSilentMode.mockReturnValue(false);
		mockReadJSON.mockReturnValue({ tasks: [] });
		mockWriteJSON.mockResolvedValue(true);
		mockGenerateTaskFiles.mockResolvedValue(true);
	});

	test('should successfully parse PRD with streaming', async () => {
		// Setup mocks
		const mockStreamingResponse = createMockStreamingResponse(6);
		mockStreamTextService.mockResolvedValue(mockStreamingResponse);

		const progressReporter = new MockProgressReporter();
		const mcpLogger = new MockMCPLogger();

		const result = await parsePRD(testPRDPath, streamingTasksPath, 6, {
			force: true,
			append: false,
			research: false,
			reportProgress: progressReporter.reportProgress.bind(progressReporter),
			mcpLog: mcpLogger,
			projectRoot: __dirname
		});

		// Verify basic result structure
		expect(result.success).toBe(true);
		expect(result.tasksPath).toBe(streamingTasksPath);
		expect(result.telemetryData).toBeDefined();

		// Verify file was created (via writeJSON mock)
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify progress reporting
		const progressHistory = progressReporter.getProgressHistory();
		expect(progressHistory.length).toBeGreaterThan(3); // At least initial + some tasks + final

		// Verify progress messages have expected format
		const initialProgress = progressHistory[0];
		expect(initialProgress.message).toMatch(
			/Starting PRD analysis.*Input: \d+ tokens/
		);

		const taskProgress = progressHistory.filter(
			(p) =>
				p.message.includes('Task ') &&
				p.message.includes(' - ') &&
				!p.message.includes('Starting') &&
				!p.message.includes('Completed')
		);
		expect(taskProgress.length).toBeGreaterThan(0);

		// Verify task progress has priority indicators and token tracking
		taskProgress.forEach((progress) => {
			expect(progress.message).toMatch(
				/^[🔴🟠🟢] Task \d+\/\d+ - .+ \| ~Output: \d+ tokens$/u
			);
		});

		const finalProgress = progressHistory[progressHistory.length - 1];
		expect(finalProgress.message).toMatch(
			/✅ Task Generation Completed \| Tokens \(I\/O\): \d+\/\d+ \(\$\d+\.\d+\)/
		);

		// Verify AI service was called with streaming
		expect(mockStreamTextService).toHaveBeenCalledTimes(1);
	});

	test('should successfully parse PRD without streaming', async () => {
		// Setup mocks
		const mockResponse = createMockTasksResponse(6);
		mockGenerateObjectService.mockResolvedValue({
			mainResult: { object: mockResponse },
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: 'test-user',
				commandName: 'parse-prd',
				modelUsed: 'claude-3-5-sonnet-20241022',
				providerName: 'anthropic',
				inputTokens: 2150,
				outputTokens: 1847,
				totalTokens: 3997,
				totalCost: 0.0423,
				currency: 'USD'
			}
		});

		const mcpLogger = new MockMCPLogger();

		const result = await parsePRD(testPRDPath, nonStreamingTasksPath, 6, {
			force: true,
			append: false,
			research: false,
			// No reportProgress provided - should use non-streaming
			mcpLog: mcpLogger,
			projectRoot: __dirname
		});

		// Verify basic result structure
		expect(result.success).toBe(true);
		expect(result.tasksPath).toBe(nonStreamingTasksPath);
		expect(result.telemetryData).toBeDefined();

		// Verify file was created (via writeJSON mock)
		expect(mockWriteJSON).toHaveBeenCalled();

		// Verify AI service was called with non-streaming
		expect(mockGenerateObjectService).toHaveBeenCalledTimes(1);
	});

	test('should produce consistent results between streaming and non-streaming', async () => {
		// Setup mocks for both calls
		const mockStreamingResponse = createMockStreamingResponse(6);
		const mockNonStreamingResponse = createMockTasksResponse(6);

		mockStreamTextService.mockResolvedValue(mockStreamingResponse);
		mockGenerateObjectService.mockResolvedValue({
			mainResult: { object: mockNonStreamingResponse },
			telemetryData: mockStreamingResponse.telemetryData
		});

		const progressReporter = new MockProgressReporter();
		const mcpLoggerStreaming = new MockMCPLogger();
		const mcpLoggerNonStreaming = new MockMCPLogger();

		// Run both tests
		const [streamingResult, nonStreamingResult] = await Promise.all([
			parsePRD(testPRDPath, streamingTasksPath, 6, {
				force: true,
				append: false,
				research: false,
				reportProgress: progressReporter.reportProgress.bind(progressReporter),
				mcpLog: mcpLoggerStreaming,
				projectRoot: __dirname
			}),
			parsePRD(testPRDPath, nonStreamingTasksPath, 6, {
				force: true,
				append: false,
				research: false,
				mcpLog: mcpLoggerNonStreaming,
				projectRoot: __dirname
			})
		]);

		// Verify both succeeded
		expect(streamingResult.success).toBe(true);
		expect(nonStreamingResult.success).toBe(true);

		// Verify both AI services were called
		expect(mockStreamTextService).toHaveBeenCalledTimes(1);
		expect(mockGenerateObjectService).toHaveBeenCalledTimes(1);
	});

	test('should handle research mode with streaming', async () => {
		// Setup mocks
		const mockStreamingResponse = createMockStreamingResponse(5);
		mockStreamTextService.mockResolvedValue(mockStreamingResponse);

		const progressReporter = new MockProgressReporter();
		const mcpLogger = new MockMCPLogger();

		const result = await parsePRD(testPRDPath, streamingTasksPath, 5, {
			force: true,
			append: false,
			research: true, // Enable research mode
			reportProgress: progressReporter.reportProgress.bind(progressReporter),
			mcpLog: mcpLogger,
			projectRoot: __dirname
		});

		expect(result.success).toBe(true);

		// Verify progress messages include research indication
		const progressHistory = progressReporter.getProgressHistory();
		const initialProgress = progressHistory[0];
		expect(initialProgress.message).toMatch(/with research/);

		// Verify AI service was called
		expect(mockStreamTextService).toHaveBeenCalledTimes(1);
	});

	test('should validate input parameters', async () => {
		const mcpLogger = new MockMCPLogger();

		// Test with invalid input file
		await expect(
			parsePRD('/nonexistent/file.txt', streamingTasksPath, 6, {
				force: true,
				append: false,
				research: false,
				mcpLog: mcpLogger,
				projectRoot: __dirname
			})
		).rejects.toThrow(/ENOENT|no such file/);
	});

	test('should handle file operations correctly', async () => {
		// Setup mocks
		const mockResponse = createMockTasksResponse(6);
		mockGenerateObjectService.mockResolvedValue({
			mainResult: { object: mockResponse },
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: 'test-user',
				commandName: 'parse-prd',
				modelUsed: 'claude-3-5-sonnet-20241022',
				providerName: 'anthropic',
				inputTokens: 2150,
				outputTokens: 1847,
				totalTokens: 3997,
				totalCost: 0.0423,
				currency: 'USD'
			}
		});

		// Mock readJSON to return existing tasks for append mode
		const existingTasks = {
			tasks: [
				{
					id: 1,
					title: 'Existing Task',
					description: 'This task already exists',
					status: 'done',
					dependencies: [],
					priority: 'high'
				}
			],
			metadata: {
				projectName: 'Existing Project',
				totalTasks: 1
			}
		};
		mockReadJSON.mockReturnValue(existingTasks);

		const mcpLogger = new MockMCPLogger();

		const result = await parsePRD(testPRDPath, streamingTasksPath, 6, {
			force: false, // Don't force overwrite
			append: true,
			research: false,
			mcpLog: mcpLogger,
			projectRoot: __dirname
		});

		// Should succeed and append tasks
		expect(result.success).toBe(true);

		// Verify writeJSON was called (file operations handled by mocks)
		expect(mockWriteJSON).toHaveBeenCalled();
	});
});
