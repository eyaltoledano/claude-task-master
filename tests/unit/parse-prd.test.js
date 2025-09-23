// In tests/unit/parse-prd.test.js
// Testing parse-prd.js file extension compatibility with real files

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the AI services to avoid real API calls
jest.unstable_mockModule(
	'../../scripts/modules/ai-services-unified.js',
	() => ({
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
					tasks: [{ id: 1, title: 'Test Task', priority: 'high' }]
				})
			};
		})
	})
);

// Mock all config-manager exports comprehensively
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

// Mock utils comprehensively to prevent CLI behavior
jest.unstable_mockModule('../../scripts/modules/utils.js', () => ({
	log: jest.fn(),
	writeJSON: jest.fn(),
	enableSilentMode: jest.fn(),
	disableSilentMode: jest.fn(),
	isSilentMode: jest.fn(() => false),
	getCurrentTag: jest.fn(() => 'master'),
	ensureTagMetadata: jest.fn(),
	readJSON: jest.fn(() => ({ master: { tasks: [] } })),
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

// Mock prompt manager
jest.unstable_mockModule('../../scripts/modules/prompt-manager.js', () => ({
	getPromptManager: jest.fn(() => ({
		loadPrompt: jest.fn(() => ({
			systemPrompt: 'Test system prompt',
			userPrompt: 'Test user prompt'
		}))
	}))
}));

// Mock progress/UI components to prevent real CLI UI
jest.unstable_mockModule('../../src/progress/parse-prd-tracker.js', () => ({
	createParsePrdTracker: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		cleanup: jest.fn(),
		addTaskLine: jest.fn(),
		updateTokens: jest.fn(),
		complete: jest.fn(),
		getSummary: jest.fn().mockReturnValue({
			taskPriorities: { high: 0, medium: 0, low: 0 },
			elapsedTime: 0,
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

// Mock task generation to prevent file operations
jest.unstable_mockModule(
	'../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn()
	})
);

// Mock stream parser
jest.unstable_mockModule('../../src/utils/stream-parser.js', () => {
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
		parseStream: jest.fn(),
		StreamingError,
		STREAMING_ERROR_CODES
	};
});

// Mock other potential UI elements
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
	},
	red: jest.fn((text) => text),
	green: jest.fn((text) => text),
	blue: jest.fn((text) => text),
	yellow: jest.fn((text) => text),
	cyan: jest.fn((text) => text),
	white: {
		bold: jest.fn((text) => text)
	}
}));

// Mock boxen
jest.unstable_mockModule('boxen', () => ({
	default: jest.fn((content) => content)
}));

// Mock constants
jest.unstable_mockModule('../../src/constants/task-priority.js', () => ({
	DEFAULT_TASK_PRIORITY: 'medium',
	TASK_PRIORITY_OPTIONS: ['low', 'medium', 'high']
}));

// Mock UI indicators
jest.unstable_mockModule('../../src/ui/indicators.js', () => ({
	getPriorityIndicators: jest.fn(() => ({
		high: '🔴',
		medium: '🟡',
		low: '🟢'
	}))
}));

// Import modules after mocking
const { generateObjectService } = await import(
	'../../scripts/modules/ai-services-unified.js'
);
const parsePRD = (
	await import('../../scripts/modules/task-manager/parse-prd/parse-prd.js')
).default;

describe('parse-prd file extension compatibility', () => {
	let tempDir;
	let testFiles;

	const mockTasksResponse = {
		tasks: [
			{
				id: 1,
				title: 'Test Task 1',
				description: 'First test task',
				status: 'pending',
				dependencies: [],
				priority: 'high',
				details: 'Implementation details for task 1',
				testStrategy: 'Unit tests for task 1'
			},
			{
				id: 2,
				title: 'Test Task 2',
				description: 'Second test task',
				status: 'pending',
				dependencies: [1],
				priority: 'medium',
				details: 'Implementation details for task 2',
				testStrategy: 'Integration tests for task 2'
			}
		],
		metadata: {
			projectName: 'Test Project',
			totalTasks: 2,
			sourceFile: 'test-prd',
			generatedAt: new Date().toISOString()
		}
	};

	const samplePRDContent = `# Test Project PRD

## Overview
Build a simple task management application.

## Features
1. Create and manage tasks
2. Set task priorities
3. Track task dependencies

## Technical Requirements
- React frontend
- Node.js backend
- PostgreSQL database

## Success Criteria
- Users can create tasks successfully
- Task dependencies work correctly`;

	beforeAll(() => {
		// Create temporary directory for test files
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-prd-test-'));

		// Create test files with different extensions
		testFiles = {
			txt: path.join(tempDir, 'test-prd.txt'),
			md: path.join(tempDir, 'test-prd.md'),
			rst: path.join(tempDir, 'test-prd.rst'),
			noExt: path.join(tempDir, 'test-prd')
		};

		// Write the same content to all test files
		Object.values(testFiles).forEach((filePath) => {
			fs.writeFileSync(filePath, samplePRDContent);
		});

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

		// Mock successful AI response
		generateObjectService.mockResolvedValue({
			mainResult: { object: mockTasksResponse },
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: 'test-user',
				commandName: 'parse-prd',
				modelUsed: 'test-model',
				providerName: 'test-provider',
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
				totalCost: 0.01,
				currency: 'USD'
			}
		});
	});

	test('should accept and parse .txt files', async () => {
		const outputPath = path.join(tempDir, 'tasks-txt.json');

		const result = await parsePRD(testFiles.txt, outputPath, 2, {
			force: true,
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
		expect(result.tasksPath).toBe(outputPath);
		expect(fs.existsSync(outputPath)).toBe(true);

		// Verify the content was parsed correctly
		const tasksData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
		expect(tasksData.master.tasks).toHaveLength(2);
		expect(tasksData.master.tasks[0].title).toBe('Test Task 1');
	});

	test('should accept and parse .md files', async () => {
		const outputPath = path.join(tempDir, 'tasks-md.json');

		const result = await parsePRD(testFiles.md, outputPath, 2, {
			force: true,
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
		expect(result.tasksPath).toBe(outputPath);
		expect(fs.existsSync(outputPath)).toBe(true);

		// Verify the content was parsed correctly
		const tasksData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
		expect(tasksData.master.tasks).toHaveLength(2);
	});

	test('should accept and parse files with other text extensions', async () => {
		const outputPath = path.join(tempDir, 'tasks-rst.json');

		const result = await parsePRD(testFiles.rst, outputPath, 2, {
			force: true,
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
		expect(result.tasksPath).toBe(outputPath);
		expect(fs.existsSync(outputPath)).toBe(true);
	});

	test('should accept and parse files with no extension', async () => {
		const outputPath = path.join(tempDir, 'tasks-noext.json');

		const result = await parsePRD(testFiles.noExt, outputPath, 2, {
			force: true,
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
		expect(result.tasksPath).toBe(outputPath);
		expect(fs.existsSync(outputPath)).toBe(true);
	});

	test('should produce identical results regardless of file extension', async () => {
		const outputs = {};

		// Parse each file type with a unique project root to avoid ID conflicts
		for (const [ext, filePath] of Object.entries(testFiles)) {
			// Create a unique subdirectory for each test to isolate them
			const testSubDir = path.join(tempDir, `test-${ext}`);
			fs.mkdirSync(testSubDir, { recursive: true });

			const outputPath = path.join(testSubDir, `tasks.json`);

			await parsePRD(filePath, outputPath, 2, {
				force: true,
				mcpLog: {
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
					debug: jest.fn(),
					success: jest.fn()
				},
				projectRoot: testSubDir
			});

			const tasksData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
			outputs[ext] = tasksData;
		}

		// Compare all outputs - they should be identical (except metadata timestamps)
		const baseOutput = outputs.txt;
		Object.values(outputs).forEach((output) => {
			expect(output.master.tasks).toEqual(baseOutput.master.tasks);
			expect(output.master.metadata.projectName).toEqual(
				baseOutput.master.metadata.projectName
			);
			expect(output.master.metadata.totalTasks).toEqual(
				baseOutput.master.metadata.totalTasks
			);
		});
	});

	test('should handle non-existent files gracefully', async () => {
		const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');
		const outputPath = path.join(tempDir, 'tasks-error.json');

		await expect(
			parsePRD(nonExistentFile, outputPath, 2, {
				force: true,
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
});
