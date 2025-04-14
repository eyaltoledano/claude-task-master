/**
 * tools/next-task.js
 * Tool to find the next task to work on
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { nextTaskDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the next-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerNextTaskTool(server) {
	server.addTool({
		name: 'next_task',
		description:
			'Find the next task to work on based on dependencies and status',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Finding next task with args: ${JSON.stringify(args)}`);

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

				const result = await nextTaskDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath
						// No other args specific to this tool
					},
					log
				);

				if (result.success) {
					log.info(
						`Successfully found next task: ${result.data?.task?.id || 'No available tasks'}`
					);
				} else {
					log.error(
						`Failed to find next task: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult(result, log, 'Error finding next task');
			} catch (error) {
				log.error(`Error in nextTask tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
