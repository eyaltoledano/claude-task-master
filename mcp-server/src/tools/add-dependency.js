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
import { findTasksJsonPath } from '../core/utils/path-utils.js';

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
				.describe('The directory of the project. Must be an absolute path.')
		}),
		execute: async (args, { log, session }) => {
			try {
				log.info(
					`Adding dependency for task ${args.id} to depend on ${args.dependsOn}`
				);

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

				// Call the direct function with the resolved path
				const result = await addDependencyDirect(
					{
						// Pass the explicitly resolved path
						tasksJsonPath: tasksJsonPath,
						// Pass other relevant args
						id: args.id,
						dependsOn: args.dependsOn
					},
					log
					// Remove context object
				);

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
