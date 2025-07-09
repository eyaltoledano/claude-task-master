/**
 * tools/next-task.js
 * Tool to find the next task to work on based on dependencies and status
 */

import { z } from 'zod';
import { createErrorResponse, handleApiResult } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { nextTaskDirect } from '../core/task-master-core.js';

/**
 * Register the nextTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerNextTaskTool(server) {
	server.addTool({
		name: 'next_task',
		description:
			'Find the next task to work on based on dependencies and status',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			complexityReport: z
				.string()
				.optional()
				.describe(
					'Path to the complexity report file (relative to project root or absolute)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: withTaskMaster({
			tasksPath: 'file',
			complexityReportPath: 'complexityReport',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Finding next task with args: ${JSON.stringify(args)}`);

				const result = await nextTaskDirect(taskMaster, {}, log, { session });

				log.info(`Next task result: ${result.success ? 'found' : 'none'}`);
				return handleApiResult(
					result,
					log,
					'Error finding next task',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error finding next task: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
