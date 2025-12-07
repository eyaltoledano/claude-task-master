/**
 * @fileoverview Status Command - Show workflow progress
 */

import { createTmCore } from '@tm/core';
import { Command } from 'commander';
import { getProjectRoot } from '../../utils/project-root.js';
import { AutopilotBaseOptions, OutputFormatter } from './shared.js';

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
			projectRoot: getProjectRoot(
				options.projectRoot || parentOpts?.projectRoot
			)
		};

		const formatter = new OutputFormatter(mergedOptions.json || false);

		try {
			const projectRoot = mergedOptions.projectRoot!;

			// Initialize TmCore facade
			const tmCore = await createTmCore({ projectPath: projectRoot });

			// Check if workflow exists
			if (!(await tmCore.workflow.hasWorkflow())) {
				if (mergedOptions.json) {
					formatter.output({
						active: false,
						message: 'No active workflow'
					});
				} else {
					formatter.info('No active workflow');
					console.log('Start a workflow with: autopilot start <taskId>');
				}
				return;
			}

			// Resume workflow and get status
			await tmCore.workflow.resume();
			const workflowStatus = tmCore.workflow.getStatus();
			const context = tmCore.workflow.getContext();

			// Build status output
			const status = {
				taskId: workflowStatus.taskId,
				phase: workflowStatus.phase,
				tddPhase: workflowStatus.tddPhase,
				branchName: workflowStatus.branchName,
				progress: workflowStatus.progress,
				currentSubtask: workflowStatus.currentSubtask
					? {
							id: workflowStatus.currentSubtask.id,
							title: workflowStatus.currentSubtask.title,
							attempts: workflowStatus.currentSubtask.attempts,
							maxAttempts: workflowStatus.currentSubtask.maxAttempts
						}
					: null,
				subtasks: context.subtasks.map((st) => ({
					id: st.id,
					title: st.title,
					status: st.status,
					attempts: st.attempts
				})),
				errors:
					context.errors && context.errors.length > 0
						? context.errors
						: undefined,
				metadata: context.metadata
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
