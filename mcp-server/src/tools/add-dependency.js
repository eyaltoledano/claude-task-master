/**
 * tools/add-dependency.js
 * Tool for adding a dependency to a task
 */

import { z } from 'zod';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { addDependencyDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

/**
 * Register the addDependency tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAddDependencyTool(server) {
	server.addTool({
		name: 'add_dependency',
		description:
			'Add dependencies to task(s). Supports ranges and comma-separated lists (e.g., id="7-10", dependsOn="1-5").',
		parameters: z.object({
			id: z
				.string()
				.describe(
					'Task ID(s) that will depend on others (e.g., "7", "7-10", "7,8,9")'
				),
			dependsOn: z
				.string()
				.describe(
					'Task ID(s) that will become dependencies (e.g., "1", "1-5", "1,3,5")'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file (default: tasks/tasks.json)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`Adding dependency for task ${args.id} to depend on ${args.dependsOn}`
				);
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
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
						dependsOn: args.dependsOn,
						projectRoot: args.projectRoot,
						tag: resolvedTag
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
				return handleApiResult(
					result,
					log,
					'Error adding dependency',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in addDependency tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
