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
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session, reportProgress }) => {
			try {
				log.info(`Finding next task with args: ${JSON.stringify(args)}`);
				// await reportProgress({ progress: 0 });

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				const result = await nextTaskDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log /*, { reportProgress, mcpLog: log, session}*/
				);

				// await reportProgress({ progress: 100 });

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
