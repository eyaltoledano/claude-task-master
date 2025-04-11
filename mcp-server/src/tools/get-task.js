/**
 * tools/get-task.js
 * Tool to get task details by ID
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { showTaskDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Custom processor function that removes allTasks from the response
 * @param {Object} data - The data returned from showTaskDirect
 * @returns {Object} - The processed data with allTasks removed
 */
function processTaskResponse(data) {
	if (!data) return data;

	// If we have the expected structure with task and allTasks
	if (data.task) {
		// Return only the task object, removing the allTasks array
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
			id: z.string().describe('Task ID to get'),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			// Log the session right at the start of execute
			log.info(
				`Session object received in execute: ${JSON.stringify(session)}`
			); // Use JSON.stringify for better visibility

			try {
				log.info(`Getting task details for ID: ${args.id}`);

				log.info(
					`Session object received in execute: ${JSON.stringify(session)}`
				); // Use JSON.stringify for better visibility

				// Get project root from args or session
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);

				// Ensure project root was determined
				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
				}

				log.info(`Attempting to use project root: ${rootFolder}`); // Log the final resolved root

				log.info(`Root folder: ${rootFolder}`); // Log the final resolved root

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

				log.info(`Attempting to use tasks file path: ${tasksJsonPath}`);

				const result = await showTaskDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath,
						// Pass other relevant args
						id: args.id
					},
					log
				);

				if (result.success) {
					log.info(
						`Successfully retrieved task details for ID: ${args.id}${result.fromCache ? ' (from cache)' : ''}`
					);
				} else {
					log.error(`Failed to get task: ${result.error.message}`);
				}

				// Use our custom processor function to remove allTasks from the response
				return handleApiResult(
					result,
					log,
					'Error retrieving task details',
					processTaskResponse
				);
			} catch (error) {
				log.error(`Error in get-task tool: ${error.message}\n${error.stack}`); // Add stack trace
				return createErrorResponse(`Failed to get task: ${error.message}`);
			}
		}
	});
}
