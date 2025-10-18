/**
 * tools/expand-all.js
 * Tool for expanding all pending tasks with subtasks
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { expandAllTasksDirect } from '../core/task-master-core.js';
import {
	findTasksPath,
	resolveComplexityReportOutputPath
} from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

/**
 * Register the expandAll tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandAllTool(server) {
	server.addTool({
		name: 'expand_all',
		description:
			'Expand all pending tasks into subtasks based on complexity or defaults',
		parameters: z.object({
			num: z
				.string()
				.optional()
				.describe(
					'Target number of subtasks per task (uses complexity/defaults otherwise)'
				),
			research: z
				.boolean()
				.optional()
				.describe(
					'Enable research-backed subtask generation (e.g., using Perplexity)'
				),
			prompt: z
				.string()
				.optional()
				.describe(
					'Additional context to guide subtask generation for all tasks'
				),
			force: z
				.boolean()
				.optional()
				.describe(
					'Force regeneration of subtasks for tasks that already have them'
				),
			file: z
				.string()
				.optional()
				.describe(
					'Absolute path to the tasks file in the /tasks folder inside the project root (default: tasks/tasks.json)'
				),
			projectRoot: z
				.string()
				.optional()
				.describe(
					'Absolute path to the project root directory (derived from session if possible)'
				),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(
					`Tool expand_all execution started with args: ${JSON.stringify(args)}`
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
					log.info(`Resolved tasks.json path: ${tasksJsonPath}`);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// Resolve complexity report path to use recommendations from analyze-complexity
				const complexityReportPath = resolveComplexityReportOutputPath(
					null,
					{ projectRoot: args.projectRoot, tag: resolvedTag },
					log
				);
				log.info(`Using complexity report path: ${complexityReportPath}`);

				const result = await expandAllTasksDirect(
					{
						tasksJsonPath: tasksJsonPath,
						num: args.num,
						research: args.research,
						prompt: args.prompt,
						force: args.force,
						projectRoot: args.projectRoot,
						tag: resolvedTag,
						complexityReportPath
					},
					log,
					{ session }
				);

				return handleApiResult(
					result,
					log,
					'Error expanding all tasks',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(
					`Unexpected error in expand_all tool execute: ${error.message}`
				);
				if (error.stack) {
					log.error(error.stack);
				}
				return createErrorResponse(
					`An unexpected error occurred: ${error.message}`
				);
			}
		})
	});
}
