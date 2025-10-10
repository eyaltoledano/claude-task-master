/**
 * @fileoverview Abort Command - Safely terminate workflow
 */

import { Command } from 'commander';
import { WorkflowOrchestrator } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	loadWorkflowState,
	deleteWorkflowState,
	OutputFormatter
} from './shared.js';
import inquirer from 'inquirer';

interface AbortOptions extends AutopilotBaseOptions {
	force?: boolean;
}

/**
 * Abort Command - Safely terminate workflow and clean up state
 */
export class AbortCommand extends Command {
	constructor() {
		super('abort');

		this.description('Abort the current TDD workflow and clean up state')
			.option('-f, --force', 'Force abort without confirmation')
			.action(async (options: AbortOptions) => {
				await this.execute(options);
			});
	}

	private async execute(options: AbortOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: AbortOptions = {
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
				formatter.warning('No active workflow to abort');
				return;
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

			// Get progress before abort
			const progress = orchestrator.getProgress();
			const currentSubtask = orchestrator.getCurrentSubtask();

			// Confirm abort if not forced or in JSON mode
			if (!mergedOptions.force && !mergedOptions.json) {
				const { confirmed } = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'confirmed',
						message:
							`This will abort the workflow for task ${state.context.taskId}. ` +
							`Progress: ${progress.completed}/${progress.total} subtasks completed. ` +
							`Continue?`,
						default: false
					}
				]);

				if (!confirmed) {
					formatter.info('Abort cancelled');
					return;
				}
			}

			// Trigger abort in orchestrator
			orchestrator.transition({ type: 'ABORT' });

			// Delete workflow state
			await deleteWorkflowState(mergedOptions.projectRoot!);

			// Output result
			formatter.success('Workflow aborted', {
				taskId: state.context.taskId,
				branchName: state.context.branchName,
				progress: {
					completed: progress.completed,
					total: progress.total
				},
				lastSubtask: currentSubtask
					? {
							id: currentSubtask.id,
							title: currentSubtask.title
						}
					: null,
				note: 'Branch and commits remain. Clean up manually if needed.'
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
