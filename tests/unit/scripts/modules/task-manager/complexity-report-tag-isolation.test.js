/**
 * Tests for complexity report tag isolation functionality
 * Verifies that different tags maintain separate complexity reports
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock the dependencies
jest.unstable_mockModule('../../../../../src/utils/path-utils.js', () => ({
	resolveComplexityReportOutputPath: jest.fn(),
	findComplexityReportPath: jest.fn(),
	findConfigPath: jest.fn(),
	findPRDPath: jest.fn(() => '/mock/project/root/.taskmaster/docs/PRD.md'),
	findTasksPath: jest.fn(
		() => '/mock/project/root/.taskmaster/tasks/tasks.json'
	),
	findProjectRoot: jest.fn(() => '/mock/project/root'),
	normalizeProjectRoot: jest.fn((root) => root)
}));

jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	isSilentMode: jest.fn(() => false),
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn(),
	flattenTasksWithSubtasks: jest.fn((tasks) => tasks),
	getTagAwareFilePath: jest.fn((basePath, tag, projectRoot) => {
		if (tag && tag !== 'master') {
			const dir = path.dirname(basePath);
			const ext = path.extname(basePath);
			const name = path.basename(basePath, ext);
			return path.join(projectRoot || '.', dir, `${name}_${tag}${ext}`);
		}
		return path.join(projectRoot || '.', basePath);
	}),
	findTaskById: jest.fn((tasks, taskId) => {
		if (!tasks || !Array.isArray(tasks)) {
			return { task: null, originalSubtaskCount: null, originalSubtasks: null };
		}
		const id = parseInt(taskId, 10);
		const task = tasks.find((t) => t.id === id);
		return task
			? { task, originalSubtaskCount: null, originalSubtasks: null }
			: { task: null, originalSubtaskCount: null, originalSubtasks: null };
	}),
	taskExists: jest.fn((tasks, taskId) => {
		if (!tasks || !Array.isArray(tasks)) return false;
		const id = parseInt(taskId, 10);
		return tasks.some((t) => t.id === id);
	}),
	formatTaskId: jest.fn((id) => `Task ${id}`),
	findCycles: jest.fn(() => []),
	truncate: jest.fn((text) => text),
	addComplexityToTask: jest.fn((task, complexity) => ({ ...task, complexity })),
	aggregateTelemetry: jest.fn((telemetryArray) => telemetryArray[0] || {}),
	ensureTagMetadata: jest.fn((tagObj) => tagObj),
	getCurrentTag: jest.fn(() => 'master'),
	markMigrationForNotice: jest.fn(),
	performCompleteTagMigration: jest.fn(),
	setTasksForTag: jest.fn(),
	getTasksForTag: jest.fn((data, tag) => data[tag]?.tasks || []),
	findProjectRoot: jest.fn(() => '/mock/project/root'),
	readComplexityReport: jest.fn(),
	findTaskInComplexityReport: jest.fn(),
	resolveEnvVariable: jest.fn((varName) => `mock_${varName}`),
	isEmpty: jest.fn(() => false),
	normalizeProjectRoot: jest.fn((root) => root),
	slugifyTagForFilePath: jest.fn((tagName) => {
		if (!tagName || typeof tagName !== 'string') {
			return 'unknown-tag';
		}
		return tagName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
	}),
	createTagAwareFilePath: jest.fn((basePath, tag, projectRoot) => {
		if (tag && tag !== 'master') {
			const dir = path.dirname(basePath);
			const ext = path.extname(basePath);
			const name = path.basename(basePath, ext);
			// Use the slugified tag
			const slugifiedTag = tag.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
			return path.join(
				projectRoot || '.',
				dir,
				`${name}_${slugifiedTag}${ext}`
			);
		}
		return path.join(projectRoot || '.', basePath);
	}),
	traverseDependencies: jest.fn((sourceTasks, allTasks, options = {}) => []),
	CONFIG: {
		defaultSubtasks: 3
	}
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateTextService: jest.fn().mockImplementation((params) => {
			const commandName = params?.commandName || 'default';

			if (commandName === 'analyze-complexity') {
				// Check if this is for a specific tag test by looking at the prompt
				const isFeatureTag =
					params?.prompt?.includes('feature') || params?.role === 'feature';
				const isMasterTag =
					params?.prompt?.includes('master') || params?.role === 'master';

				let taskTitle = 'Test Task';
				if (isFeatureTag) {
					taskTitle = 'Feature Task 1';
				} else if (isMasterTag) {
					taskTitle = 'Master Task 1';
				}

				return Promise.resolve({
					mainResult: JSON.stringify([
						{
							taskId: 1,
							taskTitle: taskTitle,
							complexityScore: 7,
							recommendedSubtasks: 4,
							expansionPrompt: 'Break down this task',
							reasoning: 'This task is moderately complex'
						},
						{
							taskId: 2,
							taskTitle: 'Task 2',
							complexityScore: 5,
							recommendedSubtasks: 3,
							expansionPrompt: 'Break down this task with a focus on task 2.',
							reasoning:
								'Automatically added due to missing analysis in AI response.'
						}
					]),
					telemetryData: {
						timestamp: new Date().toISOString(),
						commandName: 'analyze-complexity',
						modelUsed: 'claude-3-5-sonnet',
						providerName: 'anthropic',
						inputTokens: 1000,
						outputTokens: 500,
						totalTokens: 1500,
						totalCost: 0.012414,
						currency: 'USD'
					}
				});
			} else {
				// Default for expand-task and others
				return Promise.resolve({
					mainResult: JSON.stringify({
						subtasks: [
							{
								id: 1,
								title: 'Subtask 1',
								description: 'First subtask',
								dependencies: [],
								details: 'Implementation details',
								status: 'pending',
								testStrategy: 'Test strategy'
							}
						]
					}),
					telemetryData: {
						timestamp: new Date().toISOString(),
						commandName: commandName || 'expand-task',
						modelUsed: 'claude-3-5-sonnet',
						providerName: 'anthropic',
						inputTokens: 1000,
						outputTokens: 500,
						totalTokens: 1500,
						totalCost: 0.012414,
						currency: 'USD'
					}
				});
			}
		}),
		streamTextService: jest.fn().mockResolvedValue({
			mainResult: async function* () {
				yield '{"tasks":[';
				yield '{"id":1,"title":"Test Task","priority":"high"}';
				yield ']}';
			},
			telemetryData: {
				timestamp: new Date().toISOString(),
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
		generateObjectService: jest.fn().mockResolvedValue({
			mainResult: {
				object: {
					subtasks: [
						{
							id: 1,
							title: 'Subtask 1',
							description: 'First subtask',
							dependencies: [],
							details: 'Implementation details',
							status: 'pending',
							testStrategy: 'Test strategy'
						}
					]
				}
			},
			telemetryData: {
				timestamp: new Date().toISOString(),
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
		VALIDATED_PROVIDERS: ['anthropic', 'openai', 'perplexity'],
		CUSTOM_PROVIDERS: { OLLAMA: 'ollama', BEDROCK: 'bedrock' },
		ALL_PROVIDERS: ['anthropic', 'openai', 'perplexity', 'ollama', 'bedrock'],
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
		getVertexLocation: jest.fn(() => undefined),
		hasCodebaseAnalysis: jest.fn(() => false)
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

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => {
		class MockContextGatherer {
			constructor(projectRoot, tag) {
				this.projectRoot = projectRoot;
				this.tag = tag;
				this.allTasks = [];
			}

			async gather(options = {}) {
				return {
					context: 'Mock context gathered',
					analysisData: null,
					contextSections: 1,
					finalTaskIds: options.tasks || []
				};
			}
		}

		return {
			default: MockContextGatherer,
			ContextGatherer: MockContextGatherer,
			createContextGatherer: jest.fn(
				(projectRoot, tag) => new MockContextGatherer(projectRoot, tag)
			)
		};
	}
);

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
	stopLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn(),
	displayBanner: jest.fn(),
	getStatusWithColor: jest.fn((status) => status),
	succeedLoadingIndicator: jest.fn(),
	failLoadingIndicator: jest.fn(),
	warnLoadingIndicator: jest.fn(),
	infoLoadingIndicator: jest.fn(),
	displayContextAnalysis: jest.fn(),
	createProgressBar: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		update: jest.fn()
	})),
	displayTable: jest.fn(),
	displayBox: jest.fn(),
	displaySuccess: jest.fn(),
	displayError: jest.fn(),
	displayWarning: jest.fn(),
	displayInfo: jest.fn(),
	displayTaskDetails: jest.fn(),
	displayTaskList: jest.fn(),
	displayComplexityReport: jest.fn(),
	displayNextTask: jest.fn(),
	displayDependencyStatus: jest.fn(),
	displayMigrationNotice: jest.fn(),
	formatDependenciesWithStatus: jest.fn((deps) => deps),
	formatTaskId: jest.fn((id) => `Task ${id}`),
	formatPriority: jest.fn((priority) => priority),
	formatDuration: jest.fn((duration) => duration),
	formatDate: jest.fn((date) => date),
	formatComplexityScore: jest.fn((score) => score),
	formatTelemetryData: jest.fn((data) => data),
	formatContextSummary: jest.fn((context) => context),
	formatTagName: jest.fn((tag) => tag),
	formatFilePath: jest.fn((path) => path),
	getComplexityWithColor: jest.fn((complexity) => complexity),
	getPriorityWithColor: jest.fn((priority) => priority),
	getTagWithColor: jest.fn((tag) => tag),
	getDependencyWithColor: jest.fn((dep) => dep),
	getTelemetryWithColor: jest.fn((data) => data),
	getContextWithColor: jest.fn((context) => context)
}));

// Mock fs module
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
	default: {
		existsSync: mockExistsSync,
		readFileSync: mockReadFileSync,
		writeFileSync: mockWriteFileSync,
		mkdirSync: mockMkdirSync
	},
	existsSync: mockExistsSync,
	readFileSync: mockReadFileSync,
	writeFileSync: mockWriteFileSync,
	mkdirSync: mockMkdirSync
}));

// Import the mocked modules
const { resolveComplexityReportOutputPath, findComplexityReportPath } =
	await import('../../../../../src/utils/path-utils.js');

const { readJSON, writeJSON, getTagAwareFilePath } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateTextService, streamTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

// Import the modules under test
const { default: analyzeTaskComplexity } = await import(
	'../../../../../scripts/modules/task-manager/analyze-task-complexity.js'
);

const { default: expandTask } = await import(
	'../../../../../scripts/modules/task-manager/expand-task.js'
);

describe('Complexity Report Tag Isolation', () => {
	const projectRoot = '/mock/project/root';
	const sampleTasks = {
		tasks: [
			{
				id: 1,
				title: 'Task 1',
				description: 'First task',
				status: 'pending'
			},
			{
				id: 2,
				title: 'Task 2',
				description: 'Second task',
				status: 'pending'
			}
		]
	};

	const sampleComplexityReport = {
		meta: {
			generatedAt: new Date().toISOString(),
			tasksAnalyzed: 2,
			totalTasks: 2,
			analysisCount: 2,
			thresholdScore: 5,
			projectName: 'Test Project',
			usedResearch: false
		},
		complexityAnalysis: [
			{
				taskId: 1,
				taskTitle: 'Task 1',
				complexityScore: 7,
				recommendedSubtasks: 4,
				expansionPrompt: 'Break down this task',
				reasoning: 'This task is moderately complex'
			},
			{
				taskId: 2,
				taskTitle: 'Task 2',
				complexityScore: 5,
				recommendedSubtasks: 3,
				expansionPrompt: 'Break down this task',
				reasoning: 'This task is moderately complex'
			}
		]
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock implementations
		readJSON.mockReturnValue(sampleTasks);
		mockExistsSync.mockReturnValue(false);
		mockMkdirSync.mockImplementation(() => {});

		// Mock resolveComplexityReportOutputPath to return tag-aware paths
		resolveComplexityReportOutputPath.mockImplementation(
			(explicitPath, args) => {
				const tag = args?.tag;
				if (explicitPath) {
					return explicitPath;
				}

				let filename = 'task-complexity-report.json';
				if (tag && tag !== 'master') {
					// Use slugified tag for cross-platform compatibility
					const slugifiedTag = tag
						.replace(/[^a-zA-Z0-9_-]/g, '-')
						.toLowerCase();
					filename = `task-complexity-report_${slugifiedTag}.json`;
				}

				return path.join(projectRoot, '.taskmaster/reports', filename);
			}
		);

		// Mock findComplexityReportPath to return tag-aware paths
		findComplexityReportPath.mockImplementation((explicitPath, args) => {
			const tag = args?.tag;
			if (explicitPath) {
				return explicitPath;
			}

			let filename = 'task-complexity-report.json';
			if (tag && tag !== 'master') {
				filename = `task-complexity-report_${tag}.json`;
			}

			return path.join(projectRoot, '.taskmaster/reports', filename);
		});
	});

	describe('Path Resolution Tag Isolation', () => {
		test('should resolve master tag to default filename', () => {
			const result = resolveComplexityReportOutputPath(null, {
				tag: 'master',
				projectRoot
			});
			expect(result).toBe(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				)
			);
		});

		test('should resolve non-master tag to tag-specific filename', () => {
			const result = resolveComplexityReportOutputPath(null, {
				tag: 'feature-auth',
				projectRoot
			});
			expect(result).toBe(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				)
			);
		});

		test('should resolve undefined tag to default filename', () => {
			const result = resolveComplexityReportOutputPath(null, { projectRoot });
			expect(result).toBe(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				)
			);
		});

		test('should respect explicit path over tag-aware resolution', () => {
			const explicitPath = '/custom/path/report.json';
			const result = resolveComplexityReportOutputPath(explicitPath, {
				tag: 'feature-auth',
				projectRoot
			});
			expect(result).toBe(explicitPath);
		});
	});

	describe('Analysis Generation Tag Isolation', () => {
		test('should generate master tag report to default location', async () => {
			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'master'
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(resolveComplexityReportOutputPath).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining({
					tag: 'master',
					projectRoot
				}),
				expect.any(Function)
			);

			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				),
				expect.any(String),
				'utf8'
			);
		});

		test('should generate feature tag report to tag-specific location', async () => {
			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'feature-auth'
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(resolveComplexityReportOutputPath).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining({
					tag: 'feature-auth',
					projectRoot
				}),
				expect.any(Function)
			);

			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				),
				expect.any(String),
				'utf8'
			);
		});

		test('should not overwrite master report when analyzing feature tag', async () => {
			// First, analyze master tag
			const masterOptions = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'master'
			};

			await analyzeTaskComplexity(masterOptions, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Clear mocks to verify separate calls
			jest.clearAllMocks();
			readJSON.mockReturnValue(sampleTasks);

			// Then, analyze feature tag
			const featureOptions = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'feature-auth'
			};

			await analyzeTaskComplexity(featureOptions, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify that the feature tag analysis wrote to its own file
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				),
				expect.any(String),
				'utf8'
			);

			// Verify that it did NOT write to the master file
			expect(mockWriteFileSync).not.toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				),
				expect.any(String),
				'utf8'
			);
		});
	});

	describe('Report Reading Tag Isolation', () => {
		test('should read master tag report from default location', async () => {
			// Mock existing master report
			mockExistsSync.mockImplementation((filepath) => {
				return filepath.endsWith('task-complexity-report.json');
			});
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleComplexityReport));

			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'master'
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(mockExistsSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				)
			);
		});

		test('should read feature tag report from tag-specific location', async () => {
			// Mock existing feature tag report
			mockExistsSync.mockImplementation((filepath) => {
				return filepath.endsWith('task-complexity-report_feature-auth.json');
			});
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleComplexityReport));

			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'feature-auth'
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(mockExistsSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				)
			);
		});

		test('should not read master report when working with feature tag', async () => {
			// Mock that feature tag report exists but master doesn't
			mockExistsSync.mockImplementation((filepath) => {
				return filepath.endsWith('task-complexity-report_feature-auth.json');
			});
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleComplexityReport));

			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'feature-auth'
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Should check for feature tag report
			expect(mockExistsSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				)
			);

			// Should NOT check for master report
			expect(mockExistsSync).not.toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				)
			);
		});
	});

	describe('Expand Task Tag Isolation', () => {
		test('should use tag-specific complexity report for expansion', async () => {
			// Mock existing feature tag report
			mockExistsSync.mockImplementation((filepath) => {
				return filepath.endsWith('task-complexity-report_feature-auth.json');
			});
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleComplexityReport));

			const tasksPath = path.join(projectRoot, 'tasks/tasks.json');
			const taskId = 1;
			const numSubtasks = 3;

			await expandTask(
				tasksPath,
				taskId,
				numSubtasks,
				false, // useResearch
				'', // additionalContext
				{
					projectRoot,
					tag: 'feature-auth',
					complexityReportPath: path.join(
						projectRoot,
						'.taskmaster/reports',
						'task-complexity-report_feature-auth.json'
					),
					mcpLog: {
						info: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
						debug: jest.fn(),
						success: jest.fn()
					}
				},
				false // force
			);

			// Should read from feature tag report
			expect(readJSON).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				)
			);
		});

		test('should use master complexity report for master tag expansion', async () => {
			// Mock existing master report
			mockExistsSync.mockImplementation((filepath) => {
				return filepath.endsWith('task-complexity-report.json');
			});
			mockReadFileSync.mockReturnValue(JSON.stringify(sampleComplexityReport));

			const tasksPath = path.join(projectRoot, 'tasks/tasks.json');
			const taskId = 1;
			const numSubtasks = 3;

			await expandTask(
				tasksPath,
				taskId,
				numSubtasks,
				false, // useResearch
				'', // additionalContext
				{
					projectRoot,
					tag: 'master',
					complexityReportPath: path.join(
						projectRoot,
						'.taskmaster/reports',
						'task-complexity-report.json'
					),
					mcpLog: {
						info: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
						debug: jest.fn(),
						success: jest.fn()
					}
				},
				false // force
			);

			// Should read from master report
			expect(readJSON).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				)
			);
		});
	});

	describe('Cross-Tag Contamination Prevention', () => {
		test('should maintain separate reports for different tags', async () => {
			// Create different complexity reports for different tags
			const masterReport = {
				...sampleComplexityReport,
				complexityAnalysis: [
					{
						taskId: 1,
						taskTitle: 'Master Task 1',
						complexityScore: 8,
						recommendedSubtasks: 5,
						expansionPrompt: 'Master expansion',
						reasoning: 'Master task reasoning'
					}
				]
			};

			const featureReport = {
				...sampleComplexityReport,
				complexityAnalysis: [
					{
						taskId: 1,
						taskTitle: 'Feature Task 1',
						complexityScore: 6,
						recommendedSubtasks: 3,
						expansionPrompt: 'Feature expansion',
						reasoning: 'Feature task reasoning'
					}
				]
			};

			// Mock file system to return different reports for different paths
			mockExistsSync.mockImplementation((filepath) => {
				return filepath.includes('task-complexity-report');
			});

			mockReadFileSync.mockImplementation((filepath) => {
				if (filepath.includes('task-complexity-report_feature-auth.json')) {
					return JSON.stringify(featureReport);
				} else if (filepath.includes('task-complexity-report.json')) {
					return JSON.stringify(masterReport);
				}
				return '{}';
			});

			// Analyze master tag
			const masterOptions = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'master'
			};

			await analyzeTaskComplexity(masterOptions, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify that master report was written to master location
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report.json'
				),
				expect.stringContaining('"taskTitle": "Test Task"'),
				'utf8'
			);

			// Clear mocks
			jest.clearAllMocks();
			readJSON.mockReturnValue(sampleTasks);

			// Analyze feature tag
			const featureOptions = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'feature-auth'
			};

			await analyzeTaskComplexity(featureOptions, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			// Verify that feature report was written to feature location
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-auth.json'
				),
				expect.stringContaining('"taskTitle": "Test Task"'),
				'utf8'
			);
		});
	});

	describe('Edge Cases', () => {
		test('should handle empty tag gracefully', async () => {
			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: ''
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(resolveComplexityReportOutputPath).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining({
					tag: '',
					projectRoot
				}),
				expect.any(Function)
			);
		});

		test('should handle null tag gracefully', async () => {
			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: null
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(resolveComplexityReportOutputPath).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining({
					tag: null,
					projectRoot
				}),
				expect.any(Function)
			);
		});

		test('should handle special characters in tag names', async () => {
			const options = {
				file: 'tasks/tasks.json',
				threshold: '5',
				projectRoot,
				tag: 'feature/user-auth-v2'
			};

			await analyzeTaskComplexity(options, {
				projectRoot,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				}
			});

			expect(resolveComplexityReportOutputPath).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining({
					tag: 'feature/user-auth-v2',
					projectRoot
				}),
				expect.any(Function)
			);

			expect(mockWriteFileSync).toHaveBeenCalledWith(
				path.join(
					projectRoot,
					'.taskmaster/reports',
					'task-complexity-report_feature-user-auth-v2.json'
				),
				expect.any(String),
				'utf8'
			);
		});
	});
});
