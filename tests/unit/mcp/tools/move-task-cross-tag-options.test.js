import { jest } from '@jest/globals';

// Mocks
const mockFindTasksPath = jest
	.fn()
	.mockReturnValue('/test/path/.taskmaster/tasks/tasks.json');
jest.unstable_mockModule(
	'../../../../mcp-server/src/core/utils/path-utils.js',
	() => ({
		findTasksPath: mockFindTasksPath
	})
);

const mockEnableSilentMode = jest.fn();
const mockDisableSilentMode = jest.fn();
jest.unstable_mockModule('../../../../scripts/modules/utils.js', () => ({
	enableSilentMode: mockEnableSilentMode,
	disableSilentMode: mockDisableSilentMode
}));

// Spyable mock for moveTasksBetweenTags
const mockMoveTasksBetweenTags = jest.fn();
jest.unstable_mockModule(
	'../../../../scripts/modules/task-manager/move-task.js',
	() => ({
		moveTasksBetweenTags: mockMoveTasksBetweenTags
	})
);

// Import after mocks
const { moveTaskCrossTagDirect } = await import(
	'../../../../mcp-server/src/core/direct-functions/move-task-cross-tag.js'
);

describe('MCP Cross-Tag Move Direct Function - options & suggestions', () => {
	const mockLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('passes only withDependencies/ignoreDependencies (no force) to core', async () => {
		// Arrange: make core throw tag validation after call to capture params
		mockMoveTasksBetweenTags.mockImplementation(() => {
			const err = new Error('Source tag "invalid" not found or invalid');
			err.code = 'INVALID_SOURCE_TAG';
			throw err;
		});

		// Act
		await moveTaskCrossTagDirect(
			{
				sourceIds: '1,2',
				sourceTag: 'backlog',
				targetTag: 'in-progress',
				withDependencies: true,
				projectRoot: '/test'
			},
			mockLog
		);

		// Assert options argument (5th param)
		expect(mockMoveTasksBetweenTags).toHaveBeenCalled();
		const args = mockMoveTasksBetweenTags.mock.calls[0];
		const moveOptions = args[4];
		expect(moveOptions).toEqual({
			withDependencies: true,
			ignoreDependencies: false
		});
		expect('force' in moveOptions).toBe(false);
	});

	it('returns conflict suggestions on cross-tag dependency conflicts', async () => {
		// Arrange: core throws cross-tag dependency conflicts
		mockMoveTasksBetweenTags.mockImplementation(() => {
			const err = new Error(
				'Cannot move tasks: 2 cross-tag dependency conflicts found'
			);
			err.code = 'CROSS_TAG_DEPENDENCY_CONFLICTS';
			throw err;
		});

		// Act
		const result = await moveTaskCrossTagDirect(
			{
				sourceIds: '1',
				sourceTag: 'backlog',
				targetTag: 'in-progress',
				projectRoot: '/test'
			},
			mockLog
		);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error.code).toBe('CROSS_TAG_DEPENDENCY_CONFLICT');
		expect(Array.isArray(result.error.suggestions)).toBe(true);
		// Key suggestions
		const s = result.error.suggestions.join(' ');
		expect(s).toContain('--with-dependencies');
		expect(s).toContain('--ignore-dependencies');
		expect(s).toContain('validate-dependencies');
		expect(s).toContain('Move dependencies first');
	});

	it('returns ID collision suggestions when target tag already has the ID', async () => {
		// Arrange: core throws TASK_ALREADY_EXISTS structured error
		mockMoveTasksBetweenTags.mockImplementation(() => {
			const err = new Error(
				'Task 1 already exists in target tag "in-progress"'
			);
			err.code = 'TASK_ALREADY_EXISTS';
			throw err;
		});

		// Act
		const result = await moveTaskCrossTagDirect(
			{
				sourceIds: '1',
				sourceTag: 'backlog',
				targetTag: 'in-progress',
				projectRoot: '/test'
			},
			mockLog
		);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error.code).toBe('TASK_ALREADY_EXISTS');
		const joined = (result.error.suggestions || []).join(' ');
		expect(joined).toContain('different target tag');
		expect(joined).toContain('different set of IDs');
		expect(joined).toContain('within-tag');
	});
});
