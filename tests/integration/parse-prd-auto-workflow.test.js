/**
 * Integration tests for parse-prd --auto workflow
 *
 * This test suite covers:
 * 1. End-to-end parse-prd with --auto flag
 * 2. Integration between PRD parsing, complexity analysis, and task expansion
 * 3. CLI argument parsing and validation
 * 4. File system operations and cleanup
 * 5. Error handling in the complete workflow
 * 6. Telemetry data flow through the entire process
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// Mock dependencies to prevent actual AI calls
jest.unstable_mockModule('../../scripts/modules/ai-services-unified.js', () => ({
	streamTextService: jest.fn(),
	generateObjectService: jest.fn(),
	streamObjectService: jest.fn().mockImplementation(async () => {
		return {
			get partialObjectStream() {
				return (async function* () {
					yield { tasks: [] };
					yield { tasks: [{ id: 1, title: 'Test Task', priority: 'high' }] };
				})();
			},
			object: Promise.resolve({
				tasks: [
					{
						id: 1,
						title: 'Simple Task',
						description: 'A simple task',
						status: 'pending',
						dependencies: [],
						priority: 'low',
						details: 'Simple implementation',
						testStrategy: 'Basic testing',
						subtasks: []
					},
					{
						id: 2,
						title: 'Complex Task',
						description: 'A complex task requiring multiple components',
						status: 'pending',
						dependencies: [1],
						priority: 'high',
						details: 'Complex implementation with multiple components, database integration, and API endpoints',
						testStrategy: 'Comprehensive testing including unit, integration, and E2E tests',
						subtasks: []
					},
					{
						id: 3,
						title: 'Medium Task',
						description: 'A medium complexity task',
						status: 'pending',
						dependencies: [],
						priority: 'medium',
						details: 'Medium complexity implementation with some external dependencies',
						testStrategy: 'Standard testing approach',
						subtasks: []
					}
				]
			})
		};
	})
}));

// Mock config manager
jest.unstable_mockModule('../../scripts/modules/config-manager.js', () => ({
	getDebugFlag: jest.fn(() => false),
	getDefaultPriority: jest.fn(() => 'medium'),
	getMainModelId: jest.fn(() => 'test-model'),
	getResearchModelId: jest.fn(() => 'test-research-model'),
	getParametersForRole: jest.fn(() => ({ maxTokens: 1000, temperature: 0.7 })),
	getMainProvider: jest.fn(() => 'anthropic'),
	getResearchProvider: jest.fn(() => 'perplexity'),
	getFallbackProvider: jest.fn(() => 'anthropic'),
	getResponseLanguage: jest.fn(() => 'English'),
	getDefaultNumTasks: jest.fn(() => 10),
	getDefaultSubtasks: jest.fn(() => 5),
	getLogLevel: jest.fn(() => 'info'),
	getConfig: jest.fn(() => ({})),
	getAllProviders: jest.fn(() => ['anthropic', 'perplexity']),
	MODEL_MAP: {},
	VALID_PROVIDERS: ['anthropic', 'perplexity'],
	validateProvider: jest.fn(() => true),
	validateProviderModelCombination: jest.fn(() => true),
	isApiKeySet: jest.fn(() => true),
	hasCodebaseAnalysis: jest.fn(() => false)
}));

// Mock utils
jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	writeJSON: jest.fn(),
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn(),
	isSilentMode: jest.fn(() => false),
	getCurrentTag: jest.fn(() => 'master'),
	ensureTagMetadata: jest.fn(),
	readJSON: jest.fn(),
	findProjectRoot: jest.fn(() => '/tmp/test'),
	resolveEnvVariable: jest.fn(() => 'mock-key'),
	findTaskById: jest.fn(() => null),
	findTaskByPattern: jest.fn(() => []),
	validateTaskId: jest.fn(() => true),
	createTask: jest.fn(() => ({ id: 1, title: 'Mock Task' })),
	sortByDependencies: jest.fn((tasks) => tasks),
	isEmpty: jest.fn(() => false),
	truncate: jest.fn((text) => text),
	slugify: jest.fn((text) => text.toLowerCase()),
	getTagFromPath: jest.fn(() => 'master'),
	isValidTag: jest.fn(() => true),
	migrateToTaggedFormat: jest.fn(() => ({ master: { tasks: [] } })),
	performCompleteTagMigration: jest.fn(),
	resolveCurrentTag: jest.fn(() => 'master'),
	getDefaultTag: jest.fn(() => 'master'),
	performMigrationIfNeeded: jest.fn()
}));

// Mock UI components
jest.unstable_mockModule('../../src/progress/parse-prd-tracker.js', () => ({
	createParsePrdTracker: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		cleanup: jest.fn(),
		addTaskLine: jest.fn(),
		updateTokens: jest.fn(),
		complete: jest.fn(),
		getSummary: jest.fn().mockReturnValue({
			taskPriorities: { high: 1, medium: 1, low: 1 },
			elapsedTime: 1000,
			actionVerb: 'generated'
		})
	}))
}));

jest.unstable_mockModule('../../src/ui/parse-prd.js', () => ({
	displayParsePrdStart: jest.fn(),
	displayParsePrdSummary: jest.fn()
}));

jest.unstable_mockModule('../../scripts/modules/ui.js', () => ({
	displayAiUsageSummary: jest.fn()
}));

// Mock other components
jest.unstable_mockModule('../../scripts/modules/task-manager/generate-task-files.js', () => ({
	default: jest.fn()
}));

jest.unstable_mockModule('../../src/utils/stream-parser.js', () => ({
	parseStream: jest.fn(),
	StreamingError: class StreamingError extends Error {},
	STREAMING_ERROR_CODES: {
		NOT_ASYNC_ITERABLE: 'STREAMING_NOT_SUPPORTED',
		STREAM_PROCESSING_FAILED: 'STREAM_PROCESSING_FAILED',
		STREAM_NOT_ITERABLE: 'STREAM_NOT_ITERABLE'
	}
}));

jest.unstable_mockModule('ora', () => ({
	default: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		succeed: jest.fn(),
		fail: jest.fn()
	}))
}));

jest.unstable_mockModule('chalk', () => ({
	default: {
		red: jest.fn((text) => text),
		green: jest.fn((text) => text),
		blue: jest.fn((text) => text),
		yellow: jest.fn((text) => text),
		cyan: jest.fn((text) => text),
		white: {
			bold: jest.fn((text) => text)
		}
	}
}));

jest.unstable_mockModule('boxen', () => ({
	default: jest.fn((content) => content)
}));

// Mock constants
jest.unstable_mockModule('../../src/constants/task-priority.js', () => ({
	DEFAULT_TASK_PRIORITY: 'medium',
	TASK_PRIORITY_OPTIONS: ['low', 'medium', 'high']
}));

jest.unstable_mockModule('../../src/ui/indicators.js', () => ({
	getPriorityIndicators: jest.fn(() => ({
		high: '🔴',
		medium: '🟡',
		low: '🟢'
	}))
}));

describe('parse-prd --auto workflow integration', () => {
	let tempDir;
	let testPRDPath;
	let tasksPath;
	let complexityReportPath;

	const samplePRDContent = `# Test Project PRD

## Overview
Build a comprehensive task management application with advanced features.

## Features
1. User authentication and authorization
2. Task creation and management
3. Project organization and collaboration
4. Advanced reporting and analytics
5. Real-time notifications
6. Mobile app integration

## Technical Requirements
- React frontend with TypeScript
- Node.js backend with Express
- PostgreSQL database with Redis caching
- Docker containerization
- CI/CD pipeline with GitHub Actions
- Comprehensive testing suite

## Success Criteria
- Users can authenticate and manage tasks
- Real-time collaboration works seamlessly
- Mobile app provides full functionality
- System handles 1000+ concurrent users
- 99.9% uptime SLA`;

	beforeAll(() => {
		// Create temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-prd-auto-test-'));
		testPRDPath = path.join(tempDir, 'test-prd.txt');
		tasksPath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');
		complexityReportPath = path.join(tempDir, '.taskmaster', 'reports', 'task-complexity-report.json');

		// Create directory structure
		fs.mkdirSync(path.join(tempDir, '.taskmaster', 'tasks'), { recursive: true });
		fs.mkdirSync(path.join(tempDir, '.taskmaster', 'reports'), { recursive: true });

		// Write test PRD file
		fs.writeFileSync(testPRDPath, samplePRDContent);

		// Mock process.exit to prevent actual exit
		jest.spyOn(process, 'exit').mockImplementation(() => undefined);

		// Mock console methods to prevent output
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterAll(() => {
		// Clean up temporary directory
		fs.rmSync(tempDir, { recursive: true, force: true });

		// Restore mocks
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup default mock implementations
		const { readJSON, writeJSON } = require('../../scripts/modules/utils.js');
		readJSON.mockImplementation((filePath) => {
			if (fs.existsSync(filePath)) {
				return JSON.parse(fs.readFileSync(filePath, 'utf8'));
			}
			return { master: { tasks: [] } };
		});

		writeJSON.mockImplementation((filePath, data) => {
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
		});
	});

	describe('CLI argument parsing', () => {
		it('should parse --auto flag correctly', async () => {
			// This would test the CLI argument parsing
			// Since we're mocking the core functionality, we'll test the integration
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);
			expect(result.autoExpansion).toBeDefined();
		});

		it('should handle --auto-threshold parameter', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '5',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);
			expect(result.autoExpansion).toBeDefined();
		});
	});

	describe('End-to-end workflow', () => {
		it('should complete full parse-prd --auto workflow', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				research: false,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			// Verify PRD parsing succeeded
			expect(result.success).toBe(true);
			expect(result.tasksPath).toBe(tasksPath);

			// Verify tasks file was created
			expect(fs.existsSync(tasksPath)).toBe(true);

			// Verify auto-expansion was triggered
			expect(result.autoExpansion).toBeDefined();
			expect(result.autoExpansion.success).toBe(true);

			// Verify complexity report was created
			expect(fs.existsSync(complexityReportPath)).toBe(true);

			// Verify tasks were expanded
			const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksData.master.tasks).toHaveLength(3);

			// Check that some tasks have subtasks (indicating expansion occurred)
			const tasksWithSubtasks = tasksData.master.tasks.filter(task => 
				task.subtasks && task.subtasks.length > 0
			);
			expect(tasksWithSubtasks.length).toBeGreaterThan(0);
		});

		it('should handle workflow with different threshold values', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			// Test with lower threshold (should expand more tasks)
			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '4',
				research: false,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);
			expect(result.autoExpansion).toBeDefined();
		});

		it('should handle workflow with research flag', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				research: true,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);
			expect(result.autoExpansion).toBeDefined();
		});
	});

	describe('Error handling in workflow', () => {
		it('should handle PRD parsing failure gracefully', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			// Mock AI service failure
			const { generateObjectService } = await import('../../scripts/modules/ai-services-unified.js');
			generateObjectService.mockRejectedValue(new Error('AI service failed'));

			await expect(
				parsePRD(testPRDPath, tasksPath, 3, {
					force: true,
					auto: true,
					autoThreshold: '7',
					mcpLog: {
						info: jest.fn(),
						warn: jest.fn(),
						error: jest.fn(),
						debug: jest.fn(),
						success: jest.fn()
					},
					projectRoot: tempDir
				})
			).rejects.toThrow();
		});

		it('should continue with PRD parsing if auto-expansion fails', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			// Mock auto-expansion failure
			const { runAutoComplexityExpansion } = await import('../../scripts/modules/task-manager/auto-complexity-expansion.js');
			runAutoComplexityExpansion.mockRejectedValue(new Error('Auto-expansion failed'));

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			// PRD parsing should still succeed
			expect(result.success).toBe(true);
			expect(result.tasksPath).toBe(tasksPath);

			// Auto-expansion should be marked as failed
			expect(result.autoExpansion).toBeUndefined();
		});
	});

	describe('File system operations', () => {
		it('should create all necessary files and directories', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			// Verify all expected files exist
			expect(fs.existsSync(tasksPath)).toBe(true);
			expect(fs.existsSync(complexityReportPath)).toBe(true);

			// Verify directory structure
			expect(fs.existsSync(path.join(tempDir, '.taskmaster'))).toBe(true);
			expect(fs.existsSync(path.join(tempDir, '.taskmaster', 'tasks'))).toBe(true);
			expect(fs.existsSync(path.join(tempDir, '.taskmaster', 'reports'))).toBe(true);
		});

		it('should handle existing files with force flag', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			// Create existing tasks file
			const existingTasks = {
				master: {
					tasks: [
						{
							id: 1,
							title: 'Existing Task',
							description: 'This task already exists',
							status: 'done',
							dependencies: [],
							priority: 'high',
							details: 'Existing implementation',
							testStrategy: 'Existing tests',
							subtasks: []
						}
					],
					metadata: {
						projectName: 'Existing Project',
						totalTasks: 1,
						sourceFile: 'existing-prd',
						generatedAt: new Date().toISOString()
					}
				}
			};

			fs.writeFileSync(tasksPath, JSON.stringify(existingTasks, null, 2));

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);

			// Verify the file was overwritten
			const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
			expect(tasksData.master.tasks).toHaveLength(3);
			expect(tasksData.master.tasks[0].title).not.toBe('Existing Task');
		});
	});

	describe('Telemetry data flow', () => {
		it('should collect and return telemetry data from all phases', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			const result = await parsePRD(testPRDPath, tasksPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);

			// Verify telemetry data is present
			expect(result.telemetryData).toBeDefined();
			expect(result.autoExpansion.complexityTelemetryData).toBeDefined();
			expect(result.autoExpansion.expansionTelemetryData).toBeDefined();
		});
	});

	describe('Tag support', () => {
		it('should work with different tag contexts', async () => {
			const { parsePRD } = await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js');

			const customTagPath = path.join(tempDir, '.taskmaster', 'tasks', 'feature-branch-tasks.json');

			const result = await parsePRD(testPRDPath, customTagPath, 3, {
				force: true,
				auto: true,
				autoThreshold: '7',
				tag: 'feature-branch',
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: tempDir
			});

			expect(result.success).toBe(true);
			expect(fs.existsSync(customTagPath)).toBe(true);
		});
	});
});
