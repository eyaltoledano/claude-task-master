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
 * Task with blocks field (inverse of dependencies)
 */
export type TaskWithBlocks = (Task | Subtask) & { blocks?: string[] };

/**
 * Create a task table for display
 */
export function createTaskTable(
	tasks: TaskWithBlocks[],
	options?: {
		showSubtasks?: boolean;
		showComplexity?: boolean;
		showDependencies?: boolean;
		showBlocks?: boolean;
	}
): string {
	const {
		showSubtasks = false,
		showComplexity = false,
		showDependencies = true,
		showBlocks = false
	} = options || {};

	// Calculate dynamic column widths based on terminal width
	const tableWidth = getBoxWidth(0.9, 100);

	// Calculate number of optional columns
	const optionalCols =
		(showDependencies ? 1 : 0) + (showBlocks ? 1 : 0) + (showComplexity ? 1 : 0);

	// Base widths: ID, Title, Status, Priority (then optional: Dependencies, Blocks, Complexity)
	let baseColWidths: number[];
	if (optionalCols === 0) {
		baseColWidths = [
			Math.floor(tableWidth * 0.1),
			Math.floor(tableWidth * 0.5),
			Math.floor(tableWidth * 0.2),
			Math.floor(tableWidth * 0.2)
		];
	} else if (optionalCols === 1) {
		baseColWidths = [
			Math.floor(tableWidth * 0.08),
			Math.floor(tableWidth * 0.4),
			Math.floor(tableWidth * 0.18),
			Math.floor(tableWidth * 0.14),
			Math.floor(tableWidth * 0.2)
		];
	} else if (optionalCols === 2) {
		baseColWidths = [
			Math.floor(tableWidth * 0.08),
			Math.floor(tableWidth * 0.35),
			Math.floor(tableWidth * 0.14),
			Math.floor(tableWidth * 0.11),
			Math.floor(tableWidth * 0.16),
			Math.floor(tableWidth * 0.16)
		];
	} else {
		// All 3 optional columns
		baseColWidths = [
			Math.floor(tableWidth * 0.07),
			Math.floor(tableWidth * 0.3),
			Math.floor(tableWidth * 0.12),
			Math.floor(tableWidth * 0.1),
			Math.floor(tableWidth * 0.14),
			Math.floor(tableWidth * 0.14),
			Math.floor(tableWidth * 0.1)
		];
	}

	const headers = [
		chalk.blue.bold('ID'),
		chalk.blue.bold('Title'),
		chalk.blue.bold('Status'),
		chalk.blue.bold('Priority')
	];
	const colWidths = baseColWidths.slice(0, 4);
	let colIndex = 4;

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
		const row: string[] = [
			chalk.cyan(task.id.toString()),
			truncate(task.title, colWidths[1] - 3),
			getStatusWithColor(task.status, true), // Use table version
			getPriorityWithColor(task.priority)
		];

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
			const taskWithBlocks = task as TaskWithBlocks;
			if (!taskWithBlocks.blocks || taskWithBlocks.blocks.length === 0) {
				row.push(chalk.gray('-'));
			} else {
				row.push(
					chalk.yellow(taskWithBlocks.blocks.join(', '))
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
