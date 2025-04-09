/**
 * tools/add-dependency.js
 * Tool for adding a dependency to a task
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	getProjectRootFromSession
} from './utils.js';
import { addDependencyDirect } from '../core/task-master-core.js';

/**
 * Register the addDependency tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddDependencyTool(server) {
	server.addTool({
		name: 'add_dependency',
		description: 'Add a dependency relationship between two tasks',
		parameters: z.object({
			id: z.string().describe('ID of task that will depend on another task'),
			dependsOn: z
				.string()
				.describe('ID of task that will become a dependency'),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file (default: tasks/tasks.json)'
				),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Root directory of the project (default: current working directory)'
				)
		}),
		execute: async (args, { log, session, reportProgress }) => {
			try {
				log.info(
					`Adding dependency for task ${args.id} to depend on ${args.dependsOn}`
				);
				reportProgress({ progress: 0 });

				// Get project root using the utility function
				let rootFolder = getProjectRootFromSession(session, log);

				// Fallback to args.projectRoot if session didn't provide one
				if (!rootFolder && args.projectRoot) {
					rootFolder = args.projectRoot;
					log.info(`Using project root from args as fallback: ${rootFolder}`);
				}

				// Call the direct function with the resolved rootFolder
				const result = await addDependencyDirect(
					{
						projectRoot: rootFolder,
						...args
					},
					log,
					{ reportProgress, mcpLog: log, session }
				);

				reportProgress({ progress: 100 });

				// Log result
				if (result.success) {
					log.info(`Successfully added dependency: ${result.data.message}`);
				} else {
					log.error(`Failed to add dependency: ${result.error.message}`);
				}

				// Use handleApiResult to format the response
				return handleApiResult(result, log, 'Error adding dependency');
			} catch (error) {
				log.error(`Error in addDependency tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		}
	});
}
