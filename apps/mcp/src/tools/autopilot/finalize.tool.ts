/**
 * @fileoverview autopilot-finalize MCP tool
 * Finalize and complete the workflow with working tree validation
 */

import { WorkflowService } from '@tm/core';
import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

const FinalizeSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory')
});

type FinalizeArgs = z.infer<typeof FinalizeSchema>;

/**
 * Register the autopilot_finalize tool with the MCP server
 */
export function registerAutopilotFinalizeTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_finalize',
		description:
			'Finalize and complete the workflow. Validates that all changes are committed and working tree is clean before marking workflow as complete.',
		parameters: FinalizeSchema,
		execute: withToolContext(
			'autopilot-finalize',
			async (args: FinalizeArgs, { log }: ToolContext) => {
				const { projectRoot } = args;

				try {
					log.info(`Finalizing workflow in ${projectRoot}`);

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

					// Resume workflow
					await workflowService.resumeWorkflow();
					const currentStatus = workflowService.getStatus();

					// Verify we're in FINALIZE phase
					if (currentStatus.phase !== 'FINALIZE') {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: `Cannot finalize: workflow is in ${currentStatus.phase} phase. Complete all subtasks first.`
								}
							},
							log,
							projectRoot
						});
					}

					// Finalize workflow (validates clean working tree)
					const newStatus = await workflowService.finalizeWorkflow();

					log.info('Workflow finalized successfully');

					// Get next action
					const nextAction = workflowService.getNextAction();

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: 'Workflow completed successfully',
								...newStatus,
								nextAction: nextAction.action,
								nextSteps: nextAction.nextSteps
							}
						},
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in autopilot-finalize: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to finalize workflow: ${error.message}`
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
