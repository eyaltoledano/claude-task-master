/**
 * tools/update-task.js
 * Tool to update a single task by ID with new information
 */

import { z } from 'zod';
import path from 'path'; // Import path
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
				.string() // ID can be number or string like "1.2"
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
			const toolName = 'update_task';
			try {
				log.info(
					`Executing ${toolName} tool with args: ${JSON.stringify(args)}`
				);

				// 1. Get Project Root
				const rootFolder = args.projectRoot;
				if (!rootFolder || !path.isAbsolute(rootFolder)) {
					log.error(
						`${toolName}: projectRoot is required and must be absolute.`
					);
					return createErrorResponse(
						'projectRoot is required and must be absolute.'
					);
				}
				log.info(`${toolName}: Project root: ${rootFolder}`);

				// 2. Resolve Tasks Path
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: rootFolder, file: args.file }, // Pass root and optional relative file
						log
					);
					log.info(`${toolName}: Resolved tasks path: ${tasksJsonPath}`);
				} catch (error) {
					log.error(`${toolName}: Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json within project root '${rootFolder}': ${error.message}`
					);
				}

				// 3. Call Direct Function - Include projectRoot
				const result = await updateTaskByIdDirect(
					{
						tasksJsonPath: tasksJsonPath, // Pass resolved path
						id: args.id,
						prompt: args.prompt,
						research: args.research,
						projectRoot: rootFolder // <<< Pass projectRoot HERE
					},
					log,
					{ session } // Pass context with session
				);

				// 4. Handle Result
				log.info(
					`${toolName}: Direct function result: success=${result.success}`
				);
				// Pass the actual data from the result (contains updated task or message)
				return handleApiResult(result, log, 'Error updating task');
			} catch (error) {
				log.error(
					`Critical error in ${toolName} tool execute: ${error.message}`
				);
				return createErrorResponse(
					`Internal tool error (${toolName}): ${error.message}`
				);
			}
		}
	});
}
