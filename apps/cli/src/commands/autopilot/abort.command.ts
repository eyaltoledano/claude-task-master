/**
 * @fileoverview Abort Command - Safely terminate workflow
 */

import { createTmCore } from '@tm/core';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { getProjectRoot } from '../../utils/project-root.js';
import { AutopilotBaseOptions, OutputFormatter } from './shared.js';

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

		// Initialize mergedOptions with defaults (projectRoot will be set in try block)
		let mergedOptions: AbortOptions = {
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
				formatter.warning('No active workflow to abort');
				return;
			}

			// Resume workflow to get status
			await tmCore.workflow.resume();
			const status = tmCore.workflow.getStatus();

			// Confirm abort if not forced or in JSON mode
			if (!mergedOptions.force && !mergedOptions.json) {
				const { confirmed } = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'confirmed',
						message:
							`This will abort the workflow for task ${status.taskId}. ` +
							`Progress: ${status.progress?.completed || 0}/${status.progress?.total || 0} subtasks completed. ` +
							`Continue?`,
						default: false
					}
				]);

				if (!confirmed) {
					formatter.info('Abort cancelled');
					return;
				}
			}

			// Abort workflow (cleans up state internally)
			await tmCore.workflow.abort();

			// Output result
			formatter.success('Workflow aborted', {
				taskId: status.taskId,
				branchName: status.branchName,
				progress: status.progress,
				lastSubtask: status.currentSubtask
					? {
							id: status.currentSubtask.id,
							title: status.currentSubtask.title
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
