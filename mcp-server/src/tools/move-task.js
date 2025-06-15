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
import { findTasksPath } from '../core/utils/path-utils.js';

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
				.describe(
					'Root directory of the project (typically derived from session)'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				// Find tasks.json path if not provided
				let tasksJsonPath = args.file;

				if (!tasksJsonPath) {
					tasksJsonPath = findTasksPath(args, log);
				}

				// Parse comma-separated IDs
				const fromIds = args.from.split(',').map((id) => id.trim());
				const toIds = args.to.split(',').map((id) => id.trim());

				// Validate matching IDs count
				if (fromIds.length !== toIds.length) {
					return createErrorResponse(
						'The number of source and destination IDs must match',
						'MISMATCHED_ID_COUNT'
					);
				}

				// If moving multiple tasks
				if (fromIds.length > 1) {
					const results = [];
					// Move tasks one by one, only generate files on the last move
					for (let i = 0; i < fromIds.length; i++) {
						const fromId = fromIds[i];
						const toId = toIds[i];

						// Skip if source and destination are the same
						if (fromId === toId) {
							log.info(`Skipping ${fromId} -> ${toId} (same ID)`);
							continue;
						}

						const shouldGenerateFiles = i === fromIds.length - 1;
						const result = await moveTaskDirect(
							{
								sourceId: fromId,
								destinationId: toId,
								tasksJsonPath,
								projectRoot: args.projectRoot
							},
							log,
							{ session }
						);

						if (!result.success) {
							log.error(
								`Failed to move ${fromId} to ${toId}: ${result.error.message}`
							);
						} else {
							results.push(result.data);
						}
					}

					return handleApiResult(
						{
							success: true,
							data: {
								moves: results,
								message: `Successfully moved ${results.length} tasks`
							}
						},
						log,
						'Error moving multiple tasks',
						undefined,
						args.projectRoot
					);
				} else {
					// Moving a single task
					return handleApiResult(
						await moveTaskDirect(
							{
								sourceId: args.from,
								destinationId: args.to,
								tasksJsonPath,
								projectRoot: args.projectRoot
							},
							log,
							{ session }
						),
						log,
						'Error moving task',
						undefined,
						args.projectRoot
					);
				}
			} catch (error) {
				return createErrorResponse(
					`Failed to move task: ${error.message}`,
					'MOVE_TASK_ERROR'
				);
			}
		})
	});
}
