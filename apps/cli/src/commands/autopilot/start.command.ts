/**
 * @fileoverview Start Command - Initialize and start TDD workflow
 */

import { Command } from 'commander';
import { createTmCore, type WorkflowContext } from '@tm/core';
import {
	AutopilotBaseOptions,
	hasWorkflowState,
	createOrchestrator,
	createGitAdapter,
	OutputFormatter,
	validateTaskId,
	parseSubtasks
} from './shared.js';

interface StartOptions extends AutopilotBaseOptions {
	force?: boolean;
	maxAttempts?: string;
}

/**
 * Start Command - Initialize new TDD workflow
 */
export class StartCommand extends Command {
	constructor() {
		super('start');

		this.description('Initialize and start a new TDD workflow for a task')
			.argument('<taskId>', 'Task ID to start workflow for')
			.option('-f, --force', 'Force start even if workflow state exists')
			.option('--max-attempts <number>', 'Maximum attempts per subtask', '3')
			.action(async (taskId: string, options: StartOptions) => {
				await this.execute(taskId, options);
			});
	}

	private async execute(taskId: string, options: StartOptions): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: StartOptions = {
			...parentOpts,
			...options,
			projectRoot:
				options.projectRoot || parentOpts?.projectRoot || process.cwd()
		};

		const formatter = new OutputFormatter(mergedOptions.json || false);

		try {
			// Validate task ID
			if (!validateTaskId(taskId)) {
				formatter.error('Invalid task ID format', {
					taskId,
					expected: 'Format: number or number.number (e.g., "1" or "1.2")'
				});
				process.exit(1);
			}

			// Check for existing workflow state
			const hasState = await hasWorkflowState(mergedOptions.projectRoot!);
			if (hasState && !mergedOptions.force) {
				formatter.error(
					'Workflow state already exists. Use --force to overwrite or resume with "autopilot resume"'
				);
				process.exit(1);
			}

			// Initialize Task Master Core
			const tmCore = await createTmCore({
				projectPath: mergedOptions.projectRoot!
			});

			// Get current tag from ConfigManager
			const currentTag = tmCore.config.getActiveTag();

			// Load task
			formatter.info(`Loading task ${taskId}...`);
			const { task } = await tmCore.tasks.get(taskId);

			if (!task) {
				formatter.error('Task not found', { taskId });
				process.exit(1);
			}

			// Validate task has subtasks
			if (!task.subtasks || task.subtasks.length === 0) {
				formatter.error('Task has no subtasks. Expand task first.', {
					taskId,
					suggestion: `Run: task-master expand --id=${taskId}`
				});
				process.exit(1);
			}

			// Initialize Git adapter
			const gitAdapter = createGitAdapter(mergedOptions.projectRoot!);
			await gitAdapter.ensureGitRepository();
			await gitAdapter.ensureCleanWorkingTree();

			// Parse subtasks
			const maxAttempts = parseInt(mergedOptions.maxAttempts || '3', 10);
			const subtasks = parseSubtasks(task, maxAttempts);

			// Create workflow context
			const context: WorkflowContext = {
				taskId: task.id,
				subtasks,
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {
					startedAt: new Date().toISOString(),
					tags: task.tags || []
				}
			};

			// Create orchestrator with persistence
			const orchestrator = createOrchestrator(
				context,
				mergedOptions.projectRoot!
			);

			// Complete PREFLIGHT phase
			orchestrator.transition({ type: 'PREFLIGHT_COMPLETE' });

			// Generate descriptive branch name
			const sanitizedTitle = task.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 50);
			const formattedTaskId = taskId.replace(/\./g, '-');
			const tagPrefix = currentTag ? `${currentTag}/` : '';
			const branchName = `${tagPrefix}task-${formattedTaskId}-${sanitizedTitle}`;

			// Create and checkout branch
			formatter.info(`Creating branch: ${branchName}`);
			await gitAdapter.createAndCheckoutBranch(branchName);

			// Transition to SUBTASK_LOOP
			orchestrator.transition({
				type: 'BRANCH_CREATED',
				branchName
			});

			// Output success
			formatter.success('TDD workflow started', {
				taskId: task.id,
				title: task.title,
				phase: orchestrator.getCurrentPhase(),
				tddPhase: orchestrator.getCurrentTDDPhase(),
				branchName,
				subtasks: subtasks.length,
				currentSubtask: subtasks[0]?.title
			});

			// Clean up
		} catch (error) {
			formatter.error((error as Error).message);
			if (mergedOptions.verbose) {
				console.error((error as Error).stack);
			}
			process.exit(1);
		}
	}
}
