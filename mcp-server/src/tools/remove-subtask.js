/**
 * tools/remove-subtask.js
 * Tool for removing subtasks from parent tasks
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { removeSubtaskDirect } from '../core/task-master-core.js';

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
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Removing subtask with args: ${JSON.stringify(args)}`);

				const result = await removeSubtaskDirect(
					taskMaster,
					{
						id: args.id,
						convert: args.convert,
						skipGenerate: args.skipGenerate
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
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in removeSubtask tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
