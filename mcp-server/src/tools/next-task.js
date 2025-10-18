/**
 * tools/next-task.js
 * Tool to find the next task to work on based on dependencies and status
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from './utils.js';
import { nextTaskDirect } from '../core/task-master-core.js';
import {
	resolveTasksPath,
	resolveComplexityReportPath
} from '../core/utils/path-utils.js';
import { resolveTag } from '../../../scripts/modules/utils.js';

/**
 * Register the nextTask tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerNextTaskTool(server) {
	server.addTool({
		name: 'next_task',
		description:
			'Find the next task to work on based on dependencies and status',
		parameters: z.object({
			file: z.string().optional().describe('Absolute path to the tasks file'),
			complexityReport: z
				.string()
				.optional()
				.describe(
					'Path to the complexity report file (relative to project root or absolute)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Finding next task with args: ${JSON.stringify(args)}`);
				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});

				// Resolve the path to tasks.json using new path utilities
				let tasksJsonPath;
				try {
					tasksJsonPath = resolveTasksPath(args, session);
				} catch (error) {
					log.error(`Error finding tasks.json: ${error.message}`);
					return createErrorResponse(
						`Failed to find tasks.json: ${error.message}`
					);
				}

				// Resolve the path to complexity report (optional)
				let complexityReportPath;
				try {
					complexityReportPath = resolveComplexityReportPath(
						{ ...args, tag: resolvedTag },
						session
					);
				} catch (error) {
					log.error(`Error finding complexity report: ${error.message}`);
					// This is optional, so we don't fail the operation
					complexityReportPath = null;
				}

				const result = await nextTaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						reportPath: complexityReportPath,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				log.info(`Next task result: ${result.success ? 'found' : 'none'}`);
				return handleApiResult(
					result,
					log,
					'Error finding next task',
					undefined,
					args.projectRoot
				);
			} catch (error) {
				log.error(`Error finding next task: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
