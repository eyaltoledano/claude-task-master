/**
 * tools/get-task.js
 * Tool to get task details by ID
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { showTaskDirect } from '../core/task-master-core.js';

/**
 * Custom processor function that removes allTasks from the response
 * @param {Object} data - The data returned from showTaskDirect
 * @returns {Object} - The processed data with allTasks removed
 */
function processTaskResponse(data) {
	if (!data) return data;

	// If we have the expected structure with task and allTasks
	if (typeof data === 'object' && data !== null && data.id && data.title) {
		// If the data itself looks like the task object, return it
		return data;
	} else if (data.task) {
		return data.task;
	}

	// If structure is unexpected, return as is
	return data;
}

/**
 * Register the get-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerShowTaskTool(server) {
	server.addTool({
		name: 'get_task',
		description: 'Get detailed information about a specific task',
		parameters: z.object({
			id: z
				.string()
				.describe(
					'Task ID(s) to get (can be comma-separated for multiple tasks)'
				),
			status: z
				.string()
				.optional()
				.describe("Filter subtasks by status (e.g., 'pending', 'done')"),
			file: z
				.string()
				.optional()
				.describe('Path to the tasks file relative to project root'),
			complexityReport: z
				.string()
				.optional()
				.describe(
					'Path to the complexity report file (relative to project root or absolute)'
				),
			projectRoot: z
				.string()
				.describe(
					'Absolute path to the project root directory (Optional, usually from session)'
				)
		}),
		execute: withTaskMaster({
			paths: { tasksPath: 'file', complexityReportPath: 'complexityReport' }
		})(async (taskMaster, args, { log, session }) => {
			const { id, status } = args;

			try {
				log.info(
					`Getting task details for ID: ${id}${status ? ` (filtering subtasks by status: ${status})` : ''} in root: ${taskMaster.getProjectRoot()}`
				);

				// Call the direct function
				const result = await showTaskDirect(
					taskMaster,
					{
						id: id,
						status: status
					},
					log,
					{ session }
				);

				if (result.success) {
					log.info(`Successfully retrieved task details for ID: ${args.id}`);
				} else {
					log.error(`Failed to get task: ${result.error.message}`);
				}

				// Use our custom processor function
				return handleApiResult(
					result,
					log,
					'Error retrieving task details',
					processTaskResponse,
					taskMaster.getProjectRoot()
				);
			} catch (error) {
				log.error(`Error in get-task tool: ${error.message}\n${error.stack}`);
				return createErrorResponse(`Failed to get task: ${error.message}`);
			}
		})
	});
}
