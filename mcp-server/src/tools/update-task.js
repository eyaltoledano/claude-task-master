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
import { findTasksJsonPath } from '../core/utils/path-utils.js';

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
				.describe(
					"ID of the task (e.g., '15') to update. Subtasks are supported using the update-subtask tool."
				),
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
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Updating task with args: ${JSON.stringify(args)}`);

				// Get project root from args or session
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);

				// Ensure project root was determined
				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
				}

				// Resolve the path to tasks.json
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: rootFolder, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const result = await updateTaskByIdDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath,
						// Pass other relevant args
						id: args.id,
						prompt: args.prompt,
						research: args.research
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
