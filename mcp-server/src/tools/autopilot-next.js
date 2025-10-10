/**
 * tools/autopilot-next.js
 * Tool to get the next action to perform in the TDD workflow
 */

import { z } from 'zod';
import { createErrorResponse, withNormalizedProjectRoot } from './utils.js';
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
 * Register the autopilot-next tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotNextTool(server) {
	server.addTool({
		name: 'autopilot_next',
		description:
			'Get the next action to perform in the TDD workflow. Returns detailed context about what needs to be done next, including the current phase, subtask, and expected actions.',
		parameters: z.object({
			projectRoot: z
				.string()
				.describe('Absolute path to the project root directory')
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { projectRoot } = args;

			try {
				log.info(`Getting next action for workflow in ${projectRoot}`);

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

				// Determine action based on TDD phase
				let action = 'generate_test';
				let actionDescription = 'Write a failing test for the current subtask';
				let expectedFiles = [];

				if (tddPhase === 'RED') {
					action = 'generate_test';
					actionDescription = 'Write a failing test for the current subtask';
					expectedFiles = ['test file'];
				} else if (tddPhase === 'GREEN') {
					action = 'implement_code';
					actionDescription = 'Implement code to make the failing tests pass';
					expectedFiles = ['implementation file'];
				} else if (tddPhase === 'COMMIT') {
					action = 'commit_changes';
					actionDescription = 'Commit the changes with an appropriate message';
					expectedFiles = [];
				}

				log.info(`Next action determined: ${action}`);

				return {
					action,
					actionDescription,
					phase,
					tddPhase,
					taskId: state.context.taskId,
					branchName: state.context.branchName,
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
					expectedFiles,
					context: {
						canProceed: orchestrator.canProceed(),
						errors: state.context.errors || []
					}
				};
			} catch (error) {
				log.error(`Error in autopilot-next: ${error.message}\n${error.stack}`);
				return createErrorResponse(
					`Failed to get next action: ${error.message}`
				);
			}
		})
	});
}
