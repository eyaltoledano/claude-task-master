/**
 * tools/add-task.js
 * Tool to add a new task using AI
 */

import { z } from 'zod';
import {
	createErrorResponse,
	createContentResponse,
	getProjectRootFromSession,
	executeTaskMasterCommand,
	handleApiResult
} from './utils.js';
import { addTaskDirect } from '../core/task-master-core.js';

/**
 * Register the addTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddTaskTool(server) {
	server.addTool({
		name: 'add_task',
		description: 'Add a new task using AI',
		parameters: z.object({
			prompt: z.string().describe('Description of the task to add'),
			dependencies: z
				.string()
				.optional()
				.describe('Comma-separated list of task IDs this task depends on'),
			priority: z
				.string()
				.optional()
				.describe('Task priority (high, medium, low)'),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.optional()
				.describe('Root directory of the project'),
			research: z
				.boolean()
				.optional()
				.describe('Whether to use research capabilities for task creation')
		}),
		execute: async (args, { log, reportProgress, session }) => {
			try {
				log.info(`Starting add-task with args: ${JSON.stringify(args)}`);

				// Get project root from session
				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				// Call the direct function
				const result = await addTaskDirect(
					{
						...args,
						projectRoot: rootFolder
					},
					log,
					{ reportProgress, session }
				);

				// Return the result
				return handleApiResult(result, log);
			} catch (error) {
				log.error(`Error in add-task tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
