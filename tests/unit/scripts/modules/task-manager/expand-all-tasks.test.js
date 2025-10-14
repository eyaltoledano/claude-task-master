/**
 * Tests for the expand-all-tasks.js module
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/expand-task.js',
	() => ({
		default: jest.fn()
	})
);

jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	log: jest.fn(),
	isSilentMode: jest.fn(() => false),
	findProjectRoot: jest.fn(() => '/test/project'),
	aggregateTelemetry: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false)
	})
);

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	startLoadingIndicator: jest.fn(),
	stopLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule('chalk', () => ({
	default: {
		white: { bold: jest.fn((text) => text) },
		cyan: jest.fn((text) => text),
		green: jest.fn((text) => text),
		gray: jest.fn((text) => text),
		red: jest.fn((text) => text),
		bold: jest.fn((text) => text)
	}
}));

jest.unstable_mockModule('boxen', () => ({
	default: jest.fn((text) => text)
}));

// Import the mocked modules
const { default: expandTask } = await import(
	'../../../../../scripts/modules/task-manager/expand-task.js'
);
const { readJSON, aggregateTelemetry, findProjectRoot } = await import(
	'../../../../../scripts/modules/utils.js'
);

// Import the module under test
const { default: expandAllTasks } = await import(
	'../../../../../scripts/modules/task-manager/expand-all-tasks.js'
);

const mockExpandTask = expandTask;
const mockReadJSON = readJSON;
const mockAggregateTelemetry = aggregateTelemetry;
const mockFindProjectRoot = findProjectRoot;

describe('expandAllTasks', () => {
	const mockTasksPath = '/test/tasks.json';
	const mockProjectRoot = '/test/project';
	const mockSession = { userId: 'test-user' };
	const mockMcpLog = {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn()
	};

	const sampleTasksData = {
		tag: 'master',
		tasks: [
			{
				id: 1,
				title: 'Pending Task 1',
				status: 'pending',
				subtasks: []
			},
			{
				id: 2,
				title: 'In Progress Task',
				status: 'in-progress',
				subtasks: []
			},
			{
				id: 3,
				title: 'Done Task',
				status: 'done',
				subtasks: []
			},
			{
				id: 4,
				title: 'Task with Subtasks',
				status: 'pending',
				subtasks: [{ id: '4.1', title: 'Existing subtask' }]
			}
		]
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockReadJSON.mockReturnValue(sampleTasksData);
		mockAggregateTelemetry.mockReturnValue({
			timestamp: '2024-01-01T00:00:00.000Z',
			commandName: 'expand-all-tasks',
			totalCost: 0.1,
			totalTokens: 2000,
			inputTokens: 1200,
			outputTokens: 800
		});
	});

	describe('successful expansion', () => {
		test('should expand all eligible pending tasks', async () => {
			// Arrange
			const mockTelemetryData = {
				timestamp: '2024-01-01T00:00:00.000Z',
				commandName: 'expand-task',
				totalCost: 0.05,
				totalTokens: 1000
			};

			mockExpandTask.mockResolvedValue({
				telemetryData: mockTelemetryData
			});

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3, // numSubtasks
				false, // useResearch
				'test context', // additionalContext
				false, // force
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json' // outputFormat
			);

			// Assert
			expect(result.success).toBe(true);
			expect(result.expandedCount).toBe(2); // Tasks 1 and 2 (pending and in-progress)
			expect(result.failedCount).toBe(0);
			expect(result.skippedCount).toBe(0);
			expect(result.tasksToExpand).toBe(2);
			expect(result.telemetryData).toBeDefined();

			// Verify readJSON was called correctly
			expect(mockReadJSON).toHaveBeenCalledWith(
				mockTasksPath,
				mockProjectRoot,
				'master'
			);

			// Verify expandTask was called for eligible tasks
			expect(mockExpandTask).toHaveBeenCalledTimes(2);
			expect(mockExpandTask).toHaveBeenCalledWith(
				mockTasksPath,
				1,
				3,
				false,
				'test context',
				expect.objectContaining({
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				}),
				false
			);
		});

		test('should handle force flag to expand tasks with existing subtasks', async () => {
			// Arrange
			mockExpandTask.mockResolvedValue({
				telemetryData: { commandName: 'expand-task', totalCost: 0.05 }
			});

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				2,
				false,
				'',
				true, // force = true
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json'
			);

			// Assert
			expect(result.expandedCount).toBe(3); // Tasks 1, 2, and 4 (including task with existing subtasks)
			expect(mockExpandTask).toHaveBeenCalledTimes(3);
		});

		test('should handle research flag', async () => {
			// Arrange
			mockExpandTask.mockResolvedValue({
				telemetryData: { commandName: 'expand-task', totalCost: 0.08 }
			});

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				undefined, // numSubtasks not specified
				true, // useResearch = true
				'research context',
				false,
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json'
			);

			// Assert
			expect(result.success).toBe(true);
			expect(mockExpandTask).toHaveBeenCalledWith(
				mockTasksPath,
				expect.any(Number),
				undefined,
				true, // research flag passed correctly
				'research context',
				expect.any(Object),
				false
			);
		});

		test('should pass complexityReportPath to expandTask when provided in context', async () => {
			// Arrange
			const mockComplexityReportPath =
				'/test/project/.taskmaster/reports/task-complexity-report.json';
			mockExpandTask.mockResolvedValue({
				telemetryData: { commandName: 'expand-task', totalCost: 0.05 }
			});

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				undefined, // numSubtasks not specified, should use complexity report
				false,
				'',
				false,
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master',
					complexityReportPath: mockComplexityReportPath
				},
				'json'
			);

			// Assert
			expect(result.success).toBe(true);
			expect(result.expandedCount).toBe(2); // Tasks 1 and 2

			// Verify expandTask was called with complexityReportPath in context
			expect(mockExpandTask).toHaveBeenCalledWith(
				mockTasksPath,
				expect.any(Number), // task id
				undefined, // numSubtasks
				false, // useResearch
				'', // additionalContext
				expect.objectContaining({
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master',
					complexityReportPath: mockComplexityReportPath
				}),
				false // force
			);
		});

		test('should return success with message when no tasks are eligible', async () => {
			// Arrange - Mock tasks data with no eligible tasks
			const noEligibleTasksData = {
				tag: 'master',
				tasks: [
					{ id: 1, status: 'done', subtasks: [] },
					{
						id: 2,
						status: 'pending',
						subtasks: [{ id: '2.1', title: 'existing' }]
					}
				]
			};
			mockReadJSON.mockReturnValue(noEligibleTasksData);

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3,
				false,
				'',
				false, // force = false, so task with subtasks won't be expanded
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json'
			);

			// Assert
			expect(result.success).toBe(true);
			expect(result.expandedCount).toBe(0);
			expect(result.failedCount).toBe(0);
			expect(result.skippedCount).toBe(0);
			expect(result.tasksToExpand).toBe(0);
			expect(result.message).toBe('No tasks eligible for expansion.');
			expect(mockExpandTask).not.toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		test('should handle expandTask failures gracefully', async () => {
			// Arrange
			mockExpandTask
				.mockResolvedValueOnce({ telemetryData: { totalCost: 0.05 } }) // First task succeeds
				.mockRejectedValueOnce(new Error('AI service error')); // Second task fails

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3,
				false,
				'',
				false,
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json'
			);

			// Assert
			expect(result.success).toBe(true);
			expect(result.expandedCount).toBe(1);
			expect(result.failedCount).toBe(1);
		});

		test('should throw error when tasks.json is invalid', async () => {
			// Arrange
			mockReadJSON.mockReturnValue(null);

			// Act & Assert
			await expect(
				expandAllTasks(
					mockTasksPath,
					3,
					false,
					'',
					false,
					{
						session: mockSession,
						mcpLog: mockMcpLog,
						projectRoot: mockProjectRoot,
						tag: 'master'
					},
					'json'
				)
			).rejects.toThrow('Invalid tasks data');
		});

		test('should throw error when project root cannot be determined', async () => {
			// Arrange - Mock findProjectRoot to return null for this test
			mockFindProjectRoot.mockReturnValueOnce(null);

			// Act & Assert
			await expect(
				expandAllTasks(
					mockTasksPath,
					3,
					false,
					'',
					false,
					{
						session: mockSession,
						mcpLog: mockMcpLog,
						tag: 'master'
						// No projectRoot provided, and findProjectRoot will return null
					},
					'json'
				)
			).rejects.toThrow('Could not determine project root directory');
		});
	});

	describe('telemetry aggregation', () => {
		test('should aggregate telemetry data from multiple expand operations', async () => {
			// Arrange
			const telemetryData1 = {
				commandName: 'expand-task',
				totalCost: 0.03,
				totalTokens: 600
			};
			const telemetryData2 = {
				commandName: 'expand-task',
				totalCost: 0.04,
				totalTokens: 800
			};

			mockExpandTask
				.mockResolvedValueOnce({ telemetryData: telemetryData1 })
				.mockResolvedValueOnce({ telemetryData: telemetryData2 });

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3,
				false,
				'',
				false,
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json'
			);

			// Assert
			expect(mockAggregateTelemetry).toHaveBeenCalledWith(
				[telemetryData1, telemetryData2],
				'expand-all-tasks'
			);
			expect(result.telemetryData).toBeDefined();
			expect(result.telemetryData.commandName).toBe('expand-all-tasks');
		});

		test('should handle missing telemetry data gracefully', async () => {
			// Arrange
			mockExpandTask.mockResolvedValue({}); // No telemetryData

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3,
				false,
				'',
				false,
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'master'
				},
				'json'
			);

			// Assert
			expect(result.success).toBe(true);
			expect(mockAggregateTelemetry).toHaveBeenCalledWith(
				[],
				'expand-all-tasks'
			);
		});
	});

	describe('output format handling', () => {
		test('should use text output format for CLI calls', async () => {
			// Arrange
			mockExpandTask.mockResolvedValue({
				telemetryData: { commandName: 'expand-task', totalCost: 0.05 }
			});

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3,
				false,
				'',
				false,
				{
					projectRoot: mockProjectRoot,
					tag: 'master'
					// No mcpLog provided, should use CLI logger
				},
				'text' // CLI output format
			);

			// Assert
			expect(result.success).toBe(true);
			// In text mode, loading indicators and console output would be used
			// This is harder to test directly but we can verify the result structure
		});

		test('should handle context tag properly', async () => {
			// Arrange
			const taggedTasksData = {
				...sampleTasksData,
				tag: 'feature-branch'
			};
			mockReadJSON.mockReturnValue(taggedTasksData);
			mockExpandTask.mockResolvedValue({
				telemetryData: { commandName: 'expand-task', totalCost: 0.05 }
			});

			// Act
			const result = await expandAllTasks(
				mockTasksPath,
				3,
				false,
				'',
				false,
				{
					session: mockSession,
					mcpLog: mockMcpLog,
					projectRoot: mockProjectRoot,
					tag: 'feature-branch'
				},
				'json'
			);

			// Assert
			expect(mockReadJSON).toHaveBeenCalledWith(
				mockTasksPath,
				mockProjectRoot,
				'feature-branch'
			);
			expect(mockExpandTask).toHaveBeenCalledWith(
				mockTasksPath,
				expect.any(Number),
				3,
				false,
				'',
				expect.objectContaining({
					tag: 'feature-branch'
				}),
				false
			);
		});
	});
});
