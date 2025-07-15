/**
 * tools/remove-dependency.js
 * Tool for removing a dependency from a task
 */

import { z } from 'zod';
import { handleApiResult, createErrorResponse } from './utils.js';
import { withTaskMaster } from '../../../src/task-master.js';
import { removeDependencyDirect } from '../core/task-master-core.js';

/**
 * Register the removeDependency tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRemoveDependencyTool(server) {
	server.addTool({
		name: 'remove_dependency',
		description: 'Remove a dependency from a task',
		parameters: z.object({
			id: z.string().describe('Task ID to remove dependency from'),
			dependsOn: z.string().describe('Task ID to remove as a dependency'),
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
			paths: { tasksPath: 'file' }
		})(async (taskMaster, args, { log, session }) => {
			log.info(
				`Removing dependency for task ${args.id} from ${args.dependsOn}`
			);

			// Call the direct function with taskMaster
			const result = await removeDependencyDirect(
				taskMaster,
				{
					id: args.id,
					dependsOn: args.dependsOn
				},
				log
			);

			// Log result
			if (result.success) {
				log.info(`Successfully removed dependency: ${result.data.message}`);
			} else {
				log.error(`Failed to remove dependency: ${result.error.message}`);
			}

			// Use handleApiResult to format the response
			return handleApiResult(
				result,
				log,
				'Error removing dependency',
				undefined,
				taskMaster.getProjectRoot()
			);
		})
	});
}
