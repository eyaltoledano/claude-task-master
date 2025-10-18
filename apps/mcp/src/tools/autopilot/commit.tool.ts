/**
 * @fileoverview autopilot-commit MCP tool
 * Create a git commit with automatic staging and message generation
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	withNormalizedProjectRoot
} from '../../shared/utils.js';
import type { MCPContext } from '../../shared/types.js';
import { WorkflowService, GitAdapter, CommitMessageGenerator } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const CommitSchema = z.object({
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory'),
	files: z
		.array(z.string())
		.optional()
		.describe(
			'Specific files to stage (relative to project root). If not provided, stages all changes.'
		),
	customMessage: z
		.string()
		.optional()
		.describe('Custom commit message to use instead of auto-generated message')
});

type CommitArgs = z.infer<typeof CommitSchema>;

/**
 * Register the autopilot_commit tool with the MCP server
 */
export function registerAutopilotCommitTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_commit',
		description:
			'Create a git commit with automatic staging, message generation, and metadata embedding. Generates appropriate commit messages based on subtask context and TDD phase.',
		parameters: CommitSchema,
		execute: withNormalizedProjectRoot(
			async (args: CommitArgs, context: MCPContext) => {
				const { projectRoot, files, customMessage } = args;

				try {
					context.log.info(`Creating commit for workflow in ${projectRoot}`);

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

					// Resume workflow
					await workflowService.resumeWorkflow();
					const status = workflowService.getStatus();
					const workflowContext = workflowService.getContext();

					// Verify we're in COMMIT phase
					if (status.tddPhase !== 'COMMIT') {
						context.log.warn(
							`Not in COMMIT phase (currently in ${status.tddPhase})`
						);
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: `Cannot commit: currently in ${status.tddPhase} phase. Complete the ${status.tddPhase} phase first using autopilot_complete_phase`
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Verify there's an active subtask
					if (!status.currentSubtask) {
						return handleApiResult({
							result: {
								success: false,
								error: { message: 'No active subtask to commit' }
							},
							log: context.log,
							projectRoot
						});
					}

					// Initialize git adapter
					const gitAdapter = new GitAdapter(projectRoot);

					// Stage files
					try {
						if (files && files.length > 0) {
							await gitAdapter.stageFiles(files);
							context.log.info(`Staged ${files.length} files`);
						} else {
							await gitAdapter.stageFiles(['.']);
							context.log.info('Staged all changes');
						}
					} catch (error: any) {
						context.log.error(`Failed to stage files: ${error.message}`);
						return handleApiResult({
							result: {
								success: false,
								error: { message: `Failed to stage files: ${error.message}` }
							},
							log: context.log,
							projectRoot
						});
					}

					// Check if there are staged changes
					const hasStagedChanges = await gitAdapter.hasStagedChanges();
					if (!hasStagedChanges) {
						context.log.warn('No staged changes to commit');
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'No staged changes to commit. Make code changes before committing'
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Get git status for message generation
					const gitStatus = await gitAdapter.getStatus();

					// Generate commit message
					let commitMessage: string;
					if (customMessage) {
						commitMessage = customMessage;
						context.log.info('Using custom commit message');
					} else {
						const messageGenerator = new CommitMessageGenerator();

						// Determine commit type based on phase and subtask
						// RED phase = test files, GREEN phase = implementation
						const type = status.tddPhase === 'COMMIT' ? 'feat' : 'test';

						// Use subtask title as description
						const description = status.currentSubtask.title;

						// Construct proper CommitMessageOptions
						const options = {
							type,
							description,
							changedFiles: gitStatus.staged,
							taskId: status.taskId,
							phase: status.tddPhase,
							testsPassing: workflowContext.lastTestResults?.passed,
							testsFailing: workflowContext.lastTestResults?.failed
						};

						commitMessage = messageGenerator.generateMessage(options);
						context.log.info('Generated commit message automatically');
					}

					// Create commit
					try {
						await gitAdapter.createCommit(commitMessage);
						context.log.info('Commit created successfully');
					} catch (error: any) {
						context.log.error(`Failed to create commit: ${error.message}`);
						return handleApiResult({
							result: {
								success: false,
								error: { message: `Failed to create commit: ${error.message}` }
							},
							log: context.log,
							projectRoot
						});
					}

					// Get last commit info
					const lastCommit = await gitAdapter.getLastCommit();

					// Complete COMMIT phase and advance workflow
					const newStatus = await workflowService.commit();

					context.log.info(
						`Commit completed. Current phase: ${newStatus.tddPhase || newStatus.phase}`
					);

					const isComplete = newStatus.phase === 'COMPLETE';

					// Get next action with guidance
					const nextAction = workflowService.getNextAction();

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: isComplete
									? 'Workflow completed successfully'
									: 'Commit created and workflow advanced',
								commitSha: lastCommit.sha,
								commitMessage,
								...newStatus,
								isComplete,
								nextAction: nextAction.action,
								nextSteps: nextAction.nextSteps
							}
						},
						log: context.log,
						projectRoot
					});
				} catch (error: any) {
					context.log.error(`Error in autopilot-commit: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to commit: ${error.message}` }
						},
						log: context.log,
						projectRoot
					});
				}
			}
		)
	});
}
