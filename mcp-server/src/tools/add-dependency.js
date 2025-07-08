/**
 * tools/add-dependency.js
 * Tool for adding a dependency to a task
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse
} from './utils.js';
import { addDependencyDirect } from '../core/task-master-core.js';
import { withTaskMaster } from '../../../src/task-master.js';

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
		execute: withTaskMaster({
			tasksPath: 'file',
			required: ['tasksPath']
		})(async (taskMaster, args, { log, session }) => {
			log.info(
				`Adding dependency for task ${args.id} to depend on ${args.dependsOn}`
			);

			// Call the direct function with the resolved path
			const result = await addDependencyDirect(
				{
					tasksJsonPath: taskMaster.getTasksPath(),
					id: args.id,
					dependsOn: args.dependsOn
				},
				log
			);

			// Log result
			if (result.success) {
				log.info(`Successfully added dependency: ${result.data.message}`);
			} else {
				log.error(`Failed to add dependency: ${result.error.message}`);
			}

			// Use handleApiResult to format the response
			return handleApiResult(
				result,
				log,
				'Error adding dependency',
				undefined,
				taskMaster.getProjectRoot()
			);
		})
	});
}
