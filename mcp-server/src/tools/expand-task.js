/**
 * tools/expand-task.js
 * Tool to expand a task into subtasks
 */

import {
	createErrorResponse,
	handleApiResult,
	withNormalizedProjectRoot
} from '@tm/mcp';
import { z } from 'zod';
import { resolveTag } from '../../../scripts/modules/utils.js';
import { expandTaskDirect } from '../core/task-master-core.js';
import {
	findComplexityReportPath,
	findTasksPath
} from '../core/utils/path-utils.js';

/**
 * Register the expand-task tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerExpandTaskTool(server) {
	server.addTool({
		name: 'expand_task',
		description: 'Expand a task into subtasks for detailed implementation',
		parameters: z.object({
			id: z.string().describe('ID of task to expand'),
			num: z.string().optional().describe('Number of subtasks to generate'),
			research: z
				.boolean()
				.optional()
				.default(false)
				.describe('Use research role for generation'),
			prompt: z
				.string()
				.optional()
				.describe('Additional context for subtask generation'),
			file: z
				.string()
				.optional()
				.describe(
					'Path to the tasks file relative to project root (e.g., tasks/tasks.json)'
				),
			projectRoot: z
				.string()
				.describe('The directory of the project. Must be an absolute path.'),
			force: z
				.boolean()
				.optional()
				.default(false)
				.describe('Force expansion even if subtasks exist'),
			tag: z.string().optional().describe('Tag context to operate on')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				log.info(`Starting expand-task with args: ${JSON.stringify(args)}`);
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

				const complexityReportPath = findComplexityReportPath(
					{ ...args, tag: resolvedTag },
					log
				);

				const result = await expandTaskDirect(
					{
						tasksJsonPath: tasksJsonPath,
						id: args.id,
						num: args.num,
						research: args.research,
						prompt: args.prompt,
						force: args.force,
						complexityReportPath,
						projectRoot: args.projectRoot,
						tag: resolvedTag
					},
					log,
					{ session }
				);

				return handleApiResult({
					result,
					log: log,
					errorPrefix: 'Error expanding task',
					projectRoot: args.projectRoot
				});
			} catch (error) {
				log.error(`Error in expand-task tool: ${error.message}`);
				return createErrorResponse(error.message);
			}
		})
	});
}
