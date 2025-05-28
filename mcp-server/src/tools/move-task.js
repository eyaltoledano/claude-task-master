/**
 * tools/move-task.js
 * Tool for moving tasks or subtasks to a new position
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { moveTaskDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the moveTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerMoveTaskTool(server) {
	server.addTool({
		name: 'move_task',
		description: 'Move a task or subtask to a new position',
		parameters: z.object({
			from: z
				.string()
				.describe(
					'ID of the task/subtask to move (e.g., "5" or "5.2"). Can be comma-separated to move multiple tasks (e.g., "5,6,7")'
				),
			to: z
				.string()
				.describe(
					'ID of the destination (e.g., "7" or "7.3"). Must match the number of source IDs if comma-separated'
				),
			file: z.string().optional().describe('Custom path to tasks.json file'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Root directory of the project (typically derived from session)'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				// Let the core logic handle comma-separated IDs and validation
				const result = await moveTaskDirect(
					{
						sourceId: args.from,
						destinationId: args.to,
						file: args.file,
						projectRoot: args.projectRoot,
						generateFiles: true // Always generate files for MCP operations
					},
					log,
					{ session }
				);

				return handleApiResult(result, log);
			} catch (error) {
				return createErrorResponse(
					`Failed to move task: ${error.message}`,
					'MOVE_TASK_ERROR'
				);
			}
		})
	});
}
