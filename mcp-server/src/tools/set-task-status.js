/**
 * tools/setTaskStatus.js
 * Tool to set the status of a task
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { setTaskStatusDirect } from '../core/task-master-core.js';

/**
 * Register the setTaskStatus tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerSetTaskStatusTool(server) {
	server.addTool({
		name: 'set_task_status',
		description: 'Set the status of one or more tasks or subtasks.',
		parameters: z.object({
			id: z
				.string()
				.describe(
					"Task ID or subtask ID (e.g., '15', '15.2'). Can be comma-separated for multiple updates."
				),
			status: z
				.string()
				.describe(
					"New status to set (e.g., 'pending', 'done', 'in-progress', 'review', 'deferred', 'cancelled'."
				),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Root directory of the project (default: automatically detected)'
				)
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Setting status of task(s) ${args.id} to: ${args.status}`);

				// Get project root from session
				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				// Call the direct function with the project root
				const result = await setTaskStatusDirect(
					{
						...args,
						projectRoot: rootFolder
					},
					log
				);

				// Log the result
				if (result.success) {
					log.info(
						`Successfully updated status for task(s) ${args.id} to "${args.status}": ${result.data.message}`
					);
				} else {
					log.error(
						`Failed to update task status: ${result.error?.message || 'Unknown error'}`
					);
				}

				// Format and return the result
				return handleApiResult(result, log, 'Error setting task status');
			} catch (error) {
				log.error(`Error in setTaskStatus tool: ${error.message}`);
				return createErrorResponse(
					`Error setting task status: ${error.message}`
				);
			}
		}
	});
}
