/**
 * Tests for the expand-task.js module
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import {
	createGetTagAwareFilePathMock,
	createSlugifyTagForFilePathMock
} from './setup.js';

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
	findTaskById: jest.fn(),
	findProjectRoot: jest.fn((tasksPath) => '/mock/project/root'),
	getCurrentTag: jest.fn(() => 'master'),
	ensureTagMetadata: jest.fn((tagObj) => tagObj),
	flattenTasksWithSubtasks: jest.fn((tasks) => {
		const allTasks = [];
		const queue = [...(tasks || [])];
		while (queue.length > 0) {
			const task = queue.shift();
			allTasks.push(task);
			if (task.subtasks) {
				for (const subtask of task.subtasks) {
					queue.push({ ...subtask, id: `${task.id}.${subtask.id}` });
				}
			}
		}
		return allTasks;
	}),
	getTagAwareFilePath: createGetTagAwareFilePathMock(),
	slugifyTagForFilePath: createSlugifyTagForFilePathMock(),
	readComplexityReport: jest.fn(),
	markMigrationForNotice: jest.fn(),
	performCompleteTagMigration: jest.fn(),
	setTasksForTag: jest.fn(),
	getTasksForTag: jest.fn((data, tag) => data[tag]?.tasks || [])
}));

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn(),
	getStatusWithColor: jest.fn((status) => status),
	startLoadingIndicator: jest.fn(),
	stopLoadingIndicator: jest.fn(),
	succeedLoadingIndicator: jest.fn(),
	failLoadingIndicator: jest.fn(),
	warnLoadingIndicator: jest.fn(),
	infoLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn(),
	displayContextAnalysis: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateTextService: jest.fn().mockResolvedValue({
			mainResult: JSON.stringify({
				subtasks: [
					{
						id: 1,
						title: 'Set up project structure',
						description:
							'Create the basic project directory structure and configuration files',
						dependencies: [],
						details:
							'Initialize package.json, create src/ and test/ directories, set up linting configuration',
						status: 'pending',
						testStrategy:
							'Verify all expected files and directories are created'
					},
					{
						id: 2,
						title: 'Implement core functionality',
						description: 'Develop the main application logic and core features',
						dependencies: [1],
						details:
							'Create main classes, implement business logic, set up data models',
						status: 'pending',
						testStrategy: 'Unit tests for all core functions and classes'
					},
					{
						id: 3,
						title: 'Add user interface',
						description: 'Create the user interface components and layouts',
						dependencies: [2],
						details:
							'Design UI components, implement responsive layouts, add user interactions',
						status: 'pending',
						testStrategy: 'UI tests and visual regression testing'
					}
				]
			}),
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: '1234567890',
				commandName: 'expand-task',
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
		getDefaultSubtasks: jest.fn(() => 3),
		getDebugFlag: jest.fn(() => false),
		getDefaultNumTasks: jest.fn(() => 10),
		getMainProvider: jest.fn(() => 'openai'),
		getResearchProvider: jest.fn(() => 'perplexity'),
		hasCodebaseAnalysis: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => ({
		ContextGatherer: jest.fn().mockImplementation(() => ({
			gather: jest.fn().mockResolvedValue({
				context: 'Mock project context from files'
			})
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/fuzzyTaskSearch.js',
	() => ({
		FuzzyTaskSearch: jest.fn().mockImplementation(() => ({
			findRelevantTasks: jest.fn().mockReturnValue([]),
			getTaskIds: jest.fn().mockReturnValue([])
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/prompt-manager.js',
	() => ({
		getPromptManager: jest.fn().mockReturnValue({
			loadPrompt: jest.fn().mockResolvedValue({
				systemPrompt: 'Mocked system prompt',
				userPrompt: 'Mocked user prompt'
			})
		})
	})
);

// Mock external UI libraries
jest.unstable_mockModule('chalk', () => ({
	default: {
		white: { bold: jest.fn((text) => text) },
		cyan: Object.assign(
			jest.fn((text) => text),
			{
				bold: jest.fn((text) => text)
			}
		),
		green: jest.fn((text) => text),
		yellow: jest.fn((text) => text),
		bold: jest.fn((text) => text)
	}
}));

jest.unstable_mockModule('boxen', () => ({
	default: jest.fn((text) => text)
}));

jest.unstable_mockModule('cli-table3', () => ({
	default: jest.fn().mockImplementation(() => ({
		push: jest.fn(),
		toString: jest.fn(() => 'mocked table')
	}))
}));

// Mock process.exit to prevent Jest worker crashes
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
	throw new Error(`process.exit called with "${code}"`);
});

// Import the mocked modules
const {
	readJSON,
	writeJSON,
	log,
	findTaskById,
	ensureTagMetadata,
	readComplexityReport,
	findProjectRoot
} = await import('../../../../../scripts/modules/utils.js');

const { generateTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

const generateTaskFiles = (
	await import(
		'../../../../../scripts/modules/task-manager/generate-task-files.js'
	)
).default;

const { getDefaultSubtasks } = await import(
	'../../../../../scripts/modules/config-manager.js'
);

// Import the module under test
const { default: expandTask } = await import(
	'../../../../../scripts/modules/task-manager/expand-task.js'
);

describe('expandTask', () => {
	const sampleTasks = {
		master: {
			tasks: [
				{
					id: 1,
					title: 'Task 1',
					description: 'First task',
					status: 'done',
					dependencies: [],
					details: 'Already completed task',
					subtasks: []
				},
				{
					id: 2,
					title: 'Task 2',
					description: 'Second task',
					status: 'pending',
					dependencies: [],
					details: 'Task ready for expansion',
					subtasks: []
				},
				{
					id: 3,
					title: 'Complex Task',
					description: 'A complex task that needs breakdown',
					status: 'pending',
					dependencies: [1],
					details: 'This task involves multiple steps',
					subtasks: []
				},
				{
					id: 4,
					title: 'Task with existing subtasks',
					description: 'Task that already has subtasks',
					status: 'pending',
					dependencies: [],
					details: 'Has existing subtasks',
					subtasks: [
						{
							id: 1,
							title: 'Existing subtask',
							description: 'Already exists',
							status: 'pending',
							dependencies: []
						}
					]
				}
			]
		},
		'feature-branch': {
			tasks: [
				{
					id: 1,
					title: 'Feature Task 1',
					description: 'Task in feature branch',
					status: 'pending',
					dependencies: [],
					details: 'Feature-specific task',
					subtasks: []
				}
			]
		}
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
		mockExit.mockClear();

		// Default readJSON implementation - returns tagged structure
		readJSON.mockImplementation((tasksPath, projectRoot, tag) => {
			const sampleTasksCopy = JSON.parse(JSON.stringify(sampleTasks));
			const selectedTag = tag || 'master';
			return {
				...sampleTasksCopy[selectedTag],
				tag: selectedTag,
				_rawTaggedData: sampleTasksCopy
			};
		});

		// Default findTaskById implementation
		findTaskById.mockImplementation((tasks, taskId) => {
			const id = parseInt(taskId, 10);
			return tasks.find((t) => t.id === id);
		});

		// Default complexity report (no report available)
		readComplexityReport.mockReturnValue(null);

		// Mock findProjectRoot to return consistent path for complexity report
		findProjectRoot.mockReturnValue('/mock/project/root');

		writeJSON.mockResolvedValue();
		generateTaskFiles.mockResolvedValue();
		log.mockImplementation(() => {});

		// Mock console.log to avoid output during tests
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		console.log.mockRestore();
	});

	describe('Basic Functionality', () => {
		test('should expand a task with AI-generated subtasks', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const numSubtasks = 3;
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			const result = await expandTask(
				tasksPath,
				taskId,
				numSubtasks,
				false,
				'',
				context,
				false
			);

			// Assert
			expect(readJSON).toHaveBeenCalledWith(
				tasksPath,
				'/mock/project/root',
				undefined
			);
			expect(generateTextService).toHaveBeenCalledWith(expect.any(Object));
			expect(writeJSON).toHaveBeenCalledWith(
				tasksPath,
				expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 2,
							subtasks: expect.arrayContaining([
								expect.objectContaining({
									id: 1,
									title: 'Set up project structure',
									status: 'pending'
								}),
								expect.objectContaining({
									id: 2,
									title: 'Implement core functionality',
									status: 'pending'
								}),
								expect.objectContaining({
									id: 3,
									title: 'Add user interface',
									status: 'pending'
								})
							])
						})
					]),
					tag: 'master',
					_rawTaggedData: expect.objectContaining({
						master: expect.objectContaining({
							tasks: expect.any(Array)
						})
					})
				}),
				'/mock/project/root',
				undefined
			);
			expect(result).toEqual(
				expect.objectContaining({
					task: expect.objectContaining({
						id: 2,
						subtasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								title: 'Set up project structure',
								status: 'pending'
							}),
							expect.objectContaining({
								id: 2,
								title: 'Implement core functionality',
								status: 'pending'
							}),
							expect.objectContaining({
								id: 3,
								title: 'Add user interface',
								status: 'pending'
							})
						])
					}),
					telemetryData: expect.any(Object)
				})
			);
		});

		test('should handle research flag correctly', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const numSubtasks = 3;
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			await expandTask(
				tasksPath,
				taskId,
				numSubtasks,
				true, // useResearch = true
				'Additional context for research',
				context,
				false
			);

			// Assert
			expect(generateTextService).toHaveBeenCalledWith(
				expect.objectContaining({
					role: 'research',
					commandName: expect.any(String)
				})
			);
		});

		test('should handle complexity report integration without errors', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act & Assert - Should complete without errors
			const result = await expandTask(
				tasksPath,
				taskId,
				undefined, // numSubtasks not specified
				false,
				'',
				context,
				false
			);

			// Assert - Should successfully expand and return expected structure
			expect(result).toEqual(
				expect.objectContaining({
					task: expect.objectContaining({
						id: 2,
						subtasks: expect.any(Array)
					}),
					telemetryData: expect.any(Object)
				})
			);
			expect(generateTextService).toHaveBeenCalled();
		});
	});

	describe('Tag Handling (The Critical Bug Fix)', () => {
		test('should preserve tagged structure when expanding with default tag', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root',
				tag: 'master' // Explicit tag context
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - CRITICAL: Check tag is passed to readJSON and writeJSON
			expect(readJSON).toHaveBeenCalledWith(
				tasksPath,
				'/mock/project/root',
				'master'
			);
			expect(writeJSON).toHaveBeenCalledWith(
				tasksPath,
				expect.objectContaining({
					tag: 'master',
					_rawTaggedData: expect.objectContaining({
						master: expect.any(Object),
						'feature-branch': expect.any(Object)
					})
				}),
				'/mock/project/root',
				'master' // CRITICAL: Tag must be passed to writeJSON
			);
		});

		test('should preserve tagged structure when expanding with non-default tag', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '1'; // Task in feature-branch
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root',
				tag: 'feature-branch' // Different tag context
			};

			// Configure readJSON to return feature-branch data
			readJSON.mockImplementation((tasksPath, projectRoot, tag) => {
				const sampleTasksCopy = JSON.parse(JSON.stringify(sampleTasks));
				return {
					...sampleTasksCopy['feature-branch'],
					tag: 'feature-branch',
					_rawTaggedData: sampleTasksCopy
				};
			});

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - CRITICAL: Check tag preservation for non-default tag
			expect(readJSON).toHaveBeenCalledWith(
				tasksPath,
				'/mock/project/root',
				'feature-branch'
			);
			expect(writeJSON).toHaveBeenCalledWith(
				tasksPath,
				expect.objectContaining({
					tag: 'feature-branch',
					_rawTaggedData: expect.objectContaining({
						master: expect.any(Object),
						'feature-branch': expect.any(Object)
					})
				}),
				'/mock/project/root',
				'feature-branch' // CRITICAL: Correct tag passed to writeJSON
			);
		});

		test('should NOT corrupt tagged structure when tag is undefined', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
				// No tag specified - should default gracefully
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - Should still preserve structure with undefined tag
			expect(readJSON).toHaveBeenCalledWith(
				tasksPath,
				'/mock/project/root',
				undefined
			);
			expect(writeJSON).toHaveBeenCalledWith(
				tasksPath,
				expect.objectContaining({
					_rawTaggedData: expect.objectContaining({
						master: expect.any(Object)
					})
				}),
				'/mock/project/root',
				undefined
			);

			// CRITICAL: Verify structure is NOT flattened to old format
			const writeCallArgs = writeJSON.mock.calls[0][1];
			expect(writeCallArgs).toHaveProperty('tasks'); // Should have tasks property from readJSON mock
			expect(writeCallArgs).toHaveProperty('_rawTaggedData'); // Should preserve tagged structure
		});
	});

	describe('Force Flag Handling', () => {
		test('should replace existing subtasks when force=true', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '4'; // Task with existing subtasks
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, true);

			// Assert - Should replace existing subtasks
			expect(writeJSON).toHaveBeenCalledWith(
				tasksPath,
				expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 4,
							subtasks: expect.arrayContaining([
								expect.objectContaining({
									id: 1,
									title: 'Set up project structure'
								})
							])
						})
					])
				}),
				'/mock/project/root',
				undefined
			);
		});

		test('should append to existing subtasks when force=false', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '4'; // Task with existing subtasks
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - Should append to existing subtasks with proper ID increments
			expect(writeJSON).toHaveBeenCalledWith(
				tasksPath,
				expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 4,
							subtasks: expect.arrayContaining([
								// Should contain both existing and new subtasks
								expect.any(Object),
								expect.any(Object),
								expect.any(Object),
								expect.any(Object) // 1 existing + 3 new = 4 total
							])
						})
					])
				}),
				'/mock/project/root',
				undefined
			);
		});
	});

	describe('Complexity Report Integration (Tag-Specific)', () => {
		test('should use tag-specific complexity report when available', async () => {
			// Arrange
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt: 'Generate exactly 5 subtasks for complexity report',
				userPrompt:
					'Please break this task into 5 parts\n\nUser provided context'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			const tasksPath = 'tasks/tasks.json';
			const taskId = '1'; // Task in feature-branch
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root',
				tag: 'feature-branch',
				complexityReportPath:
					'/mock/project/root/task-complexity-report_feature-branch.json'
			};

			// Stub fs.existsSync to simulate complexity report exists for this tag
			const existsSpy = jest
				.spyOn(fs, 'existsSync')
				.mockImplementation((filepath) =>
					filepath.endsWith('task-complexity-report_feature-branch.json')
				);

			// Stub readJSON to return complexity report when reading the report path
			readJSON.mockImplementation((filepath, projectRootParam, tagParam) => {
				if (filepath.includes('task-complexity-report_feature-branch.json')) {
					return {
						complexityAnalysis: [
							{
								taskId: 1,
								complexityScore: 8,
								recommendedSubtasks: 5,
								reasoning: 'Needs five detailed steps',
								expansionPrompt: 'Please break this task into 5 parts'
							}
						]
					};
				}
				// Default tasks data for tasks.json
				const sampleTasksCopy = JSON.parse(JSON.stringify(sampleTasks));
				const selectedTag = tagParam || 'master';
				return {
					...sampleTasksCopy[selectedTag],
					tag: selectedTag,
					_rawTaggedData: sampleTasksCopy
				};
			});

			// Act
			await expandTask(tasksPath, taskId, undefined, false, '', context, false);

			// Assert - generateTextService called with systemPrompt for 5 subtasks
			const callArg = generateTextService.mock.calls[0][0];
			expect(callArg.systemPrompt).toContain('Generate exactly 5 subtasks');

			// Assert - Should use complexity-report variant with expansion prompt
			expect(mockLoadPrompt).toHaveBeenCalledWith(
				'expand-task',
				expect.objectContaining({
					subtaskCount: 5,
					expansionPrompt: 'Please break this task into 5 parts'
				}),
				'complexity-report'
			);

			// Clean up stub
			existsSpy.mockRestore();
		});
	});

	describe('Error Handling', () => {
		test('should handle non-existent task ID', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '999'; // Non-existent task
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			findTaskById.mockReturnValue(null);

			// Act & Assert
			await expect(
				expandTask(tasksPath, taskId, 3, false, '', context, false)
			).rejects.toThrow('Task 999 not found');

			expect(writeJSON).not.toHaveBeenCalled();
		});

		test('should expand tasks regardless of status (including done tasks)', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '1'; // Task with 'done' status
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			const result = await expandTask(
				tasksPath,
				taskId,
				3,
				false,
				'',
				context,
				false
			);

			// Assert - Should successfully expand even 'done' tasks
			expect(writeJSON).toHaveBeenCalled();
			expect(result).toEqual(
				expect.objectContaining({
					task: expect.objectContaining({
						id: 1,
						status: 'done', // Status unchanged
						subtasks: expect.arrayContaining([
							expect.objectContaining({
								id: 1,
								title: 'Set up project structure',
								status: 'pending'
							})
						])
					}),
					telemetryData: expect.any(Object)
				})
			);
		});

		test('should handle AI service failures', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			generateTextService.mockRejectedValueOnce(new Error('AI service error'));

			// Act & Assert
			await expect(
				expandTask(tasksPath, taskId, 3, false, '', context, false)
			).rejects.toThrow('AI service error');

			expect(writeJSON).not.toHaveBeenCalled();
		});

		test('should handle file read errors', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			readJSON.mockImplementation(() => {
				throw new Error('File read failed');
			});

			// Act & Assert
			await expect(
				expandTask(tasksPath, taskId, 3, false, '', context, false)
			).rejects.toThrow('File read failed');

			expect(writeJSON).not.toHaveBeenCalled();
		});

		test('should handle invalid tasks data', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			readJSON.mockReturnValue(null);

			// Act & Assert
			await expect(
				expandTask(tasksPath, taskId, 3, false, '', context, false)
			).rejects.toThrow();
		});
	});

	describe('Output Format Handling', () => {
		test('should display telemetry for CLI output format', async () => {
			// Arrange
			const { displayAiUsageSummary } = await import(
				'../../../../../scripts/modules/ui.js'
			);
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				projectRoot: '/mock/project/root'
				// No mcpLog - should trigger CLI mode
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - Should display telemetry for CLI users
			expect(displayAiUsageSummary).toHaveBeenCalledWith(
				expect.objectContaining({
					commandName: 'expand-task',
					modelUsed: 'claude-3-5-sonnet',
					totalCost: 0.012414
				}),
				'cli'
			);
		});

		test('should not display telemetry for MCP output format', async () => {
			// Arrange
			const { displayAiUsageSummary } = await import(
				'../../../../../scripts/modules/ui.js'
			);
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - Should NOT display telemetry for MCP (handled at higher level)
			expect(displayAiUsageSummary).not.toHaveBeenCalled();
		});
	});

	describe('Edge Cases', () => {
		test('should handle empty additional context', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - Should work with empty context (but may include project context)
			expect(generateTextService).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringMatching(/.*/) // Just ensure prompt exists
				})
			);
		});

		test('should handle additional context correctly', async () => {
			// Arrange
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt: 'Mocked system prompt',
				userPrompt: 'Mocked user prompt with context'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const additionalContext = 'Use React hooks and TypeScript';
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root'
			};

			// Act
			await expandTask(
				tasksPath,
				taskId,
				3,
				false,
				additionalContext,
				context,
				false
			);

			// Assert - Should pass separate context parameters to prompt manager
			expect(mockLoadPrompt).toHaveBeenCalledWith(
				'expand-task',
				expect.objectContaining({
					additionalContext: expect.stringContaining(
						'Use React hooks and TypeScript'
					),
					gatheredContext: expect.stringContaining(
						'Mock project context from files'
					)
				}),
				expect.any(String)
			);

			// Additional assertion to verify the context parameters are passed separately
			const call = mockLoadPrompt.mock.calls[0];
			const parameters = call[1];
			expect(parameters.additionalContext).toContain(
				'Use React hooks and TypeScript'
			);
			expect(parameters.gatheredContext).toContain(
				'Mock project context from files'
			);
		});

		test('should handle missing project root in context', async () => {
			// Arrange
			const tasksPath = 'tasks/tasks.json';
			const taskId = '2';
			const context = {
				mcpLog: createMcpLogMock()
				// No projectRoot in context
			};

			// Act
			await expandTask(tasksPath, taskId, 3, false, '', context, false);

			// Assert - Should derive project root from tasksPath
			expect(findProjectRoot).toHaveBeenCalledWith(tasksPath);
			expect(readJSON).toHaveBeenCalledWith(
				tasksPath,
				'/mock/project/root',
				undefined
			);
		});
	});

	describe('Dynamic Subtask Generation', () => {
		const tasksPath = 'tasks/tasks.json';
		const taskId = 1;
		const context = { session: null, mcpLog: null };

		beforeEach(() => {
			// Reset all mocks
			jest.clearAllMocks();

			// Setup default mocks
			readJSON.mockReturnValue({
				tasks: [
					{
						id: 1,
						title: 'Test Task',
						description: 'A test task',
						status: 'pending',
						subtasks: []
					}
				]
			});

			findTaskById.mockReturnValue({
				id: 1,
				title: 'Test Task',
				description: 'A test task',
				status: 'pending',
				subtasks: []
			});

			findProjectRoot.mockReturnValue('/mock/project/root');
		});

		test('should accept 0 as valid numSubtasks value for dynamic generation', async () => {
			// Act - Call with numSubtasks=0 (should not throw error)
			const result = await expandTask(
				tasksPath,
				taskId,
				0,
				false,
				'',
				context,
				false
			);

			// Assert - Should complete successfully
			expect(result).toBeDefined();
			expect(generateTextService).toHaveBeenCalled();
		});

		test('should use dynamic prompting when numSubtasks is 0', async () => {
			// Mock getPromptManager to return realistic prompt with dynamic content
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt:
					'You are an AI assistant helping with task breakdown for software development. You need to break down a high-level task into an appropriate number of specific subtasks that can be implemented one by one.',
				userPrompt:
					'Break down this task into an appropriate number of specific subtasks'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			// Act
			await expandTask(tasksPath, taskId, 0, false, '', context, false);

			// Assert - Verify generateTextService was called
			expect(generateTextService).toHaveBeenCalled();

			// Get the call arguments to verify the system prompt
			const callArgs = generateTextService.mock.calls[0][0];
			expect(callArgs.systemPrompt).toContain(
				'an appropriate number of specific subtasks'
			);
		});

		test('should use specific count prompting when numSubtasks is positive', async () => {
			// Mock getPromptManager to return realistic prompt with specific count
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt:
					'You are an AI assistant helping with task breakdown for software development. You need to break down a high-level task into 5 specific subtasks that can be implemented one by one.',
				userPrompt: 'Break down this task into exactly 5 specific subtasks'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			// Act
			await expandTask(tasksPath, taskId, 5, false, '', context, false);

			// Assert - Verify generateTextService was called
			expect(generateTextService).toHaveBeenCalled();

			// Get the call arguments to verify the system prompt
			const callArgs = generateTextService.mock.calls[0][0];
			expect(callArgs.systemPrompt).toContain('5 specific subtasks');
		});

		test('should reject negative numSubtasks values and fallback to default', async () => {
			// Mock getDefaultSubtasks to return a specific value
			getDefaultSubtasks.mockReturnValue(4);

			// Mock getPromptManager to return realistic prompt with default count
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt:
					'You are an AI assistant helping with task breakdown for software development. You need to break down a high-level task into 4 specific subtasks that can be implemented one by one.',
				userPrompt: 'Break down this task into exactly 4 specific subtasks'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			// Act
			await expandTask(tasksPath, taskId, -3, false, '', context, false);

			// Assert - Should use default value instead of negative
			expect(generateTextService).toHaveBeenCalled();
			const callArgs = generateTextService.mock.calls[0][0];
			expect(callArgs.systemPrompt).toContain('4 specific subtasks');
		});

		test('should use getDefaultSubtasks when numSubtasks is undefined', async () => {
			// Mock getDefaultSubtasks to return a specific value
			getDefaultSubtasks.mockReturnValue(6);

			// Mock getPromptManager to return realistic prompt with default count
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt:
					'You are an AI assistant helping with task breakdown for software development. You need to break down a high-level task into 6 specific subtasks that can be implemented one by one.',
				userPrompt: 'Break down this task into exactly 6 specific subtasks'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			// Act - Call without specifying numSubtasks (undefined)
			await expandTask(tasksPath, taskId, undefined, false, '', context, false);

			// Assert - Should use default value
			expect(generateTextService).toHaveBeenCalled();
			const callArgs = generateTextService.mock.calls[0][0];
			expect(callArgs.systemPrompt).toContain('6 specific subtasks');
		});

		test('should use getDefaultSubtasks when numSubtasks is null', async () => {
			// Mock getDefaultSubtasks to return a specific value
			getDefaultSubtasks.mockReturnValue(7);

			// Mock getPromptManager to return realistic prompt with default count
			const { getPromptManager } = await import(
				'../../../../../scripts/modules/prompt-manager.js'
			);
			const mockLoadPrompt = jest.fn().mockResolvedValue({
				systemPrompt:
					'You are an AI assistant helping with task breakdown for software development. You need to break down a high-level task into 7 specific subtasks that can be implemented one by one.',
				userPrompt: 'Break down this task into exactly 7 specific subtasks'
			});
			getPromptManager.mockReturnValue({
				loadPrompt: mockLoadPrompt
			});

			// Act - Call with null numSubtasks
			await expandTask(tasksPath, taskId, null, false, '', context, false);

			// Assert - Should use default value
			expect(generateTextService).toHaveBeenCalled();
			const callArgs = generateTextService.mock.calls[0][0];
			expect(callArgs.systemPrompt).toContain('7 specific subtasks');
		});
	});
});
