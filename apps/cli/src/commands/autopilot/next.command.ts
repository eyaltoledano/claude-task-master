/**
 * @fileoverview Next Command - Get next action in TDD workflow
 */

import { createTmCore } from '@tm/core';
import { Command } from 'commander';
import { getProjectRoot } from '../../utils/project-root.js';
import { type AutopilotBaseOptions, OutputFormatter } from './shared.js';

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

		// Initialize mergedOptions with defaults (projectRoot will be set in try block)
		let mergedOptions: NextOptions = {
			...parentOpts,
			...options,
			projectRoot: '' // Will be set in try block
		};

		const formatter = new OutputFormatter(
			options.json || parentOpts?.json || false
		);

		try {
			// Resolve project root inside try block to catch any errors
			const projectRoot = getProjectRoot(
				options.projectRoot || parentOpts?.projectRoot
			);

			// Update mergedOptions with resolved project root
			mergedOptions = {
				...mergedOptions,
				projectRoot
			};

			// Initialize TmCore facade
			const tmCore = await createTmCore({ projectPath: projectRoot });

			// Check if workflow exists
			if (!(await tmCore.workflow.hasWorkflow())) {
				formatter.error('No active workflow', {
					suggestion: 'Start a workflow with: autopilot start <taskId>'
				});
				process.exit(1);
			}

			// Resume workflow and get next action
			await tmCore.workflow.resume();
			const status = tmCore.workflow.getStatus();
			const nextAction = tmCore.workflow.getNextAction();
			const context = tmCore.workflow.getContext();

			// Get current phase info
			const phase = status.phase;
			const tddPhase = status.tddPhase;
			const currentSubtask = status.currentSubtask;

			if (phase === 'COMPLETE') {
				formatter.success('Workflow complete', {
					message: 'All subtasks have been completed',
					taskId: status.taskId
				});
				return;
			}

			// Output next action using the facade's guidance
			const output = {
				action: nextAction.action,
				description: nextAction.description,
				phase,
				tddPhase,
				taskId: status.taskId,
				branchName: status.branchName,
				subtask: currentSubtask
					? {
							id: currentSubtask.id,
							title: currentSubtask.title,
							attempts: currentSubtask.attempts
						}
					: null,
				nextSteps: nextAction.nextSteps,
				lastTestResults: context.lastTestResults
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
