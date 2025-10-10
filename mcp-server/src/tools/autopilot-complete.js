/**
 * tools/autopilot-complete.js
 * Tool to complete the current TDD phase with validation
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
 * Save workflow state to disk
 */
async function saveWorkflowState(projectRoot, state) {
	const statePath = path.join(projectRoot, STATE_FILE);
	await fs.ensureDir(path.dirname(statePath));
	await fs.writeJSON(statePath, state, { spaces: 2 });
}

/**
 * Register the autopilot-complete tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotCompleteTool(server) {
	server.addTool({
		name: 'autopilot_complete_phase',
		description:
			'Complete the current TDD phase (RED, GREEN, or COMMIT) with test result validation. Validates that RED phase has failures and GREEN phase has all tests passing before transitioning.',
		parameters: z.object({
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
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { projectRoot, testResults } = args;

			try {
				log.info(`Completing current phase in workflow for ${projectRoot}`);

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

				// Re-enable auto-persistence
				orchestrator.enableAutoPersist(async (newState) => {
					await saveWorkflowState(projectRoot, newState);
				});

				const tddPhase = orchestrator.getCurrentTDDPhase();
				const currentSubtask = orchestrator.getCurrentSubtask();

				// Validate based on current phase
				if (tddPhase === 'RED') {
					// RED phase must have failures
					if (testResults.failed === 0) {
						log.error('RED phase validation failed: no test failures');
						return createErrorResponse('RED phase validation failed', {
							reason: 'At least one test must be failing in RED phase',
							actual: {
								passed: testResults.passed,
								failed: testResults.failed
							},
							suggestion:
								'Ensure you have written a failing test before proceeding to GREEN phase'
						});
					}
					log.info(
						'RED phase validation passed: tests are failing as expected'
					);
				} else if (tddPhase === 'GREEN') {
					// GREEN phase must have all tests passing
					if (testResults.failed > 0) {
						log.error('GREEN phase validation failed: tests still failing');
						return createErrorResponse('GREEN phase validation failed', {
							reason: 'All tests must pass in GREEN phase',
							actual: {
								passed: testResults.passed,
								failed: testResults.failed
							},
							suggestion:
								'Fix the implementation to make all tests pass before proceeding'
						});
					}
					log.info('GREEN phase validation passed: all tests passing');
				}

				// Transition to next phase
				try {
					if (tddPhase === 'RED') {
						orchestrator.transition('RED_COMPLETE', { testResults });
						log.info('Transitioned from RED to GREEN phase');
					} else if (tddPhase === 'GREEN') {
						orchestrator.transition('GREEN_COMPLETE', { testResults });
						log.info('Transitioned from GREEN to COMMIT phase');
					} else if (tddPhase === 'COMMIT') {
						orchestrator.transition('COMMIT_COMPLETE');
						log.info('Completed COMMIT phase');
					}
				} catch (error) {
					log.error(`Transition failed: ${error.message}`);
					return createErrorResponse(`Transition failed: ${error.message}`);
				}

				const newTddPhase = orchestrator.getCurrentTDDPhase();
				const progress = orchestrator.getProgress();

				// Determine next action
				let nextAction = 'generate_test';
				if (newTddPhase === 'GREEN') {
					nextAction = 'implement_code';
				} else if (newTddPhase === 'COMMIT') {
					nextAction = 'commit_changes';
				}

				log.info(`Phase completed successfully, now in ${newTddPhase} phase`);

				return {
					success: true,
					message: `Completed ${tddPhase} phase`,
					previousPhase: tddPhase,
					currentPhase: newTddPhase,
					taskId: state.context.taskId,
					currentSubtask: currentSubtask
						? {
								id: currentSubtask.id,
								title: currentSubtask.title,
								status: currentSubtask.status
							}
						: null,
					progress: {
						completed: progress.completed,
						total: progress.total,
						percentage: progress.percentage
					},
					nextAction,
					testResults
				};
			} catch (error) {
				log.error(
					`Error in autopilot-complete: ${error.message}\n${error.stack}`
				);
				return createErrorResponse(
					`Failed to complete phase: ${error.message}`
				);
			}
		})
	});
}
