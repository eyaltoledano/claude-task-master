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
	resolveEnvVariable: jest.fn((varName) => `mock_${varName}`)
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
const { readJSON, writeJSON, log, findProjectRoot } = await import(
	'../../../../../scripts/modules/utils.js'
);
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
	// Sample task data for testing
	const sampleTasks = {
		meta: { projectName: 'Test Project' },
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
		]
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('should generate task files from tasks.json - working test', async () => {
		// Set up mocks for this specific test
		readJSON.mockImplementationOnce(() => sampleTasks);
		fs.existsSync.mockImplementationOnce(() => true);

		// Call the function
		const tasksPath = 'tasks/tasks.json';
		const outputDir = 'tasks';

		await generateTaskFiles(tasksPath, outputDir, {
			mcpLog: { info: jest.fn() }
		});

		// Verify the data was read
		expect(readJSON).toHaveBeenCalledWith(tasksPath);

		// Verify dependencies were validated
		expect(validateAndFixDependencies).toHaveBeenCalledWith(
			sampleTasks,
			tasksPath
		);

		// Verify files were written for each task
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
		readJSON.mockImplementationOnce(() => sampleTasks);
		fs.existsSync.mockImplementationOnce(() => true);
		formatDependenciesWithStatus.mockReturnValue(
			'✅ Task 1 (done), ⏱️ Task 2 (pending)'
		);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Verify formatDependenciesWithStatus was called for tasks with dependencies
		expect(formatDependenciesWithStatus).toHaveBeenCalled();
	});

	test('should handle tasks with no subtasks', async () => {
		// Create data with tasks that have no subtasks
		const tasksWithoutSubtasks = {
			meta: { projectName: 'Test Project' },
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
			]
		};

		readJSON.mockImplementationOnce(() => tasksWithoutSubtasks);
		fs.existsSync.mockImplementationOnce(() => true);

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

	test("should create the output directory if it doesn't exist", async () => {
		// Set up mocks
		readJSON.mockImplementationOnce(() => sampleTasks);
		fs.existsSync.mockImplementation((path) => {
			if (path === 'tasks') return false; // Directory doesn't exist
			return true; // Other paths exist
		});

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Verify mkdir was called
		expect(fs.mkdirSync).toHaveBeenCalledWith('tasks', { recursive: true });
	});

	test('should format task files with proper sections', async () => {
		// Set up mocks
		readJSON.mockImplementationOnce(() => sampleTasks);
		fs.existsSync.mockImplementationOnce(() => true);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Get the content written to the first task file
		const firstTaskContent = fs.writeFileSync.mock.calls[0][1];

		// Verify the content includes expected sections
		expect(firstTaskContent).toContain('# Task ID: 1');
		expect(firstTaskContent).toContain('# Title: Task 1');
		expect(firstTaskContent).toContain('# Description');
		expect(firstTaskContent).toContain('# Status');
		expect(firstTaskContent).toContain('# Priority');
		expect(firstTaskContent).toContain('# Dependencies');
		expect(firstTaskContent).toContain('# Details:');
		expect(firstTaskContent).toContain('# Test Strategy:');
	});

	test('should include subtasks in task files when present', async () => {
		// Set up mocks
		readJSON.mockImplementationOnce(() => sampleTasks);
		fs.existsSync.mockImplementationOnce(() => true);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Get the content written to the task file with subtasks (task 3)
		const taskWithSubtasksContent = fs.writeFileSync.mock.calls[2][1];

		// Verify the content includes subtasks section
		expect(taskWithSubtasksContent).toContain('# Subtasks:');
		expect(taskWithSubtasksContent).toContain('## 1. Subtask 1');
		expect(taskWithSubtasksContent).toContain('## 2. Subtask 2');
	});

	test('should handle errors during file generation', () => {
		// Mock an error in readJSON
		readJSON.mockImplementationOnce(() => {
			throw new Error('File read failed');
		});

		// Call the function and expect it to handle the error
		expect(() => {
			generateTaskFiles('tasks/tasks.json', 'tasks', {
				mcpLog: { info: jest.fn() }
			});
		}).toThrow('File read failed');
	});

	test('should validate dependencies before generating files', async () => {
		// Set up mocks
		readJSON.mockImplementationOnce(() => sampleTasks);
		fs.existsSync.mockImplementationOnce(() => true);

		// Call the function
		await generateTaskFiles('tasks/tasks.json', 'tasks', {
			mcpLog: { info: jest.fn() }
		});

		// Verify validateAndFixDependencies was called
		expect(validateAndFixDependencies).toHaveBeenCalledWith(
			sampleTasks,
			'tasks/tasks.json'
		);
	});
});
