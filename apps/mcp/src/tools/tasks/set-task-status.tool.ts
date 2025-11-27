/**
 * @fileoverview set-task-status MCP tool
 * Set the status of one or more tasks or subtasks
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../../shared/utils.js';
import type { ToolContext } from '../../shared/types.js';
import { TASK_STATUSES, taskIdsSchema, parseTaskIds, type TaskStatus } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const SetTaskStatusSchema = z.object({
	id: taskIdsSchema.describe(
		"Task ID or subtask ID (e.g., '15', '15.2'). Can be comma-separated to update multiple tasks/subtasks at once."
	),
	status: z
		.enum(TASK_STATUSES as unknown as [string, ...string[]])
		.describe(
			"New status to set (e.g., 'pending', 'done', 'in-progress', 'review', 'deferred', 'cancelled')."
		),
	projectRoot: z
		.string()
		.describe('The directory of the project. Must be an absolute path.'),
	tag: z.string().optional().describe('Optional tag context to operate on')
});

type SetTaskStatusArgs = z.infer<typeof SetTaskStatusSchema>;

/**
 * Register the set_task_status tool with the MCP server
 */
export function registerSetTaskStatusTool(server: FastMCP) {
	server.addTool({
		name: 'set_task_status',
		description: 'Set the status of one or more tasks or subtasks.',
		parameters: SetTaskStatusSchema,
		execute: withToolContext(
			'set-task-status',
			async (args: SetTaskStatusArgs, { log, tmCore }: ToolContext) => {
				const { id, status, projectRoot, tag } = args;

				try {
					log.info(
						`Setting status of task(s) ${id} to: ${status}${tag ? ` in tag: ${tag}` : ' in current tag'}`
					);

					// Parse and validate task IDs (validation already done by schema, this handles splitting)
					const taskIds = parseTaskIds(id);

					const results: Array<{
						success: boolean;
						oldStatus: TaskStatus;
						newStatus: TaskStatus;
						taskId: string;
					}> = [];

					for (const taskId of taskIds) {
						const result = await tmCore.tasks.updateStatus(
							taskId,
							status as TaskStatus,
							tag
						);
						results.push(result);
						log.info(
							`Updated task ${taskId}: ${result.oldStatus} → ${result.newStatus}`
						);
					}

					log.info(
						`Successfully updated status for ${results.length} task(s) to "${status}"`
					);

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: `Successfully updated ${results.length} task(s) to "${status}"`,
								tasks: results
							}
						},
						log,
						projectRoot,
						tag
					});
				} catch (error: unknown) {
					const err =
						error instanceof Error ? error : new Error(String(error));
					log.error(`Error in set-task-status: ${err.message}`);
					if (err.stack) {
						log.debug(err.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to set task status: ${err.message}`
							}
						},
						log,
						projectRoot,
						tag
					});
				}
			}
		)
	});
}
