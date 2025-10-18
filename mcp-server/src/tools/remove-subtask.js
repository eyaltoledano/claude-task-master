/**
 * tools/remove-subtask.js
 * Tool for removing subtasks from parent tasks
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { removeSubtaskDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

/**
 * Register the removeSubtask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRemoveSubtaskTool(server) {
	server.addTool({
		name: 'remove_subtask',
		description: 'Remove a subtask from its parent task',
		parameters: z.object({
			id: z
				.string()
				.describe(
					"Subtask ID to remove in format 'parentId.subtaskId' (required)"
				),
			convert: z
				.boolean()
				.optional()
				.describe(
					'Convert the subtask to a standalone task instead of deleting it'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file (default: tasks/tasks.json)'
				),
			skipGenerate: z
				.boolean()
				.optional()
				.describe('Skip regenerating task files'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				log.info(`Removing subtask with args: ${JSON.stringify(args)}`);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const result = await removeSubtaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						convert: args.convert,
						skipGenerate: args.skipGenerate,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Subtask removed successfully: ${result.data.message}`);
				} else {
					log.error(`Failed to remove subtask: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error removing subtask',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in removeSubtask tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
