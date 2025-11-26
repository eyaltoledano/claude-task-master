/**
 * @fileoverview set-task-status MCP tool
 * Set the status of one or more tasks or subtasks
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../../shared/utils.js';
import type { ToolContext } from '../../shared/types.js';
import { TASK_STATUSES, type TaskStatus } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const SetTaskStatusSchema = z.object({
	id: z
		.string()
		.describe(
			"Task ID or subtask ID (e.g., '15', '15.2'). Can be comma-separated to update multiple tasks/subtasks at once."
		),
	status: z
		.enum(TASK_STATUSES as unknown as [string, ...string[]])
		.describe(
			"New status to set (e.g., 'pending', 'done', 'in-progress', 'review', 'deferred', 'cancelled'."
		),
	projectRoot: z
		.string()
		.describe('The directory of the project. Must be an absolute path.'),
	tag: z.string().optional().describe('Optional tag context to operate on'),
	file: z.string().optional().describe('Absolute path to the tasks file'),
	complexityReport: z
		.string()
		.optional()
		.describe(
			'Path to the complexity report file (relative to project root or absolute)'
		)
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

					// Handle comma-separated IDs
					const taskIds = id.split(',').map((tid) => tid.trim());
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
				} catch (error: any) {
					log.error(`Error in set-task-status: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to set task status: ${error.message}`
							}
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
