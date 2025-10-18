/**
 * @fileoverview autopilot-status MCP tool
 * Get comprehensive workflow status and progress information
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	withNormalizedProjectRoot
} from '../../shared/utils.js';
import type { MCPContext } from '../../shared/types.js';
import { WorkflowService } from '@tm/core';
import type { FastMCP } from 'fastmcp';

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
		execute: withNormalizedProjectRoot(
			async (args: StatusArgs, context: MCPContext) => {
				const { projectRoot } = args;

				try {
					context.log.info(`Getting workflow status for ${projectRoot}`);

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
							log: context.log,
							projectRoot
						});
					}

					// Resume to load state
					await workflowService.resumeWorkflow();

					// Get status
					const status = workflowService.getStatus();

					context.log.info(
						`Workflow status retrieved for task ${status.taskId}`
					);

					return handleApiResult({
						result: {
							success: true,
							data: status
						},
						log: context.log,
						projectRoot
					});
				} catch (error: any) {
					context.log.error(`Error in autopilot-status: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to get workflow status: ${error.message}`
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
