/**
 * tools/autopilot-commit.js
 * Tool to create a commit with git operations and enhanced message generation
 */

import { z } from 'zod';
import {
	createErrorResponse,
	withNormalizedProjectRoot
} from './utils.js';
import {
	WorkflowOrchestrator,
	GitAdapter,
	CommitMessageGenerator
} from '@tm/core';
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
 * Register the autopilot-commit tool with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerAutopilotCommitTool(server) {
	server.addTool({
		name: 'autopilot_commit',
		description:
			'Create a git commit with automatic staging, message generation, and metadata embedding. Generates appropriate commit messages based on subtask context and TDD phase.',
		parameters: z.object({
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
				.describe(
					'Custom commit message to use instead of auto-generated message'
				)
		}),
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			const { projectRoot, files, customMessage } = args;

			try {
				log.info(`Creating commit for workflow in ${projectRoot}`);

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

				if (!currentSubtask) {
					return createErrorResponse('No active subtask to commit');
				}

				// Verify we're in COMMIT phase
				if (tddPhase !== 'COMMIT') {
					log.warn(`Not in COMMIT phase (currently in ${tddPhase})`);
					return createErrorResponse(
						`Cannot commit: currently in ${tddPhase} phase`,
						{
							suggestion: `Complete the ${tddPhase} phase first using autopilot_complete_phase`
						}
					);
				}

				// Initialize git adapter
				const gitAdapter = new GitAdapter(projectRoot);

				// Stage files
				try {
					if (files && files.length > 0) {
						await gitAdapter.stageFiles(files);
						log.info(`Staged ${files.length} files`);
					} else {
						await gitAdapter.stageFiles(['.']);
						log.info('Staged all changes');
					}
				} catch (error) {
					log.error(`Failed to stage files: ${error.message}`);
					return createErrorResponse(`Failed to stage files: ${error.message}`);
				}

				// Check if there are staged changes
				const hasStagedChanges = await gitAdapter.hasStagedChanges();
				if (!hasStagedChanges) {
					log.warn('No staged changes to commit');
					return createErrorResponse('No staged changes to commit', {
						suggestion: 'Make code changes before committing'
					});
				}

				// Get git status for message generation
				const gitStatus = await gitAdapter.getStatus();

				// Generate commit message
				let commitMessage;
				if (customMessage) {
					commitMessage = customMessage;
					log.info('Using custom commit message');
				} else {
					const messageGenerator = new CommitMessageGenerator();
					const options = {
						subtask: currentSubtask,
						phase: tddPhase,
						taskId: state.context.taskId,
						branchName: state.context.branchName,
						files: gitStatus.staged
					};
					commitMessage = messageGenerator.generateMessage(options);
					log.info('Generated commit message automatically');
				}

				// Create commit
				try {
					await gitAdapter.createCommit(commitMessage);
					log.info('Commit created successfully');
				} catch (error) {
					log.error(`Failed to create commit: ${error.message}`);
					return createErrorResponse(
						`Failed to create commit: ${error.message}`
					);
				}

				// Get last commit info
				const lastCommit = await gitAdapter.getLastCommit();

				// Transition to next subtask or complete workflow
				try {
					orchestrator.transition('COMMIT_COMPLETE');
					log.info('Transitioned to next subtask');
				} catch (error) {
					log.error(`Transition failed: ${error.message}`);
					return createErrorResponse(`Transition failed: ${error.message}`);
				}

				const newSubtask = orchestrator.getCurrentSubtask();
				const progress = orchestrator.getProgress();
				const phase = orchestrator.getCurrentPhase();

				// Check if workflow is complete
				const isComplete = phase === 'COMPLETE';

				log.info('Commit completed successfully');

				return {
					success: true,
					message: 'Commit created successfully',
					commit: {
						hash: lastCommit.hash,
						message: lastCommit.message
					},
					taskId: state.context.taskId,
					subtaskCompleted: currentSubtask.id,
					currentSubtask: newSubtask
						? {
								id: newSubtask.id,
								title: newSubtask.title,
								status: newSubtask.status
							}
						: null,
					progress: {
						completed: progress.completed,
						total: progress.total,
						percentage: progress.percentage
					},
					phase,
					isComplete,
					nextAction: isComplete ? 'workflow_complete' : 'generate_test'
				};
			} catch (error) {
				log.error(
					`Error in autopilot-commit: ${error.message}\n${error.stack}`
				);
				return createErrorResponse(
					`Failed to create commit: ${error.message}`
				);
			}
		})
	});
}
