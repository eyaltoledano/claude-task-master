/**
 * tools/get-tasks.js
 * Tool to get all tasks from Task Master
 */

import { z } from 'zod';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { listTasksDirect } from '../core/task-master-core.js';
import {
	resolveTasksPath,
	resolveComplexityReportPath
} from '../core/utils/path-utils.js';

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
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Getting tasks with filters: ${JSON.stringify(args)}`);

				// Resolve the path to tasks.json using new path utilities
				let tasksJsonPath;
				try {
					tasksJsonPath = resolveTasksPath(args, log);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// Resolve the path to complexity report
				let complexityReportPath;
				try {
					complexityReportPath = resolveComplexityReportPath(args, session);
				} catch (error) {
					log.error(`Error finding complexity report: ${error.message}`);
					// This is optional, so we don't fail the operation
					complexityReportPath = null;
				}

				const result = await listTasksDirect(
					{
						tasksJsonPath: tasksJsonPath,
						status: args.status,
						withSubtasks: args.withSubtasks,
						reportPath: complexityReportPath,
						projectRoot: args.projectRoot
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
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error getting tasks: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}

// We no longer need the formatTasksResponse function as we're returning raw JSON data
