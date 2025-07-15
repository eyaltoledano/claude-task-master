/**
 * tools/remove-task.js
 * Tool to remove a task by ID
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { removeTaskDirect } from '../core/task-master-core.js';

/**
 * Register the remove-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRemoveTaskTool(server) {
	server.addTool({
		name: 'remove_task',
		description: 'Remove a task or subtask permanently from the tasks list',
		parameters: z.object({
			id: z
				.string()
				.describe(
					"ID of the task or subtask to remove (e.g., '5' or '5.2'). Can be comma-separated to update multiple tasks/subtasks at once."
				),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			confirm: z
				.boolean()
				.optional()
				.describe('Whether to skip confirmation prompt (default: false)'),
			tag: z
				.string()
				.optional()
				.describe(
					'Specify which tag context to operate on. Defaults to the current active tag.'
				)
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Removing task(s) with ID(s): ${args.id}`);

				const result = await removeTaskDirect(
					taskMaster,
					{ id: args.id, tag: args.tag },
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully removed task: ${args.id}`);
				} else {
					log.error(`Failed to remove task: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error removing task',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in remove-task tool: ${error.message}`);
				return createErrorResponse(`Failed to remove task: ${error.message}`);
			}
		})
	});
}
