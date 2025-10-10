/**
 * @fileoverview Complete Command - Complete current TDD phase with validation
 */

import { Command } from 'commander';
import { WorkflowOrchestrator, TestResult } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	loadWorkflowState,
	OutputFormatter
} from './shared.js';

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

			// Restore orchestrator with persistence
			const { saveWorkflowState } = await import('./shared.js');
			const orchestrator = new WorkflowOrchestrator(state.context);
			orchestrator.restoreState(state);
			orchestrator.enableAutoPersist(async (newState) => {
				await saveWorkflowState(mergedOptions.projectRoot!, newState);
			});

			// Get current phase
			const tddPhase = orchestrator.getCurrentTDDPhase();
			const currentSubtask = orchestrator.getCurrentSubtask();

			if (!tddPhase) {
				formatter.error('Not in a TDD phase', {
					phase: orchestrator.getCurrentPhase()
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

				// Complete phase with test results
				if (tddPhase === 'RED') {
					orchestrator.transition({
						type: 'RED_PHASE_COMPLETE',
						testResults
					});
					formatter.success('RED phase completed', {
						nextPhase: 'GREEN',
						testResults,
						subtask: currentSubtask?.title
					});
				} else {
					orchestrator.transition({
						type: 'GREEN_PHASE_COMPLETE',
						testResults
					});
					formatter.success('GREEN phase completed', {
						nextPhase: 'COMMIT',
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
