import { jest } from '@jest/globals';

// Provide fs mock early so existsSync can be stubbed
jest.unstable_mockModule('fs', () => {
	const mockFs = {
		existsSync: jest.fn(() => true),
		writeFileSync: jest.fn(),
		readFileSync: jest.fn(),
		unlinkSync: jest.fn()
	};
	return { default: mockFs, ...mockFs };
});

// --- Mock dependencies ---
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
			.mockResolvedValue({ mainResult: { content: '' }, telemetryData: {} })
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false),
		hasCodebaseAnalysis: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/prompt-manager.js',
	() => ({
		default: jest.fn().mockReturnValue({
			loadPrompt: jest.fn().mockReturnValue('Update the subtask')
		}),
		getPromptManager: jest.fn().mockReturnValue({
			loadPrompt: jest.fn().mockReturnValue('Update the subtask')
		})
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/utils/contextGatherer.js',
	() => ({
		ContextGatherer: jest.fn().mockImplementation(() => ({
			gather: jest.fn().mockReturnValue({
				fullContext: '',
				summary: ''
			})
		}))
	})
);

// Import mocked utils to leverage mocks later
const { readJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);

// Import function under test
const { default: updateSubtaskById } = await import(
	'../../../../../scripts/modules/task-manager/update-subtask-by-id.js'
);

describe('updateSubtaskById validation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
	});

	test('throws error on invalid subtask id format', async () => {
		await expect(
			updateSubtaskById(
				'tasks/tasks.json',
				'invalid',
				'my prompt',
				false,
				{
					tag: 'master'
				},
				'json'
			)
		).rejects.toThrow('Invalid subtask ID format');
	});

	test('throws error when prompt is empty', async () => {
		await expect(
			updateSubtaskById(
				'tasks/tasks.json',
				'1.1',
				'',
				false,
				{ tag: 'master' },
				'json'
			)
		).rejects.toThrow('Prompt cannot be empty');
	});

	test('throws error if tasks file does not exist', async () => {
		// Mock fs.existsSync to return false via jest.spyOn (dynamic import of fs)
		const fs = await import('fs');
		fs.existsSync.mockReturnValue(false);
		await expect(
			updateSubtaskById(
				'tasks/tasks.json',
				'1.1',
				'prompt',
				false,
				{
					tag: 'master'
				},
				'json'
			)
		).rejects.toThrow('Tasks file not found');
	});

	test('throws error if parent task missing', async () => {
		// Mock existsSync true
		const fs = await import('fs');
		fs.existsSync.mockReturnValue(true);
		// readJSON returns tasks without parent id 1
		readJSON.mockReturnValue({ tag: 'master', tasks: [] });
		await expect(
			updateSubtaskById(
				'tasks/tasks.json',
				'1.1',
				'prompt',
				false,
				{
					tag: 'master'
				},
				'json'
			)
		).rejects.toThrow('Parent task with ID 1 not found');
		// log called with error level
		expect(log).toHaveBeenCalled();
	});

	test('successfully updates subtask with valid inputs', async () => {
		const fs = await import('fs');
		const { writeJSON } = await import(
			'../../../../../scripts/modules/utils.js'
		);

		fs.existsSync.mockReturnValue(true);
		readJSON.mockReturnValue({
			tag: 'master',
			tasks: [
				{
					id: 1,
					title: 'Parent Task',
					subtasks: [{ id: 1, title: 'Original subtask', status: 'pending' }]
				}
			]
		});

		// updateSubtaskById doesn't return a value on success, it just executes
		await expect(
			updateSubtaskById(
				'tasks/tasks.json',
				'1.1',
				'Update this subtask',
				false,
				{ tag: 'master' },
				'json'
			)
		).resolves.not.toThrow();

		expect(writeJSON).toHaveBeenCalled();
	});
});
