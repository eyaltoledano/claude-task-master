/**
 * tools/expand-all.js
 * Tool for expanding all pending tasks with subtasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { expandAllTasksDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the expandAll tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandAllTool(server) {
	server.addTool({
		name: 'expand_all',
		description: 'Expand all pending tasks into subtasks',
		parameters: z.object({
			num: z
				.string()
				.optional()
				.describe('Number of subtasks to generate for each task'),
			research: z
				.boolean()
				.optional()
				.describe(
					'Enable Perplexity AI for research-backed subtask generation'
				),
			prompt: z
				.string()
				.optional()
				.describe('Additional context to guide subtask generation'),
			force: z
				.boolean()
				.optional()
				.describe(
					'Force regeneration of subtasks for tasks that already have them'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file (default: tasks/tasks.json)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Expanding all tasks with args: ${JSON.stringify(args)}`);

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

				const result = await expandAllTasksDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath,
						// Pass other relevant args
						num: args.num,
						research: args.research,
						prompt: args.prompt,
						force: args.force
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully expanded all tasks: ${result.data.message}`);
				} else {
					log.error(
						`Failed to expand all tasks: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(result, log, 'Error expanding all tasks');
			} catch (error) {
				log.error(`Error in expand-all tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
