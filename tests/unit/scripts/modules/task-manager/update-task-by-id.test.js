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
	getCurrentTag: jest.fn(() => 'master')
}));

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	getStatusWithColor: jest.fn((s) => s),
	startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
	stopLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

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

const { readJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);
const { default: updateTaskById } = await import(
	'../../../../../scripts/modules/task-manager/update-task-by-id.js'
);

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
		readJSON.mockReturnValue({ tag: 'master', tasks: [] });
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
		expect(log).toHaveBeenCalled();
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
