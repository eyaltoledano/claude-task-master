/**
 * tools/fix-dependencies.js
 * Tool for automatically fixing invalid task dependencies
 */

import { createErrorResponse, handleApiResult, withToolContext } from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
import { fixDependenciesDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';

/**
 * Register the fixDependencies tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerFixDependenciesTool(server) {
	server.addTool({
		name: 'fix_dependencies',
		description: 'Fix invalid dependencies in tasks automatically',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withToolContext('fix-dependencies', async (args, context) => {
			try {
				context.log.info(
					`Fixing dependencies with args: ${JSON.stringify(args)}`
				);

				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});

				// Use args.projectRoot directly (guaranteed by withNormalizedProjectRoot)
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

				const result = await fixDependenciesDirect(
					{
						tasksJsonPath: tasksJsonPath,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					context.log
				);

				if (result.success) {
					context.log.info(
						`Successfully fixed dependencies: ${result.data.message}`
					);
				} else {
					context.log.error(
						`Failed to fix dependencies: ${result.error.message}`
					);
				}

				return handleApiResult({
					result,
					log: context.log,
					errorPrefix: 'Error fixing dependencies',
					projectRoot: args.projectRoot
				});
			} catch (error) {
				context.log.error(`Error in fixDependencies tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
