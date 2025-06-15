/**
 * Tests for the add-task.js module
 */
import { jest } from '@jest/globals';

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
	findTaskById: jest.fn((tasks, id) => {
		if (!tasks) return null;
		const allTasks = [];
		const queue = [...tasks];
		while (queue.length > 0) {
			const task = queue.shift();
			allTasks.push(task);
			if (task.subtasks) {
				queue.push(...task.subtasks);
			}
		}
		return allTasks.find((task) => String(task.id) === String(id));
	}),
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
		generateObjectService: jest.fn().mockResolvedValue({
			mainResult: {
				object: {
					title: 'Task from prompt: Create a new authentication system',
					description:
						'Task generated from: Create a new authentication system',
					details:
						'Implementation details for task generated from prompt: Create a new authentication system',
					testStrategy: 'Write unit tests to verify functionality',
					dependencies: []
				}
			},
			telemetryData: {
				timestamp: new Date().toISOString(),
				userId: '1234567890',
				commandName: 'add-task',
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
		getDefaultPriority: jest.fn(() => 'medium')
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => ({
		default: jest.fn().mockImplementation(() => ({
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

// Import the mocked modules
const { readJSON, writeJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateObjectService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

const generateTaskFiles = (
	await import(
		'../../../../../scripts/modules/task-manager/generate-task-files.js'
	)
).default;

// Import the module under test
const { default: addTask } = await import(
	'../../../../../scripts/modules/task-manager/add-task.js'
);

describe('addTask', () => {
	const sampleTasks = {
		master: {
			tasks: [
				{
					id: 1,
					title: 'Task 1',
					description: 'First task',
					status: 'pending',
					dependencies: []
				},
				{
					id: 2,
					title: 'Task 2',
					description: 'Second task',
					status: 'pending',
					dependencies: []
				},
				{
					id: 3,
					title: 'Task 3',
					description: 'Third task',
					status: 'pending',
					dependencies: [1]
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
		readJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks)));

		// Mock console.log to avoid output during tests
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		console.log.mockRestore();
	});

	test('should add a new task using AI', async () => {
		// Arrange
		const prompt = 'Create a new authentication system';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act
		const result = await addTask(
			'tasks/tasks.json',
			prompt,
			[],
			'medium',
			context,
			'json'
		);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			'/mock/project/root'
		);
		expect(generateObjectService).toHaveBeenCalledWith(expect.any(Object));
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				master: expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 4, // Next ID after existing tasks
							title: expect.stringContaining(
								'Create a new authentication system'
							),
							status: 'pending'
						})
					])
				})
			})
		);
		expect(result).toEqual(
			expect.objectContaining({
				newTaskId: 4,
				telemetryData: expect.any(Object)
			})
		);
	});

	test('should validate dependencies when adding a task', async () => {
		// Arrange
		const prompt = 'Create a new authentication system';
		const validDependencies = [1, 2]; // These exist in sampleTasks
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act
		const result = await addTask(
			'tasks/tasks.json',
			prompt,
			validDependencies,
			'medium',
			context,
			'json'
		);

		// Assert
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				master: expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 4,
							dependencies: validDependencies
						})
					])
				})
			})
		);
	});

	test('should filter out invalid dependencies', async () => {
		// Arrange
		const prompt = 'Create a new authentication system';
		const invalidDependencies = [999]; // Non-existent task ID
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act
		const result = await addTask(
			'tasks/tasks.json',
			prompt,
			invalidDependencies,
			'medium',
			context,
			'json'
		);

		// Assert
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				master: expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 4,
							dependencies: [] // Invalid dependencies should be filtered out
						})
					])
				})
			})
		);
		expect(context.mcpLog.warn).toHaveBeenCalledWith(
			expect.stringContaining(
				'The following dependencies do not exist or are invalid: 999'
			)
		);
	});

	test('should use specified priority', async () => {
		// Arrange
		const prompt = 'Create a new authentication system';
		const priority = 'high';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act
		await addTask('tasks/tasks.json', prompt, [], priority, context, 'json');

		// Assert
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				master: expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							priority: priority
						})
					])
				})
			})
		);
	});

	test('should handle empty tasks file', async () => {
		// Arrange
		readJSON.mockReturnValue({ master: { tasks: [] } });
		const prompt = 'Create a new authentication system';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act
		const result = await addTask(
			'tasks/tasks.json',
			prompt,
			[],
			'medium',
			context,
			'json'
		);

		// Assert
		expect(result.newTaskId).toBe(1); // First task should have ID 1
		expect(writeJSON).toHaveBeenCalledWith(
			'tasks/tasks.json',
			expect.objectContaining({
				master: expect.objectContaining({
					tasks: expect.arrayContaining([
						expect.objectContaining({
							id: 1
						})
					])
				})
			})
		);
	});

	test('should handle missing tasks file', async () => {
		// Arrange
		readJSON.mockReturnValue(null);
		const prompt = 'Create a new authentication system';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act
		const result = await addTask(
			'tasks/tasks.json',
			prompt,
			[],
			'medium',
			context,
			'json'
		);

		// Assert
		expect(result.newTaskId).toBe(1); // First task should have ID 1
		expect(writeJSON).toHaveBeenCalledTimes(1); // Should create file and add task in one go.
	});

	test('should handle AI service errors', async () => {
		// Arrange
		generateObjectService.mockRejectedValueOnce(new Error('AI service failed'));
		const prompt = 'Create a new authentication system';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act & Assert
		await expect(
			addTask('tasks/tasks.json', prompt, [], 'medium', context, 'json')
		).rejects.toThrow('AI service failed');
	});

	test('should handle file read errors', async () => {
		// Arrange
		readJSON.mockImplementation(() => {
			throw new Error('File read failed');
		});
		const prompt = 'Create a new authentication system';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act & Assert
		await expect(
			addTask('tasks/tasks.json', prompt, [], 'medium', context, 'json')
		).rejects.toThrow('File read failed');
	});

	test('should handle file write errors', async () => {
		// Arrange
		writeJSON.mockImplementation(() => {
			throw new Error('File write failed');
		});
		const prompt = 'Create a new authentication system';
		const context = {
			mcpLog: createMcpLogMock(),
			projectRoot: '/mock/project/root'
		};

		// Act & Assert
		await expect(
			addTask('tasks/tasks.json', prompt, [], 'medium', context, 'json')
		).rejects.toThrow('File write failed');
	});
});
