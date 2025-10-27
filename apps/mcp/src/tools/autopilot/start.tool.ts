/**
 * @fileoverview autopilot-start MCP tool
 * Initialize and start a new TDD workflow for a task
 */

// TEMPORARY: Using zod/v3 for Draft-07 JSON Schema compatibility with FastMCP's zod-to-json-schema
// TODO: Revert to 'zod' when MCP spec issue is resolved (see PR #1323)
import { z } from 'zod/v3';
import {
	handleApiResult,
	withNormalizedProjectRoot
} from '../../shared/utils.js';
import type { MCPContext } from '../../shared/types.js';
import { createTmCore } from '@tm/core';
import { WorkflowService } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const StartWorkflowSchema = z.object({
	taskId: z
		.string()
		.describe(
			'Main task ID to start workflow for (e.g., "1", "2", "HAM-123"). Subtask IDs (e.g., "2.3", "1.1") are not allowed.'
		),
	projectRoot: z
		.string()
		.describe('Absolute path to the project root directory'),
	maxAttempts: z
		.number()
		.optional()
		.default(3)
		.describe('Maximum attempts per subtask (default: 3)'),
	force: z
		.boolean()
		.optional()
		.default(false)
		.describe('Force start even if workflow state exists')
});

type StartWorkflowArgs = z.infer<typeof StartWorkflowSchema>;

/**
 * Check if a task ID is a main task (not a subtask)
 * Main tasks: "1", "2", "HAM-123", "PROJ-456"
 * Subtasks: "1.1", "2.3", "HAM-123.1"
 */
function isMainTaskId(taskId: string): boolean {
	// A main task has no dots in the ID after the optional prefix
	// Examples: "1" ✓, "HAM-123" ✓, "1.1" ✗, "HAM-123.1" ✗
	const parts = taskId.split('.');
	return parts.length === 1;
}

/**
 * Register the autopilot_start tool with the MCP server
 */
export function registerAutopilotStartTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_start',
		description:
			'Initialize and start a new TDD workflow for a task. Creates a git branch and sets up the workflow state machine.',
		parameters: StartWorkflowSchema,
		execute: withNormalizedProjectRoot(
			async (args: StartWorkflowArgs, context: MCPContext) => {
				const { taskId, projectRoot, maxAttempts, force } = args;

				try {
					context.log.info(
						`Starting autopilot workflow for task ${taskId} in ${projectRoot}`
					);

					// Validate that taskId is a main task (not a subtask)
					if (!isMainTaskId(taskId)) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: `Task ID "${taskId}" is a subtask. Autopilot workflows can only be started for main tasks (e.g., "1", "2", "HAM-123"). Please provide the parent task ID instead.`
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Load task data and get current tag
					const core = await createTmCore({
						projectPath: projectRoot
					});

					// Get current tag from ConfigManager
					const currentTag = core.config.getActiveTag();

					const taskResult = await core.tasks.get(taskId);

					if (!taskResult || !taskResult.task) {
						return handleApiResult({
							result: {
								success: false,
								error: { message: `Task ${taskId} not found` }
							},
							log: context.log,
							projectRoot
						});
					}

					const task = taskResult.task;

					// Validate task has subtasks
					if (!task.subtasks || task.subtasks.length === 0) {
						return handleApiResult({
							result: {
								success: false,
								error: {
									message: `Task ${taskId} has no subtasks. Please use expand_task (with id="${taskId}") to create subtasks first. For improved results, consider running analyze_complexity before expanding the task.`
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Initialize workflow service
					const workflowService = new WorkflowService(projectRoot);

					// Check for existing workflow
					const hasWorkflow = await workflowService.hasWorkflow();
					if (hasWorkflow && !force) {
						context.log.warn('Workflow state already exists');
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'Workflow already in progress. Use force=true to override or resume the existing workflow. Suggestion: Use autopilot_resume to continue the existing workflow'
								}
							},
							log: context.log,
							projectRoot
						});
					}

					// Start workflow
					const status = await workflowService.startWorkflow({
						taskId,
						taskTitle: task.title,
						subtasks: task.subtasks.map((st: any) => ({
							id: st.id,
							title: st.title,
							status: st.status,
							maxAttempts
						})),
						maxAttempts,
						force,
						tag: currentTag // Pass current tag for branch naming
					});

					context.log.info(`Workflow started successfully for task ${taskId}`);

					// Get next action with guidance from WorkflowService
					const nextAction = workflowService.getNextAction();

					return handleApiResult({
						result: {
							success: true,
							data: {
								message: `Workflow started for task ${taskId}`,
								taskId,
								branchName: status.branchName,
								phase: status.phase,
								tddPhase: status.tddPhase,
								progress: status.progress,
								currentSubtask: status.currentSubtask,
								nextAction: nextAction.action,
								nextSteps: nextAction.nextSteps
							}
						},
						log: context.log,
						projectRoot
					});
				} catch (error: any) {
					context.log.error(`Error in autopilot-start: ${error.message}`);
					if (error.stack) {
						context.log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to start workflow: ${error.message}` }
						},
						log: context.log,
						projectRoot
					});
				}
			}
		)
	});
}
