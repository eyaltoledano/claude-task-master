/**
 * @fileoverview UI utilities for Task Master CLI
 * Provides formatting, display, and visual components for the command line interface
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import type { Task, TaskStatus, TaskPriority, Subtask } from '@tm/core';

/**
 * Get colored status display with ASCII icons (matches scripts/modules/ui.js style)
 */
export function getStatusWithColor(
	status: TaskStatus,
	forTable: boolean = false
): string {
	const statusConfig = {
		done: {
			color: chalk.green,
			icon: '✓',
			tableIcon: '✓'
		},
		pending: {
			color: chalk.yellow,
			icon: '○',
			tableIcon: '○'
		},
		'in-progress': {
			color: chalk.hex('#FFA500'),
			icon: '▶',
			tableIcon: '▶'
		},
		deferred: {
			color: chalk.gray,
			icon: 'x',
			tableIcon: 'x'
		},
		review: {
			color: chalk.magenta,
			icon: '?',
			tableIcon: '?'
		},
		cancelled: {
			color: chalk.gray,
			icon: 'x',
			tableIcon: 'x'
		},
		blocked: {
			color: chalk.red,
			icon: '!',
			tableIcon: '!'
		},
		completed: {
			color: chalk.green,
			icon: '✓',
			tableIcon: '✓'
		}
	};

	const config = statusConfig[status] || {
		color: chalk.red,
		icon: 'X',
		tableIcon: 'X'
	};

	const icon = forTable ? config.tableIcon : config.icon;
	return config.color(`${icon} ${status}`);
}

/**
 * Get colored priority display
 */
export function getPriorityWithColor(priority: TaskPriority): string {
	const priorityColors: Record<TaskPriority, (text: string) => string> = {
		critical: chalk.red.bold,
		high: chalk.red,
		medium: chalk.yellow,
		low: chalk.gray
	};

	const colorFn = priorityColors[priority] || chalk.white;
	return colorFn(priority);
}

/**
 * Get complexity color and label based on score thresholds
 */
function getComplexityLevel(score: number): {
	color: (text: string) => string;
	label: string;
} {
	if (score >= 7) {
		return { color: chalk.hex('#CC0000'), label: 'High' };
	} else if (score >= 4) {
		return { color: chalk.hex('#FF8800'), label: 'Medium' };
	} else {
		return { color: chalk.green, label: 'Low' };
	}
}

/**
 * Get colored complexity display with dot indicator (simple format)
 */
export function getComplexityWithColor(complexity: number | string): string {
	const score =
		typeof complexity === 'string' ? parseInt(complexity, 10) : complexity;

	if (isNaN(score)) {
		return chalk.gray('N/A');
	}

	const { color } = getComplexityLevel(score);
	return color(`● ${score}`);
}

/**
 * Get colored complexity display with /10 format (for dashboards)
 */
export function getComplexityWithScore(complexity: number | undefined): string {
	if (typeof complexity !== 'number') {
		return chalk.gray('N/A');
	}

	const { color, label } = getComplexityLevel(complexity);
	return color(`${complexity}/10 (${label})`);
}

/**
 * Calculate box width as percentage of terminal width
 * @param percentage - Percentage of terminal width to use (default: 0.9)
 * @param minWidth - Minimum width to enforce (default: 40)
 * @returns Calculated box width
 */
export function getBoxWidth(
	percentage: number = 0.9,
	minWidth: number = 40
): number {
	const terminalWidth = process.stdout.columns || 80;
	return Math.max(Math.floor(terminalWidth * percentage), minWidth);
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create a progress bar
 */
export function createProgressBar(
	completed: number,
	total: number,
	width: number = 30
): string {
	if (total === 0) {
		return chalk.gray('No tasks');
	}

	const percentage = Math.round((completed / total) * 100);
	const filled = Math.round((completed / total) * width);
	const empty = width - filled;

	const bar = chalk.green('█').repeat(filled) + chalk.gray('░').repeat(empty);

	return `${bar} ${chalk.cyan(`${percentage}%`)} (${completed}/${total})`;
}

/**
 * Display a fancy banner
 */
export function displayBanner(title: string = 'Task Master'): void {
	console.log(
		boxen(chalk.white.bold(title), {
			padding: 1,
			margin: { top: 1, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'blue',
			textAlignment: 'center'
		})
	);
}

/**
 * Display an error message (matches scripts/modules/ui.js style)
 */
export function displayError(message: string, details?: string): void {
	const boxWidth = getBoxWidth();

	console.error(
		boxen(
			chalk.red.bold('X Error: ') +
				chalk.white(message) +
				(details ? '\n\n' + chalk.gray(details) : ''),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'red',
				width: boxWidth
			}
		)
	);
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
	const boxWidth = getBoxWidth();

	console.log(
		boxen(
			chalk.green.bold(String.fromCharCode(8730) + ' ') + chalk.white(message),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'green',
				width: boxWidth
			}
		)
	);
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
	const boxWidth = getBoxWidth();

	console.log(
		boxen(chalk.yellow.bold('⚠ ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'yellow',
			width: boxWidth
		})
	);
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
	const boxWidth = getBoxWidth();

	console.log(
		boxen(chalk.blue.bold('i ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'blue',
			width: boxWidth
		})
	);
}

/**
 * Format dependencies with their status
 */
export function formatDependenciesWithStatus(
	dependencies: string[] | number[],
	tasks: Task[]
): string {
	if (!dependencies || dependencies.length === 0) {
		return chalk.gray('none');
	}

	const taskMap = new Map(tasks.map((t) => [t.id.toString(), t]));

	return dependencies
		.map((depId) => {
			const task = taskMap.get(depId.toString());
			if (!task) {
				return chalk.red(`${depId} (not found)`);
			}

			const statusIcon =
				task.status === 'done'
					? '✓'
					: task.status === 'in-progress'
						? '►'
						: '○';

			return `${depId}${statusIcon}`;
		})
		.join(', ');
}

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
					chalk.gray(subtask.priority || 'medium')
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
