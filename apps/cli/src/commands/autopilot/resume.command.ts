/**
 * @fileoverview Resume Command - Restore and resume TDD workflow
 */

import { createTmCore } from '@tm/core';
import { Command } from 'commander';
import { getProjectRoot } from '../../utils/project-root.js';
import { AutopilotBaseOptions, OutputFormatter } from './shared.js';

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
				formatter.error('No workflow state found', {
					suggestion: 'Start a new workflow with: autopilot start <taskId>'
				});
				process.exit(1);
			}

			// Resume workflow
			formatter.info('Loading workflow state...');
			const status = await tmCore.workflow.resume();

			// Output success
			formatter.success('Workflow resumed', {
				taskId: status.taskId,
				phase: status.phase,
				tddPhase: status.tddPhase,
				branchName: status.branchName,
				progress: status.progress,
				currentSubtask: status.currentSubtask
					? {
							id: status.currentSubtask.id,
							title: status.currentSubtask.title,
							attempts: status.currentSubtask.attempts
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
