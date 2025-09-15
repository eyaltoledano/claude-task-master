/**
 * Integration tests for parse-prd --auto functionality in MCP server
 *
 * This test suite covers:
 * 1. MCP tool schema validation for --auto arguments
 * 2. MCP server integration with auto-complexity-expansion
 * 3. Error handling in MCP context
 * 4. Response structure validation
 * 5. Telemetry data handling in MCP responses
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies
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
					}
				]
			})
		};
	})
}));

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

jest.unstable_mockModule('../../scripts/modules/ui.js', () => ({
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule('../../src/progress/parse-prd-tracker.js', () => ({
	createParsePrdTracker: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		cleanup: jest.fn(),
		addTaskLine: jest.fn(),
		updateTokens: jest.fn(),
		complete: jest.fn(),
		getSummary: jest.fn().mockReturnValue({
			taskPriorities: { high: 1, medium: 0, low: 1 },
			elapsedTime: 1000,
			actionVerb: 'generated'
		})
	}))
}));

jest.unstable_mockModule('../../src/ui/parse-prd.js', () => ({
	displayParsePrdStart: jest.fn(),
	displayParsePrdSummary: jest.fn()
}));

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

describe('MCP parse-prd --auto integration', () => {
	let tempDir;
	let testPRDPath;
	let tasksPath;

	const samplePRDContent = `# Test Project PRD

## Overview
Build a task management application.

## Features
1. User authentication
2. Task management
3. Project organization

## Technical Requirements
- React frontend
- Node.js backend
- PostgreSQL database

## Success Criteria
- Users can manage tasks
- System is reliable`;

	beforeAll(() => {
		// Create temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-parse-prd-auto-test-'));
		testPRDPath = path.join(tempDir, 'test-prd.txt');
		tasksPath = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');

		// Create directory structure
		fs.mkdirSync(path.join(tempDir, '.taskmaster', 'tasks'), { recursive: true });

		// Write test PRD file
		fs.writeFileSync(testPRDPath, samplePRDContent);

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

	describe('MCP tool schema validation', () => {
		it('should accept auto parameter in MCP tool', async () => {
			// Import the MCP tool
			const { registerParsePrdTool } = await import('../../mcp-server/src/tools/parse-prd.js');

			// Create a mock server
			const mockServer = {
				addTool: jest.fn()
			};

			// Register the tool
			registerParsePrdTool(mockServer);

			// Verify the tool was registered
			expect(mockServer.addTool).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'parse_prd',
					description: expect.stringContaining('parse-prd'),
					parameters: expect.objectContaining({
						type: 'object',
						properties: expect.objectContaining({
							auto: expect.objectContaining({
								type: 'boolean',
								description: expect.stringContaining('auto')
							}),
							autoThreshold: expect.objectContaining({
								type: 'string',
								description: expect.stringContaining('threshold')
							})
						})
					})
				})
			);
		});

		it('should validate auto parameter types', async () => {
			const { registerParsePrdTool } = await import('../../mcp-server/src/tools/parse-prd.js');

			const mockServer = {
				addTool: jest.fn()
			};

			registerParsePrdTool(mockServer);

			const toolConfig = mockServer.addTool.mock.calls[0][0];
			const autoParam = toolConfig.parameters.properties.auto;
			const autoThresholdParam = toolConfig.parameters.properties.autoThreshold;

			// Verify parameter types
			expect(autoParam.type).toBe('boolean');
			expect(autoThresholdParam.type).toBe('string');
			expect(autoThresholdParam.default).toBe('7');
		});
	});

	describe('MCP server execution', () => {
		it('should execute parse-prd with auto flag successfully', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: true,
				autoThreshold: '7',
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			expect(result.success).toBe(true);
			expect(result.data.tasksPath).toBe(tasksPath);
			expect(result.data.autoExpansion).toBeDefined();
			expect(result.data.autoExpansion.success).toBe(true);
		});

		it('should handle auto parameter defaults', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: true,
				// autoThreshold not specified - should use default
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			expect(result.success).toBe(true);
			expect(result.data.autoExpansion).toBeDefined();
		});

		it('should handle auto=false (disabled)', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: false,
				autoThreshold: '7',
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			expect(result.success).toBe(true);
			expect(result.data.tasksPath).toBe(tasksPath);
			expect(result.data.autoExpansion).toBeUndefined();
		});
	});

	describe('Error handling in MCP context', () => {
		it('should handle auto-expansion failure gracefully', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			// Mock auto-expansion failure
			const { runAutoComplexityExpansion } = await import('../../scripts/modules/task-manager/auto-complexity-expansion.js');
			runAutoComplexityExpansion.mockRejectedValue(new Error('Auto-expansion failed'));

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: true,
				autoThreshold: '7',
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			// PRD parsing should still succeed
			expect(result.success).toBe(true);
			expect(result.data.tasksPath).toBe(tasksPath);

			// Auto-expansion should be undefined (failed)
			expect(result.data.autoExpansion).toBeUndefined();
		});

		it('should handle invalid autoThreshold values', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: true,
				autoThreshold: 'invalid',
				research: false,
				projectRoot: tempDir
			};

			// Should not throw, but auto-expansion might fail
			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			expect(result.success).toBe(true);
		});
	});

	describe('Response structure validation', () => {
		it('should return proper MCP response structure', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: true,
				autoThreshold: '7',
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			// Verify MCP response structure
			expect(result).toHaveProperty('success');
			expect(result).toHaveProperty('data');
			expect(result.success).toBe(true);

			// Verify data structure
			expect(result.data).toHaveProperty('tasksPath');
			expect(result.data).toHaveProperty('autoExpansion');
			expect(result.data).toHaveProperty('telemetryData');

			// Verify auto-expansion result structure
			expect(result.data.autoExpansion).toHaveProperty('success');
			expect(result.data.autoExpansion).toHaveProperty('expandedTasks');
			expect(result.data.autoExpansion).toHaveProperty('skippedTasks');
			expect(result.data.autoExpansion).toHaveProperty('failedTasks');
		});

		it('should include telemetry data in response', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: tasksPath,
				numTasks: 2,
				force: true,
				auto: true,
				autoThreshold: '7',
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			// Verify telemetry data is present
			expect(result.data.telemetryData).toBeDefined();
			expect(result.data.autoExpansion.complexityTelemetryData).toBeDefined();
			expect(result.data.autoExpansion.expansionTelemetryData).toBeDefined();

			// Verify telemetry structure
			expect(result.data.telemetryData).toHaveProperty('timestamp');
			expect(result.data.telemetryData).toHaveProperty('commandName');
			expect(result.data.telemetryData).toHaveProperty('modelUsed');
			expect(result.data.telemetryData).toHaveProperty('providerName');
			expect(result.data.telemetryData).toHaveProperty('totalTokens');
			expect(result.data.telemetryData).toHaveProperty('totalCost');
		});
	});

	describe('Tag support in MCP', () => {
		it('should work with different tag contexts in MCP', async () => {
			const { parsePRDDirect } = await import('../../mcp-server/src/core/direct-functions/parse-prd.js');

			const customTagPath = path.join(tempDir, '.taskmaster', 'tasks', 'feature-branch-tasks.json');

			const mockLog = {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
				success: jest.fn()
			};

			const args = {
				input: testPRDPath,
				output: customTagPath,
				numTasks: 2,
				force: true,
				auto: true,
				autoThreshold: '7',
				tag: 'feature-branch',
				research: false,
				projectRoot: tempDir
			};

			const result = await parsePRDDirect(args, mockLog, { session: 'test-session' });

			expect(result.success).toBe(true);
			expect(result.data.tasksPath).toBe(customTagPath);
			expect(fs.existsSync(customTagPath)).toBe(true);
		});
	});
});
