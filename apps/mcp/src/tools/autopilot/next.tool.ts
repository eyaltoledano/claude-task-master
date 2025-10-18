/**
 * @fileoverview autopilot-next MCP tool
 * Get the next action to perform in the TDD workflow
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

const NextActionSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory')
});

type NextActionArgs = z.infer<typeof NextActionSchema>;

/**
 * Register the autopilot_next tool with the MCP server
 */
export function registerAutopilotNextTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_next',
		description:
			'Get the next action to perform in the TDD workflow. Returns detailed context about what needs to be done next, including the current phase, subtask, and expected actions.',
		parameters: NextActionSchema,
		execute: withNormalizedProjectRoot(
			async (args: NextActionArgs, context: MCPContext) => {
				const { projectRoot } = args;

				try {
					context.log.info(
						`Getting next action for workflow in ${projectRoot}`
					);

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

					// Get next action
					const nextAction = workflowService.getNextAction();
					const status = workflowService.getStatus();

					context.log.info(`Next action determined: ${nextAction.action}`);

					return handleApiResult({
						result: {
							success: true,
							data: {
								action: nextAction.action,
								actionDescription: nextAction.description,
								...status,
								nextSteps: nextAction.nextSteps
							}
						},
						log: context.log,
						projectRoot
					});
				} catch (error: any) {
					context.log.error(`Error in autopilot-next: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to get next action: ${error.message}`
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
