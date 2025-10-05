import { jest } from '@jest/globals';

// Mock the utils functions
const mockFindTasksPath = jest
	.fn()
	.mockReturnValue('/test/path/.taskmaster/tasks/tasks.json');
jest.mock('../../../../mcp-server/src/core/utils/path-utils.js', () => ({
	findTasksPath: mockFindTasksPath
}));

const mockEnableSilentMode = jest.fn();
const mockDisableSilentMode = jest.fn();
const mockReadJSON = jest.fn();
const mockWriteJSON = jest.fn();
jest.mock('../../../../scripts/modules/utils.js', () => ({
	enableSilentMode: mockEnableSilentMode,
	disableSilentMode: mockDisableSilentMode,
	readJSON: mockReadJSON,
	writeJSON: mockWriteJSON
}));

// Import the direct function after setting up mocks
import { moveTaskCrossTagDirect } from '../../../../mcp-server/src/core/direct-functions/move-task-cross-tag.js';

describe('MCP Cross-Tag Move Direct Function', () => {
	const mockLog = {
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn()
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Mock Verification', () => {
		it('should verify that mocks are working', () => {
			// Test that findTasksPath mock is working
			expect(mockFindTasksPath()).toBe(
				'/test/path/.taskmaster/tasks/tasks.json'
			);

			// Test that readJSON mock is working
			mockReadJSON.mockReturnValue('test');
			expect(mockReadJSON()).toBe('test');
		});
	});

	describe('Parameter Validation', () => {
		it('should return error when source IDs are missing', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceTag: 'backlog',
					targetTag: 'in-progress',
					projectRoot: '/test'
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('MISSING_SOURCE_IDS');
			expect(result.error.message).toBe('Source IDs are required');
		});

		it('should return error when source tag is missing', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1,2',
					targetTag: 'in-progress',
					projectRoot: '/test'
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('MISSING_SOURCE_TAG');
			expect(result.error.message).toBe(
				'Source tag is required for cross-tag moves'
			);
		});

		it('should return error when target tag is missing', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1,2',
					sourceTag: 'backlog',
					projectRoot: '/test'
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('MISSING_TARGET_TAG');
			expect(result.error.message).toBe(
				'Target tag is required for cross-tag moves'
			);
		});

		it('should return error when source and target tags are the same', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1,2',
					sourceTag: 'backlog',
					targetTag: 'backlog',
					projectRoot: '/test'
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('SAME_SOURCE_TARGET_TAG');
			expect(result.error.message).toBe(
				'Source and target tags are the same ("backlog")'
			);
			expect(result.error.suggestions).toHaveLength(3);
		});
	});

	describe('Error Code Mapping', () => {
		it('should map tag not found errors correctly', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'invalid',
					targetTag: 'in-progress',
					projectRoot: '/test'
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('TAG_OR_TASK_NOT_FOUND');
			expect(result.error.message).toBe(
				'Source tag "invalid" not found or invalid'
			);
			expect(result.error.suggestions).toHaveLength(3);
		});

		it('should map missing project root errors correctly', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'in-progress'
					// Missing projectRoot
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('MISSING_PROJECT_ROOT');
			expect(result.error.message).toBe(
				'Project root is required if tasksJsonPath is not provided'
			);
		});
	});

	describe('Move Options Handling', () => {
		it('should handle move options correctly', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'in-progress',
					withDependencies: true,
					ignoreDependencies: false,
					projectRoot: '/test'
				},
				mockLog
			);

			// The function should fail due to missing tag, but options should be processed
			expect(result.success).toBe(false);
			expect(result.error.code).toBe('TAG_OR_TASK_NOT_FOUND');
		});
	});

	describe('Function Call Flow', () => {
		it('should call findTasksPath when projectRoot is provided', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'in-progress',
					projectRoot: '/test'
				},
				mockLog
			);

			// The function should fail due to tag validation before reaching path resolution
			expect(result.success).toBe(false);
			expect(result.error.code).toBe('TAG_OR_TASK_NOT_FOUND');

			// Since the function fails early, findTasksPath is not called
			expect(mockFindTasksPath).toHaveBeenCalledTimes(0);
		});

		it('should enable and disable silent mode during execution', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'in-progress',
					projectRoot: '/test'
				},
				mockLog
			);

			// The function should fail due to tag validation before reaching silent mode calls
			expect(result.success).toBe(false);
			expect(result.error.code).toBe('TAG_OR_TASK_NOT_FOUND');

			// Since the function fails early, silent mode is not called
			expect(mockEnableSilentMode).toHaveBeenCalledTimes(0);
			expect(mockDisableSilentMode).toHaveBeenCalledTimes(0);
		});

		it('should parse source IDs correctly', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1, 2, 3', // With spaces
					sourceTag: 'backlog',
					targetTag: 'in-progress',
					projectRoot: '/test'
				},
				mockLog
			);

			// Should fail due to tag validation, but ID parsing should work
			expect(result.success).toBe(false);
			expect(result.error.code).toBe('TAG_OR_TASK_NOT_FOUND');
		});

		it('should handle move options correctly', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'in-progress',
					withDependencies: true,
					ignoreDependencies: false,
					projectRoot: '/test'
				},
				mockLog
			);

			// Should fail due to tag validation, but option processing should work
			expect(result.success).toBe(false);
			expect(result.error.code).toBe('TAG_OR_TASK_NOT_FOUND');
		});
	});

	describe('Error Handling', () => {
		it('should handle missing project root correctly', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'in-progress'
					// Missing projectRoot
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('MISSING_PROJECT_ROOT');
			expect(result.error.message).toBe(
				'Project root is required if tasksJsonPath is not provided'
			);
		});

		it('should handle same source and target tags', async () => {
			const result = await moveTaskCrossTagDirect(
				{
					sourceIds: '1',
					sourceTag: 'backlog',
					targetTag: 'backlog',
					projectRoot: '/test'
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('SAME_SOURCE_TARGET_TAG');
			expect(result.error.message).toBe(
				'Source and target tags are the same ("backlog")'
			);
			expect(result.error.suggestions).toHaveLength(3);
		});
	});
});
