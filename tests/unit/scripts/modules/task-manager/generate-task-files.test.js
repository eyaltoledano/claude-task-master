/**
 * Tests for the generate-task-files.js module
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
jest.unstable_mockModule('fs', () => ({
	default: {
		existsSync: jest.fn(),
		mkdirSync: jest.fn(),
		readdirSync: jest.fn(),
		unlinkSync: jest.fn(),
		writeFileSync: jest.fn()
	},
	existsSync: jest.fn(),
	mkdirSync: jest.fn(),
	readdirSync: jest.fn(),
	unlinkSync: jest.fn(),
	writeFileSync: jest.fn()
}));

jest.unstable_mockModule('path', () => ({
	default: {
		join: jest.fn((...args) => args.join('/')),
		dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/'))
	},
	join: jest.fn((...args) => args.join('/')),
	dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/'))
}));

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
	findTaskById: jest.fn((tasks, id) =>
		tasks.find((t) => t.id === parseInt(id))
	),
	findProjectRoot: jest.fn(() => '/mock/project/root'),
	resolveEnvVariable: jest.fn((varName) => `mock_${varName}`),
	ensureTagMetadata: jest.fn()
}));

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	formatDependenciesWithStatus: jest.fn(),
	displayBanner: jest.fn(),
	displayTaskList: jest.fn(),
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
	stopLoadingIndicator: jest.fn(),
	createProgressBar: jest.fn(() => ' MOCK_PROGRESS_BAR '),
	getStatusWithColor: jest.fn((status) => status),
	getComplexityWithColor: jest.fn((score) => `Score: ${score}`)
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/dependency-manager.js',
	() => ({
		validateAndFixDependencies: jest.fn(),
		validateTaskDependencies: jest.fn()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false),
		getProjectName: jest.fn(() => 'Test Project')
	})
);

// Import the mocked modules
const { readJSON, writeJSON, log, findProjectRoot, ensureTagMetadata } =
	await import('../../../../../scripts/modules/utils.js');
const { formatDependenciesWithStatus } = await import(
	'../../../../../scripts/modules/ui.js'
);
const { validateAndFixDependencies } = await import(
	'../../../../../scripts/modules/dependency-manager.js'
);

const fs = (await import('fs')).default;
const path = (await import('path')).default;

// Import the module under test
const { default: generateTaskFiles } = await import(
	'../../../../../scripts/modules/task-manager/generate-task-files.js'
);

describe('generateTaskFiles', () => {
	// Sample task data for testing - updated to tagged format
	const sampleTasksData = {
		master: {
			tasks: [
				{
					id: 1,
					title: 'Task 1',
					description: 'First task description',
					status: 'pending',
					dependencies: [],
					priority: 'high',
					details: 'Detailed information for task 1',
					testStrategy: 'Test strategy for task 1'
				},
				{
					id: 2,
					title: 'Task 2',
					description: 'Second task description',
					status: 'pending',
					dependencies: [1],
					priority: 'medium',
					details: 'Detailed information for task 2',
					testStrategy: 'Test strategy for task 2'
				},
				{
					id: 3,
					title: 'Task with Subtasks',
					description: 'Task with subtasks description',
					status: 'pending',
					dependencies: [1, 2],
					priority: 'high',
					details: 'Detailed information for task 3',
					testStrategy: 'Test strategy for task 3',
					subtasks: [
						{
							id: 1,
							title: 'Subtask 1',
							description: 'First subtask',
							status: 'pending',
							dependencies: [],
							details: 'Details for subtask 1'
						},
						{
							id: 2,
							title: 'Subtask 2',
							description: 'Second subtask',
							status: 'pending',
							dependencies: [1],
							details: 'Details for subtask 2'
						}
					]
				}
			],
			metadata: {
				projectName: 'Test Project',
				created: '2024-01-01T00:00:00.000Z',
				updated: '2024-01-01T00:00:00.000Z'
			}
		}
	};

	beforeEach(() => {
		jest.clearAllMocks();
		// Mock readJSON to return the full tagged structure
		readJSON.mockImplementation((tasksPath, projectRoot, tag) => {
			if (tag && sampleTasksData[tag]) {
				return {
					...sampleTasksData[tag],
					tag,
					_rawTaggedData: sampleTasksData
				};
			}
			// Default to master if no tag or tag not found
			return {
				...sampleTasksData.master,
				tag: 'master',
				_rawTaggedData: sampleTasksData
			};
		});
	});

	test('should generate task files from tasks.json - working test', async () => {
		// Set up mocks for this specific test
		fs.existsSync.mockReturnValue(true);

		// Call the function
		const tasksPath = 'tasks/tasks.json';
		const outputDir = 'tasks';

		await generateTaskFiles(tasksPath, outputDir, {
			mcpLog: { info: jest.fn() }
		});

		// Verify the data was read with new signature, defaulting to master
		expect(readJSON).toHaveBeenCalledWith(tasksPath, undefined);

		// Verify dependencies were validated with the raw tagged data
		expect(validateAndFixDependencies).toHaveBeenCalledWith(
			sampleTasksData,
			tasksPath,
			undefined,
			'master'
		);

		// Verify files were written for each task in the master tag
		expect(fs.writeFileSync).toHaveBeenCalledTimes(3);

		// Verify specific file paths
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			'tasks/task_001.txt',
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			'tasks/task_002.txt',
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			'tasks/task_003.txt',
			expect.any(String)
		);
	});

	test('should format dependencies with status indicators', async () => {
		// Set up mocks
		fs.existsSync.mockReturnValue(true);
		formatDependenciesWithStatus.mockReturnValue(
			'✅ Task 1 (done), ⏱️ Task 2 (pending)'
		);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Verify formatDependenciesWithStatus was called for tasks with dependencies
		// It will be called multiple times, once for each task that has dependencies.
		expect(formatDependenciesWithStatus).toHaveBeenCalled();
	});

	test('should handle tasks with no subtasks', async () => {
		// Create data with tasks that have no subtasks - updated to tagged format
		const tasksWithoutSubtasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Simple Task',
						description: 'A simple task without subtasks',
						status: 'pending',
						dependencies: [],
						priority: 'medium',
						details: 'Simple task details',
						testStrategy: 'Simple test strategy'
					}
				],
				metadata: {
					projectName: 'Test Project',
					created: '2024-01-01T00:00:00.000Z',
					updated: '2024-01-01T00:00:00.000Z'
				}
			}
		};

		// Update the mock for this specific test case
		readJSON.mockImplementation((tasksPath, projectRoot, tag) => {
			return {
				...tasksWithoutSubtasks.master,
				tag: 'master',
				_rawTaggedData: tasksWithoutSubtasks
			};
		});

		fs.existsSync.mockReturnValue(true);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Verify the file was written
		expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			'tasks/task_001.txt',
			expect.any(String)
		);
	});

	test('should validate dependencies before generating files', async () => {
		// Set up mocks
		fs.existsSync.mockReturnValue(true);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Verify validateAndFixDependencies was called with the raw tagged data
		expect(validateAndFixDependencies).toHaveBeenCalledWith(
			sampleTasksData,
			'tasks/tasks.json',
			undefined,
			'master'
		);
	});
});
