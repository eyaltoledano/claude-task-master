/**
 * Tests for the update-tasks.js module
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
	findTaskById: jest.fn(),
	getCurrentTag: jest.fn(() => 'master'),
	ensureTagMetadata: jest.fn((tagObj) => tagObj),
	flattenTasksWithSubtasks: jest.fn((tasks) => tasks),
	findProjectRoot: jest.fn(() => '/mock/project/root')
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateTextService: jest.fn().mockResolvedValue({
			mainResult: '[]', // mainResult is the text string directly
			telemetryData: {}
		})
	})
);

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	getStatusWithColor: jest.fn((status) => status),
	startLoadingIndicator: jest.fn(),
	stopLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false),
		hasCodebaseAnalysis: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/prompt-manager.js',
	() => ({
		getPromptManager: jest.fn().mockReturnValue({
			loadPrompt: jest.fn().mockResolvedValue({
				systemPrompt: 'Mocked system prompt',
				userPrompt: 'Mocked user prompt'
			})
		})
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/models.js',
	() => ({
		getModelConfiguration: jest.fn(() => ({
			model: 'mock-model',
			maxTokens: 4000,
			temperature: 0.7
		}))
	})
);

// Import the mocked modules
const { readJSON, writeJSON, log } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

// Import the module under test
const { default: updateTasks } = await import(
	'../../../../../scripts/modules/task-manager/update-tasks.js'
);

describe('updateTasks', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('should update tasks based on new context', async () => {
		// Arrange
		const mockTasksPath = '/mock/path/tasks.json';
		const mockFromId = 2;
		const mockPrompt = 'New project direction';
		const mockInitialTasks = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Old Task 1',
						status: 'done',
						details: 'Done details'
					},
					{
						id: 2,
						title: 'Old Task 2',
						status: 'pending',
						details: 'Old details 2'
					},
					{
						id: 3,
						title: 'Old Task 3',
						status: 'in-progress',
						details: 'Old details 3'
					}
				]
			}
		};

		const mockUpdatedTasks = [
			{
				id: 2,
				title: 'Updated Task 2',
				status: 'pending',
				details: 'New details 2 based on direction',
				description: 'Updated description',
				dependencies: [],
				priority: 'medium',
				testStrategy: 'Unit test the updated functionality',
				subtasks: []
			},
			{
				id: 3,
				title: 'Updated Task 3',
				status: 'pending',
				details: 'New details 3 based on direction',
				description: 'Updated description',
				dependencies: [],
				priority: 'medium',
				testStrategy: 'Integration test the updated features',
				subtasks: []
			}
		];

		const mockApiResponse = {
			mainResult: JSON.stringify(mockUpdatedTasks), // mainResult is the JSON string directly
			telemetryData: {}
		};

		// Configure mocks - readJSON should return the resolved view with tasks at top level
		readJSON.mockReturnValue({
			...mockInitialTasks.master,
			tag: 'master',
			_rawTaggedData: mockInitialTasks
		});
		generateTextService.mockResolvedValue(mockApiResponse);

		// Act
		const result = await updateTasks(
			mockTasksPath,
			mockFromId,
			mockPrompt,
			false, // research
			{ projectRoot: '/mock/path', tag: 'master' }, // context
			'json' // output format
		);

		// Assert
		// 1. Read JSON called
		expect(readJSON).toHaveBeenCalledWith(
			mockTasksPath,
			'/mock/path',
			'master'
		);

		// 2. AI Service called with correct args
		expect(generateTextService).toHaveBeenCalledWith(expect.any(Object));

		// 3. Write JSON called with correctly merged tasks
		expect(writeJSON).toHaveBeenCalledWith(
			mockTasksPath,
			expect.objectContaining({
				_rawTaggedData: expect.objectContaining({
					master: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 1 }),
							expect.objectContaining({ id: 2, title: 'Updated Task 2' }),
							expect.objectContaining({ id: 3, title: 'Updated Task 3' })
						])
					})
				})
			}),
			'/mock/path',
			'master'
		);

		// 4. Check return value
		expect(result).toEqual(
			expect.objectContaining({
				success: true,
				updatedTasks: mockUpdatedTasks,
				telemetryData: {}
			})
		);
	});

	test('should handle no tasks to update', async () => {
		// Arrange
		const mockTasksPath = '/mock/path/tasks.json';
		const mockFromId = 99; // Non-existent ID
		const mockPrompt = 'Update non-existent tasks';
		const mockInitialTasks = {
			master: {
				tasks: [
					{ id: 1, status: 'done' },
					{ id: 2, status: 'done' }
				]
			}
		};

		// Configure mocks - readJSON should return the resolved view with tasks at top level
		readJSON.mockReturnValue({
			...mockInitialTasks.master,
			tag: 'master',
			_rawTaggedData: mockInitialTasks
		});

		// Act
		const result = await updateTasks(
			mockTasksPath,
			mockFromId,
			mockPrompt,
			false,
			{ projectRoot: '/mock/path', tag: 'master' },
			'json'
		);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(
			mockTasksPath,
			'/mock/path',
			'master'
		);
		expect(generateTextService).not.toHaveBeenCalled();
		expect(writeJSON).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(
			'info',
			expect.stringContaining('No tasks to update')
		);

		// Should return early with no updates
		expect(result).toBeUndefined();
	});

	test('should preserve all tags when updating tasks in tagged context', async () => {
		// Arrange - Simple 2-tag structure to test tag corruption fix
		const mockTasksPath = '/mock/path/tasks.json';
		const mockFromId = 1;
		const mockPrompt = 'Update master tag tasks';

		const mockTaggedData = {
			master: {
				tasks: [
					{
						id: 1,
						title: 'Master Task',
						status: 'pending',
						details: 'Old details'
					},
					{
						id: 2,
						title: 'Master Task 2',
						status: 'done',
						details: 'Done task'
					}
				],
				metadata: {
					created: '2024-01-01T00:00:00.000Z',
					description: 'Master tag tasks'
				}
			},
			'feature-branch': {
				tasks: [
					{
						id: 1,
						title: 'Feature Task',
						status: 'pending',
						details: 'Feature work'
					}
				],
				metadata: {
					created: '2024-01-02T00:00:00.000Z',
					description: 'Feature branch tasks'
				}
			}
		};

		const mockUpdatedTasks = [
			{
				id: 1,
				title: 'Updated Master Task',
				status: 'pending',
				details: 'Updated details',
				description: 'Updated description',
				dependencies: [],
				priority: 'medium',
				testStrategy: 'Test the updated functionality',
				subtasks: []
			}
		];

		// Configure mocks - readJSON returns resolved view for master tag
		readJSON.mockReturnValue({
			...mockTaggedData.master,
			tag: 'master',
			_rawTaggedData: mockTaggedData
		});

		generateTextService.mockResolvedValue({
			mainResult: JSON.stringify(mockUpdatedTasks),
			telemetryData: { commandName: 'update-tasks', totalCost: 0.05 }
		});

		// Act
		const result = await updateTasks(
			mockTasksPath,
			mockFromId,
			mockPrompt,
			false, // research
			{ projectRoot: '/mock/project/root', tag: 'master' },
			'json'
		);

		// Assert - CRITICAL: Both tags must be preserved (this would fail before the fix)
		expect(writeJSON).toHaveBeenCalledWith(
			mockTasksPath,
			expect.objectContaining({
				_rawTaggedData: expect.objectContaining({
					master: expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 1, title: 'Updated Master Task' }),
							expect.objectContaining({ id: 2, title: 'Master Task 2' }) // Unchanged done task
						])
					}),
					// CRITICAL: This tag would be missing/corrupted if the bug existed
					'feature-branch': expect.objectContaining({
						tasks: expect.arrayContaining([
							expect.objectContaining({ id: 1, title: 'Feature Task' })
						]),
						metadata: expect.objectContaining({
							description: 'Feature branch tasks'
						})
					})
				})
			}),
			'/mock/project/root',
			'master'
		);

		expect(result.success).toBe(true);
		expect(result.updatedTasks).toEqual(mockUpdatedTasks);
	});
});
