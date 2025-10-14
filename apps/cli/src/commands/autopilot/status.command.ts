/**
 * @fileoverview Status Command - Show workflow progress
 */

import { Command } from 'commander';
import { WorkflowOrchestrator } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	loadWorkflowState,
	OutputFormatter
} from './shared.js';

type StatusOptions = AutopilotBaseOptions;

/**
 * Status Command - Show current workflow status
 */
export class StatusCommand extends Command {
	constructor() {
		super('status');

		this.description('Show current TDD workflow status and progress').action(
			async (options: StatusOptions) => {
				await this.execute(options);
			}
		);
	}

	private async execute(options: StatusOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: StatusOptions = {
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

			// Restore orchestrator
			const orchestrator = new WorkflowOrchestrator(state.context);
			orchestrator.restoreState(state);

			// Get status information
			const phase = orchestrator.getCurrentPhase();
			const tddPhase = orchestrator.getCurrentTDDPhase();
			const progress = orchestrator.getProgress();
			const currentSubtask = orchestrator.getCurrentSubtask();
			const errors = state.context.errors ?? [];

			// Build status output
			const status = {
				taskId: state.context.taskId,
				phase,
				tddPhase,
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
				subtasks: state.context.subtasks.map((st) => ({
					id: st.id,
					title: st.title,
					status: st.status,
					attempts: st.attempts
				})),
				errors: errors.length > 0 ? errors : undefined,
				metadata: state.context.metadata
			};

			if (mergedOptions.json) {
				formatter.output(status);
			} else {
				formatter.success('Workflow status', status);
			}
		} catch (error) {
			formatter.error((error as Error).message);
			if (mergedOptions.verbose) {
				console.error((error as Error).stack);
			}
			process.exit(1);
		}
	}
}
