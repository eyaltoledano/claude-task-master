/**
 * tools/clear-subtasks.js
 * Tool for clearing subtasks from parent tasks
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { clearSubtasksDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the clearSubtasks tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerClearSubtasksTool(server) {
	server.addTool({
		name: 'clear_subtasks',
		description: 'Clear subtasks from specified tasks',
		parameters: z
			.object({
				id: z
					.string()
					.optional()
					.describe('Task IDs (comma-separated) to clear subtasks from'),
				all: z.boolean().optional().describe('Clear subtasks from all tasks'),
				file: z
					.string()
					.optional()
					.describe(
						'Absolute path to the tasks file (default: tasks/tasks.json)'
					),
				projectRoot: z
					.string()
					.describe('The directory of the project. Must be an absolute path.')
			})
			.refine((data) => data.id || data.all, {
				message: "Either 'id' or 'all' parameter must be provided",
				path: ['id', 'all']
			}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Clearing subtasks with args: ${JSON.stringify(args)}`);

				// Get project root from args or session
				const rootFolder =
					args.projectRoot || getProjectRootFromSession(session, log);

				// Ensure project root was determined
				if (!rootFolder) {
					return createErrorResponse(
						'Could not determine project root. Please provide it explicitly or ensure your session contains valid root information.'
					);
				}

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

				const result = await clearSubtasksDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath,
						// Pass other relevant args
						id: args.id,
						all: args.all
					},
					log
					// Remove context object as clearSubtasksDirect likely doesn't need session/reportProgress
				);

				if (result.success) {
					log.info(`Subtasks cleared successfully: ${result.data.message}`);
				} else {
					log.error(`Failed to clear subtasks: ${result.error.message}`);
				}

				return handleApiResult(result, log, 'Error clearing subtasks');
			} catch (error) {
				log.error(`Error in clearSubtasks tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
