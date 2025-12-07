/**
 * @fileoverview Finalize Command - Complete the TDD workflow
 */

import { createTmCore } from '@tm/core';
import { Command } from 'commander';
import { getProjectRoot } from '../../utils/project-root.js';
import { AutopilotBaseOptions, OutputFormatter } from './shared.js';

type FinalizeOptions = AutopilotBaseOptions;

/**
 * Finalize Command - Complete the workflow after all subtasks are done
 */
export class FinalizeCommand extends Command {
	constructor() {
		super('finalize');

		this.description(
			'Finalize and complete the workflow. Validates working tree is clean.'
		).action(async (options: FinalizeOptions) => {
			await this.execute(options);
		});
	}

	private async execute(options: FinalizeOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;

		// Initialize mergedOptions with defaults (projectRoot will be set in try block)
		let mergedOptions: FinalizeOptions = {
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

			// Resume workflow to get status
			await tmCore.workflow.resume();
			const currentStatus = tmCore.workflow.getStatus();

			// Verify we're in FINALIZE phase
			if (currentStatus.phase !== 'FINALIZE') {
				formatter.error(
					`Cannot finalize: workflow is in ${currentStatus.phase} phase`,
					{
						suggestion: 'Complete all subtasks first'
					}
				);
				process.exit(1);
			}

			// Finalize workflow
			formatter.info('Validating working tree and finalizing workflow...');
			const newStatus = await tmCore.workflow.finalize();

			// Output result
			formatter.success('Workflow completed', {
				taskId: newStatus.taskId,
				phase: newStatus.phase,
				branchName: newStatus.branchName,
				progress: newStatus.progress
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
