/**
 * @fileoverview Commit Command - Create commit with enhanced message generation
 */

import { Command } from 'commander';
import { WorkflowOrchestrator } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	loadWorkflowState,
	createGitAdapter,
	createCommitMessageGenerator,
	OutputFormatter,
	saveWorkflowState
} from './shared.js';

type CommitOptions = AutopilotBaseOptions;

/**
 * Commit Command - Create commit using enhanced message generator
 */
export class CommitCommand extends Command {
	constructor() {
		super('commit');

		this.description('Create a commit for the completed GREEN phase').action(
			async (options: CommitOptions) => {
				await this.execute(options);
			}
		);
	}

	private async execute(options: CommitOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: CommitOptions = {
			...parentOpts,
			...options,
			projectRoot:
				options.projectRoot || parentOpts?.projectRoot || process.cwd()
		};

		const formatter = new OutputFormatter(mergedOptions.json || false);

		try {
			// Check for workflow state
			const hasState = await hasWorkflowState(mergedOptions.projectRoot!);
			if (!hasState) {
				formatter.error('No active workflow', {
					suggestion: 'Start a workflow with: autopilot start <taskId>'
				});
				process.exit(1);
			}

			// Load state
			const state = await loadWorkflowState(mergedOptions.projectRoot!);
			if (!state) {
				formatter.error('Failed to load workflow state');
				process.exit(1);
			}

			const orchestrator = new WorkflowOrchestrator(state.context);
			orchestrator.restoreState(state);
			orchestrator.enableAutoPersist(async (newState) => {
				await saveWorkflowState(mergedOptions.projectRoot!, newState);
			});

			// Verify in COMMIT phase
			const tddPhase = orchestrator.getCurrentTDDPhase();
			if (tddPhase !== 'COMMIT') {
				formatter.error('Not in COMMIT phase', {
					currentPhase: tddPhase || orchestrator.getCurrentPhase(),
					suggestion: 'Complete RED and GREEN phases first'
				});
				process.exit(1);
			}

			// Get current subtask
			const currentSubtask = orchestrator.getCurrentSubtask();
			if (!currentSubtask) {
				formatter.error('No current subtask');
				process.exit(1);
			}

			// Initialize git adapter
			const gitAdapter = createGitAdapter(mergedOptions.projectRoot!);
			await gitAdapter.ensureGitRepository();

			// Check for staged changes
			const hasStagedChanges = await gitAdapter.hasStagedChanges();
			if (!hasStagedChanges) {
				// Stage all changes
				formatter.info('No staged changes, staging all changes...');
				await gitAdapter.stageFiles(['.']);
			}

			// Get changed files for scope detection
			const status = await gitAdapter.getStatus();
			const changedFiles = [...status.staged, ...status.modified];

			// Generate commit message
			const messageGenerator = createCommitMessageGenerator();
			const testResults = state.context.lastTestResults;

			const commitMessage = messageGenerator.generateMessage({
				type: 'feat',
				description: currentSubtask.title,
				changedFiles,
				taskId: state.context.taskId,
				phase: 'TDD',
				tag: (state.context.metadata.tag as string) || undefined,
				testsPassing: testResults?.passed,
				testsFailing: testResults?.failed,
				coveragePercent: undefined // Could be added if available
			});

			// Create commit with metadata
			await gitAdapter.createCommit(commitMessage, {
				metadata: {
					taskId: state.context.taskId,
					subtaskId: currentSubtask.id,
					phase: 'COMMIT',
					tddCycle: 'complete'
				}
			});

			// Get commit info
			const lastCommit = await gitAdapter.getLastCommit();

			// Complete COMMIT phase (this marks subtask as completed)
			orchestrator.transition({ type: 'COMMIT_COMPLETE' });

			// Check if should advance to next subtask
			const progress = orchestrator.getProgress();
			if (progress.current < progress.total) {
				orchestrator.transition({ type: 'SUBTASK_COMPLETE' });
			} else {
				// All subtasks complete
				orchestrator.transition({ type: 'ALL_SUBTASKS_COMPLETE' });
			}

			// Output success
			formatter.success('Commit created', {
				commitHash: lastCommit.hash.substring(0, 7),
				message: commitMessage.split('\n')[0], // First line only
				subtask: {
					id: currentSubtask.id,
					title: currentSubtask.title,
					status: currentSubtask.status
				},
				progress: {
					completed: progress.completed,
					total: progress.total,
					percentage: progress.percentage
				},
				nextAction:
					progress.completed < progress.total
						? 'Start next subtask with RED phase'
						: 'All subtasks complete. Run: autopilot status'
			});
		} catch (error) {
			formatter.error((error as Error).message);
			if (mergedOptions.verbose) {
				console.error((error as Error).stack);
			}
			process.exit(1);
		}
	}
}
