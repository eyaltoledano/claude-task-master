/**
 * tools/setTaskStatus.js
 * Tool to set the status of a task
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import {
	setTaskStatusDirect,
	nextTaskDirect
} from '../core/task-master-core.js';
import { TASK_STATUS_OPTIONS } from '../../../src/constants/task-status.js';

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
		execute: withTaskMaster({
			paths: { tasksPath: 'file', complexityReportPath: 'complexityReport' }
		})(async (taskMaster, args, { log, session }) => {
			try {
				log.info(`Setting status of task(s) ${args.id} to: ${args.status}`);

				// Get paths from TaskMaster
				log.info(`Using tasks path: ${taskMaster.getTasksPath()}`);
				const complexityReportPath = taskMaster.getComplexityReportPath();

				const result = await setTaskStatusDirect(
					taskMaster,
					{
						id: args.id,
						status: args.status,
						complexityReportPath,
						tag: args.tag
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error setting task status',
					undefined,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in setTaskStatus tool: ${error.message}`);
				return createErrorResponse(
					`Error setting task status: ${error.message}`
				);
			}
		})
	});
}
