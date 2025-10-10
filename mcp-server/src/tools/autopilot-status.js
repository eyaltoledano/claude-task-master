/**
 * tools/autopilot-status.js
 * Tool to get comprehensive workflow status and progress information
 */

import { z } from 'zod';
import {
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import { WorkflowOrchestrator } from '@tm/core';
import fs from 'fs-extra';
import path from 'path';

const STATE_FILE = '.taskmaster/workflow-state.json';

/**
 * Load workflow state from disk
 */
async function loadWorkflowState(projectRoot) {
	const statePath = path.join(projectRoot, STATE_FILE);

	if (!(await fs.pathExists(statePath))) {
		return null;
	}

	try {
		const stateData = await fs.readJSON(statePath);
		return stateData;
	} catch (error) {
		throw new Error(`Failed to load workflow state: ${error.message}`);
	}
}

/**
 * Register the autopilot-status tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotStatusTool(server) {
	server.addTool({
		name: 'autopilot_status',
		description:
			'Get comprehensive workflow status including current phase, progress, subtask details, and activity history.',
		parameters: z.object({
			projectRoot: z
				.string()
				.describe('Absolute path to the project root directory')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { projectRoot } = args;

			try {
				log.info(`Getting workflow status for ${projectRoot}`);

				// Load state
				const state = await loadWorkflowState(projectRoot);

				if (!state) {
					log.warn('No active workflow found');
					return createErrorResponse('No active workflow', {
						suggestion: 'Start a workflow with autopilot_start'
					});
				}

				// Create orchestrator and restore state
				const orchestrator = new WorkflowOrchestrator(state.context);
				orchestrator.restoreState(state);

				const phase = orchestrator.getCurrentPhase();
				const tddPhase = orchestrator.getCurrentTDDPhase();
				const currentSubtask = orchestrator.getCurrentSubtask();
				const progress = orchestrator.getProgress();

				// Get all subtasks with their status
				const subtasks = state.context.subtasks.map((st) => ({
					id: st.id,
					title: st.title,
					status: st.status,
					attempts: st.attempts,
					maxAttempts: st.maxAttempts
				}));

				// Get errors if any
				const errors = state.context.errors || [];

				// Get metadata
				const metadata = state.context.metadata || {};

				log.info(`Workflow status retrieved for task ${state.context.taskId}`);

				return {
					taskId: state.context.taskId,
					branchName: state.context.branchName,
					phase,
					tddPhase,
					progress: {
						completed: progress.completed,
						total: progress.total,
						current: progress.current,
						percentage: progress.percentage
					},
					currentSubtask: currentSubtask
						? {
								id: currentSubtask.id,
								title: currentSubtask.title,
								status: currentSubtask.status,
								attempts: currentSubtask.attempts,
								maxAttempts: currentSubtask.maxAttempts
							}
						: null,
					subtasks,
					errors,
					metadata,
					canProceed: orchestrator.canProceed()
				};
			} catch (error) {
				log.error(
					`Error in autopilot-status: ${error.message}\n${error.stack}`
				);
				return createErrorResponse(
					`Failed to get workflow status: ${error.message}`
				);
			}
		})
	});
}
