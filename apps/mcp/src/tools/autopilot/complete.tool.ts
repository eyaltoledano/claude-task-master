/**
 * @fileoverview autopilot-complete MCP tool
 * Complete the current TDD phase with test result validation
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

const CompletePhaseSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory'),
	testResults: z
		.object({
			total: z.number().describe('Total number of tests'),
			passed: z.number().describe('Number of passing tests'),
			failed: z.number().describe('Number of failing tests'),
			skipped: z.number().optional().describe('Number of skipped tests')
		})
		.describe('Test results from running the test suite')
});

type CompletePhaseArgs = z.infer<typeof CompletePhaseSchema>;

/**
 * Register the autopilot_complete_phase tool with the MCP server
 */
export function registerAutopilotCompleteTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_complete_phase',
		description:
			'Complete the current TDD phase (RED, GREEN, or COMMIT) with test result validation. RED phase: expects failures (if 0 failures, feature is already implemented and subtask auto-completes). GREEN phase: expects all tests passing.',
		parameters: CompletePhaseSchema,
		execute: withNormalizedProjectRoot(
			async (args: CompletePhaseArgs, context: MCPContext) => {
				const { projectRoot, testResults } = args;

				try {
					context.log.info(
						`Completing current phase in workflow for ${projectRoot}`
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

					// Resume workflow to get current state
					await workflowService.resumeWorkflow();
					const currentStatus = workflowService.getStatus();

					// Validate that we're in a TDD phase (RED or GREEN)
					if (!currentStatus.tddPhase) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: `Cannot complete phase: not in a TDD phase (current phase: ${currentStatus.phase})`
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// COMMIT phase completion is handled by autopilot_commit tool
					if (currentStatus.tddPhase === 'COMMIT') {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'Cannot complete COMMIT phase with this tool. Use autopilot_commit instead'
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Map TDD phase to TestResult phase (only RED or GREEN allowed)
					const phase = currentStatus.tddPhase as 'RED' | 'GREEN';

					// Construct full TestResult with phase
					const fullTestResults = {
						total: testResults.total,
						passed: testResults.passed,
						failed: testResults.failed,
						skipped: testResults.skipped ?? 0,
						phase
					};

					// Complete phase with test results
					const status = await workflowService.completePhase(fullTestResults);
					const nextAction = workflowService.getNextAction();

					context.log.info(
						`Phase completed. New phase: ${status.tddPhase || status.phase}`
					);

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: `Phase completed. Transitioned to ${status.tddPhase || status.phase}`,
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
					context.log.error(`Error in autopilot-complete: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `Failed to complete phase: ${error.message}`
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
