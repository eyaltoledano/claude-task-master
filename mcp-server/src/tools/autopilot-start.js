/**
 * tools/autopilot-start.js
 * Tool to start a new TDD workflow for a task
 */

import { z } from 'zod';
import {
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { createTaskMasterCore } from '@tm/core';
import {
	WorkflowOrchestrator,
	GitAdapter,
	CommitMessageGenerator
} from '@tm/core';
import { resolveTag } from '../../../scripts/modules/utils.js';
import fs from 'fs-extra';
import path from 'path';

const STATE_FILE = '.taskmaster/workflow-state.json';

/**
 * Save workflow state to disk
 */
async function saveWorkflowState(projectRoot, state) {
	const statePath = path.join(projectRoot, STATE_FILE);
	await fs.ensureDir(path.dirname(statePath));
	await fs.writeJSON(statePath, state, { spaces: 2 });
}

/**
 * Check if workflow state exists
 */
async function hasWorkflowState(projectRoot) {
	const statePath = path.join(projectRoot, STATE_FILE);
	return await fs.pathExists(statePath);
}

/**
 * Parse subtasks from task data
 */
function parseSubtasks(task, maxAttempts = 3) {
	if (!task?.subtasks || !Array.isArray(task.subtasks)) {
		return [];
	}

	return task.subtasks.map((st) => ({
		id: st.id,
		title: st.title,
		status: st.status === 'done' ? 'completed' : st.status === 'in-progress' ? 'in-progress' : 'pending',
		attempts: 0,
		maxAttempts
	}));
}

/**
 * Register the autopilot-start tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotStartTool(server) {
	server.addTool({
		name: 'autopilot_start',
		description:
			'Initialize and start a new TDD workflow for a task. Creates a git branch and sets up the workflow state machine.',
		parameters: z.object({
			taskId: z
				.string()
				.describe('Task ID to start workflow for (e.g., "1", "2.3")'),
			projectRoot: z
				.string()
				.describe('Absolute path to the project root directory'),
			tag: z
				.string()
				.optional()
				.describe('Tag context to operate on (defaults to current tag)'),
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
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { taskId, projectRoot, maxAttempts, force } = args;

			try {
				log.info(
					`Starting autopilot workflow for task ${taskId} in ${projectRoot}`
				);

				// Check for existing workflow
				const hasState = await hasWorkflowState(projectRoot);
				if (hasState && !force) {
					log.warn('Workflow state already exists');
					return createErrorResponse(
						'Workflow already in progress. Use force=true to override or resume the existing workflow.',
						{
							suggestion: 'Use autopilot_resume to continue the existing workflow'
						}
					);
				}

				const resolvedTag = resolveTag({
					projectRoot: args.projectRoot,
					tag: args.tag
				});

				// Load task data
				const core = await createTaskMasterCore({ projectRoot, tag: resolvedTag });
				const taskResult = await core.getTaskWithSubtask(taskId);

				if (!taskResult || !taskResult.task) {
					return createErrorResponse(`Task ${taskId} not found`);
				}

				const task = taskResult.task;

				// Validate task has subtasks
				if (!task.subtasks || task.subtasks.length === 0) {
					return createErrorResponse(
						`Task ${taskId} has no subtasks. Use expand-task to create subtasks first.`,
						{
							suggestion: `Run expand_task with id="${taskId}" to break down the task into subtasks`
						}
					);
				}

				// Parse subtasks
				const subtasks = parseSubtasks(task, maxAttempts);

				// Initialize git adapter
				const gitAdapter = new GitAdapter(projectRoot);

				// Check git preconditions
				try {
					await gitAdapter.ensureGitRepository();
					await gitAdapter.ensureCleanWorkingTree();
				} catch (error) {
					log.error(`Git validation failed: ${error.message}`);
					return createErrorResponse(`Git validation failed: ${error.message}`, {
						suggestion: 'Ensure you are in a git repository with a clean working tree'
					});
				}

				// Create workflow branch
				const branchName = `task-${taskId.replace(/\./g, '-')}`;
				try {
					await gitAdapter.createAndCheckoutBranch(branchName);
					log.info(`Created and checked out branch: ${branchName}`);
				} catch (error) {
					log.error(`Failed to create branch: ${error.message}`);
					return createErrorResponse(`Failed to create branch: ${error.message}`);
				}

				// Initialize workflow context
				const context = {
					taskId,
					subtasks,
					currentSubtaskIndex: 0,
					currentTDDPhase: 'RED',
					branchName,
					tag: resolvedTag,
					errors: [],
					metadata: {
						startedAt: new Date().toISOString(),
						taskTitle: task.title
					}
				};

				// Create orchestrator and enable persistence
				const orchestrator = new WorkflowOrchestrator(context);
				orchestrator.enableAutoPersist(async (state) => {
					await saveWorkflowState(projectRoot, state);
				});

				// Get initial state
				const state = orchestrator.getState();
				const currentSubtask = orchestrator.getCurrentSubtask();
				const progress = orchestrator.getProgress();

				await core.close();

				log.info(`Workflow started successfully for task ${taskId}`);

				return {
					success: true,
					message: `Workflow started for task ${taskId}`,
					taskId,
					branchName,
					phase: state.phase,
					tddPhase: context.currentTDDPhase,
					progress: {
						completed: progress.completed,
						total: progress.total,
						percentage: progress.percentage
					},
					currentSubtask: currentSubtask
						? {
								id: currentSubtask.id,
								title: currentSubtask.title,
								status: currentSubtask.status,
								attempts: currentSubtask.attempts
							}
						: null,
					nextAction: 'generate_test'
				};
			} catch (error) {
				log.error(`Error in autopilot-start: ${error.message}\n${error.stack}`);
				return createErrorResponse(
					`Failed to start workflow: ${error.message}`
				);
			}
		})
	});
}
