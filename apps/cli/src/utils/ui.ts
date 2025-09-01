/**
 * @fileoverview UI utilities for Task Master CLI
 * Provides formatting, display, and visual components for the command line interface
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import type { Task, TaskStatus, TaskPriority } from '@tm/core';

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
			icon: String.fromCharCode(8730),
			tableIcon: String.fromCharCode(8730)
		}, // √
		pending: { color: chalk.yellow, icon: 'o', tableIcon: 'o' },
		'in-progress': {
			color: chalk.hex('#FFA500'),
			icon: String.fromCharCode(9654),
			tableIcon: '>'
		}, // ▶
		deferred: { color: chalk.gray, icon: 'x', tableIcon: 'x' },
		blocked: { color: chalk.red, icon: '!', tableIcon: '!' },
		review: { color: chalk.magenta, icon: '?', tableIcon: '?' },
		cancelled: { color: chalk.gray, icon: 'X', tableIcon: 'X' }
	};

	const config = statusConfig[status] || {
		color: chalk.red,
		icon: 'X',
		tableIcon: 'X'
	};

	// Use simple ASCII characters for stable display
	const simpleIcons = {
		done: String.fromCharCode(8730), // √
		pending: 'o',
		'in-progress': '>',
		deferred: 'x',
		blocked: '!',
		review: '?',
		cancelled: 'X'
	};

	const icon = forTable ? simpleIcons[status] || 'X' : config.icon;
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
 * Get colored complexity display
 */
export function getComplexityWithColor(complexity: number | string): string {
	const score =
		typeof complexity === 'string' ? parseInt(complexity, 10) : complexity;

	if (isNaN(score)) {
		return chalk.gray('N/A');
	}

	if (score >= 8) {
		return chalk.red.bold(`${score} (High)`);
	} else if (score >= 5) {
		return chalk.yellow(`${score} (Medium)`);
	} else {
		return chalk.green(`${score} (Low)`);
	}
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
	console.error(
		boxen(
			chalk.red.bold('X Error: ') +
				chalk.white(message) +
				(details ? '\n\n' + chalk.gray(details) : ''),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'red'
			}
		)
	);
}

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
	console.log(
		boxen(
			chalk.green.bold(String.fromCharCode(8730) + ' ') + chalk.white(message),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'green'
			}
		)
	);
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
	console.log(
		boxen(chalk.yellow.bold('⚠ ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'yellow'
		})
	);
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
	console.log(
		boxen(chalk.blue.bold('i ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'blue'
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
	tasks: Task[],
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
	const terminalWidth = process.stdout.columns || 100;
	const baseColWidths = showComplexity
		? [8, Math.floor(terminalWidth * 0.35), 18, 12, 15, 12] // ID, Title, Status, Priority, Dependencies, Complexity
		: [8, Math.floor(terminalWidth * 0.4), 18, 12, 20]; // ID, Title, Status, Priority, Dependencies

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
			row.push(formatDependenciesWithStatus(task.dependencies, tasks));
		}

		if (showComplexity && 'complexity' in task) {
			row.push(getComplexityWithColor(task.complexity as number | string));
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
					subRow.push(chalk.gray('--'));
				}

				table.push(subRow);
			});
		}
	});

	return table.toString();
}
