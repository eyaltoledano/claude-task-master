/**
 * tools/remove-task.js
 * Tool to remove a task by ID
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { removeTaskDirect } from '../core/task-master-core.js';
import { findTasksJsonPath } from '../core/utils/path-utils.js';

/**
 * Register the remove-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRemoveTaskTool(server) {
	server.addTool({
		name: 'remove_task',
		description: 'Remove a task or subtask permanently from the tasks list',
		parameters: z.object({
			id: z
				.string()
				.describe("ID of the task or subtask to remove (e.g., '5' or '5.2')"),
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				),
			confirm: z
				.boolean()
				.optional()
				.describe('Whether to skip confirmation prompt (default: false)')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(`Removing task with ID: ${args.id}`);

				// Get project root from session
				let rootFolder = getProjectRootFromSession(session, log);

				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				} else if (!rootFolder) {
					// Ensure we have a default if nothing else works
					rootFolder = process.cwd();
					log.warn(
						`Session and args failed to provide root, using CWD: ${rootFolder}`
					);
				}

				log.info(`Using project root: ${rootFolder}`);

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

				log.info(`Using tasks file path: ${tasksJsonPath}`);

				// Assume client has already handled confirmation if needed
				const result = await removeTaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id
					},
					log
				);

				if (result.success) {
					log.info(`Successfully removed task: ${args.id}`);
				} else {
					log.error(`Failed to remove task: ${result.error.message}`);
				}

				return handleApiResult(result, log, 'Error removing task');
			} catch (error) {
				log.error(`Error in remove-task tool: ${error.message}`);
				return createErrorResponse(`Failed to remove task: ${error.message}`);
			}
		}
	});
}
