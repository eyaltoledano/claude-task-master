/**
 * @fileoverview Table display utilities
 * Provides table creation and formatting for tasks
 */

import type { Subtask, Task, TaskPriority } from '@tm/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getComplexityWithColor } from '../formatters/complexity-formatters.js';
import { getPriorityWithColor } from '../formatters/priority-formatters.js';
import { getStatusWithColor } from '../formatters/status-formatters.js';
import { getBoxWidth, truncate } from '../layout/helpers.js';

/**
 * Default priority for tasks/subtasks when not specified
 */
const DEFAULT_PRIORITY: TaskPriority = 'medium';

/**
 * Create a task table for display
 */
export function createTaskTable(
	tasks: (Task | Subtask)[],
	options?: {
		showSubtasks?: boolean;
		showComplexity?: boolean;
		showDependencies?: boolean;
	}
): string {
	const {
		showSubtasks = false,
		showComplexity = false,
		showDependencies = true
	} = options || {};

	// Calculate dynamic column widths based on terminal width
	const tableWidth = getBoxWidth(0.9, 100);
	// Adjust column widths to better match the original layout
	const baseColWidths = showComplexity
		? [
				Math.floor(tableWidth * 0.1),
				Math.floor(tableWidth * 0.4),
				Math.floor(tableWidth * 0.15),
				Math.floor(tableWidth * 0.1),
				Math.floor(tableWidth * 0.2),
				Math.floor(tableWidth * 0.1)
			] // ID, Title, Status, Priority, Dependencies, Complexity
		: [
				Math.floor(tableWidth * 0.08),
				Math.floor(tableWidth * 0.4),
				Math.floor(tableWidth * 0.18),
				Math.floor(tableWidth * 0.12),
				Math.floor(tableWidth * 0.2)
			]; // ID, Title, Status, Priority, Dependencies

	const headers = [
		chalk.blue.bold('ID'),
		chalk.blue.bold('Title'),
		chalk.blue.bold('Status'),
		chalk.blue.bold('Priority')
	];
	const colWidths = baseColWidths.slice(0, 4);

	if (showDependencies) {
		headers.push(chalk.blue.bold('Dependencies'));
		colWidths.push(baseColWidths[4]);
	}

	if (showComplexity) {
		headers.push(chalk.blue.bold('Complexity'));
		colWidths.push(baseColWidths[5] || 12);
	}

	const table = new Table({
		head: headers,
		style: { head: [], border: [] },
		colWidths,
		wordWrap: true
	});

	tasks.forEach((task) => {
		const row: string[] = [
			chalk.cyan(task.id.toString()),
			truncate(task.title, colWidths[1] - 3),
			getStatusWithColor(task.status, true), // Use table version
			getPriorityWithColor(task.priority)
		];

		if (showDependencies) {
			// For table display, show simple format without status icons
			if (!task.dependencies || task.dependencies.length === 0) {
				row.push(chalk.gray('None'));
			} else {
				row.push(
					chalk.cyan(task.dependencies.map((d) => String(d)).join(', '))
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
				const subRow: string[] = [
					chalk.gray(` └─ ${subtask.id}`),
					chalk.gray(truncate(subtask.title, colWidths[1] - 6)),
					chalk.gray(getStatusWithColor(subtask.status, true)),
					chalk.gray(subtask.priority || DEFAULT_PRIORITY)
				];

				if (showDependencies) {
					subRow.push(
						chalk.gray(
							subtask.dependencies && subtask.dependencies.length > 0
								? subtask.dependencies.map((dep) => String(dep)).join(', ')
								: 'None'
						)
					);
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
