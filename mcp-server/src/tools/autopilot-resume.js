/**
 * tools/autopilot-resume.js
 * Tool to resume a previously started TDD workflow
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
 * Save workflow state to disk
 */
async function saveWorkflowState(projectRoot, state) {
	const statePath = path.join(projectRoot, STATE_FILE);
	await fs.ensureDir(path.dirname(statePath));
	await fs.writeJSON(statePath, state, { spaces: 2 });
}

/**
 * Register the autopilot-resume tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotResumeTool(server) {
	server.addTool({
		name: 'autopilot_resume',
		description:
			'Resume a previously started TDD workflow from saved state. Restores the workflow state machine and continues from where it left off.',
		parameters: z.object({
			projectRoot: z
				.string()
				.describe('Absolute path to the project root directory')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { projectRoot } = args;

			try {
				log.info(`Resuming autopilot workflow in ${projectRoot}`);

				// Load state
				const state = await loadWorkflowState(projectRoot);

				if (!state) {
					log.warn('No workflow state found');
					return createErrorResponse('No workflow state found', {
						suggestion: 'Start a new workflow with autopilot_start'
					});
				}

				// Validate state can be resumed
				const orchestrator = new WorkflowOrchestrator(state.context);
				if (!orchestrator.canResumeFromState(state)) {
					log.error('Invalid workflow state');
					return createErrorResponse('Invalid workflow state', {
						suggestion:
							'State file may be corrupted. Consider starting a new workflow.'
					});
				}

				// Restore state
				orchestrator.restoreState(state);

				// Re-enable auto-persistence
				orchestrator.enableAutoPersist(async (newState) => {
					await saveWorkflowState(projectRoot, newState);
				});

				// Get progress
				const progress = orchestrator.getProgress();
				const currentSubtask = orchestrator.getCurrentSubtask();
				const phase = orchestrator.getCurrentPhase();
				const tddPhase = orchestrator.getCurrentTDDPhase();

				// Determine next action
				let nextAction = 'generate_test';
				if (tddPhase === 'GREEN') {
					nextAction = 'implement_code';
				} else if (tddPhase === 'COMMIT') {
					nextAction = 'commit_changes';
				}

				log.info(`Workflow resumed successfully for task ${state.context.taskId}`);

				return {
					success: true,
					message: 'Workflow resumed',
					taskId: state.context.taskId,
					branchName: state.context.branchName,
					phase,
					tddPhase,
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
					nextAction
				};
			} catch (error) {
				log.error(`Error in autopilot-resume: ${error.message}\n${error.stack}`);
				return createErrorResponse(
					`Failed to resume workflow: ${error.message}`
				);
			}
		})
	});
}
