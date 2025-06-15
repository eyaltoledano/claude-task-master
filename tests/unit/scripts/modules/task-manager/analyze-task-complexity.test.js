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
	aggregateTelemetry: jest.fn((telemetryArray) => telemetryArray[0] || {}),
	ensureTagMetadata: jest.fn((tagObj) => tagObj),
	getCurrentTag: jest.fn(() => 'master'),
	flattenTasksWithSubtasks: jest.fn((tasks) => tasks),
	markMigrationForNotice: jest.fn(),
	performCompleteTagMigration: jest.fn(),
	setTasksForTag: jest.fn(),
	getTasksForTag: jest.fn((data, tag) => data[tag]?.tasks || [])
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

// Mock fs module
const mockWriteFileSync = jest.fn();
jest.unstable_mockModule('fs', () => ({
	default: {
		existsSync: jest.fn(() => false),
		readFileSync: jest.fn(),
		writeFileSync: mockWriteFileSync
	},
	existsSync: jest.fn(() => false),
	readFileSync: jest.fn(),
	writeFileSync: mockWriteFileSync
}));

// Import the mocked modules
const { readJSON, writeJSON, log, CONFIG } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateObjectService, generateTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

const fs = await import('fs');

// Import the module under test
const { default: analyzeTaskComplexity } = await import(
	'../../../../../scripts/modules/task-manager/analyze-task-complexity.js'
);

describe('analyzeTaskComplexity', () => {
	// Sample response structure (simplified for these tests)
	const sampleApiResponse = {
		mainResult: JSON.stringify({
			tasks: [
				{ id: 1, complexity: 3, subtaskCount: 2 },
				{ id: 2, complexity: 7, subtaskCount: 5 },
				{ id: 3, complexity: 9, subtaskCount: 8 }
			]
		}),
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
		master: {
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
				}
			]
		}
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock implementations - readJSON should return the resolved view with tasks at top level
		readJSON.mockImplementation((tasksPath, projectRoot, tag) => {
			return {
				...sampleTasks.master,
				tag: tag || 'master',
				_rawTaggedData: sampleTasks
			};
		});
		generateTextService.mockResolvedValue(sampleApiResponse);
	});

	test('should call generateTextService with the correct parameters', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5',
			research: false
		};

		// Act
		await analyzeTaskComplexity(options, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Assert
		expect(readJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			undefined,
			undefined
		);
		expect(generateTextService).toHaveBeenCalledWith(expect.any(Object));
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.stringContaining('"thresholdScore": 5'),
			'utf8'
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

		// Act
		await analyzeTaskComplexity(researchOptions, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Assert
		expect(generateTextService).toHaveBeenCalledWith(
			expect.objectContaining({
				role: 'research' // This should be present when research is true
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

		await analyzeTaskComplexity(options, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		expect(mockWriteFileSync).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.stringContaining('"thresholdScore": 7'),
			'utf8'
		);

		// Reset mocks
		jest.clearAllMocks();

		// Test with number threshold
		options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: 8
		};

		await analyzeTaskComplexity(options, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		expect(mockWriteFileSync).toHaveBeenCalledWith(
			'scripts/task-complexity-report.json',
			expect.stringContaining('"thresholdScore": 8'),
			'utf8'
		);
	});

	test('should filter out completed tasks from analysis', async () => {
		// Arrange
		const options = {
			file: 'tasks/tasks.json',
			output: 'scripts/task-complexity-report.json',
			threshold: '5'
		};

		// Act
		await analyzeTaskComplexity(options, {
			mcpLog: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			}
		});

		// Assert
		// Check if the prompt sent to AI doesn't include the completed task (id: 3)
		expect(generateTextService).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.not.stringContaining('"id": 3')
			})
		);
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

		const mockMcpLog = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			success: jest.fn()
		};

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
});
