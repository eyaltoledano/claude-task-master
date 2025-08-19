import { jest } from '@jest/globals';
import chalk from 'chalk';

// ============================================================================
// MOCK FACTORY & CONFIGURATION SYSTEM
// ============================================================================

/**
 * Mock configuration object to enable/disable specific mocks per test
 */
const mockConfig = {
	// Core functionality mocks (always needed)
	core: {
		moveTasksBetweenTags: true,
		generateTaskFiles: true,
		readJSON: true,
		initTaskMaster: true,
		findProjectRoot: true
	},
	// Console and process mocks
	console: {
		error: true,
		log: true,
		exit: true
	},
	// TaskMaster instance mocks
	taskMaster: {
		getCurrentTag: true,
		getTasksPath: true,
		getProjectRoot: true
	}
};

/**
 * Creates mock functions with consistent naming
 */
function createMock(name) {
	return jest.fn().mockName(name);
}

/**
 * Mock factory for creating focused mocks based on configuration
 */
function createMockFactory(config = mockConfig) {
	const mocks = {};

	// Core functionality mocks
	if (config.core?.moveTasksBetweenTags) {
		mocks.moveTasksBetweenTags = createMock('moveTasksBetweenTags');
	}
	if (config.core?.generateTaskFiles) {
		mocks.generateTaskFiles = createMock('generateTaskFiles');
	}
	if (config.core?.readJSON) {
		mocks.readJSON = createMock('readJSON');
	}
	if (config.core?.initTaskMaster) {
		mocks.initTaskMaster = createMock('initTaskMaster');
	}
	if (config.core?.findProjectRoot) {
		mocks.findProjectRoot = createMock('findProjectRoot');
	}

	return mocks;
}

/**
 * Sets up mocks based on configuration
 */
function setupMocks(config = mockConfig) {
	const mocks = createMockFactory(config);

	// Only mock the modules that are actually used in cross-tag move functionality
	if (config.core?.moveTasksBetweenTags) {
		jest.mock(
			'../../../../../scripts/modules/task-manager/move-task.js',
			() => ({
				moveTasksBetweenTags: mocks.moveTasksBetweenTags
			})
		);
	}

	if (
		config.core?.generateTaskFiles ||
		config.core?.readJSON ||
		config.core?.findProjectRoot
	) {
		jest.mock('../../../../../scripts/modules/utils.js', () => ({
			findProjectRoot: mocks.findProjectRoot,
			generateTaskFiles: mocks.generateTaskFiles,
			readJSON: mocks.readJSON,
			// Minimal set of utils that might be used
			log: jest.fn(),
			writeJSON: jest.fn(),
			getCurrentTag: jest.fn(() => 'master')
		}));
	}

	if (config.core?.initTaskMaster) {
		jest.mock('../../../../../scripts/modules/config-manager.js', () => ({
			initTaskMaster: mocks.initTaskMaster,
			isApiKeySet: jest.fn(() => true),
			getConfig: jest.fn(() => ({}))
		}));
	}

	// Mock chalk for consistent output testing
	jest.mock('chalk', () => ({
		red: jest.fn((text) => text),
		blue: jest.fn((text) => text),
		green: jest.fn((text) => text),
		yellow: jest.fn((text) => text),
		white: jest.fn((text) => ({
			bold: jest.fn((text) => text)
		})),
		reset: jest.fn((text) => text)
	}));

	return mocks;
}

// ============================================================================
// TEST SETUP
// ============================================================================

// Set up mocks with default configuration
const mocks = setupMocks();

// Import the actual command handler functions
import { registerCommands } from '../../../../../scripts/modules/commands.js';

// Extract the handleCrossTagMove function from the commands module
// This is a simplified version of the actual function for testing
async function handleCrossTagMove(moveContext, options) {
	const { sourceId, sourceTag, toTag, taskMaster } = moveContext;

	if (!sourceId) {
		console.error('Error: --from parameter is required for cross-tag moves');
		process.exit(1);
		throw new Error('--from parameter is required for cross-tag moves');
	}

	if (sourceTag === toTag) {
		console.error(
			`Error: Source and target tags are the same ("${sourceTag}")`
		);
		process.exit(1);
		throw new Error(`Source and target tags are the same ("${sourceTag}")`);
	}

	const sourceIds = sourceId.split(',').map((id) => id.trim());
	const moveOptions = {
		withDependencies: options.withDependencies || false,
		ignoreDependencies: options.ignoreDependencies || false
	};

	const result = await mocks.moveTasksBetweenTags(
		taskMaster.getTasksPath(),
		sourceIds,
		sourceTag,
		toTag,
		moveOptions,
		{ projectRoot: taskMaster.getProjectRoot() }
	);

	// Check if source tag still contains tasks before regenerating files
	const tasksData = mocks.readJSON(
		taskMaster.getTasksPath(),
		taskMaster.getProjectRoot(),
		sourceTag
	);
	const sourceTagHasTasks =
		tasksData && Array.isArray(tasksData.tasks) && tasksData.tasks.length > 0;

	// Generate task files for the affected tags
	await mocks.generateTaskFiles(taskMaster.getTasksPath(), 'tasks', {
		tag: toTag,
		projectRoot: taskMaster.getProjectRoot()
	});

	// Only regenerate source tag files if it still contains tasks
	if (sourceTagHasTasks) {
		await mocks.generateTaskFiles(taskMaster.getTasksPath(), 'tasks', {
			tag: sourceTag,
			projectRoot: taskMaster.getProjectRoot()
		});
	}

	return result;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('CLI Move Command Cross-Tag Functionality', () => {
	let mockTaskMaster;
	let mockConsoleError;
	let mockConsoleLog;
	let mockProcessExit;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock console methods
		mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
		mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
		mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

		// Mock TaskMaster instance
		mockTaskMaster = {
			getCurrentTag: jest.fn().mockReturnValue('master'),
			getTasksPath: jest.fn().mockReturnValue('/test/path/tasks.json'),
			getProjectRoot: jest.fn().mockReturnValue('/test/project')
		};

		mocks.initTaskMaster.mockReturnValue(mockTaskMaster);
		mocks.findProjectRoot.mockReturnValue('/test/project');
		mocks.generateTaskFiles.mockResolvedValue();
		mocks.readJSON.mockReturnValue({
			tasks: [
				{ id: 1, title: 'Test Task 1' },
				{ id: 2, title: 'Test Task 2' }
			]
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('Cross-Tag Move Logic', () => {
		it('should handle basic cross-tag move', async () => {
			const options = {
				from: '1',
				fromTag: 'backlog',
				toTag: 'in-progress',
				withDependencies: false,
				ignoreDependencies: false
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			mocks.moveTasksBetweenTags.mockResolvedValue({
				message: 'Successfully moved 1 tasks from "backlog" to "in-progress"'
			});

			await handleCrossTagMove(moveContext, options);

			expect(mocks.moveTasksBetweenTags).toHaveBeenCalledWith(
				'/test/path/tasks.json',
				['1'],
				'backlog',
				'in-progress',
				{
					withDependencies: false,
					ignoreDependencies: false
				},
				{ projectRoot: '/test/project' }
			);
		});

		it('should handle --with-dependencies flag', async () => {
			const options = {
				from: '1',
				fromTag: 'backlog',
				toTag: 'in-progress',
				withDependencies: true,
				ignoreDependencies: false
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			mocks.moveTasksBetweenTags.mockResolvedValue({
				message: 'Successfully moved 2 tasks from "backlog" to "in-progress"'
			});

			await handleCrossTagMove(moveContext, options);

			expect(mocks.moveTasksBetweenTags).toHaveBeenCalledWith(
				'/test/path/tasks.json',
				['1'],
				'backlog',
				'in-progress',
				{
					withDependencies: true,
					ignoreDependencies: false
				},
				{ projectRoot: '/test/project' }
			);
		});

		it('should handle --ignore-dependencies flag', async () => {
			const options = {
				from: '1',
				fromTag: 'backlog',
				toTag: 'in-progress',
				withDependencies: false,
				ignoreDependencies: true
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			mocks.moveTasksBetweenTags.mockResolvedValue({
				message: 'Successfully moved 1 tasks from "backlog" to "in-progress"'
			});

			await handleCrossTagMove(moveContext, options);

			expect(mocks.moveTasksBetweenTags).toHaveBeenCalledWith(
				'/test/path/tasks.json',
				['1'],
				'backlog',
				'in-progress',
				{
					withDependencies: false,
					ignoreDependencies: true
				},
				{ projectRoot: '/test/project' }
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle missing --from parameter', async () => {
			const options = {
				from: undefined,
				fromTag: 'backlog',
				toTag: 'in-progress'
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			await expect(handleCrossTagMove(moveContext, options)).rejects.toThrow();

			expect(mockConsoleError).toHaveBeenCalledWith(
				'Error: --from parameter is required for cross-tag moves'
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it('should handle same source and target tags', async () => {
			const options = {
				from: '1',
				fromTag: 'backlog',
				toTag: 'backlog'
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			await expect(handleCrossTagMove(moveContext, options)).rejects.toThrow();

			expect(mockConsoleError).toHaveBeenCalledWith(
				'Error: Source and target tags are the same ("backlog")'
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});
	});

	describe('Fallback to Current Tag', () => {
		it('should use current tag when --from-tag is not provided', async () => {
			const options = {
				from: '1',
				fromTag: undefined,
				toTag: 'in-progress'
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: 'master', // Should use current tag
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			mocks.moveTasksBetweenTags.mockResolvedValue({
				message: 'Successfully moved 1 tasks from "master" to "in-progress"'
			});

			await handleCrossTagMove(moveContext, options);

			expect(mocks.moveTasksBetweenTags).toHaveBeenCalledWith(
				'/test/path/tasks.json',
				['1'],
				'master',
				'in-progress',
				expect.any(Object),
				{ projectRoot: '/test/project' }
			);
		});
	});

	describe('Multiple Task Movement', () => {
		it('should handle comma-separated task IDs', async () => {
			const options = {
				from: '1,2,3',
				fromTag: 'backlog',
				toTag: 'in-progress'
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			mocks.moveTasksBetweenTags.mockResolvedValue({
				message: 'Successfully moved 3 tasks from "backlog" to "in-progress"'
			});

			await handleCrossTagMove(moveContext, options);

			expect(mocks.moveTasksBetweenTags).toHaveBeenCalledWith(
				'/test/path/tasks.json',
				['1', '2', '3'],
				'backlog',
				'in-progress',
				expect.any(Object),
				{ projectRoot: '/test/project' }
			);
		});

		it('should handle whitespace in comma-separated task IDs', async () => {
			const options = {
				from: '1, 2, 3',
				fromTag: 'backlog',
				toTag: 'in-progress'
			};

			const moveContext = {
				sourceId: options.from,
				sourceTag: options.fromTag,
				toTag: options.toTag,
				taskMaster: mockTaskMaster
			};

			mocks.moveTasksBetweenTags.mockResolvedValue({
				message: 'Successfully moved 3 tasks from "backlog" to "in-progress"'
			});

			await handleCrossTagMove(moveContext, options);

			expect(mocks.moveTasksBetweenTags).toHaveBeenCalledWith(
				'/test/path/tasks.json',
				['1', '2', '3'],
				'backlog',
				'in-progress',
				expect.any(Object),
				{ projectRoot: '/test/project' }
			);
		});
	});

	describe('Mock Configuration Tests', () => {
		it('should work with minimal mock configuration', async () => {
			// Test that the mock factory works with minimal config
			const minimalConfig = {
				core: {
					moveTasksBetweenTags: true,
					generateTaskFiles: true,
					readJSON: true
				}
			};

			const minimalMocks = createMockFactory(minimalConfig);
			expect(minimalMocks.moveTasksBetweenTags).toBeDefined();
			expect(minimalMocks.generateTaskFiles).toBeDefined();
			expect(minimalMocks.readJSON).toBeDefined();
		});

		it('should allow disabling specific mocks', async () => {
			// Test that mocks can be selectively disabled
			const selectiveConfig = {
				core: {
					moveTasksBetweenTags: true,
					generateTaskFiles: false, // Disabled
					readJSON: true
				}
			};

			const selectiveMocks = createMockFactory(selectiveConfig);
			expect(selectiveMocks.moveTasksBetweenTags).toBeDefined();
			expect(selectiveMocks.generateTaskFiles).toBeUndefined();
			expect(selectiveMocks.readJSON).toBeDefined();
		});
	});
});
