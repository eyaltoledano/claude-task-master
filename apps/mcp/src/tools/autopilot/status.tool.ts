/**
 * @fileoverview autopilot-status MCP tool
 * Get comprehensive workflow status and progress information
 */

import { WorkflowService } from '@tm/core';
import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

const StatusSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory')
});

type StatusArgs = z.infer<typeof StatusSchema>;

/**
 * Register the autopilot_status tool with the MCP server
 */
export function registerAutopilotStatusTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_status',
		description:
			'Get comprehensive workflow status including current phase, progress, subtask details, and activity history.',
		parameters: StatusSchema,
		execute: withToolContext(
			'autopilot-status',
			async (args: StatusArgs, { log }: ToolContext) => {
				const { projectRoot } = args;

				try {
					log.info(`Getting workflow status for ${projectRoot}`);

					const workflowService = new WorkflowService(projectRoot);

					// Check if workflow exists
					if (!(await workflowService.hasWorkflow())) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'No active workflow found. Start a workflow with autopilot_start'
								}
							},
							log,
							projectRoot
						});
					}

					// Resume to load state
					await workflowService.resumeWorkflow();

					// Get status
					const status = workflowService.getStatus();

					log.info(`Workflow status retrieved for task ${status.taskId}`);

					return handleApiResult({
						result: {
							success: true,
							data: status
						},
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in autopilot-status: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to get workflow status: ${error.message}`
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
