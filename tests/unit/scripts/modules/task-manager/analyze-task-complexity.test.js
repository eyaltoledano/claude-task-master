/**
 * Tests for the analyze-task-complexity.js module
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
		debug: false,
		defaultSubtasks: 3
	},
	findTaskById: jest.fn(),
	readComplexityReport: jest.fn(),
	findTaskInComplexityReport: jest.fn(),
	findProjectRoot: jest.fn(() => '/mock/project/root'),
	resolveEnvVariable: jest.fn((varName) => `mock_${varName}`),
	isSilentMode: jest.fn(() => false),
	findCycles: jest.fn(() => []),
	formatTaskId: jest.fn((id) => `Task ${id}`),
	taskExists: jest.fn((tasks, id) => tasks.some((t) => t.id === id)),
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn(),
	truncate: jest.fn((text) => text),
	addComplexityToTask: jest.fn((task, complexity) => ({ ...task, complexity })),
	aggregateTelemetry: jest.fn((telemetryArray) => telemetryArray[0] || {})
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateObjectService: jest.fn().mockResolvedValue({
			mainResult: {
				tasks: []
			},
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: '1234567890',
				commandName: 'analyze-complexity',
				modelUsed: 'claude-3-5-sonnet',
				providerName: 'anthropic',
				inputTokens: 1000,
				outputTokens: 500,
				totalTokens: 1500,
				totalCost: 0.012414,
				currency: 'USD'
			}
		}),
		generateTextService: jest.fn().mockResolvedValue({
			mainResult: '[]',
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: '1234567890',
				commandName: 'analyze-complexity',
				modelUsed: 'claude-3-5-sonnet',
				providerName: 'anthropic',
				inputTokens: 1000,
				outputTokens: 500,
				totalTokens: 1500,
				totalCost: 0.012414,
				currency: 'USD'
			}
		})
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		// Core config access
		getConfig: jest.fn(() => ({
			models: { main: { provider: 'anthropic', modelId: 'claude-3-5-sonnet' } },
			global: { projectName: 'Test Project' }
		})),
		writeConfig: jest.fn(() => true),
		ConfigurationError: class extends Error {},
		isConfigFilePresent: jest.fn(() => true),

		// Validation
		validateProvider: jest.fn(() => true),
		validateProviderModelCombination: jest.fn(() => true),
		VALID_PROVIDERS: ['anthropic', 'openai', 'perplexity'],
		MODEL_MAP: {
			anthropic: [
				{
					id: 'claude-3-5-sonnet',
					cost_per_1m_tokens: { input: 3, output: 15 }
				}
			],
			openai: [{ id: 'gpt-4', cost_per_1m_tokens: { input: 30, output: 60 } }]
		},
		getAvailableModels: jest.fn(() => [
			{
				id: 'claude-3-5-sonnet',
				name: 'Claude 3.5 Sonnet',
				provider: 'anthropic'
			},
			{ id: 'gpt-4', name: 'GPT-4', provider: 'openai' }
		]),

		// Role-specific getters
		getMainProvider: jest.fn(() => 'anthropic'),
		getMainModelId: jest.fn(() => 'claude-3-5-sonnet'),
		getMainMaxTokens: jest.fn(() => 4000),
		getMainTemperature: jest.fn(() => 0.7),
		getResearchProvider: jest.fn(() => 'perplexity'),
		getResearchModelId: jest.fn(() => 'sonar-pro'),
		getResearchMaxTokens: jest.fn(() => 8700),
		getResearchTemperature: jest.fn(() => 0.1),
		getFallbackProvider: jest.fn(() => 'anthropic'),
		getFallbackModelId: jest.fn(() => 'claude-3-5-sonnet'),
		getFallbackMaxTokens: jest.fn(() => 4000),
		getFallbackTemperature: jest.fn(() => 0.7),
		getBaseUrlForRole: jest.fn(() => undefined),

		// Global setting getters
		getLogLevel: jest.fn(() => 'info'),
		getDebugFlag: jest.fn(() => false),
		getDefaultNumTasks: jest.fn(() => 10),
		getDefaultSubtasks: jest.fn(() => 5),
		getDefaultPriority: jest.fn(() => 'medium'),
		getProjectName: jest.fn(() => 'Test Project'),
		getOllamaBaseURL: jest.fn(() => 'http://localhost:11434/api'),
		getAzureBaseURL: jest.fn(() => undefined),
		getBedrockBaseURL: jest.fn(() => undefined),
		getParametersForRole: jest.fn(() => ({
			maxTokens: 4000,
			temperature: 0.7
		})),
		getUserId: jest.fn(() => '1234567890'),

		// API Key Checkers
		isApiKeySet: jest.fn(() => true),
		getMcpApiKeyStatus: jest.fn(() => true),

		// Additional functions
		getAllProviders: jest.fn(() => ['anthropic', 'openai', 'perplexity']),
		getVertexProjectId: jest.fn(() => undefined),
		getVertexLocation: jest.fn(() => undefined)
	})
);

// Import the mocked modules
const { readJSON, writeJSON, log, CONFIG } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateObjectService, generateTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

// Import the module under test
const { default: analyzeTaskComplexity } = await import(
	'../../../../../scripts/modules/task-manager/analyze-task-complexity.js'
);

describe('analyzeTaskComplexity', () => {
	// Sample response structure (simplified for these tests)
	const sampleApiResponse = {
		mainResult: JSON.stringify([
			{ taskId: 1, taskTitle: 'Task 1', complexityScore: 3, recommendedSubtasks: 2, expansionPrompt: 'Break down authentication', reasoning: 'Simple task' },
			{ taskId: 2, taskTitle: 'Task 2', complexityScore: 7, recommendedSubtasks: 5, expansionPrompt: 'Break down database', reasoning: 'Complex task' }
		]),
		telemetryData: {
			timestamp: new Date().toISOString(),
			userId: '1234567890',
			commandName: 'analyze-complexity',
			modelUsed: 'claude-3-5-sonnet',
			providerName: 'anthropic',
			inputTokens: 1000,
			outputTokens: 500,
			totalTokens: 1500,
			totalCost: 0.012414,
			currency: 'USD'
		}
	};

	const sampleTasks = {
		meta: { projectName: 'Test Project' },
		tasks: [
			{
				id: 1,
				title: 'Task 1',
				description: 'First task description',
				status: 'pending',
				dependencies: [],
				priority: 'high'
			},
			{
				id: 2,
				title: 'Task 2',
				description: 'Second task description',
				status: 'pending',
				dependencies: [1],
				priority: 'medium'
			},
			{
				id: 3,
				title: 'Task 3',
				description: 'Third task description',
				status: 'done',
				dependencies: [1, 2],
				priority: 'high'
			},
			{
				id: 4,
				title: 'Task 4',
				description: 'Fourth task description',
				status: 'blocked',
				dependencies: [],
				priority: 'low'
			},
			{
				id: 5,
				title: 'Task 5',
				description: 'Fifth task description',
				status: 'in-progress',
				dependencies: [1],
				priority: 'high'
			}
		]
	};

	// Create a helper function for consistent mcpLog mock
	const createMcpLogMock = () => ({
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		success: jest.fn()
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock implementations
		readJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks)));
		generateTextService.mockResolvedValue(sampleApiResponse);

		// Mock console.log to avoid output during tests
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		console.log.mockRestore();
	});

	test('should call generateTextService with the correct parameters', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5',
			research: false
		};
		const mcpLog = createMcpLogMock();

		// Act
		const result = await analyzeTaskComplexity(options, { mcpLog });

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json');
		expect(generateTextService).toHaveBeenCalledWith(
			expect.objectContaining({
				role: 'main',
				prompt: expect.stringContaining('Analyze the following tasks'),
				commandName: 'analyze-complexity',
				outputType: 'mcp'
			})
		);
		expect(writeJSON).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.objectContaining({
				meta: expect.objectContaining({
					thresholdScore: 5,
					projectName: 'Test Project'
				}),
				complexityAnalysis: expect.any(Array)
			})
		);
		
		// Should return telemetry data
		expect(result).toEqual(
			expect.objectContaining({
				telemetryData: sampleApiResponse.telemetryData
			})
		);
	});

	test('should use research flag to determine which AI service to use', async () => {
		// Arrange
		const researchOptions = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5',
			research: true
		};
		const mcpLog = createMcpLogMock();

		// Act
		await analyzeTaskComplexity(researchOptions, { mcpLog });

		// Assert
		expect(generateTextService).toHaveBeenCalledWith(
			expect.objectContaining({
				role: 'research'
			})
		);
	});

	test('should handle different threshold parameter types correctly', async () => {
		// Test with string threshold
		let options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '7'
		};
		const mcpLog = createMcpLogMock();

		await analyzeTaskComplexity(options, { mcpLog });

		expect(writeJSON).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.objectContaining({
				meta: expect.objectContaining({
					thresholdScore: 7
				})
			})
		);

		// Reset mocks
		jest.clearAllMocks();
		readJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks)));
		generateTextService.mockResolvedValue(sampleApiResponse);

		// Test with number threshold
		options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: 8
		};

		await analyzeTaskComplexity(options, { mcpLog });

		expect(writeJSON).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.objectContaining({
				meta: expect.objectContaining({
					thresholdScore: 8
				})
			})
		);
	});

	test('should filter out completed tasks from analysis', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};
		const mcpLog = createMcpLogMock();

		// Act
		await analyzeTaskComplexity(options, { mcpLog });

		// Assert
		// Check that only active tasks (pending, blocked, in-progress) are included
		const callArgs = generateTextService.mock.calls[0][0];
		expect(callArgs.prompt).not.toContain('"id": 3'); // 'done' task should be filtered out
		expect(callArgs.prompt).toContain('"id": 1'); // 'pending' task should be included
		expect(callArgs.prompt).toContain('"id": 2'); // 'pending' task should be included
		expect(callArgs.prompt).toContain('"id": 4'); // 'blocked' task should be included
		expect(callArgs.prompt).toContain('"id": 5'); // 'in-progress' task should be included
	});

	test('should filter tasks by specific IDs when provided', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5',
			id: '1,2'
		};
		const mcpLog = createMcpLogMock();

		// Act
		await analyzeTaskComplexity(options, { mcpLog });

		// Assert
		const callArgs = generateTextService.mock.calls[0][0];
		expect(callArgs.prompt).toContain('"id": 1');
		expect(callArgs.prompt).toContain('"id": 2');
		expect(callArgs.prompt).not.toContain('"id": 4');
		expect(callArgs.prompt).not.toContain('"id": 5');
	});

	test('should filter tasks by ID range when provided', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5',
			from: 2,
			to: 4
		};
		const mcpLog = createMcpLogMock();

		// Act
		await analyzeTaskComplexity(options, { mcpLog });

		// Assert
		const callArgs = generateTextService.mock.calls[0][0];
		expect(callArgs.prompt).not.toContain('"id": 1'); // Below range
		expect(callArgs.prompt).toContain('"id": 2'); // In range
		expect(callArgs.prompt).toContain('"id": 4'); // In range
		expect(callArgs.prompt).not.toContain('"id": 5'); // Above range
	});

	test('should handle empty task list gracefully', async () => {
		// Arrange
		const emptyTasks = { meta: { projectName: 'Test Project' }, tasks: [] };
		readJSON.mockReturnValue(emptyTasks);
		
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};
		const mcpLog = createMcpLogMock();

		// Act & Assert
		await expect(analyzeTaskComplexity(options, { mcpLog }))
			.rejects.toThrow('No tasks found in the tasks file');
	});

	test('should handle invalid JSON response from AI', async () => {
		// Arrange
		const invalidApiResponse = {
			...sampleApiResponse,
			mainResult: 'invalid json'
		};
		generateTextService.mockResolvedValue(invalidApiResponse);
		
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};
		const mcpLog = createMcpLogMock();

		// Act & Assert
		await expect(analyzeTaskComplexity(options, { mcpLog }))
			.rejects.toThrow();
	});

	test('should handle API errors gracefully', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};

		// Force API error
		generateTextService.mockRejectedValueOnce(new Error('API Error'));

		const mockMcpLog = createMcpLogMock();

		// Act & Assert
		await expect(
			analyzeTaskComplexity(options, {
				mcpLog: mockMcpLog
			})
		).rejects.toThrow('API Error');

		// Check that the error was logged via mcpLog
		expect(mockMcpLog.error).toHaveBeenCalledWith(
			expect.stringContaining('API Error')
		);
	});

	test('should use default file paths when not specified', async () => {
		// Arrange
		const options = {
			threshold: '5'
		};
		const mcpLog = createMcpLogMock();

		// Act
		await analyzeTaskComplexity(options, { mcpLog });

		// Assert
		expect(readJSON).toHaveBeenCalledWith('tasks/tasks.json'); // LEGACY_TASKS_FILE
		expect(writeJSON).toHaveBeenCalledWith(
			expect.stringContaining('task-complexity-report.json'), // COMPLEXITY_REPORT_FILE
			expect.any(Object)
		);
	});

	test('should handle CLI output format correctly', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};

		// Act without mcpLog (CLI mode)
		const result = await analyzeTaskComplexity(options, {});

		// Assert
		expect(generateTextService).toHaveBeenCalledWith(
			expect.objectContaining({
				outputType: 'cli'
			})
		);
		expect(result).toEqual(
			expect.objectContaining({
				telemetryData: sampleApiResponse.telemetryData
			})
		);
	});

	test('should handle missing project name in metadata', async () => {
		// Arrange
		const tasksWithoutProjectName = {
			meta: {}, // No projectName
			tasks: sampleTasks.tasks
		};
		readJSON.mockReturnValue(tasksWithoutProjectName);

		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};
		const mcpLog = createMcpLogMock();

		// Act
		await analyzeTaskComplexity(options, { mcpLog });

		// Assert
		expect(writeJSON).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.objectContaining({
				meta: expect.objectContaining({
					projectName: expect.any(String) // Should have a fallback value
				})
			})
		);
	});

	test('should handle task filtering with no matching active tasks', async () => {
		// Arrange
		const tasksAllCompleted = {
			meta: { projectName: 'Test Project' },
			tasks: [
				{ id: 1, title: 'Task 1', status: 'done' },
				{ id: 2, title: 'Task 2', status: 'cancelled' }
			]
		};
		readJSON.mockReturnValue(tasksAllCompleted);

		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};
		const mcpLog = createMcpLogMock();

		// Act
		const result = await analyzeTaskComplexity(options, { mcpLog });

		// Assert - should handle gracefully even with no active tasks
		expect(result).toEqual(
			expect.objectContaining({
				report: expect.objectContaining({
					meta: expect.objectContaining({
						projectName: 'Test Project',
						tasksAnalyzed: 0
					}),
					complexityAnalysis: []
				}),
				telemetryData: null // No AI call made when no active tasks
			})
		);

		// Verify that generateTextService was not called since no active tasks
		expect(generateTextService).not.toHaveBeenCalled();
	});
});
