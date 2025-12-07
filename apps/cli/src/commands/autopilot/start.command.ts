/**
 * @fileoverview Start Command - Initialize and start TDD workflow
 */

import { createTmCore, MainTaskIdSchema } from '@tm/core';
import { Command } from 'commander';
import { getProjectRoot } from '../../utils/project-root.js';
import { AutopilotBaseOptions, OutputFormatter } from './shared.js';

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

	private async execute(
		rawTaskId: string,
		options: StartOptions
	): Promise<void> {
		// Inherit parent options
		const parentOpts = this.parent?.opts() as AutopilotBaseOptions;
		const mergedOptions: StartOptions = {
			...parentOpts,
			...options,
			projectRoot: getProjectRoot(
				options.projectRoot || parentOpts?.projectRoot
			)
		};

		const formatter = new OutputFormatter(mergedOptions.json || false);

		try {
			// Validate and normalize task ID
			const parseResult = MainTaskIdSchema.safeParse(rawTaskId);
			if (!parseResult.success) {
				formatter.error('Invalid task ID format', {
					taskId: rawTaskId,
					error: parseResult.error.issues[0]?.message
				});
				process.exit(1);
			}
			const taskId = parseResult.data;

			const projectRoot = mergedOptions.projectRoot!;

			// Initialize TmCore facade
			const tmCore = await createTmCore({ projectPath: projectRoot });

			// Check for existing workflow state
			const hasState = await tmCore.workflow.hasWorkflow();
			if (hasState && !mergedOptions.force) {
				formatter.error(
					'Workflow state already exists. Use --force to overwrite or resume with "autopilot resume"'
				);
				process.exit(1);
			}

			// Get current tag from ConfigManager
			const currentTag = tmCore.config.getActiveTag();

			// Get org slug from auth context (for API storage mode)
			const authContext = tmCore.auth.getContext();
			const orgSlug = authContext?.orgSlug;

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

			// Parse max attempts
			const maxAttempts = parseInt(mergedOptions.maxAttempts || '3', 10);

			// Start workflow via tmCore facade (handles git, orchestrator, status updates internally)
			formatter.info('Starting TDD workflow...');
			const status = await tmCore.workflow.start({
				taskId,
				taskTitle: task.title,
				subtasks: task.subtasks.map((st: any) => ({
					id: st.id,
					title: st.title,
					status: st.status,
					maxAttempts
				})),
				maxAttempts,
				force: mergedOptions.force,
				tag: currentTag,
				orgSlug
			});

			// Output success
			formatter.success('TDD workflow started', {
				taskId: status.taskId,
				title: task.title,
				phase: status.phase,
				tddPhase: status.tddPhase,
				branchName: status.branchName,
				subtasks: task.subtasks.length,
				currentSubtask: status.currentSubtask?.title
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
