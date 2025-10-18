/**
 * tools/scope-down.js
 * Tool to scope down task complexity
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { scopeDownDirect } from '../core/task-master-core.js';
import { findTasksPath } from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

/**
 * Register the scopeDown tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerScopeDownTool(server) {
	server.addTool({
		name: 'scope_down_task',
		description: 'Decrease the complexity of one or more tasks using AI',
		parameters: z.object({
			id: z
				.string()
				.describe(
					'Comma-separated list of task IDs to scope down (e.g., "1,3,5")'
				),
			strength: z
				.string()
				.optional()
				.describe(
					'Strength level: light, regular, or heavy (default: regular)'
				),
			prompt: z
				.string()
				.optional()
				.describe('Custom prompt for specific scoping adjustments'),
			file: z
				.string()
				.optional()
				.describe('Path to the tasks file (default: tasks/tasks.json)'),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on'),
			research: z
				.boolean()
				.optional()
				.describe('Whether to use research capabilities for scoping')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting scope-down with args: ${JSON.stringify(args)}`);

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

				// Call the direct function
				const result = await scopeDownDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						strength: args.strength,
						prompt: args.prompt,
						research: args.research,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error scoping down task',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error in scope-down tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
