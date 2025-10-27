/**
 * @fileoverview ListTasks command using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
	createTmCore,
	type Task,
	type TaskStatus,
	type TmCore,
	TASK_STATUSES,
	OUTPUT_FORMATS,
	STATUS_ICONS,
	type OutputFormat
} from '@tm/core';
import type { StorageType } from '@tm/core';
import * as ui from '../utils/ui.js';
import { displayError } from '../utils/error-handler.js';
import { displayCommandHeader } from '../utils/display-helpers.js';
import {
	displayDashboards,
	calculateTaskStatistics,
	calculateSubtaskStatistics,
	calculateDependencyStatistics,
	getPriorityBreakdown,
	displayRecommendedNextTask,
	getTaskDescription,
	displaySuggestedNextSteps,
	type NextTaskInfo
} from '../ui/index.js';

/**
 * Options interface for the list command
 */
export interface ListCommandOptions {
	status?: string;
	tag?: string;
	withSubtasks?: boolean;
	format?: OutputFormat;
	silent?: boolean;
	project?: string;
}

/**
 * Result type from list command
 */
export interface ListTasksResult {
	tasks: Task[];
	total: number;
	filtered: number;
	tag?: string;
	storageType: Exclude<StorageType, 'auto'>;
}

/**
 * ListTasksCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class ListTasksCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: ListTasksResult;

	constructor(name?: string) {
		super(name || 'list');

		// Configure the command
		this.description('List tasks with optional filtering')
			.alias('ls')
			.option('-s, --status <status>', 'Filter by status (comma-separated)')
			.option('-t, --tag <tag>', 'Filter by tag')
			.option('--with-subtasks', 'Include subtasks in the output')
			.option(
				'-f, --format <format>',
				'Output format (text, json, compact)',
				'text'
			)
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option('-p, --project <path>', 'Project root directory', process.cwd())
			.action(async (options: ListCommandOptions) => {
				await this.executeCommand(options);
			});
	}

	/**
	 * Execute the list command
	 */
	private async executeCommand(options: ListCommandOptions): Promise<void> {
		try {
			// Validate options
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			// Initialize tm-core
			await this.initializeCore(options.project || process.cwd());

			// Get tasks from core
			const result = await this.getTasks(options);

			// Store result for programmatic access
			this.setLastResult(result);

			// Display results
			if (!options.silent) {
				this.displayResults(result, options);
			}
		} catch (error: any) {
			displayError(error);
		}
	}

	/**
	 * Validate command options
	 */
	private validateOptions(options: ListCommandOptions): boolean {
		// Validate format
		if (
			options.format &&
			!OUTPUT_FORMATS.includes(options.format as OutputFormat)
		) {
			console.error(chalk.red(`Invalid format: ${options.format}`));
			console.error(chalk.gray(`Valid formats: ${OUTPUT_FORMATS.join(', ')}`));
			return false;
		}

		// Validate status
		if (options.status) {
			const statuses = options.status.split(',').map((s: string) => s.trim());

			for (const status of statuses) {
				if (status !== 'all' && !TASK_STATUSES.includes(status as TaskStatus)) {
					console.error(chalk.red(`Invalid status: ${status}`));
					console.error(
						chalk.gray(`Valid statuses: ${TASK_STATUSES.join(', ')}`)
					);
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Initialize TmCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({ projectPath: projectRoot });
		}
	}

	/**
	 * Get tasks from tm-core
	 */
	private async getTasks(
		options: ListCommandOptions
	): Promise<ListTasksResult> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}

		// Build filter
		const filter =
			options.status && options.status !== 'all'
				? {
						status: options.status
							.split(',')
							.map((s: string) => s.trim() as TaskStatus)
					}
				: undefined;

		// Call tm-core
		const result = await this.tmCore.tasks.list({
			tag: options.tag,
			filter,
			includeSubtasks: options.withSubtasks
		});

		return result as ListTasksResult;
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: ListTasksResult,
		options: ListCommandOptions
	): void {
		const format = (options.format || 'text') as OutputFormat | 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'compact':
				this.displayCompact(result.tasks, options.withSubtasks);
				break;

			case 'text':
			default:
				this.displayText(result, options.withSubtasks);
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(data: ListTasksResult): void {
		console.log(
			JSON.stringify(
				{
					tasks: data.tasks,
					metadata: {
						total: data.total,
						filtered: data.filtered,
						tag: data.tag,
						storageType: data.storageType
					}
				},
				null,
				2
			)
		);
	}

	/**
	 * Display in compact format
	 */
	private displayCompact(tasks: Task[], withSubtasks?: boolean): void {
		tasks.forEach((task) => {
			const icon = STATUS_ICONS[task.status];
			console.log(`${chalk.cyan(task.id)} ${icon} ${task.title}`);

			if (withSubtasks && task.subtasks?.length) {
				task.subtasks.forEach((subtask) => {
					const subIcon = STATUS_ICONS[subtask.status];
					console.log(
						`  ${chalk.gray(String(subtask.id))} ${subIcon} ${chalk.gray(subtask.title)}`
					);
				});
			}
		});
	}

	/**
	 * Display in text format with tables
	 */
	private displayText(data: ListTasksResult, withSubtasks?: boolean): void {
		const { tasks, tag, storageType } = data;

		// Display header using utility function
		displayCommandHeader(this.tmCore, {
			tag: tag || 'master',
			storageType
		});

		// No tasks message
		if (tasks.length === 0) {
			ui.displayWarning('No tasks found matching the criteria.');
			return;
		}

		// Calculate statistics
		const taskStats = calculateTaskStatistics(tasks);
		const subtaskStats = calculateSubtaskStatistics(tasks);
		const depStats = calculateDependencyStatistics(tasks);
		const priorityBreakdown = getPriorityBreakdown(tasks);

		// Find next task following the same logic as findNextTask
		const nextTaskInfo = this.findNextTask(tasks);

		// Get the full task object with complexity data already included
		const nextTask = nextTaskInfo
			? tasks.find((t) => String(t.id) === String(nextTaskInfo.id))
			: undefined;

		// Display dashboard boxes (nextTask already has complexity from storage enrichment)
		displayDashboards(
			taskStats,
			subtaskStats,
			priorityBreakdown,
			depStats,
			nextTask
		);

		// Task table
		console.log(
			ui.createTaskTable(tasks, {
				showSubtasks: withSubtasks,
				showDependencies: true,
				showComplexity: true // Enable complexity column
			})
		);

		// Display recommended next task section immediately after table
		if (nextTask) {
			const description = getTaskDescription(nextTask);

			displayRecommendedNextTask({
				id: nextTask.id,
				title: nextTask.title,
				priority: nextTask.priority,
				status: nextTask.status,
				dependencies: nextTask.dependencies,
				description,
				complexity: nextTask.complexity as number | undefined
			});
		} else {
			displayRecommendedNextTask(undefined);
		}

		// Display suggested next steps at the end
		displaySuggestedNextSteps();
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: ListTasksResult): void {
		this.lastResult = result;
	}

	/**
	 * Find the next task to work on
	 * Implements the same logic as scripts/modules/task-manager/find-next-task.js
	 */
	private findNextTask(tasks: Task[]): NextTaskInfo | undefined {
		const priorityValues: Record<string, number> = {
			critical: 4,
			high: 3,
			medium: 2,
			low: 1
		};

		// Build set of completed task IDs (including subtasks)
		const completedIds = new Set<string>();
		tasks.forEach((t) => {
			if (t.status === 'done' || t.status === 'completed') {
				completedIds.add(String(t.id));
			}
			if (t.subtasks) {
				t.subtasks.forEach((st) => {
					if (st.status === 'done' || st.status === 'completed') {
						completedIds.add(`${t.id}.${st.id}`);
					}
				});
			}
		});

		// First, look for eligible subtasks in in-progress parent tasks
		const candidateSubtasks: NextTaskInfo[] = [];

		tasks
			.filter(
				(t) => t.status === 'in-progress' && t.subtasks && t.subtasks.length > 0
			)
			.forEach((parent) => {
				parent.subtasks!.forEach((st) => {
					const stStatus = (st.status || 'pending').toLowerCase();
					if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

					// Check if dependencies are satisfied
					const fullDeps =
						st.dependencies?.map((d) => {
							// Handle both numeric and string IDs
							if (typeof d === 'string' && d.includes('.')) {
								return d;
							}
							return `${parent.id}.${d}`;
						}) ?? [];

					const depsSatisfied =
						fullDeps.length === 0 ||
						fullDeps.every((depId) => completedIds.has(String(depId)));

					if (depsSatisfied) {
						candidateSubtasks.push({
							id: `${parent.id}.${st.id}`,
							title: st.title || `Subtask ${st.id}`,
							priority: st.priority || parent.priority || 'medium',
							dependencies: fullDeps.map((d) => String(d))
						});
					}
				});
			});

		if (candidateSubtasks.length > 0) {
			// Sort by priority, then by dependencies count, then by ID
			candidateSubtasks.sort((a, b) => {
				const pa = priorityValues[a.priority || 'medium'] ?? 2;
				const pb = priorityValues[b.priority || 'medium'] ?? 2;
				if (pb !== pa) return pb - pa;

				const depCountA = a.dependencies?.length || 0;
				const depCountB = b.dependencies?.length || 0;
				if (depCountA !== depCountB) return depCountA - depCountB;

				return String(a.id).localeCompare(String(b.id));
			});
			return candidateSubtasks[0];
		}

		// Fall back to finding eligible top-level tasks
		const eligibleTasks = tasks.filter((task) => {
			// Skip non-eligible statuses
			const status = (task.status || 'pending').toLowerCase();
			if (status !== 'pending' && status !== 'in-progress') return false;

			// Check dependencies
			const deps = task.dependencies || [];
			const depsSatisfied =
				deps.length === 0 ||
				deps.every((depId) => completedIds.has(String(depId)));

			return depsSatisfied;
		});

		if (eligibleTasks.length === 0) return undefined;

		// Sort eligible tasks
		eligibleTasks.sort((a, b) => {
			// Priority (higher first)
			const pa = priorityValues[a.priority || 'medium'] ?? 2;
			const pb = priorityValues[b.priority || 'medium'] ?? 2;
			if (pb !== pa) return pb - pa;

			// Dependencies count (fewer first)
			const depCountA = a.dependencies?.length || 0;
			const depCountB = b.dependencies?.length || 0;
			if (depCountA !== depCountB) return depCountA - depCountB;

			// ID (lower first)
			return Number(a.id) - Number(b.id);
		});

		const nextTask = eligibleTasks[0];
		return {
			id: nextTask.id,
			title: nextTask.title,
			priority: nextTask.priority,
			dependencies: nextTask.dependencies?.map((d) => String(d))
		};
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): ListTasksResult | undefined {
		return this.lastResult;
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		if (this.tmCore) {
			this.tmCore = undefined;
		}
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): ListTasksCommand {
		const listCommand = new ListTasksCommand(name);
		program.addCommand(listCommand);
		return listCommand;
	}
}
