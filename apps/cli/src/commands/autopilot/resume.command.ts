/**
 * @fileoverview Resume Command - Restore and resume TDD workflow
 */

import { Command } from 'commander';
import { WorkflowOrchestrator } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	loadWorkflowState,
	OutputFormatter
} from './shared.js';

type ResumeOptions = AutopilotBaseOptions;

/**
 * Resume Command - Restore workflow from saved state
 */
export class ResumeCommand extends Command {
	constructor() {
		super('resume');

		this.description('Resume a previously started TDD workflow').action(
			async (options: ResumeOptions) => {
				await this.execute(options);
			}
		);
	}

	private async execute(options: ResumeOptions): Promise<void> {
		// Inherit parent options (autopilot command)
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: ResumeOptions = {
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
				formatter.error('No workflow state found', {
					suggestion: 'Start a new workflow with: autopilot start <taskId>'
				});
				process.exit(1);
			}

			// Load state
			formatter.info('Loading workflow state...');
			const state = await loadWorkflowState(mergedOptions.projectRoot!);

			if (!state) {
				formatter.error('Failed to load workflow state');
				process.exit(1);
			}

			// Validate state can be resumed
			const orchestrator = new WorkflowOrchestrator(state.context);
			if (!orchestrator.canResumeFromState(state)) {
				formatter.error('Invalid workflow state', {
					suggestion:
						'State file may be corrupted. Consider starting a new workflow.'
				});
				process.exit(1);
			}

			// Restore state
			orchestrator.restoreState(state);

			// Re-enable auto-persistence
			const { saveWorkflowState } = await import('./shared.js');
			orchestrator.enableAutoPersist(async (newState) => {
				await saveWorkflowState(mergedOptions.projectRoot!, newState);
			});

			// Get progress
			const progress = orchestrator.getProgress();
			const currentSubtask = orchestrator.getCurrentSubtask();

			// Output success
			formatter.success('Workflow resumed', {
				taskId: state.context.taskId,
				phase: orchestrator.getCurrentPhase(),
				tddPhase: orchestrator.getCurrentTDDPhase(),
				branchName: state.context.branchName,
				progress: {
					completed: progress.completed,
					total: progress.total,
					percentage: progress.percentage
				},
				currentSubtask: currentSubtask
					? {
							id: currentSubtask.id,
							title: currentSubtask.title,
							attempts: currentSubtask.attempts
						}
					: null
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
