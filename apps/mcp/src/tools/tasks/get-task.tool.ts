/**
 * @fileoverview get-task MCP tool
 * Get detailed information about a specific task by ID
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	withNormalizedProjectRoot
} from '../../shared/utils.js';
import type { MCPContext } from '../../shared/types.js';
import { createTmCore, Subtask, type Task } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const GetTaskSchema = z.object({
	id: z
		.string()
		.describe(
			'Task ID(s) to get (can be comma-separated for multiple tasks)'
		),
	status: z
		.string()
		.optional()
		.describe("Filter subtasks by status (e.g., 'pending', 'done')"),
	projectRoot: z
		.string()
		.describe(
			'Absolute path to the project root directory (Optional, usually from session)'
		),
	tag: z.string().optional().describe('Tag context to operate on')
});

type GetTaskArgs = z.infer<typeof GetTaskSchema>;

/**
 * Register the get_task tool with the MCP server
 */
export function registerGetTaskTool(server: FastMCP) {
	server.addTool({
		name: 'get_task',
		description: 'Get detailed information about a specific task',
		parameters: GetTaskSchema,
		execute: withNormalizedProjectRoot(
			async (args: GetTaskArgs, context: MCPContext) => {
				const { id, status, projectRoot, tag } = args;

				try {
					context.log.info(
						`Getting task details for ID: ${id}${status ? ` (filtering subtasks by status: ${status})` : ''} in root: ${projectRoot}`
					);

					// Create tm-core with logging callback
					const tmCore = await createTmCore({
						projectPath: projectRoot,
						loggerConfig: {
							mcpMode: true,
							logCallback: context.log
						}
					});

					// Handle comma-separated IDs - parallelize for better performance
					const taskIds = id.split(',').map((tid) => tid.trim());
					const results = await Promise.all(
						taskIds.map((taskId) => tmCore.tasks.get(taskId, tag))
					);

					const tasks: (Task | Subtask)[] = [];
					for (const result of results) {
						if (!result.task) continue;

						// If status filter is provided, filter subtasks (create copy to avoid mutation)
						if (status && result.task.subtasks) {
							const statusFilters = status
								.split(',')
								.map((s) => s.trim().toLowerCase());
							const filteredSubtasks = result.task.subtasks.filter((st) =>
								statusFilters.includes(String(st.status).toLowerCase())
							);
							tasks.push({ ...result.task, subtasks: filteredSubtasks });
						} else {
							tasks.push(result.task);
						}
					}

					if (tasks.length === 0) {
						context.log.warn(`No tasks found for ID(s): ${id}`);
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: `No tasks found for ID(s): ${id}`
								}
							},
							log: context.log,
							projectRoot
						});
					}

					context.log.info(
						`Successfully retrieved ${tasks.length} task(s) for ID(s): ${id}`
					);

					// Return single task if only one ID was requested, otherwise array
					const responseData = taskIds.length === 1 ? tasks[0] : tasks;

					return handleApiResult({
						result: {
							success: true,
							data: responseData
						},
						log: context.log,
						projectRoot,
						tag
					});
				} catch (error: any) {
					context.log.error(`Error in get-task: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to get task: ${error.message}`
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
