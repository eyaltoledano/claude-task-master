/**
 * @fileoverview autopilot-start MCP tool
 * Initialize and start a new TDD workflow for a task
 */

import { z } from 'zod';
import {
	handleApiResult,
	withNormalizedProjectRoot
} from '../../shared/utils.js';
import type { MCPContext } from '../../shared/types.js';
import { createTaskMasterCore } from '@tm/core';
import { WorkflowService } from '@tm/core';
import type { FastMCP } from 'fastmcp';

const StartWorkflowSchema = z.object({
	taskId: z
		.string()
		.describe('Task ID to start workflow for (e.g., "1", "2.3")'),
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

					// Load task data and get current tag
					const core = await createTaskMasterCore({
						projectPath: projectRoot
					});

					// Get current tag from ConfigManager
					const currentTag = core.getActiveTag();

					const taskResult = await core.getTaskWithSubtask(taskId);

					if (!taskResult || !taskResult.task) {
						await core.close();
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
						await core.close();
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
								nextAction: 'generate_test'
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
