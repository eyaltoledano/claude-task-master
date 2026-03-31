/**
 * @fileoverview SearchCommand using Commander's native class pattern
 * Extends Commander.Command for better integration with the framework
 *
 * Implements issue #1453 — search/find tasks across title, description,
 * details, testStrategy, and subtask titles/descriptions.
 */

import {
	STATUS_ICONS,
	TASK_STATUSES,
	createTmCore,
	type Task,
	type TaskStatus,
	type TmCore
} from '@tm/core';
import type { StorageType, Subtask } from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';
import * as ui from '../utils/ui.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options interface for the search command
 */
export interface SearchCommandOptions {
	status?: string;
	tag?: string;
	includeSubtasks?: boolean;
	format?: 'text' | 'json' | 'compact';
	json?: boolean;
	compact?: boolean;
	project?: string;
	silent?: boolean;
}

/**
 * A task match — the parent task plus optional matching subtasks
 */
export interface TaskMatch {
	task: Task;
	/** Subtasks that matched the query (populated when --include-subtasks is given) */
	matchingSubtasks: Subtask[];
}

/**
 * Result type from the search command
 */
export interface SearchTasksResult {
	query: string;
	matches: TaskMatch[];
	totalTasks: number;
	tag?: string;
	storageType: Exclude<StorageType, 'auto'>;
}

// ---------------------------------------------------------------------------
// Helper — case-insensitive substring search
// ---------------------------------------------------------------------------

function matchesQuery(text: string | undefined | null, query: string): boolean {
	if (!text) return false;
	return text.toLowerCase().includes(query);
}

/**
 * Return true if a task matches the query on any of the searched fields.
 * Searched fields: title, description, details, testStrategy
 */
function taskMatchesQuery(task: Task, queryLower: string): boolean {
	return (
		matchesQuery(task.title, queryLower) ||
		matchesQuery(task.description, queryLower) ||
		matchesQuery(task.details, queryLower) ||
		matchesQuery(task.testStrategy, queryLower)
	);
}

/**
 * Return true if a subtask matches the query on title or description.
 */
function subtaskMatchesQuery(subtask: Subtask, queryLower: string): boolean {
	return (
		matchesQuery(subtask.title, queryLower) ||
		matchesQuery(subtask.description, queryLower) ||
		matchesQuery(subtask.details, queryLower) ||
		matchesQuery(subtask.testStrategy, queryLower)
	);
}

// ---------------------------------------------------------------------------
// Command class
// ---------------------------------------------------------------------------

/**
 * SearchCommand extending Commander's Command class.
 * This is a thin presentation layer over @tm/core.
 */
export class SearchCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: SearchTasksResult;

	constructor(name?: string) {
		super(name || 'search');

		this.description('Search tasks by keyword across title, description, details, and test strategy')
			.alias('find')
			.argument('<query>', 'Search query (case-insensitive substring match)')
			.option(
				'-s, --status <status>',
				'Filter results by status (e.g., pending, done, in-progress)'
			)
			.option('-t, --tag <tag>', 'Tag context to search in')
			.option(
				'--include-subtasks',
				'Also search and display matching subtasks'
			)
			.option(
				'-f, --format <format>',
				'Output format (text, json, compact)',
				'text'
			)
			.option('--json', 'Output in JSON format (shorthand for --format json)')
			.option(
				'-c, --compact',
				'Output in compact format (shorthand for --format compact)'
			)
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (query: string, options: SearchCommandOptions) => {
				await this.executeCommand(query, options);
			});
	}

	// -------------------------------------------------------------------------
	// Execution
	// -------------------------------------------------------------------------

	private async executeCommand(
		query: string,
		options: SearchCommandOptions
	): Promise<void> {
		try {
			if (!this.validateOptions(options)) {
				process.exit(1);
			}

			await this.initializeCore(getProjectRoot(options.project));

			const result = await this.searchTasks(query, options);

			this.lastResult = result;

			if (!options.silent) {
				this.displayResults(result, options);
			}
		} catch (error: any) {
			displayError(error);
		}
	}

	// -------------------------------------------------------------------------
	// Validation
	// -------------------------------------------------------------------------

	private validateOptions(options: SearchCommandOptions): boolean {
		const validFormats = ['text', 'json', 'compact'];
		if (options.format && !validFormats.includes(options.format)) {
			console.error(chalk.red(`Invalid format: ${options.format}`));
			console.error(chalk.gray(`Valid formats: ${validFormats.join(', ')}`));
			return false;
		}

		if (options.status) {
			const statuses = options.status.split(',').map((s) => s.trim());
			for (const status of statuses) {
				if (!TASK_STATUSES.includes(status as TaskStatus)) {
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

	// -------------------------------------------------------------------------
	// Core initialisation
	// -------------------------------------------------------------------------

	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			this.tmCore = await createTmCore({ projectPath: projectRoot });
		}
	}

	// -------------------------------------------------------------------------
	// Search logic
	// -------------------------------------------------------------------------

	private async searchTasks(
		query: string,
		options: SearchCommandOptions
	): Promise<SearchTasksResult> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}

		const queryLower = query.toLowerCase();

		// Parse optional status filter
		const statusFilter =
			options.status
				? options.status.split(',').map((s) => s.trim() as TaskStatus)
				: undefined;

		// Fetch all tasks (with subtasks so we can search them)
		const listResult = await this.tmCore.tasks.list({
			tag: options.tag,
			includeSubtasks: true
		});

		const matches: TaskMatch[] = [];

		for (const task of listResult.tasks) {
			// Apply status filter if specified
			if (statusFilter && !statusFilter.includes(task.status)) {
				continue;
			}

			const taskMatches = taskMatchesQuery(task, queryLower);

			// Check subtasks
			const matchingSubtasks: Subtask[] = options.includeSubtasks
				? (task.subtasks || []).filter((st) =>
						subtaskMatchesQuery(st, queryLower)
					)
				: [];

			// Include the task if the task itself matches, or if any subtask matched
			// (when --include-subtasks is set)
			if (taskMatches || matchingSubtasks.length > 0) {
				matches.push({ task, matchingSubtasks });
			}
		}

		return {
			query,
			matches,
			totalTasks: listResult.total,
			tag: listResult.tag,
			storageType: listResult.storageType as Exclude<StorageType, 'auto'>
		};
	}

	// -------------------------------------------------------------------------
	// Display
	// -------------------------------------------------------------------------

	private displayResults(
		result: SearchTasksResult,
		options: SearchCommandOptions
	): void {
		// Resolve format
		let format: 'text' | 'json' | 'compact' = options.format || 'text';
		if (options.json) format = 'json';
		else if (options.compact) format = 'compact';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;
			case 'compact':
				this.displayCompact(result, options);
				break;
			case 'text':
			default:
				this.displayText(result, options);
				break;
		}
	}

	private displayJson(result: SearchTasksResult): void {
		console.log(
			JSON.stringify(
				{
					query: result.query,
					matches: result.matches,
					metadata: {
						totalTasksSearched: result.totalTasks,
						matchCount: result.matches.length,
						tag: result.tag,
						storageType: result.storageType
					}
				},
				null,
				2
			)
		);
	}

	private displayCompact(
		result: SearchTasksResult,
		options: SearchCommandOptions
	): void {
		displayCommandHeader(this.tmCore, {
			tag: result.tag || 'master',
			storageType: result.storageType
		});

		if (result.matches.length === 0) {
			console.log(chalk.yellow(`No tasks found matching "${result.query}"`));
			return;
		}

		for (const { task, matchingSubtasks } of result.matches) {
			const icon = STATUS_ICONS[task.status];
			console.log(`${chalk.cyan(task.id)} ${icon} ${task.title}`);

			if (options.includeSubtasks && matchingSubtasks.length > 0) {
				for (const subtask of matchingSubtasks) {
					const subIcon = STATUS_ICONS[subtask.status];
					console.log(
						`  ${chalk.gray(String(subtask.id))} ${subIcon} ${chalk.gray(subtask.title)}`
					);
				}
			}
		}
	}

	private displayText(
		result: SearchTasksResult,
		options: SearchCommandOptions
	): void {
		displayCommandHeader(this.tmCore, {
			tag: result.tag || 'master',
			storageType: result.storageType
		});

		console.log(
			chalk.blue.bold(
				`\nSearch results for "${chalk.white(result.query)}":`
			)
		);

		if (result.matches.length === 0) {
			ui.displayWarning(
				`No tasks found matching "${result.query}". Try a different keyword or broaden your search.`
			);
			return;
		}

		console.log(
			chalk.gray(
				`Found ${result.matches.length} matching task(s) out of ${result.totalTasks} total.\n`
			)
		);

		// Build a flat list of tasks (with subtasks collapsed under the parent) for the table
		const tasksForTable = result.matches.map(({ task }) => task);

		console.log(
			ui.createTaskTable(tasksForTable, {
				showSubtasks: options.includeSubtasks,
				showDependencies: true
			})
		);

		// If --include-subtasks, summarise which subtasks matched
		if (options.includeSubtasks) {
			const subtaskMatches = result.matches.filter(
				({ matchingSubtasks }) => matchingSubtasks.length > 0
			);

			if (subtaskMatches.length > 0) {
				console.log(chalk.blue.bold('\nMatching subtasks:\n'));
				for (const { task, matchingSubtasks } of subtaskMatches) {
					for (const subtask of matchingSubtasks) {
						const icon = STATUS_ICONS[subtask.status];
						console.log(
							`  ${chalk.cyan(`${task.id}.${subtask.id}`)} ${icon} ${subtask.title}`
						);
					}
				}
				console.log();
			}
		}

		// Hint
		console.log(
			chalk.gray(
				`Tip: Use ${chalk.white('task-master show <id>')} to view full task details.`
			)
		);
	}

	// -------------------------------------------------------------------------
	// Programmatic API
	// -------------------------------------------------------------------------

	getLastResult(): SearchTasksResult | undefined {
		return this.lastResult;
	}

	async cleanup(): Promise<void> {
		if (this.tmCore) {
			this.tmCore = undefined;
		}
	}

	/**
	 * Register this command on an existing program
	 */
	static register(program: Command, name?: string): SearchCommand {
		const searchCommand = new SearchCommand(name);
		program.addCommand(searchCommand);
		return searchCommand;
	}
}
