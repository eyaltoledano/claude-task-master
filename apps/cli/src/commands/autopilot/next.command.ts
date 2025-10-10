/**
 * @fileoverview Next Command - Get next action in TDD workflow
 */

import { Command } from 'commander';
import { WorkflowOrchestrator } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	loadWorkflowState,
	OutputFormatter
} from './shared.js';

type NextOptions = AutopilotBaseOptions;

/**
 * Next Command - Get next action details
 */
export class NextCommand extends Command {
	constructor() {
		super('next');

		this.description(
			'Get the next action to perform in the TDD workflow'
		).action(async (options: NextOptions) => {
			await this.execute(options);
		});
	}

	private async execute(options: NextOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: NextOptions = {
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

			// Get current phase and subtask
			const phase = orchestrator.getCurrentPhase();
			const tddPhase = orchestrator.getCurrentTDDPhase();
			const currentSubtask = orchestrator.getCurrentSubtask();

			// Determine next action based on phase
			let actionType: string;
			let actionDescription: string;
			let actionDetails: Record<string, unknown> = {};

			if (phase === 'COMPLETE') {
				formatter.success('Workflow complete', {
					message: 'All subtasks have been completed',
					taskId: state.context.taskId
				});
				return;
			}

			if (phase === 'SUBTASK_LOOP' && tddPhase) {
				switch (tddPhase) {
					case 'RED':
						actionType = 'generate_test';
						actionDescription = 'Write failing test for current subtask';
						actionDetails = {
							subtask: currentSubtask
								? {
										id: currentSubtask.id,
										title: currentSubtask.title,
										attempts: currentSubtask.attempts
									}
								: null,
							testCommand: 'npm test', // Could be customized based on config
							expectedOutcome: 'Test should fail'
						};
						break;

					case 'GREEN':
						actionType = 'implement_code';
						actionDescription = 'Implement code to pass the failing test';
						actionDetails = {
							subtask: currentSubtask
								? {
										id: currentSubtask.id,
										title: currentSubtask.title,
										attempts: currentSubtask.attempts
									}
								: null,
							testCommand: 'npm test',
							expectedOutcome: 'All tests should pass',
							lastTestResults: state.context.lastTestResults
						};
						break;

					case 'COMMIT':
						actionType = 'commit_changes';
						actionDescription = 'Commit the changes';
						actionDetails = {
							subtask: currentSubtask
								? {
										id: currentSubtask.id,
										title: currentSubtask.title,
										attempts: currentSubtask.attempts
									}
								: null,
							suggestion: 'Use: autopilot commit'
						};
						break;

					default:
						actionType = 'unknown';
						actionDescription = 'Unknown TDD phase';
				}
			} else {
				actionType = 'workflow_phase';
				actionDescription = `Currently in ${phase} phase`;
			}

			// Output next action
			const output = {
				action: actionType,
				description: actionDescription,
				phase,
				tddPhase,
				taskId: state.context.taskId,
				branchName: state.context.branchName,
				...actionDetails
			};

			if (mergedOptions.json) {
				formatter.output(output);
			} else {
				formatter.success('Next action', output);
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
