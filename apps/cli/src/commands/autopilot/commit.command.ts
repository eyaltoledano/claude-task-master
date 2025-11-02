/**
 * @fileoverview Commit Command - Create commit with enhanced message generation
 */

import { Command } from 'commander';
import { WorkflowService, GitAdapter, CommitMessageGenerator } from '@tm/core';
import { AutopilotBaseOptions, OutputFormatter } from './shared.js';

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
			const projectRoot = mergedOptions.projectRoot!;

			// Create workflow service (manages WorkflowStateManager internally)
			const workflowService = new WorkflowService(projectRoot);

			// Check if workflow exists
			if (!(await workflowService.hasWorkflow())) {
				formatter.error('No active workflow', {
					suggestion: 'Start a workflow with: autopilot start <taskId>'
				});
				process.exit(1);
			}

			// Resume workflow (loads state with single WorkflowStateManager instance)
			await workflowService.resumeWorkflow();
			const status = workflowService.getStatus();
			const workflowContext = workflowService.getContext();

			// Verify in COMMIT phase
			if (status.tddPhase !== 'COMMIT') {
				formatter.error('Not in COMMIT phase', {
					currentPhase: status.tddPhase || status.phase,
					suggestion: 'Complete RED and GREEN phases first'
				});
				process.exit(1);
			}

			// Verify there's an active subtask
			if (!status.currentSubtask) {
				formatter.error('No current subtask');
				process.exit(1);
			}

			// Initialize git adapter
			const gitAdapter = new GitAdapter(projectRoot);
			await gitAdapter.ensureGitRepository();

			// Check for staged changes
			const hasStagedChanges = await gitAdapter.hasStagedChanges();
			if (!hasStagedChanges) {
				// Stage all changes
				formatter.info('No staged changes, staging all changes...');
				await gitAdapter.stageFiles(['.']);
			}

			// Get changed files for scope detection
			const gitStatus = await gitAdapter.getStatus();
			const changedFiles = [...gitStatus.staged, ...gitStatus.modified];

			// Generate commit message
			const messageGenerator = new CommitMessageGenerator();
			const testResults = workflowContext.lastTestResults;

			const commitMessage = messageGenerator.generateMessage({
				type: 'feat',
				description: status.currentSubtask.title,
				changedFiles,
				taskId: status.taskId,
				phase: status.tddPhase,
				tag: (workflowContext.metadata.tag as string) || undefined,
				testsPassing: testResults?.passed,
				testsFailing: testResults?.failed,
				coveragePercent: undefined // Could be added if available
			});

			// Create commit with metadata
			await gitAdapter.createCommit(commitMessage, {
				metadata: {
					taskId: status.taskId,
					subtaskId: status.currentSubtask.id,
					phase: 'COMMIT',
					tddCycle: 'complete'
				}
			});

			// Get commit info
			const lastCommit = await gitAdapter.getLastCommit();

			// Complete COMMIT phase and advance workflow
			// This handles all transitions internally with a single WorkflowStateManager
			const newStatus = await workflowService.commit();

			const isComplete = newStatus.phase === 'COMPLETE';

			// Output success
			formatter.success('Commit created', {
				commitHash: lastCommit.hash.substring(0, 7),
				message: commitMessage.split('\n')[0], // First line only
				subtask: {
					id: status.currentSubtask.id,
					title: status.currentSubtask.title
				},
				progress: newStatus.progress,
				nextAction: isComplete
					? 'All subtasks complete. Run: autopilot status'
					: 'Start next subtask with RED phase'
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
