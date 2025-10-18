/**
 * tools/remove-dependency.js
 * Tool for removing a dependency from a task
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { removeDependencyDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

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
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});
				log.info(
					`Removing dependency for task ${args.id} from ${args.dependsOn} with args: ${JSON.stringify(args)}`
				);

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
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

				const result = await removeDependencyDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						dependsOn: args.dependsOn,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log
				);

				if (result.success) {
					log.info(`Successfully removed dependency: ${result.data.message}`);
				} else {
					log.error(`Failed to remove dependency: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error removing dependency',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in removeDependency tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
