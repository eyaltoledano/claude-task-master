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
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Expanding all tasks with args: ${JSON.stringify(args)}`);

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				const result = await expandAllTasksDirect(
					{
						projectRoot: rootFolder,
						...args
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
