/**
 * tools/setTaskStatus.js
 * Tool to set the status of a task
 */

import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
import { TASK_STATUS_OPTIONS } from '../../../src/constants/task-status.js';
import {
	nextTaskDirect,
	setTaskStatusDirect
} from '../core/task-master-core.js';
import {
	findComplexityReportPath,
	findTasksPath
} from '../core/utils/path-utils.js';

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
					"Task ID or subtask ID (e.g., '15', '15.2'). Can be comma-separated to update multiple tasks/subtasks at once."
				),
			status: z
				.enum(TASK_STATUS_OPTIONS)
				.describe(
					"New status to set (e.g., 'pending', 'done', 'in-progress', 'review', 'deferred', 'cancelled'."
				),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			complexityReport: z
				.string()
				.optional()
				.describe(
					'Path to the complexity report file (relative to project root or absolute)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Optional tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`Setting status of task(s) ${args.id} to: ${args.status} ${
						args.tag ? `in tag: ${args.tag}` : 'in current tag'
					}`
				);
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						log
					);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				let complexityReportPath;
				try {
					complexityReportPath = findComplexityReportPath(
						{
							projectRoot: args.projectRoot,
							complexityReport: args.complexityReport,
							tag: resolvedTag
						},
						log
					);
				} catch (error) {
					log.error(`Error finding complexity report: ${error.message}`);
				}

				const result = await setTaskStatusDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						status: args.status,
						complexityReportPath,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(
						`Successfully updated status for task(s) ${args.id} to "${args.status}": ${result.data.message}`
					);
				} else {
					log.error(
						`Failed to update task status: ${result.error?.message || 'Unknown error'}`
					);
				}

				return handleApiResult({
					result,
					log: log,
					errorPrefix: 'Error setting task status',
					projectRoot: args.projectRoot
				});
			} catch (error) {
				log.error(`Error in setTaskStatus tool: ${error.message}`);
				return createErrorResponse(
					`Error setting task status: ${error.message}`
				);
			}
		})
	});
}
