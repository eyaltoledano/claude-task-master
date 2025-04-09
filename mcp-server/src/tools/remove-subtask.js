/**
 * tools/remove-subtask.js
 * Tool for removing subtasks from parent tasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
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
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session, reportProgress }) => {
			try {
				log.info(`Removing subtask with args: ${JSON.stringify(args)}`);
				// await reportProgress({ progress: 0 });

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				const result = await removeSubtaskDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log /*, { reportProgress, mcpLog: log, session}*/
				);

				// await reportProgress({ progress: 100 });

				if (result.success) {
					log.info(`Subtask removed successfully: ${result.data.message}`);
				} else {
					log.error(`Failed to remove subtask: ${result.error.message}`);
				}

				return handleApiResult(result, log, 'Error removing subtask');
			} catch (error) {
				log.error(`Error in removeSubtask tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
