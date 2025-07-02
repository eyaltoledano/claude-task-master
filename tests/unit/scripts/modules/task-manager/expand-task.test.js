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
		getDebugFlag: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => ({
		ContextGatherer: jest.fn().mockImplementation(() => ({
			gather: jest.fn().mockResolvedValue({
				contextSummary: 'Mock context summary',
				allRelatedTaskIds: [],
				graphVisualization: 'Mock graph'
			})
		}))
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
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
			const tasksPath = 'tasks/tasks.json';
			const taskId = '1'; // Task in feature-branch
			const context = {
				mcpLog: createMcpLogMock(),
				projectRoot: '/mock/project/root',
				tag: 'feature-branch'
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

			// Assert - Should include additional context in prompt
			expect(generateTextService).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining('Use React hooks and TypeScript')
				})
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
});
