/**
 * @fileoverview autopilot-abort MCP tool
 * Abort a running TDD workflow and clean up state
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

const AbortSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory')
});

type AbortArgs = z.infer<typeof AbortSchema>;

/**
 * Register the autopilot_abort tool with the MCP server
 */
export function registerAutopilotAbortTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_abort',
		description:
			'Abort the current TDD workflow and clean up workflow state. This will remove the workflow state file but will NOT delete the git branch or any code changes.',
		parameters: AbortSchema,
		execute: withNormalizedProjectRoot(
			async (args: AbortArgs, context: MCPContext) => {
				const { projectRoot } = args;

				try {
					context.log.info(`Aborting autopilot workflow in ${projectRoot}`);

					const workflowService = new WorkflowService(projectRoot);

					// Check if workflow exists
					const hasWorkflow = await workflowService.hasWorkflow();

					if (!hasWorkflow) {
						context.log.warn('No active workflow to abort');
						return handleApiResult({
							result: {
								success: true,
								data: {
									message: 'No active workflow to abort',
									hadWorkflow: false
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Get info before aborting
					await workflowService.resumeWorkflow();
					const status = workflowService.getStatus();

					// Abort workflow
					await workflowService.abortWorkflow();

					context.log.info('Workflow state deleted');

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: 'Workflow aborted',
								hadWorkflow: true,
								taskId: status.taskId,
								branchName: status.branchName,
								note: 'Git branch and code changes were preserved. You can manually clean them up if needed.'
							}
						},
						log: context.log,
						projectRoot
					});
				} catch (error: any) {
					context.log.error(`Error in autopilot-abort: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to abort workflow: ${error.message}` }
						},
						log: context.log,
						projectRoot
					});
				}
			}
		)
	});
}
