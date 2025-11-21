/**
 * tools/remove-dependency.js
 * Tool for removing a dependency from a task
 */

import { createErrorResponse, handleApiResult, withToolContext } from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
import { removeDependencyDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the removeDependency tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerRemoveDependencyTool(server) {
	server.addTool({
		name: 'remove_dependency',
		description:
			'Remove dependencies from task(s). Supports ranges and comma-separated lists (e.g., id="7-10", dependsOn="1-5").',
		parameters: z.object({
			id: z
				.string()
				.describe(
					'Task ID(s) to remove dependencies from (e.g., "7", "7-10", "7,8,9")'
				),
			dependsOn: z
				.string()
				.describe(
					'Task ID(s) to remove as dependencies (e.g., "1", "1-5", "1,3,5")'
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
		execute: withToolContext('remove-dependency', async (args, context) => {
			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				context.log.info(
					`Removing dependency for task ${args.id} from ${args.dependsOn} with args: ${JSON.stringify(args)}`
				);

				// Use args.projectRoot directly (guaranteed by withToolContext)
				let tasksJsonPath;
				try {
					tasksJsonPath = findTasksPath(
						{ projectRoot: args.projectRoot, file: args.file },
						context.log
					);
				} catch (error) {
					context.log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				const result = await removeDependencyDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						dependsOn: args.dependsOn,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					context.log
				);

				if (result.success) {
					context.log.info(
						`Successfully removed dependency: ${result.data.message}`
					);
				} else {
					context.log.error(
						`Failed to remove dependency: ${result.error.message}`
					);
				}

				return handleApiResult({
					result,
					log: context.log,
					errorPrefix: 'Error removing dependency',
					projectRoot: args.projectRoot
				});
			} catch (error) {
				context.log.error(`Error in removeDependency tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
