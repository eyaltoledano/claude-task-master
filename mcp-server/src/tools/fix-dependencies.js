/**
 * tools/fix-dependencies.js
 * Tool for automatically fixing invalid task dependencies
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { fixDependenciesDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';
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
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Fixing dependencies with args: ${JSON.stringify(args)}`);

				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});

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

				const result = await fixDependenciesDirect(
					{
						tasksJsonPath: tasksJsonPath,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log
				);

				if (result.success) {
					log.info(`Successfully fixed dependencies: ${result.data.message}`);
				} else {
					log.error(`Failed to fix dependencies: ${result.error.message}`);
				}

				return handleApiResult(
					result,
					log,
					'Error fixing dependencies',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in fixDependencies tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
