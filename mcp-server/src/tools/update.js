/**
 * tools/update.js
 * Tool to update tasks based on new context/prompt
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { updateTasksDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';
import path from 'path';

/**
 * Register the update tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerUpdateTool(server) {
	server.addTool({
		name: 'update',
		description:
			"Update multiple upcoming tasks (with ID >= 'from' ID) based on new context or changes provided in the prompt. Use 'update_task' instead for a single specific task or 'update_subtask' for subtasks.",
		parameters: z.object({
			from: z
				.string()
				.describe(
					"Task ID from which to start updating (inclusive). IMPORTANT: This tool uses 'from', not 'id'"
				),
			prompt: z
				.string()
				.describe('Explanation of changes or new context to apply'),
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
				log.info(`Executing update tool with args: ${JSON.stringify(args)}`);

				// 1. Get Project Root
				const rootFolder = args.projectRoot;
				if (!rootFolder || !path.isAbsolute(rootFolder)) {
					return createErrorResponse(
						'projectRoot is required and must be absolute.'
					);
				}
				log.info(`Project root: ${rootFolder}`);

				// 2. Resolve Path
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksJsonPath(
						{ projectRoot: rootFolder, file: args.file },
						log
					);
					log.info(`Resolved tasks path: ${tasksJsonPath}`);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// 3. Call Direct Function
				const result = await updateTasksDirect(
					{
						tasksJsonPath: tasksJsonPath,
						from: args.from,
						prompt: args.prompt,
						research: args.research,
						projectRoot: rootFolder
					},
					log,
					{ session }
				);

				// 4. Handle Result
				log.info(`updateTasksDirect result: success=${result.success}`);
				return handleApiResult(result, log, 'Error updating tasks');
			} catch (error) {
				log.error(`Critical error in update tool execute: ${error.message}`);
				return createErrorResponse(`Internal tool error: ${error.message}`);
			}
		}
	});
}
