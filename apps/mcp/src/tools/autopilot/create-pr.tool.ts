/**
 * @fileoverview autopilot-create-pr MCP tool
 * Create GitHub pull requests per execution cluster
 */

import { type ClusterCompletionEvent, ClusterPRIntegration } from '@tm/core';
import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

const DEFAULT_ACTIVITY_LOG_PATH = '.taskmaster/state/activity.jsonl';

const CreatePRSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory'),
	clusterId: z
		.string()
		.optional()
		.describe('Cluster ID (auto-generated if not provided)'),
	branchName: z
		.string()
		.optional()
		.describe('Branch name (uses workflow branch if not provided)'),
	baseBranch: z
		.string()
		.optional()
		.default('main')
		.describe('Base branch for PR (default: main)'),
	commits: z
		.array(z.string())
		.optional()
		.describe('Array of commit SHAs in this cluster'),
	dryRun: z
		.boolean()
		.optional()
		.default(false)
		.describe('Preview PR without creating it'),
	autoMerge: z
		.boolean()
		.optional()
		.default(false)
		.describe('Enable auto-merge for PR'),
	draft: z.boolean().optional().default(false).describe('Create PR as draft'),
	labels: z.array(z.string()).optional().describe('Labels to add to PR'),
	metadata: z
		.record(z.string(), z.unknown())
		.optional()
		.describe('Additional metadata for PR')
});

type CreatePRArgs = z.infer<typeof CreatePRSchema>;

/**
 * Register the autopilot_create_pr tool with the MCP server
 */
export function registerAutopilotCreatePRTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_create_pr',
		description:
			'Create a GitHub pull request for the current workflow cluster. Links PR to task and includes run metadata, test results, and commit history.',
		parameters: CreatePRSchema,
		annotations: {
			title: 'Create Pull Request',
			destructiveHint: true
		},
		execute: withToolContext(
			'autopilot-create-pr',
			async (args: CreatePRArgs, { log, tmCore }: ToolContext) => {
				const {
					projectRoot,
					clusterId,
					branchName,
					baseBranch,
					commits,
					dryRun,
					autoMerge,
					draft,
					labels,
					metadata
				} = args;

				try {
					log.info(
						`Creating PR for workflow in ${projectRoot}${dryRun ? ' (dry-run)' : ''}`
					);

					// Check if workflow exists
					if (!(await tmCore.workflow.hasWorkflow())) {
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

					// Resume workflow to get context
					await tmCore.workflow.resume();
					const workflowContext = tmCore.workflow.getContext();
					const status = tmCore.workflow.getStatus();

					// Verify workflow is in a state where PR can be created
					if (status.phase !== 'FINALIZE' && status.phase !== 'COMPLETE') {
						log.warn(
							`Workflow is in ${status.phase} phase, PRs are typically created in FINALIZE/COMPLETE`
						);
					}

					// Generate cluster ID if not provided
					const finalClusterId =
						clusterId || `cluster-${workflowContext.taskId}-${Date.now()}`;

					// Use workflow branch if not provided
					const finalBranchName =
						branchName || workflowContext.branchName || '';

					if (!finalBranchName) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'No branch name available. Workflow must have a branch to create PR.'
								}
							},
							log,
							projectRoot
						});
					}

					// Initialize PR integration
					const prIntegration = new ClusterPRIntegration({
						projectRoot,
						baseBranch,
						dryRun,
						autoMerge,
						draft,
						labels: labels || ['automated', 'taskmaster'],
						activityLogPath: DEFAULT_ACTIVITY_LOG_PATH
					});

					// Build cluster completion event
					const clusterEvent: ClusterCompletionEvent = {
						clusterId: finalClusterId,
						workflowContext,
						branchName: finalBranchName,
						commits: commits || [],
						metadata: metadata || {}
					};

					// Handle cluster completion and create PR
					const result =
						await prIntegration.handleClusterCompletion(clusterEvent);

					if (!result.success) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: result.error || 'Failed to create PR'
								}
							},
							log,
							projectRoot
						});
					}

					// Success response
					const response = {
						clusterId: finalClusterId,
						prUrl: result.prResult?.prUrl,
						prNumber: result.prResult?.prNumber,
						dryRun: result.prResult?.dryRun || false,
						branchName: finalBranchName,
						baseBranch,
						taskId: workflowContext.taskId,
						message: dryRun
							? 'PR preview generated (dry-run mode)'
							: 'Pull request created successfully'
					};

					log.info(
						dryRun
							? `PR preview generated for cluster ${finalClusterId}`
							: `PR created: ${result.prResult?.prUrl}`
					);

					return handleApiResult({
						result: { success: true, data: response },
						log,
						projectRoot
					});
				} catch (error: unknown) {
					const message =
						error instanceof Error ? error.message : String(error);
					log.error(`Failed to create PR: ${message}`);

					return handleApiResult({
						result: {
							success: false,
							error: {
								message: `PR creation failed: ${message}`
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
