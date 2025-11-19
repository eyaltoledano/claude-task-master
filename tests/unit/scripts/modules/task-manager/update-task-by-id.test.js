import { jest } from '@jest/globals';

jest.unstable_mockModule('fs', () => {
	const mockFs = {
		existsSync: jest.fn(() => true),
		writeFileSync: jest.fn(),
		readFileSync: jest.fn(),
		unlinkSync: jest.fn()
	};
	return { default: mockFs, ...mockFs };
});

jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	isSilentMode: jest.fn(() => false),
	findProjectRoot: jest.fn(() => '/project'),
	flattenTasksWithSubtasks: jest.fn(() => []),
	truncate: jest.fn((t) => t),
	isEmpty: jest.fn(() => false),
	resolveEnvVariable: jest.fn(),
	findTaskById: jest.fn(),
	getCurrentTag: jest.fn(() => 'master'),
	resolveTag: jest.fn(() => 'master'),
	addComplexityToTask: jest.fn((task, complexity) => ({ ...task, complexity })),
	getTasksForTag: jest.fn((data, tag) => data[tag]?.tasks || []),
	setTasksForTag: jest.fn(),
	ensureTagMetadata: jest.fn((tagObj) => tagObj)
}));

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	displayBanner: jest.fn(),
	getStatusWithColor: jest.fn((s) => s),
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
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
		generateTextService: jest
			.fn()
			.mockResolvedValue({ mainResult: { content: '{}' }, telemetryData: {} }),
		generateObjectService: jest.fn().mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					title: 'Updated Task',
					description: 'Updated description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: null,
					testStrategy: null,
					subtasks: []
				}
			},
			telemetryData: {}
		})
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false),
		isApiKeySet: jest.fn(() => true),
		hasCodebaseAnalysis: jest.fn(() => false)
	})
);

// Mock @tm/bridge module
jest.unstable_mockModule('@tm/bridge', () => ({
	tryUpdateViaRemote: jest.fn().mockResolvedValue(null)
}));

// Mock bridge-utils module
jest.unstable_mockModule(
	'../../../../../scripts/modules/bridge-utils.js',
	() => ({
		createBridgeLogger: jest.fn(() => ({
			logger: {
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn()
			},
			report: jest.fn(),
			isMCP: false
		}))
	})
);

// Mock prompt-manager module
jest.unstable_mockModule(
	'../../../../../scripts/modules/prompt-manager.js',
	() => ({
		getPromptManager: jest.fn().mockReturnValue({
			loadPrompt: jest.fn((promptId, params) => ({
				systemPrompt:
					'You are an AI assistant that helps update a software development task with new requirements and information.',
				userPrompt: `Update the following task based on the provided information: ${params?.updatePrompt || 'User prompt for task update'}`,
				metadata: {
					templateId: 'update-task',
					version: '1.0.0',
					variant: 'default',
					parameters: params || {}
				}
			}))
		})
	})
);

// Mock contextGatherer module
jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => ({
		ContextGatherer: jest.fn().mockImplementation(() => ({
			gather: jest.fn().mockResolvedValue({
				fullContext: '',
				summary: ''
			})
		}))
	})
);

// Mock fuzzyTaskSearch module
jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/fuzzyTaskSearch.js',
	() => ({
		FuzzyTaskSearch: jest.fn().mockImplementation(() => ({
			search: jest.fn().mockReturnValue([]),
			findRelevantTasks: jest.fn().mockReturnValue([]),
			getTaskIds: jest.fn().mockReturnValue([])
		}))
	})
);

const { readJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);
const { tryUpdateViaRemote } = await import('@tm/bridge');
const { createBridgeLogger } = await import(
	'../../../../../scripts/modules/bridge-utils.js'
);
const { getPromptManager } = await import(
	'../../../../../scripts/modules/prompt-manager.js'
);
const { ContextGatherer } = await import(
	'../../../../../scripts/modules/utils/contextGatherer.js'
);
const { FuzzyTaskSearch } = await import(
	'../../../../../scripts/modules/utils/fuzzyTaskSearch.js'
);
const { default: updateTaskById } = await import(
	'../../../../../scripts/modules/task-manager/update-task-by-id.js'
);

// Import test fixtures for consistent sample data
import {
	taggedEmptyTasks,
	taggedOneTask
} from '../../../../fixtures/sample-tasks.js';

describe('updateTaskById validation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
	});

	test('throws error if prompt is empty', async () => {
		await expect(
			updateTaskById(
				'tasks/tasks.json',
				1,
				'',
				false,
				{ tag: 'master' },
				'json'
			)
		).rejects.toThrow('Prompt cannot be empty');
	});

	test('throws error if task file missing', async () => {
		const fs = await import('fs');
		fs.existsSync.mockReturnValue(false);
		await expect(
			updateTaskById(
				'tasks/tasks.json',
				1,
				'prompt',
				false,
				{
					tag: 'master'
				},
				'json'
			)
		).rejects.toThrow('Tasks file not found');
	});

	test('throws error when task ID not found', async () => {
		const fs = await import('fs');
		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue(taggedEmptyTasks);
		await expect(
			updateTaskById(
				'tasks/tasks.json',
				42,
				'prompt',
				false,
				{
					tag: 'master'
				},
				'json'
			)
		).rejects.toThrow('Task with ID 42 not found');
		// Note: The error is reported through the bridge logger (report),
		// not the log function, so we don't assert on log being called
	});
});

describe('updateTaskById success path with generateObjectService', () => {
	let fs;
	let generateObjectService;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
		fs = await import('fs');
		const aiServices = await import(
			'../../../../../scripts/modules/ai-services-unified.js'
		);
		generateObjectService = aiServices.generateObjectService;
	});

	test('successfully updates task with all fields from generateObjectService', async () => {
		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Original Task',
					description: 'Original description',
					status: 'pending',
					dependencies: [],
					priority: 'low',
					details: null,
					testStrategy: null,
					subtasks: []
				}
			]
		});

		const updatedTaskData = {
			id: 1,
			title: 'Updated Task',
			description: 'Updated description',
			status: 'pending',
			dependencies: [2],
			priority: 'high',
			details: 'New implementation details',
			testStrategy: 'Unit tests required',
			subtasks: [
				{
					id: 1,
					title: 'Subtask 1',
					description: 'First subtask',
					status: 'pending',
					dependencies: []
				}
			]
		};

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: updatedTaskData
			},
			telemetryData: {
				model: 'claude-3-5-sonnet-20241022',
				inputTokens: 100,
				outputTokens: 200
			}
		});

		const result = await updateTaskById(
			'tasks/tasks.json',
			1,
			'Update task with new requirements',
			false,
			{ tag: 'master' },
			'json'
		);

		// Verify generateObjectService was called (not generateTextService)
		expect(generateObjectService).toHaveBeenCalled();
		const callArgs = generateObjectService.mock.calls[0][0];

		// Verify correct arguments were passed
		expect(callArgs).toMatchObject({
			role: 'main',
			commandName: 'update-task',
			objectName: 'task'
		});
		expect(callArgs.schema).toBeDefined();
		expect(callArgs.systemPrompt).toContain(
			'update a software development task'
		);
		expect(callArgs.prompt).toContain('Update task with new requirements');

		// Verify the returned task contains all expected fields
		expect(result).toEqual({
			updatedTask: expect.objectContaining({
				id: 1,
				title: 'Updated Task',
				description: 'Updated description',
				status: 'pending',
				dependencies: [2],
				priority: 'high',
				details: 'New implementation details',
				testStrategy: 'Unit tests required',
				subtasks: expect.arrayContaining([
					expect.objectContaining({
						id: 1,
						title: 'Subtask 1',
						description: 'First subtask',
						status: 'pending'
					})
				])
			}),
			telemetryData: expect.objectContaining({
				model: 'claude-3-5-sonnet-20241022',
				inputTokens: 100,
				outputTokens: 200
			}),
			tagInfo: undefined
		});
	});

	test('handles generateObjectService with malformed mainResult', async () => {
		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: null,
					testStrategy: null,
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: null // Malformed: task is null
			},
			telemetryData: {}
		});

		await expect(
			updateTaskById(
				'tasks/tasks.json',
				1,
				'Update task',
				false,
				{ tag: 'master' },
				'json'
			)
		).rejects.toThrow('Received invalid task object from AI');
	});

	test('handles generateObjectService with missing required fields', async () => {
		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: null,
					testStrategy: null,
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					// Missing title and description
					status: 'pending',
					dependencies: [],
					priority: 'medium'
				}
			},
			telemetryData: {}
		});

		await expect(
			updateTaskById(
				'tasks/tasks.json',
				1,
				'Update task',
				false,
				{ tag: 'master' },
				'json'
			)
		).rejects.toThrow('Updated task missing required fields');
	});
});

describe('Remote Update via Bridge', () => {
	let fs;
	let generateObjectService;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
		fs = await import('fs');
		const aiServices = await import(
			'../../../../../scripts/modules/ai-services-unified.js'
		);
		generateObjectService = aiServices.generateObjectService;
	});

	test('should use remote update result when tryUpdateViaRemote succeeds', async () => {
		// Arrange - Mock successful remote update
		const remoteResult = {
			success: true,
			message: 'Task updated successfully via remote',
			data: {
				task: {
					id: 1,
					title: 'Updated via Remote',
					description: 'Updated description from remote',
					status: 'in-progress',
					dependencies: [],
					priority: 'high',
					details: 'Remote update details',
					testStrategy: 'Remote test strategy',
					subtasks: []
				}
			}
		};
		tryUpdateViaRemote.mockResolvedValue(remoteResult);

		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Original Task',
					description: 'Original description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Original details',
					testStrategy: 'Original test strategy',
					subtasks: []
				}
			]
		});

		// Act
		const result = await updateTaskById(
			'tasks/tasks.json',
			1,
			'Update this task',
			false,
			{ tag: 'master' },
			'json'
		);

		// Assert - Should use remote result and NOT call local AI service
		expect(tryUpdateViaRemote).toHaveBeenCalled();
		expect(generateObjectService).not.toHaveBeenCalled();
		expect(result).toEqual(remoteResult);
	});

	test('should fallback to local update when tryUpdateViaRemote returns null', async () => {
		// Arrange - Mock remote returning null (no remote available)
		tryUpdateViaRemote.mockResolvedValue(null);

		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Details',
					testStrategy: 'Test strategy',
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					title: 'Updated Task',
					description: 'Updated description',
					status: 'in-progress',
					dependencies: [],
					priority: 'high',
					details: 'Updated details',
					testStrategy: 'Updated test strategy',
					subtasks: []
				}
			},
			telemetryData: {}
		});

		// Act
		await updateTaskById(
			'tasks/tasks.json',
			1,
			'Update this task',
			false,
			{ tag: 'master' },
			'json'
		);

		// Assert - Should fallback to local update
		expect(tryUpdateViaRemote).toHaveBeenCalled();
		expect(generateObjectService).toHaveBeenCalled();
	});

	test('should propagate error when tryUpdateViaRemote throws error', async () => {
		// Arrange - Mock remote throwing error (it re-throws, doesn't return null)
		tryUpdateViaRemote.mockImplementation(() =>
			Promise.reject(new Error('Remote update service unavailable'))
		);

		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Details',
					testStrategy: 'Test strategy',
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					title: 'Updated Task',
					description: 'Updated description',
					status: 'in-progress',
					dependencies: [],
					priority: 'high',
					details: 'Updated details',
					testStrategy: 'Updated test strategy',
					subtasks: []
				}
			},
			telemetryData: {}
		});

		// Act & Assert - Should propagate the error (not fallback to local)
		await expect(
			updateTaskById(
				'tasks/tasks.json',
				1,
				'Update this task',
				false,
				{ tag: 'master' },
				'json'
			)
		).rejects.toThrow('Remote update service unavailable');

		expect(tryUpdateViaRemote).toHaveBeenCalled();
		// Local update should NOT be called when remote throws
		expect(generateObjectService).not.toHaveBeenCalled();
	});
});

describe('Prompt Manager Integration', () => {
	let fs;
	let generateObjectService;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
		fs = await import('fs');
		const aiServices = await import(
			'../../../../../scripts/modules/ai-services-unified.js'
		);
		generateObjectService = aiServices.generateObjectService;
		tryUpdateViaRemote.mockResolvedValue(null); // No remote
	});

	test('should use prompt manager to load update prompts', async () => {
		// Arrange
		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Details',
					testStrategy: 'Test strategy',
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					title: 'Updated Task',
					description: 'Updated description',
					status: 'in-progress',
					dependencies: [],
					priority: 'high',
					details: 'Updated details',
					testStrategy: 'Updated test strategy',
					subtasks: []
				}
			},
			telemetryData: {}
		});

		// Act
		await updateTaskById(
			'tasks/tasks.json',
			1,
			'Update this task with new requirements',
			false,
			{ tag: 'master', projectRoot: '/mock/project' },
			'json'
		);

		// Assert - Prompt manager should be called
		expect(getPromptManager).toHaveBeenCalled();
		const promptManagerInstance = getPromptManager.mock.results[0].value;
		expect(promptManagerInstance.loadPrompt).toHaveBeenCalled();
	});
});

describe('Context Gathering Integration', () => {
	let fs;
	let generateObjectService;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
		fs = await import('fs');
		const aiServices = await import(
			'../../../../../scripts/modules/ai-services-unified.js'
		);
		generateObjectService = aiServices.generateObjectService;
		tryUpdateViaRemote.mockResolvedValue(null); // No remote
	});

	test('should gather project context when projectRoot is provided', async () => {
		// Arrange
		const mockContextGatherer = {
			gather: jest.fn().mockResolvedValue({
				fullContext: 'Project context from files',
				summary: 'Context summary'
			})
		};
		ContextGatherer.mockImplementation(() => mockContextGatherer);

		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Details',
					testStrategy: 'Test strategy',
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					title: 'Updated Task',
					description: 'Updated description',
					status: 'in-progress',
					dependencies: [],
					priority: 'high',
					details: 'Updated details',
					testStrategy: 'Updated test strategy',
					subtasks: []
				}
			},
			telemetryData: {}
		});

		// Act
		await updateTaskById(
			'tasks/tasks.json',
			1,
			'Update with context',
			false,
			{ tag: 'master', projectRoot: '/mock/project' },
			'json'
		);

		// Assert - Context gatherer should be instantiated and used
		expect(ContextGatherer).toHaveBeenCalledWith('/mock/project', 'master');
		expect(mockContextGatherer.gather).toHaveBeenCalled();
	});
});

describe('Fuzzy Task Search Integration', () => {
	let fs;
	let generateObjectService;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
		fs = await import('fs');
		const aiServices = await import(
			'../../../../../scripts/modules/ai-services-unified.js'
		);
		generateObjectService = aiServices.generateObjectService;
		tryUpdateViaRemote.mockResolvedValue(null); // No remote
	});

	test('should use fuzzy search to find related tasks for context', async () => {
		// Arrange
		const mockFuzzySearch = {
			findRelevantTasks: jest.fn().mockReturnValue([
				{ id: 2, title: 'Related Task 1', score: 0.9 },
				{ id: 3, title: 'Related Task 2', score: 0.85 }
			]),
			getTaskIds: jest.fn().mockReturnValue(['2', '3'])
		};
		FuzzyTaskSearch.mockImplementation(() => mockFuzzySearch);

		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Task to update',
					description: 'Description',
					status: 'pending',
					dependencies: [],
					priority: 'medium',
					details: 'Details',
					testStrategy: 'Test strategy',
					subtasks: []
				},
				{
					id: 2,
					title: 'Related Task 1',
					description: 'Related description',
					status: 'done',
					dependencies: [],
					priority: 'medium',
					details: 'Related details',
					testStrategy: 'Related test strategy',
					subtasks: []
				},
				{
					id: 3,
					title: 'Related Task 2',
					description: 'Another related description',
					status: 'pending',
					dependencies: [],
					priority: 'low',
					details: 'More details',
					testStrategy: 'Test strategy',
					subtasks: []
				}
			]
		});

		generateObjectService.mockResolvedValue({
			mainResult: {
				task: {
					id: 1,
					title: 'Updated Task',
					description: 'Updated description',
					status: 'in-progress',
					dependencies: [],
					priority: 'high',
					details: 'Updated details',
					testStrategy: 'Updated test strategy',
					subtasks: []
				}
			},
			telemetryData: {}
		});

		// Act
		await updateTaskById(
			'tasks/tasks.json',
			1,
			'Update with related task context',
			false,
			{ tag: 'master' },
			'json'
		);

		// Assert - Fuzzy search should be instantiated and used
		expect(FuzzyTaskSearch).toHaveBeenCalled();
		expect(mockFuzzySearch.findRelevantTasks).toHaveBeenCalledWith(
			expect.stringContaining('Task to update'),
			expect.objectContaining({
				maxResults: 5,
				includeSelf: true
			})
		);
		expect(mockFuzzySearch.getTaskIds).toHaveBeenCalled();
	});
});
