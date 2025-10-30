/**
 * @fileoverview get-tasks MCP tool
 * Get all tasks from Task Master with optional filtering
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	withNormalizedProjectRoot
} from '../../shared/utils.js';
import type { MCPContext } from '../../shared/types.js';
import { createTmCore, type TaskStatus, type Task } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const GetTasksSchema = z.object({
	projectRoot: z
		.string()
		.describe('The directory of the project. Must be an absolute path.'),
	status: z
		.string()
		.optional()
		.describe(
			"Filter tasks by status (e.g., 'pending', 'done') or multiple statuses separated by commas (e.g., 'blocked,deferred')"
		),
	withSubtasks: z
		.boolean()
		.optional()
		.describe('Include subtasks nested within their parent tasks in the response'),
	tag: z.string().optional().describe('Tag context to operate on')
});

type GetTasksArgs = z.infer<typeof GetTasksSchema>;

/**
 * Register the get_tasks tool with the MCP server
 */
export function registerGetTasksTool(server: FastMCP) {
	server.addTool({
		name: 'get_tasks',
		description:
			'Get all tasks from Task Master, optionally filtering by status and including subtasks.',
		parameters: GetTasksSchema,
		execute: withNormalizedProjectRoot(
			async (args: GetTasksArgs, context: MCPContext) => {
				const { projectRoot, status, withSubtasks, tag } = args;

				try {
					context.log.info(
						`Getting tasks from ${projectRoot}${status ? ` with status filter: ${status}` : ''}${tag ? ` for tag: ${tag}` : ''}`
					);

					// Create tm-core with logging callback
					const tmCore = await createTmCore({
						projectPath: projectRoot,
						loggerConfig: {
							mcpMode: true,
							logCallback: context.log
						}
					});

					// Build filter
					const filter =
						status && status !== 'all'
							? {
									status: status
										.split(',')
										.map((s: string) => s.trim() as TaskStatus)
								}
							: undefined;

					// Call tm-core tasks.list()
					const result = await tmCore.tasks.list({
						tag,
						filter,
						includeSubtasks: withSubtasks
					});

					context.log.info(
						`Retrieved ${result.tasks?.length || 0} tasks (${result.filtered} filtered, ${result.total} total)`
					);

					// Calculate stats using reduce for cleaner code
					const totalTasks = result.total;
					const taskCounts = result.tasks.reduce(
						(acc, task) => {
							acc[task.status] = (acc[task.status] || 0) + 1;
							return acc;
						},
						{} as Record<string, number>
					);

					const completionPercentage =
						totalTasks > 0 ? ((taskCounts.done || 0) / totalTasks) * 100 : 0;

					// Count subtasks using reduce
					const subtaskCounts = result.tasks.reduce(
						(acc, task) => {
							task.subtasks?.forEach((st) => {
								acc.total++;
								acc[st.status] = (acc[st.status] || 0) + 1;
							});
							return acc;
						},
						{ total: 0 } as Record<string, number>
					);

					const subtaskCompletionPercentage =
						subtaskCounts.total > 0
							? ((subtaskCounts.done || 0) / subtaskCounts.total) * 100
							: 0;

					return handleApiResult({
						result: {
							success: true,
							data: {
								tasks: result.tasks as Task[],
								filter: status || 'all',
								stats: {
									total: totalTasks,
									completed: taskCounts.done || 0,
									inProgress: taskCounts['in-progress'] || 0,
									pending: taskCounts.pending || 0,
									blocked: taskCounts.blocked || 0,
									deferred: taskCounts.deferred || 0,
									cancelled: taskCounts.cancelled || 0,
									review: taskCounts.review || 0,
									completionPercentage,
									subtasks: {
										total: subtaskCounts.total,
										completed: subtaskCounts.done || 0,
										inProgress: subtaskCounts['in-progress'] || 0,
										pending: subtaskCounts.pending || 0,
										blocked: subtaskCounts.blocked || 0,
										deferred: subtaskCounts.deferred || 0,
										cancelled: subtaskCounts.cancelled || 0,
										completionPercentage: subtaskCompletionPercentage
									}
								}
							}
						},
						log: context.log,
						projectRoot,
						tag: result.tag
					});
				} catch (error: any) {
					context.log.error(`Error in get-tasks: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to get tasks: ${error.message}`
							}
						},
						log: context.log,
						projectRoot
					});
				}
			}
		)
	});
}
