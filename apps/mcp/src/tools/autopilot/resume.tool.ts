/**
 * @fileoverview autopilot-resume MCP tool
 * Resume a previously started TDD workflow from saved state
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

const ResumeWorkflowSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory')
});

type ResumeWorkflowArgs = z.infer<typeof ResumeWorkflowSchema>;

/**
 * Register the autopilot_resume tool with the MCP server
 */
export function registerAutopilotResumeTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_resume',
		description:
			'Resume a previously started TDD workflow from saved state. Restores the workflow state machine and continues from where it left off.',
		parameters: ResumeWorkflowSchema,
		execute: withNormalizedProjectRoot(
			async (args: ResumeWorkflowArgs, context: MCPContext) => {
				const { projectRoot } = args;

				try {
					context.log.info(`Resuming autopilot workflow in ${projectRoot}`);

					const workflowService = new WorkflowService(projectRoot);

					// Check if workflow exists
					if (!(await workflowService.hasWorkflow())) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'No workflow state found. Start a new workflow with autopilot_start'
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Resume workflow
					const status = await workflowService.resumeWorkflow();
					const nextAction = workflowService.getNextAction();

					context.log.info(
						`Workflow resumed successfully for task ${status.taskId}`
					);

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: 'Workflow resumed',
								...status,
								nextAction: nextAction.action,
								actionDescription: nextAction.description,
								nextSteps: nextAction.nextSteps
							}
						},
						log: context.log,
						projectRoot
					});
				} catch (error: any) {
					context.log.error(`Error in autopilot-resume: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to resume workflow: ${error.message}` }
						},
						log: context.log,
						projectRoot
					});
				}
			}
		)
	});
}
