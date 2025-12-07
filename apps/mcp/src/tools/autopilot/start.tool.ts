/**
 * @fileoverview autopilot-start MCP tool
 * Initialize and start a new TDD workflow for a task
 */

import { MainTaskIdSchemaForMcp, normalizeDisplayId } from '@tm/core';
import type { FastMCP } from 'fastmcp';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types.js';
import { handleApiResult, withToolContext } from '../../shared/utils.js';

const StartWorkflowSchema = z.object({
	taskId: MainTaskIdSchemaForMcp.describe(
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
 * Register the autopilot_start tool with the MCP server
 */
export function registerAutopilotStartTool(server: FastMCP) {
	server.addTool({
		name: 'autopilot_start',
		description:
			'Initialize and start a new TDD workflow for a task. Creates a git branch and sets up the workflow state machine.',
		parameters: StartWorkflowSchema,
		execute: withToolContext(
			'autopilot-start',
			async (args: StartWorkflowArgs, { log, tmCore }: ToolContext) => {
				const { taskId: rawTaskId, projectRoot, maxAttempts, force } = args;
				// Normalize task ID (e.g., "ham1" → "HAM-1")
				const taskId = normalizeDisplayId(rawTaskId);

				try {
					log.info(
						`Starting autopilot workflow for task ${taskId} in ${projectRoot}`
					);

					// Get current tag from ConfigManager
					const currentTag = tmCore.config.getActiveTag();

					// Get org slug from auth context (for API storage mode)
					const authContext = tmCore.auth.getContext();
					const orgSlug = authContext?.orgSlug;

					const taskResult = await tmCore.tasks.get(taskId);

					if (!taskResult || !taskResult.task) {
						return handleApiResult({
							result: {
								success: false,
								error: { message: `Task ${taskId} not found` }
							},
							log,
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
							log,
							projectRoot
						});
					}

					// Check for existing workflow
					const hasWorkflow = await tmCore.workflow.hasWorkflow();
					if (hasWorkflow && !force) {
						log.warn('Workflow state already exists');
						return handleApiResult({
							result: {
								success: false,
								error: {
									message:
										'Workflow already in progress. Use force=true to override or resume the existing workflow. Suggestion: Use autopilot_resume to continue the existing workflow'
								}
							},
							log,
							projectRoot
						});
					}

					// Start workflow via tmCore facade (handles status updates internally)
					const status = await tmCore.workflow.start({
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
						tag: currentTag, // Pass current tag for branch naming (local storage)
						orgSlug // Pass org slug for branch naming (API storage, takes precedence)
					});

					log.info(`Workflow started successfully for task ${taskId}`);

					// Get next action with guidance
					const nextAction = tmCore.workflow.getNextAction();

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
						log,
						projectRoot
					});
				} catch (error: any) {
					log.error(`Error in autopilot-start: ${error.message}`);
					if (error.stack) {
						log.debug(error.stack);
					}
					return handleApiResult({
						result: {
							success: false,
							error: { message: `Failed to start workflow: ${error.message}` }
						},
						log,
						projectRoot
					});
				}
			}
		)
	});
}
