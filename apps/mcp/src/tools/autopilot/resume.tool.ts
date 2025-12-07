/**
 * @fileoverview autopilot-resume MCP tool
 * Resume a previously started TDD workflow from saved state
 */

import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

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
		execute: withToolContext(
			'autopilot-resume',
			async (args: ResumeWorkflowArgs, { log, tmCore }: ToolContext) => {
				const { projectRoot } = args;

				try {
					log.info(`Resuming autopilot workflow in ${projectRoot}`);

					// Check if workflow exists
					if (!(await tmCore.workflow.hasWorkflow())) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'No workflow state found. Start a new workflow with autopilot_start'
								}
							},
							log,
							projectRoot
						});
					}

					// Resume workflow
					const status = await tmCore.workflow.resume();
					const nextAction = tmCore.workflow.getNextAction();

					log.info(`Workflow resumed successfully for task ${status.taskId}`);

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
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in autopilot-resume: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to resume workflow: ${error.message}` }
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
