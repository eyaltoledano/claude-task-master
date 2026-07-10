/**
 * @fileoverview FindCommand using Commander's native class pattern
 * Keyword search across tasks and subtasks without consuming AI tokens
 */

import path from 'node:path';
import {
	SEARCHABLE_FIELDS,
	type SearchableField,
	type TaskSearchMatch,
	type TmCore,
	createTmCore
} from '@tm/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { getStatusWithColor } from '../ui/formatters/status-formatters.js';
import { displayCommandHeader } from '../utils/display-helpers.js';
import { displayError } from '../utils/error-handler.js';
import { getProjectRoot } from '../utils/project-root.js';

/**
 * Options interface for the find command
 */
export interface FindCommandOptions {
	tag?: string;
	fields?: string;
	format?: 'text' | 'json';
	silent?: boolean;
	project?: string;
}

/**
 * Result type from find command
 */
export interface FindTaskResult {
	query: string;
	matches: TaskSearchMatch[];
	total: number;
	tag?: string;
}

/**
 * FindCommand extending Commander's Command class
 * This is a thin presentation layer over @tm/core
 */
export class FindCommand extends Command {
	private tmCore?: TmCore;
	private lastResult?: FindTaskResult;

	constructor(name?: string) {
		super(name || 'find');

		// Configure the command
		this.description(
			'Search tasks and subtasks by keyword (title, description, details, test strategy)'
		)
			.argument('<query...>', 'Keyword(s) to search for')
			.option('-t, --tag <tag>', 'Filter by tag')
			.option(
				'--fields <fields>',
				`Comma-separated fields to search (${SEARCHABLE_FIELDS.join(', ')})`
			)
			.option('-f, --format <format>', 'Output format (text, json)', 'text')
			.option('--silent', 'Suppress output (useful for programmatic usage)')
			.option(
				'-p, --project <path>',
				'Project root directory (auto-detected if not provided)'
			)
			.action(async (queryParts: string[], options: FindCommandOptions) => {
				await this.executeCommand(queryParts.join(' '), options);
			});
	}

	/**
	 * Execute the find command
	 */
	private async executeCommand(
		query: string,
		options: FindCommandOptions
	): Promise<void> {
		let hasError = false;
		try {
			// Validate options (throws on invalid options)
			const fields = this.validateOptions(options);

			// Initialize tm-core
			await this.initializeCore(getProjectRoot(options.project));

			// Search tasks through core
			const result = await this.findTasks(query, fields, options);

			// Store result for programmatic access
			this.setLastResult(result);

			// Display results
			if (!options.silent) {
				this.displayResults(result, options);
			}
		} catch (error: any) {
			hasError = true;
			displayError(error, { skipExit: true });
		} finally {
			// Always clean up resources, even on error
			await this.cleanup();
		}

		// Exit after cleanup completes
		if (hasError) {
			process.exit(1);
		}
	}

	/**
	 * Validate command options and parse the fields filter
	 */
	private validateOptions(options: FindCommandOptions): SearchableField[] {
		if (options.format && !['text', 'json'].includes(options.format)) {
			throw new Error(
				`Invalid format: ${options.format}. Valid formats are: text, json`
			);
		}

		if (!options.fields) {
			return [];
		}

		const fields = options.fields
			.split(',')
			.map((field) => field.trim())
			.filter(Boolean);

		const invalidFields = fields.filter(
			(field) => !SEARCHABLE_FIELDS.includes(field as SearchableField)
		);
		if (invalidFields.length > 0) {
			throw new Error(
				`Invalid field(s): ${invalidFields.join(', ')}. Valid fields are: ${SEARCHABLE_FIELDS.join(', ')}`
			);
		}

		return fields as SearchableField[];
	}

	/**
	 * Initialize TmCore
	 */
	private async initializeCore(projectRoot: string): Promise<void> {
		if (!this.tmCore) {
			const resolved = path.resolve(projectRoot);
			this.tmCore = await createTmCore({ projectPath: resolved });
		}
	}

	/**
	 * Search tasks through tm-core
	 */
	private async findTasks(
		query: string,
		fields: SearchableField[],
		options: FindCommandOptions
	): Promise<FindTaskResult> {
		if (!this.tmCore) {
			throw new Error('TmCore not initialized');
		}

		const { matches, total, tag } = await this.tmCore.tasks.search(query, {
			tag: options.tag,
			...(fields.length > 0 && { fields })
		});

		return { query, matches, total, tag };
	}

	/**
	 * Display results based on format
	 */
	private displayResults(
		result: FindTaskResult,
		options: FindCommandOptions
	): void {
		const format = options.format || 'text';

		switch (format) {
			case 'json':
				this.displayJson(result);
				break;

			case 'text':
			default:
				this.displayText(result);
				break;
		}
	}

	/**
	 * Display in JSON format
	 */
	private displayJson(result: FindTaskResult): void {
		console.log(JSON.stringify(result, null, 2));
	}

	/**
	 * Display in text format
	 */
	private displayText(result: FindTaskResult): void {
		displayCommandHeader(this.tmCore, {
			tag: result.tag || 'master',
			storageType: this.tmCore?.tasks.getStorageType() ?? 'file'
		});

		if (result.matches.length === 0) {
			console.log(
				chalk.yellow(`No tasks matching "${result.query}" were found.`)
			);
			console.log(
				`\n${chalk.dim('Searched')} ${result.total} ${chalk.dim('task(s). Try a different keyword or')} ${chalk.cyan('--fields')} ${chalk.dim('to widen the search.')}`
			);
			return;
		}

		console.log(
			chalk.bold(
				`Found ${result.matches.length} task(s) matching "${result.query}":\n`
			)
		);

		for (const match of result.matches) {
			const { task } = match;
			const fieldsLabel =
				match.matchedFields.length > 0
					? chalk.dim(` (matched: ${match.matchedFields.join(', ')})`)
					: '';
			console.log(
				`${chalk.cyan(`#${task.id}`)} ${getStatusWithColor(task.status)} ${task.title}${fieldsLabel}`
			);

			for (const subtaskMatch of match.subtaskMatches) {
				const { subtask } = subtaskMatch;
				console.log(
					`  ${chalk.cyan(`#${task.id}.${subtask.id}`)} ${getStatusWithColor(subtask.status)} ${subtask.title}${chalk.dim(` (matched: ${subtaskMatch.matchedFields.join(', ')})`)}`
				);
			}
		}

		console.log(
			`\n${chalk.dim('Tip: Use')} ${chalk.cyan('task-master show <id>')} ${chalk.dim('to see full task details')}`
		);
	}

	/**
	 * Set the last result for programmatic access
	 */
	private setLastResult(result: FindTaskResult): void {
		this.lastResult = result;
	}

	/**
	 * Get the last result (for programmatic usage)
	 */
	getLastResult(): FindTaskResult | undefined {
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
	static register(program: Command, name?: string): FindCommand {
		const findCommand = new FindCommand(name);
		program.addCommand(findCommand);
		return findCommand;
	}
}
