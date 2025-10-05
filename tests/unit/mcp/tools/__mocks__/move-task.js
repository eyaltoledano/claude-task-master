/**
 * Mock for move-task module
 * Provides mock implementations for testing scenarios
 */

// Mock the moveTask function from the core module
const mockMoveTask = jest
	.fn()
	.mockImplementation(
		async (tasksPath, sourceId, destinationId, generateFiles, options) => {
			// Simulate successful move operation
			return {
				success: true,
				sourceId,
				destinationId,
				message: `Successfully moved task ${sourceId} to ${destinationId}`,
				...options
			};
		}
	);

// Mock the moveTaskDirect function
const mockMoveTaskDirect = jest
	.fn()
	.mockImplementation(async (args, log, context = {}) => {
		// Validate required parameters
		if (!args.sourceId) {
			return {
				success: false,
				error: {
					message: 'Source ID is required',
					code: 'MISSING_SOURCE_ID'
				}
			};
		}

		if (!args.destinationId) {
			return {
				success: false,
				error: {
					message: 'Destination ID is required',
					code: 'MISSING_DESTINATION_ID'
				}
			};
		}

		// Simulate successful move
		return {
			success: true,
			data: {
				sourceId: args.sourceId,
				destinationId: args.destinationId,
				message: `Successfully moved task/subtask ${args.sourceId} to ${args.destinationId}`,
				tag: args.tag,
				projectRoot: args.projectRoot
			}
		};
	});

// Mock the moveTaskCrossTagDirect function
const mockMoveTaskCrossTagDirect = jest
	.fn()
	.mockImplementation(async (args, log, context = {}) => {
		// Validate required parameters
		if (!args.sourceIds) {
			return {
				success: false,
				error: {
					message: 'Source IDs are required',
					code: 'MISSING_SOURCE_IDS'
				}
			};
		}

		if (!args.sourceTag) {
			return {
				success: false,
				error: {
					message: 'Source tag is required for cross-tag moves',
					code: 'MISSING_SOURCE_TAG'
				}
			};
		}

		if (!args.targetTag) {
			return {
				success: false,
				error: {
					message: 'Target tag is required for cross-tag moves',
					code: 'MISSING_TARGET_TAG'
				}
			};
		}

		if (args.sourceTag === args.targetTag) {
			return {
				success: false,
				error: {
					message: `Source and target tags are the same ("${args.sourceTag}")`,
					code: 'SAME_SOURCE_TARGET_TAG'
				}
			};
		}

		// Simulate successful cross-tag move
		return {
			success: true,
			data: {
				sourceIds: args.sourceIds,
				sourceTag: args.sourceTag,
				targetTag: args.targetTag,
				message: `Successfully moved tasks ${args.sourceIds} from ${args.sourceTag} to ${args.targetTag}`,
				withDependencies: args.withDependencies || false,
				ignoreDependencies: args.ignoreDependencies || false
			}
		};
	});

// Mock the registerMoveTaskTool function
const mockRegisterMoveTaskTool = jest.fn().mockImplementation((server) => {
	// Simulate tool registration
	server.addTool({
		name: 'move_task',
		description: 'Move a task or subtask to a new position',
		parameters: {},
		execute: jest.fn()
	});
});

// Export the mock functions
export {
	mockMoveTask,
	mockMoveTaskDirect,
	mockMoveTaskCrossTagDirect,
	mockRegisterMoveTaskTool
};

// Default export for the main moveTask function
export default mockMoveTask;
