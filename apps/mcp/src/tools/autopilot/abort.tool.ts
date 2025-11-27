/**
 * @fileoverview autopilot-abort MCP tool
 * Abort a running TDD workflow and clean up state
 */

import { WorkflowService } from '@tm/core';
import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

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
		execute: withToolContext(
			'autopilot-abort',
			async (args: AbortArgs, { log }: ToolContext) => {
				const { projectRoot } = args;

				try {
					log.info(`Aborting autopilot workflow in ${projectRoot}`);

					const workflowService = new WorkflowService(projectRoot);

					// Check if workflow exists
					const hasWorkflow = await workflowService.hasWorkflow();

					if (!hasWorkflow) {
						log.warn('No active workflow to abort');
						return handleApiResult({
							result: {
								success: true,
								data: {
									message: 'No active workflow to abort',
									hadWorkflow: false
								}
							},
							log,
							projectRoot
						});
					}

					// Get info before aborting
					await workflowService.resumeWorkflow();
					const status = workflowService.getStatus();

					// Abort workflow
					await workflowService.abortWorkflow();

					log.info('Workflow state deleted');

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
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in autopilot-abort: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to abort workflow: ${error.message}` }
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
