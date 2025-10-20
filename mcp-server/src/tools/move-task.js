/**
 * tools/move-task.js
 * Tool for moving tasks or subtasks to a new position
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import {
	moveTaskDirect,
	moveTaskCrossTagDirect
} from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

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
				.optional()
				.describe(
					'ID of the destination (e.g., "7" or "7.3"). Required for within-tag moves. For cross-tag moves, if omitted, task will be moved to the target tag maintaining its ID'
				),
			file: z.string().optional().describe('Custom path to tasks.json file'),
			projectRoot: z
				.string()
				.describe(
					'Root directory of the project (typically derived from session)'
				),
			tag: z.string().optional().describe('Tag context to operate on'),
			fromTag: z.string().optional().describe('Source tag for cross-tag moves'),
			toTag: z.string().optional().describe('Target tag for cross-tag moves'),
			withDependencies: z
				.boolean()
				.optional()
				.describe('Move dependent tasks along with main task'),
			ignoreDependencies: z
				.boolean()
				.optional()
				.describe('Break cross-tag dependencies during move')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				// Check if this is a cross-tag move
				const isCrossTagMove =
					args.fromTag && args.toTag && args.fromTag !== args.toTag;

				if (isCrossTagMove) {
					// Cross-tag move logic
					if (!args.from) {
						return createErrorResponse(
							'Source IDs are required for cross-tag moves',
							'MISSING_SOURCE_IDS'
						);
					}

					// Warn if 'to' parameter is provided for cross-tag moves
					if (args.to) {
						log.warn(
							'The "to" parameter is not used for cross-tag moves and will be ignored. Tasks retain their original IDs in the target tag.'
						);
					}

					// Find tasks.json path if not provided
					let tasksJsonPath = args.file;
					if (!tasksJsonPath) {
						tasksJsonPath = findTasksPath(args, log);
					}

					// Use cross-tag move function
					return handleApiResult(
						await moveTaskCrossTagDirect(
							{
								sourceIds: args.from,
								sourceTag: args.fromTag,
								targetTag: args.toTag,
								withDependencies: args.withDependencies || false,
								ignoreDependencies: args.ignoreDependencies || false,
								tasksJsonPath,
								projectRoot: args.projectRoot
							},
							log,
							{ session }
						),
						log,
						'Error moving tasks between tags',
						undefined,
						args.projectRoot
					);
				} else {
					// Within-tag move logic (existing functionality)
					if (!args.to) {
						return createErrorResponse(
							'Destination ID is required for within-tag moves',
							'MISSING_DESTINATION_ID'
						);
					}

					const resolvedTag = resolveTag({
						projectRoot: args.projectRoot,
						tag: args.tag
					});

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
						if (fromIds.length > 1) {
							const results = [];
							const skipped = [];
							// Move tasks one by one, only generate files on the last move
							for (let i = 0; i < fromIds.length; i++) {
								const fromId = fromIds[i];
								const toId = toIds[i];

								// Skip if source and destination are the same
								if (fromId === toId) {
									log.info(`Skipping ${fromId} -> ${toId} (same ID)`);
									skipped.push({ fromId, toId, reason: 'same ID' });
									continue;
								}

								const shouldGenerateFiles = i === fromIds.length - 1;
								const result = await moveTaskDirect(
									{
										sourceId: fromId,
										destinationId: toId,
										tasksJsonPath,
										projectRoot: args.projectRoot,
										tag: resolvedTag,
										generateFiles: shouldGenerateFiles
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
										skipped: skipped.length > 0 ? skipped : undefined,
										message: `Successfully moved ${results.length} tasks${skipped.length > 0 ? `, skipped ${skipped.length}` : ''}`
									}
								},
								log,
								'Error moving multiple tasks',
								undefined,
								args.projectRoot
							);
						}
						return handleApiResult(
							{
								success: true,
								data: {
									moves: results,
									skippedMoves: skippedMoves,
									message: `Successfully moved ${results.length} tasks${skippedMoves.length > 0 ? `, skipped ${skippedMoves.length} moves` : ''}`
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
									projectRoot: args.projectRoot,
									tag: resolvedTag,
									generateFiles: true
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
