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
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session, reportProgress }) => {
			// Log the session right at the start of execute
			log.info(
				`Session object received in execute: ${JSON.stringify(session)}`
			); // Use JSON.stringify for better visibility

			try {
				log.info(`Getting task details for ID: ${args.id}`);

				log.info(
					`Session object received in execute: ${JSON.stringify(session)}`
				); // Use JSON.stringify for better visibility

				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				} else if (!rootFolder) {
					// Ensure we always have *some* root, even if session failed and args didn't provide one
					rootFolder = process.cwd();
					log.warn(
						`Session and args failed to provide root, using CWD: ${rootFolder}`
					);
				}

				log.info(`Attempting to use project root: ${rootFolder}`); // Log the final resolved root

				log.info(`Root folder: ${rootFolder}`); // Log the final resolved root
				const result = await showTaskDirect(
					{
						projectRoot: rootFolder,
						...args
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
