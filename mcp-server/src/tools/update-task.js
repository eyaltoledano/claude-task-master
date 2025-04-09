/**
 * tools/update-task.js
 * Tool to update a single task by ID with new information
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { updateTaskByIdDirect } from '../core/task-master-core.js';

/**
 * Register the update-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTaskTool(server) {
	server.addTool({
		name: 'update_task',
		description:
			'Updates a single task by ID with new information or context provided in the prompt.',
		parameters: z.object({
			id: z
				.string()
				.describe("ID of the task or subtask (e.g., '15', '15.2') to update"),
			prompt: z
				.string()
				.describe('New information or context to incorporate into the task'),
			research: z
				.boolean()
				.optional()
				.describe('Use Perplexity AI for research-backed updates'),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Updating task with args: ${JSON.stringify(args)}`);

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				const result = await updateTaskByIdDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully updated task with ID ${args.id}`);
				} else {
					log.error(
						`Failed to update task: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(result, log, 'Error updating task');
			} catch (error) {
				log.error(`Error in update_task tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
