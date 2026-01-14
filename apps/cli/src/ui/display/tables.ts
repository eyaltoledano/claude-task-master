/**
 * @fileoverview Table display utilities
 * Provides table creation and formatting for tasks
 */

import type { Subtask, Task, TaskPriority } from '@tm/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { isTaskComplete } from '../../utils/task-status.js';
import { getComplexityWithColor } from '../formatters/complexity-formatters.js';
import { getPriorityWithColor } from '../formatters/priority-formatters.js';
import { getStatusWithColor } from '../formatters/status-formatters.js';
import { getBoxWidth, truncate } from '../layout/helpers.js';

/**
 * Default priority for tasks/subtasks when not specified
 */
const DEFAULT_PRIORITY: TaskPriority = 'medium';

/**
 * Task-like object that can optionally have blocks field and tag name
 * Used for table display - accepts both enriched TaskWithBlocks and regular Task/Subtask
 */
export type TaskTableItem = (Task | Subtask) & {
	blocks?: string[];
	tagName?: string;
};

/**
 * Column width ratios indexed by number of optional columns
 * Each array contains ratios for: [Tag?, ID, Title, Status, Priority, Dependencies?, Blocks?, Complexity?]
 */
const COLUMN_WIDTH_RATIOS: Record<number, number[]> = {
	0: [0.1, 0.5, 0.2, 0.2],
	1: [0.08, 0.4, 0.18, 0.14, 0.2],
	2: [0.08, 0.35, 0.14, 0.11, 0.16, 0.16],
	3: [0.07, 0.3, 0.12, 0.1, 0.14, 0.14, 0.1],
	4: [0.12, 0.06, 0.2, 0.1, 0.1, 0.12, 0.12, 0.1]
};

/**
 * Create a task table for display
 */
export function createTaskTable(
	tasks: TaskTableItem[],
	options?: {
		showSubtasks?: boolean;
		showComplexity?: boolean;
		showDependencies?: boolean;
		showBlocks?: boolean;
		showTag?: boolean;
	}
): string {
	const {
		showSubtasks = false,
		showComplexity = false,
		showDependencies = true,
		showBlocks = false,
		showTag = false
	} = options || {};

	// Calculate dynamic column widths based on terminal width
	const tableWidth = getBoxWidth(0.9, 100);

	// Count optional columns and get corresponding width ratios
	const optionalCols =
		(showTag ? 1 : 0) +
		(showDependencies ? 1 : 0) +
		(showBlocks ? 1 : 0) +
		(showComplexity ? 1 : 0);

	const ratios = COLUMN_WIDTH_RATIOS[optionalCols] || COLUMN_WIDTH_RATIOS[4];
	const baseColWidths = ratios.map((ratio) => Math.floor(tableWidth * ratio));

	// Build headers and column widths dynamically
	const headers: string[] = [];
	const colWidths: number[] = [];
	let colIndex = 0;

	if (showTag) {
		headers.push(chalk.blue.bold('Tag'));
		colWidths.push(baseColWidths[colIndex++]);
	}

	// Core columns: ID, Title, Status, Priority
	headers.push(
		chalk.blue.bold('ID'),
		chalk.blue.bold('Title'),
		chalk.blue.bold('Status'),
		chalk.blue.bold('Priority')
	);
	colWidths.push(...baseColWidths.slice(colIndex, colIndex + 4));
	colIndex += 4;

	if (showDependencies) {
		headers.push(chalk.blue.bold('Dependencies'));
		colWidths.push(baseColWidths[colIndex++]);
	}

	if (showBlocks) {
		headers.push(chalk.blue.bold('Blocks'));
		colWidths.push(baseColWidths[colIndex++]);
	}

	if (showComplexity) {
		headers.push(chalk.blue.bold('Complexity'));
		colWidths.push(baseColWidths[colIndex] || 12);
	}

	const table = new Table({
		head: headers,
		style: { head: [], border: [] },
		colWidths,
		wordWrap: true
	});

	tasks.forEach((task) => {
		const row: string[] = [];

		// Tag goes first when showing all tags
		if (showTag) {
			row.push(chalk.magenta(task.tagName || '-'));
		}

		// Core columns: ID, Title, Status, Priority
		// Title column index depends on whether tag is shown
		const titleColIndex = showTag ? 2 : 1;
		row.push(
			chalk.cyan(task.id.toString()),
			truncate(task.title, colWidths[titleColIndex] - 3),
			getStatusWithColor(task.status, true), // Use table version
			getPriorityWithColor(task.priority)
		);

		if (showDependencies) {
			// For table display, show simple format without status icons
			if (!task.dependencies || task.dependencies.length === 0) {
				row.push(chalk.gray('-'));
			} else {
				row.push(
					chalk.cyan(task.dependencies.map((d) => String(d)).join(', '))
				);
			}
		}

		if (showBlocks) {
			// Show tasks that depend on this one
			if (!task.blocks || task.blocks.length === 0) {
				row.push(chalk.gray('-'));
			} else {
				// Gray out blocks for completed tasks (no longer blocking)
				const blocksText = task.blocks.join(', ');
				row.push(
					isTaskComplete(task.status)
						? chalk.gray(blocksText)
						: chalk.yellow(blocksText)
				);
			}
		}

		if (showComplexity) {
			// Show complexity score from report if available
			if (typeof task.complexity === 'number') {
				row.push(getComplexityWithColor(task.complexity));
			} else {
				row.push(chalk.gray('N/A'));
			}
		}

		table.push(row);

		// Add subtasks if requested
		if (showSubtasks && task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				const subRow: string[] = [];

				// Tag goes first when showing all tags
				if (showTag) {
					// Subtasks inherit parent's tag, just show dash
					subRow.push(chalk.gray('-'));
				}

				// Core subtask columns: ID, Title, Status, Priority
				const subTitleColIndex = showTag ? 2 : 1;
				subRow.push(
					chalk.gray(` └─ ${subtask.id}`),
					chalk.gray(truncate(subtask.title, colWidths[subTitleColIndex] - 6)),
					chalk.gray(getStatusWithColor(subtask.status, true)),
					chalk.gray(subtask.priority || DEFAULT_PRIORITY)
				);

				if (showDependencies) {
					subRow.push(
						chalk.gray(
							subtask.dependencies && subtask.dependencies.length > 0
								? subtask.dependencies.map((dep) => String(dep)).join(', ')
								: '-'
						)
					);
				}

				if (showBlocks) {
					// Subtasks don't typically have blocks, show dash
					subRow.push(chalk.gray('-'));
				}

				if (showComplexity) {
					const complexityDisplay =
						typeof subtask.complexity === 'number'
							? getComplexityWithColor(subtask.complexity)
							: '--';
					subRow.push(chalk.gray(complexityDisplay));
				}

				table.push(subRow);
			});
		}
	});

	return table.toString();
}
