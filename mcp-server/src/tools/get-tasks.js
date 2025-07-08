/**
 * tools/get-tasks.js
 * Tool to get all tasks from Task Master
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult
} from './utils.js';
import { listTasksDirect } from '../core/task-master-core.js';
import { withTaskMaster } from '../../../src/task-master.js';

/**
 * Register the getTasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerListTasksTool(server) {
	server.addTool({
		name: 'get_tasks',
		description:
			'Get all tasks from Task Master, optionally filtering by status and including subtasks.',
		parameters: z.object({
			status: z
				.string()
				.optional()
				.describe(
					"Filter tasks by status (e.g., 'pending', 'done') or multiple statuses separated by commas (e.g., 'blocked,deferred')"
				),
			withSubtasks: z
				.boolean()
				.optional()
				.describe(
					'Include subtasks nested within their parent tasks in the response'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Path to the tasks file (relative to project root or absolute)'
				),
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
			log.info(`Getting tasks with filters: ${JSON.stringify(args)}`);

			const result = await listTasksDirect(
				{
					tasksJsonPath: taskMaster.getTasksPath(),
					status: args.status,
					withSubtasks: args.withSubtasks,
					reportPath: taskMaster.getComplexityReportPath(),
					projectRoot: taskMaster.getProjectRoot()
				},
				log,
				{ session }
			);

			log.info(
				`Retrieved ${result.success ? result.data?.tasks?.length || 0 : 0} tasks`
			);
			return handleApiResult(
				result,
				log,
				'Error getting tasks',
				undefined,
				taskMaster.getProjectRoot()
			);
		})
	});
}

// We no longer need the formatTasksResponse function as we're returning raw JSON data
