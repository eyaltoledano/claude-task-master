/**
 * @fileoverview Complete Command - Complete current TDD phase with validation
 */

import { type TestResult, createTmCore } from '@tm/core';
import { Command } from 'commander';
import { getProjectRoot } from '../../utils/project-root.js';
import { type AutopilotBaseOptions, OutputFormatter } from './shared.js';

interface CompleteOptions extends AutopilotBaseOptions {
	results?: string;
	coverage?: string;
}

/**
 * Complete Command - Mark current phase as complete with validation
 */
export class CompleteCommand extends Command {
	constructor() {
		super('complete');

		this.description('Complete the current TDD phase with result validation')
			.option(
				'-r, --results <json>',
				'Test results JSON (with total, passed, failed, skipped)'
			)
			.option('-c, --coverage <percent>', 'Coverage percentage')
			.action(async (options: CompleteOptions) => {
				await this.execute(options);
			});
	}

	private async execute(options: CompleteOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: CompleteOptions = {
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
				formatter.error('No active workflow', {
					suggestion: 'Start a workflow with: autopilot start <taskId>'
				});
				process.exit(1);
			}

			// Resume workflow
			await tmCore.workflow.resume();
			const status = tmCore.workflow.getStatus();

			// Get current phase
			const tddPhase = status.tddPhase;
			const currentSubtask = status.currentSubtask;

			if (!tddPhase) {
				formatter.error('Not in a TDD phase', {
					phase: status.phase
				});
				process.exit(1);
			}

			// Validate based on phase
			if (tddPhase === 'RED' || tddPhase === 'GREEN') {
				if (!mergedOptions.results) {
					formatter.error('Test results required for RED/GREEN phase', {
						usage:
							'--results \'{"total":10,"passed":9,"failed":1,"skipped":0}\''
					});
					process.exit(1);
				}

				// Parse test results
				let testResults: TestResult;
				try {
					const parsed = JSON.parse(mergedOptions.results);
					testResults = {
						total: parsed.total || 0,
						passed: parsed.passed || 0,
						failed: parsed.failed || 0,
						skipped: parsed.skipped || 0,
						phase: tddPhase
					};
				} catch (error) {
					formatter.error('Invalid test results JSON', {
						error: (error as Error).message
					});
					process.exit(1);
				}

				// Validate RED phase requirements
				if (tddPhase === 'RED' && testResults.failed === 0) {
					formatter.error('RED phase validation failed', {
						reason: 'At least one test must be failing',
						actual: {
							passed: testResults.passed,
							failed: testResults.failed
						}
					});
					process.exit(1);
				}

				// Validate GREEN phase requirements
				if (tddPhase === 'GREEN' && testResults.failed !== 0) {
					formatter.error('GREEN phase validation failed', {
						reason: 'All tests must pass',
						actual: {
							passed: testResults.passed,
							failed: testResults.failed
						}
					});
					process.exit(1);
				}

				// Complete phase with test results using tmCore facade
				const newStatus = await tmCore.workflow.completePhase(testResults);

				if (tddPhase === 'RED') {
					formatter.success('RED phase completed', {
						nextPhase: newStatus.tddPhase || 'GREEN',
						testResults,
						subtask: currentSubtask?.title
					});
				} else {
					formatter.success('GREEN phase completed', {
						nextPhase: newStatus.tddPhase || 'COMMIT',
						testResults,
						subtask: currentSubtask?.title,
						suggestion: 'Run: autopilot commit'
					});
				}
			} else if (tddPhase === 'COMMIT') {
				formatter.error('Use "autopilot commit" to complete COMMIT phase');
				process.exit(1);
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
