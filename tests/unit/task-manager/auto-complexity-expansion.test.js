/**
 * Tests for Auto Complexity Expansion functionality
 *
 * This test suite covers:
 * 1. runAutoComplexityExpansion function behavior
 * 2. Integration with analyzeTaskComplexity
 * 3. Integration with expandAllTasks
 * 4. Error handling and edge cases
 * 5. Telemetry data handling
 * 6. Threshold configuration
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies
jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn()
}));

jest.unstable_mockModule('../../../scripts/modules/task-manager/analyze-task-complexity.js', () => ({
	default: jest.fn()
}));

jest.unstable_mockModule('../../../scripts/modules/task-manager/expand-all-tasks.js', () => ({
	default: jest.fn()
}));

jest.unstable_mockModule('../../../scripts/modules/ui.js', () => ({
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule('../../../src/utils/path-utils.js', () => ({
	resolveComplexityReportOutputPath: jest.fn()
}));

jest.unstable_mockModule('chalk', () => ({
	default: {
		blue: jest.fn((text) => text),
		green: jest.fn((text) => text),
		yellow: jest.fn((text) => text),
		red: jest.fn((text) => text)
	}
}));

// Mock console methods to prevent output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Import modules after mocking
const { readJSON } = await import('../../../scripts/modules/utils.js');
const analyzeTaskComplexity = (await import('../../../scripts/modules/task-manager/analyze-task-complexity.js')).default;
const expandAllTasks = (await import('../../../scripts/modules/task-manager/expand-all-tasks.js')).default;
const { displayAiUsageSummary } = await import('../../../scripts/modules/ui.js');
const { resolveComplexityReportOutputPath } = await import('../../../src/utils/path-utils.js');

// Import the function under test
const { runAutoComplexityExpansion } = await import('../../../scripts/modules/task-manager/auto-complexity-expansion.js');

describe('runAutoComplexityExpansion', () => {
	let tempDir;
	let mockTasksPath;
	let mockComplexityReportPath;

	const mockTasksData = {
		master: {
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
					description: 'A complex task',
					status: 'pending',
					dependencies: [1],
					priority: 'high',
					details: 'Complex implementation with multiple components',
					testStrategy: 'Comprehensive testing',
					subtasks: []
				},
				{
					id: 3,
					title: 'Medium Task',
					description: 'A medium complexity task',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Medium complexity implementation',
					testStrategy: 'Standard testing',
					subtasks: []
				}
			],
			metadata: {
				projectName: 'Test Project',
				totalTasks: 3,
				sourceFile: 'test-prd',
				generatedAt: new Date().toISOString()
			}
		}
	};

	const mockComplexityResult = {
		report: {
			tasks: [
				{
					id: 1,
					complexityScore: 3,
					recommendation: 'Low complexity - no expansion needed',
					expansionPrompt: null
				},
				{
					id: 2,
					complexityScore: 8,
					recommendation: 'High complexity - expand into subtasks',
					expansionPrompt: 'Break down this complex task into smaller components'
				},
				{
					id: 3,
					complexityScore: 6,
					recommendation: 'Medium complexity - consider expansion',
					expansionPrompt: 'Consider breaking this task into subtasks'
				}
			]
		},
		telemetryData: {
			timestamp: new Date().toISOString(),
			userId: 'test-user',
			commandName: 'analyze-complexity',
			modelUsed: 'test-model',
			providerName: 'test-provider',
			inputTokens: 500,
			outputTokens: 200,
			totalTokens: 700,
			totalCost: 0.01,
			currency: 'USD'
		},
		tagInfo: {
			currentTag: 'master',
			totalTasks: 3
		}
	};

	const mockExpandResult = {
		expandedCount: 2,
		skippedCount: 1,
		failedCount: 0,
		tasksToExpand: 2,
		telemetryData: {
			timestamp: new Date().toISOString(),
			userId: 'test-user',
			commandName: 'expand-all',
			modelUsed: 'test-model',
			providerName: 'test-provider',
			inputTokens: 300,
			outputTokens: 400,
			totalTokens: 700,
			totalCost: 0.008,
			currency: 'USD'
		}
	};

	beforeAll(() => {
		// Create temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-complexity-test-'));
		mockTasksPath = path.join(tempDir, 'tasks.json');
		mockComplexityReportPath = path.join(tempDir, 'complexity-report.json');

		// Write mock tasks file
		fs.writeFileSync(mockTasksPath, JSON.stringify(mockTasksData, null, 2));
	});

	afterAll(() => {
		// Clean up temporary directory
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup default mocks
		readJSON.mockResolvedValue(mockTasksData);
		resolveComplexityReportOutputPath.mockReturnValue(mockComplexityReportPath);
		analyzeTaskComplexity.mockResolvedValue(mockComplexityResult);
		expandAllTasks.mockResolvedValue(mockExpandResult);
	});

	describe('Successful execution', () => {
		it('should run complexity analysis and expansion successfully', async () => {
			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			const result = await runAutoComplexityExpansion(options);

			// Verify complexity analysis was called
			expect(analyzeTaskComplexity).toHaveBeenCalledWith(
				{
					file: mockTasksPath,
					threshold: 7,
					research: false,
					projectRoot: tempDir,
					tag: 'master'
				},
				{
					session: null,
					mcpLog: null
				}
			);

			// Verify expansion was called
			expect(expandAllTasks).toHaveBeenCalledWith(
				mockTasksPath,
				null, // numSubtasks
				false, // useResearch
				'', // additionalContext
				false, // force
				{
					session: null,
					mcpLog: null,
					projectRoot: tempDir,
					tag: 'master',
					complexityReportPath: mockComplexityReportPath
				},
				'text' // outputFormat
			);

			// Verify result structure
			expect(result).toEqual({
				success: true,
				expandedTasks: 2,
				skippedTasks: 1,
				failedTasks: 0,
				totalTasksAnalyzed: 2,
				complexityReportPath: mockComplexityReportPath,
				complexityTelemetryData: mockComplexityResult.telemetryData,
				expansionTelemetryData: mockExpandResult.telemetryData
			});
		});

		it('should handle different threshold values', async () => {
			const options = {
				tasksPath: mockTasksPath,
				threshold: 5,
				research: true,
				projectRoot: tempDir,
				tag: 'master'
			};

			await runAutoComplexityExpansion(options);

			expect(analyzeTaskComplexity).toHaveBeenCalledWith(
				expect.objectContaining({
					threshold: 5,
					research: true
				}),
				expect.any(Object)
			);
		});

		it('should display telemetry data', async () => {
			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await runAutoComplexityExpansion(options);

			// Verify telemetry display was called
			expect(displayAiUsageSummary).toHaveBeenCalledWith(
				mockComplexityResult.telemetryData,
				'cli'
			);
			expect(displayAiUsageSummary).toHaveBeenCalledWith(
				mockExpandResult.telemetryData,
				'cli'
			);
		});
	});

	describe('Error handling', () => {
		it('should handle complexity analysis failure', async () => {
			const error = new Error('Complexity analysis failed');
			analyzeTaskComplexity.mockRejectedValue(error);

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await expect(runAutoComplexityExpansion(options)).rejects.toThrow(
				'Complexity analysis failed'
			);
		});

		it('should handle missing complexity report', async () => {
			analyzeTaskComplexity.mockResolvedValue({
				// Missing report property
				telemetryData: mockComplexityResult.telemetryData,
				tagInfo: mockComplexityResult.tagInfo
			});

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await expect(runAutoComplexityExpansion(options)).rejects.toThrow(
				'Complexity analysis failed: No report generated'
			);
		});

		it('should handle null complexity result', async () => {
			analyzeTaskComplexity.mockResolvedValue(null);

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await expect(runAutoComplexityExpansion(options)).rejects.toThrow(
				'Complexity analysis failed: No report generated'
			);
		});

		it('should handle expansion failure', async () => {
			const error = new Error('Expansion failed');
			expandAllTasks.mockRejectedValue(error);

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await expect(runAutoComplexityExpansion(options)).rejects.toThrow(
				'Expansion failed'
			);
		});
	});

	describe('Edge cases', () => {
		it('should handle empty tasks file', async () => {
			const emptyTasksData = {
				master: {
					tasks: [],
					metadata: {
						projectName: 'Empty Project',
						totalTasks: 0,
						sourceFile: 'empty-prd',
						generatedAt: new Date().toISOString()
					}
				}
			};

			readJSON.mockResolvedValue(emptyTasksData);

			const emptyComplexityResult = {
				report: { tasks: [] },
				telemetryData: mockComplexityResult.telemetryData,
				tagInfo: { currentTag: 'master', totalTasks: 0 }
			};

			const emptyExpandResult = {
				expandedCount: 0,
				skippedCount: 0,
				failedCount: 0,
				tasksToExpand: 0,
				telemetryData: mockExpandResult.telemetryData
			};

			analyzeTaskComplexity.mockResolvedValue(emptyComplexityResult);
			expandAllTasks.mockResolvedValue(emptyExpandResult);

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			const result = await runAutoComplexityExpansion(options);

			expect(result.expandedTasks).toBe(0);
			expect(result.skippedTasks).toBe(0);
			expect(result.failedTasks).toBe(0);
		});

		it('should handle missing telemetry data', async () => {
			const resultWithoutTelemetry = {
				report: mockComplexityResult.report,
				tagInfo: mockComplexityResult.tagInfo
				// No telemetryData
			};

			const expandResultWithoutTelemetry = {
				expandedCount: 2,
				skippedCount: 1,
				failedCount: 0,
				tasksToExpand: 2
				// No telemetryData
			};

			analyzeTaskComplexity.mockResolvedValue(resultWithoutTelemetry);
			expandAllTasks.mockResolvedValue(expandResultWithoutTelemetry);

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			const result = await runAutoComplexityExpansion(options);

			expect(result.success).toBe(true);
			expect(result.complexityTelemetryData).toBeUndefined();
			expect(result.expansionTelemetryData).toBeUndefined();

			// Should not call displayAiUsageSummary when telemetry is missing
			expect(displayAiUsageSummary).not.toHaveBeenCalled();
		});

		it('should handle different tag contexts', async () => {
			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'feature-branch'
			};

			await runAutoComplexityExpansion(options);

			expect(analyzeTaskComplexity).toHaveBeenCalledWith(
				expect.objectContaining({
					tag: 'feature-branch'
				}),
				expect.any(Object)
			);

			expect(expandAllTasks).toHaveBeenCalledWith(
				expect.any(String), // tasksPath
				null, // numSubtasks
				false, // useResearch
				'', // additionalContext
				false, // force
				expect.objectContaining({
					tag: 'feature-branch'
				}), // context
				'text' // outputFormat
			);
		});
	});

	describe('Configuration options', () => {
		it('should use default threshold when not specified', async () => {
			const options = {
				tasksPath: mockTasksPath,
				// threshold not specified
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await runAutoComplexityExpansion(options);

			expect(analyzeTaskComplexity).toHaveBeenCalledWith(
				expect.objectContaining({
					threshold: 7 // Default value
				}),
				expect.any(Object)
			);
		});

		it('should pass research flag correctly', async () => {
			const options = {
				tasksPath: mockTasksPath,
				threshold: 8,
				research: true,
				projectRoot: tempDir,
				tag: 'master'
			};

			await runAutoComplexityExpansion(options);

			expect(analyzeTaskComplexity).toHaveBeenCalledWith(
				expect.objectContaining({
					research: true
				}),
				expect.any(Object)
			);

			expect(expandAllTasks).toHaveBeenCalledWith(
				expect.any(String), // tasksPath
				null, // numSubtasks
				true, // useResearch
				'', // additionalContext
				false, // force
				expect.any(Object), // context
				'text' // outputFormat
			);
		});
	});

	describe('Integration with path resolution', () => {
		it('should resolve complexity report path correctly', async () => {
			const customReportPath = '/custom/path/complexity-report.json';
			resolveComplexityReportOutputPath.mockReturnValue(customReportPath);

			const options = {
				tasksPath: mockTasksPath,
				threshold: 7,
				research: false,
				projectRoot: tempDir,
				tag: 'master'
			};

			await runAutoComplexityExpansion(options);

			expect(resolveComplexityReportOutputPath).toHaveBeenCalledWith(
				null, // no explicit path
				{ projectRoot: tempDir, tag: 'master' },
				null // no logger
			);

			expect(expandAllTasks).toHaveBeenCalledWith(
				expect.any(String), // tasksPath
				null, // numSubtasks
				false, // useResearch
				'', // additionalContext
				false, // force
				expect.objectContaining({
					complexityReportPath: customReportPath
				}), // context
				'text' // outputFormat
			);
		});
	});
});
