/**
 * @fileoverview Dashboard components for Task Master CLI
 * Displays project statistics and dependency information
 */

import chalk from 'chalk';
import boxen from 'boxen';
import type { Task, TaskPriority } from '@tm/core';
import { getComplexityWithColor } from '../../utils/ui.js';

/**
 * Statistics for task collection
 */
export interface TaskStatistics {
	total: number;
	done: number;
	inProgress: number;
	pending: number;
	blocked: number;
	deferred: number;
	cancelled: number;
	review?: number;
	completionPercentage: number;
}

/**
 * Statistics for dependencies
 */
export interface DependencyStatistics {
	tasksWithNoDeps: number;
	tasksReadyToWork: number;
	tasksBlockedByDeps: number;
	mostDependedOnTaskId?: number;
	mostDependedOnCount?: number;
	avgDependenciesPerTask: number;
}

/**
 * Next task information
 */
export interface NextTaskInfo {
	id: string | number;
	title: string;
	priority?: TaskPriority;
	dependencies?: (string | number)[];
	complexity?: number | string;
}

/**
 * Status breakdown for progress bars
 */
export interface StatusBreakdown {
	'in-progress'?: number;
	pending?: number;
	blocked?: number;
	deferred?: number;
	cancelled?: number;
	review?: number;
}

/**
 * Create a progress bar with color-coded status segments
 */
function createProgressBar(
	completionPercentage: number,
	width: number = 30,
	statusBreakdown?: StatusBreakdown
): string {
	// If no breakdown provided, use simple green bar
	if (!statusBreakdown) {
		const filled = Math.round((completionPercentage / 100) * width);
		const empty = width - filled;
		return chalk.green('█').repeat(filled) + chalk.gray('░').repeat(empty);
	}

	// Build the bar with different colored sections
	// Order matches the status display: Done, Cancelled, Deferred, In Progress, Review, Pending, Blocked
	let bar = '';
	let charsUsed = 0;

	// 1. Green filled blocks for completed tasks (done)
	const completedChars = Math.round((completionPercentage / 100) * width);
	if (completedChars > 0) {
		bar += chalk.green('█').repeat(completedChars);
		charsUsed += completedChars;
	}

	// 2. Gray filled blocks for cancelled (won't be done)
	if (statusBreakdown.cancelled && charsUsed < width) {
		const cancelledChars = Math.round(
			(statusBreakdown.cancelled / 100) * width
		);
		const actualChars = Math.min(cancelledChars, width - charsUsed);
		if (actualChars > 0) {
			bar += chalk.gray('█').repeat(actualChars);
			charsUsed += actualChars;
		}
	}

	// 3. Gray filled blocks for deferred (won't be done now)
	if (statusBreakdown.deferred && charsUsed < width) {
		const deferredChars = Math.round((statusBreakdown.deferred / 100) * width);
		const actualChars = Math.min(deferredChars, width - charsUsed);
		if (actualChars > 0) {
			bar += chalk.gray('█').repeat(actualChars);
			charsUsed += actualChars;
		}
	}

	// 4. Blue filled blocks for in-progress (actively working)
	if (statusBreakdown['in-progress'] && charsUsed < width) {
		const inProgressChars = Math.round(
			(statusBreakdown['in-progress'] / 100) * width
		);
		const actualChars = Math.min(inProgressChars, width - charsUsed);
		if (actualChars > 0) {
			bar += chalk.blue('█').repeat(actualChars);
			charsUsed += actualChars;
		}
	}

	// 5. Magenta empty blocks for review (almost done)
	if (statusBreakdown.review && charsUsed < width) {
		const reviewChars = Math.round((statusBreakdown.review / 100) * width);
		const actualChars = Math.min(reviewChars, width - charsUsed);
		if (actualChars > 0) {
			bar += chalk.magenta('░').repeat(actualChars);
			charsUsed += actualChars;
		}
	}

	// 6. Yellow empty blocks for pending (ready to start)
	if (statusBreakdown.pending && charsUsed < width) {
		const pendingChars = Math.round((statusBreakdown.pending / 100) * width);
		const actualChars = Math.min(pendingChars, width - charsUsed);
		if (actualChars > 0) {
			bar += chalk.yellow('░').repeat(actualChars);
			charsUsed += actualChars;
		}
	}

	// 7. Red empty blocks for blocked (can't start yet)
	if (statusBreakdown.blocked && charsUsed < width) {
		const blockedChars = Math.round((statusBreakdown.blocked / 100) * width);
		const actualChars = Math.min(blockedChars, width - charsUsed);
		if (actualChars > 0) {
			bar += chalk.red('░').repeat(actualChars);
			charsUsed += actualChars;
		}
	}

	// Fill any remaining space with gray empty yellow blocks
	if (charsUsed < width) {
		bar += chalk.yellow('░').repeat(width - charsUsed);
	}

	return bar;
}

/**
 * Calculate task statistics from a list of tasks
 */
export function calculateTaskStatistics(tasks: Task[]): TaskStatistics {
	const stats: TaskStatistics = {
		total: tasks.length,
		done: 0,
		inProgress: 0,
		pending: 0,
		blocked: 0,
		deferred: 0,
		cancelled: 0,
		review: 0,
		completionPercentage: 0
	};

	tasks.forEach((task) => {
		switch (task.status) {
			case 'done':
				stats.done++;
				break;
			case 'in-progress':
				stats.inProgress++;
				break;
			case 'pending':
				stats.pending++;
				break;
			case 'blocked':
				stats.blocked++;
				break;
			case 'deferred':
				stats.deferred++;
				break;
			case 'cancelled':
				stats.cancelled++;
				break;
			case 'review':
				stats.review = (stats.review || 0) + 1;
				break;
		}
	});

	stats.completionPercentage =
		stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

	return stats;
}

/**
 * Calculate subtask statistics from tasks
 */
export function calculateSubtaskStatistics(tasks: Task[]): TaskStatistics {
	const stats: TaskStatistics = {
		total: 0,
		done: 0,
		inProgress: 0,
		pending: 0,
		blocked: 0,
		deferred: 0,
		cancelled: 0,
		review: 0,
		completionPercentage: 0
	};

	tasks.forEach((task) => {
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				stats.total++;
				switch (subtask.status) {
					case 'done':
						stats.done++;
						break;
					case 'in-progress':
						stats.inProgress++;
						break;
					case 'pending':
						stats.pending++;
						break;
					case 'blocked':
						stats.blocked++;
						break;
					case 'deferred':
						stats.deferred++;
						break;
					case 'cancelled':
						stats.cancelled++;
						break;
					case 'review':
						stats.review = (stats.review || 0) + 1;
						break;
				}
			});
		}
	});

	stats.completionPercentage =
		stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

	return stats;
}

/**
 * Calculate dependency statistics
 */
export function calculateDependencyStatistics(
	tasks: Task[]
): DependencyStatistics {
	const completedTaskIds = new Set(
		tasks.filter((t) => t.status === 'done').map((t) => t.id)
	);

	const tasksWithNoDeps = tasks.filter(
		(t) =>
			t.status !== 'done' && (!t.dependencies || t.dependencies.length === 0)
	).length;

	const tasksWithAllDepsSatisfied = tasks.filter(
		(t) =>
			t.status !== 'done' &&
			t.dependencies &&
			t.dependencies.length > 0 &&
			t.dependencies.every((depId) => completedTaskIds.has(depId))
	).length;

	const tasksBlockedByDeps = tasks.filter(
		(t) =>
			t.status !== 'done' &&
			t.dependencies &&
			t.dependencies.length > 0 &&
			!t.dependencies.every((depId) => completedTaskIds.has(depId))
	).length;

	// Calculate most depended-on task
	const dependencyCount: Record<string, number> = {};
	tasks.forEach((task) => {
		if (task.dependencies && task.dependencies.length > 0) {
			task.dependencies.forEach((depId) => {
				const key = String(depId);
				dependencyCount[key] = (dependencyCount[key] || 0) + 1;
			});
		}
	});

	let mostDependedOnTaskId: number | undefined;
	let mostDependedOnCount = 0;

	for (const [taskId, count] of Object.entries(dependencyCount)) {
		if (count > mostDependedOnCount) {
			mostDependedOnCount = count;
			mostDependedOnTaskId = parseInt(taskId);
		}
	}

	// Calculate average dependencies
	const totalDependencies = tasks.reduce(
		(sum, task) => sum + (task.dependencies ? task.dependencies.length : 0),
		0
	);
	const avgDependenciesPerTask =
		tasks.length > 0 ? totalDependencies / tasks.length : 0;

	return {
		tasksWithNoDeps,
		tasksReadyToWork: tasksWithNoDeps + tasksWithAllDepsSatisfied,
		tasksBlockedByDeps,
		mostDependedOnTaskId,
		mostDependedOnCount,
		avgDependenciesPerTask
	};
}

/**
 * Get priority counts
 */
export function getPriorityBreakdown(
	tasks: Task[]
): Record<TaskPriority, number> {
	const breakdown: Record<TaskPriority, number> = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0
	};

	tasks.forEach((task) => {
		const priority = task.priority || 'medium';
		breakdown[priority]++;
	});

	return breakdown;
}

/**
 * Calculate status breakdown as percentages
 */
function calculateStatusBreakdown(stats: TaskStatistics): StatusBreakdown {
	if (stats.total === 0) return {};

	return {
		'in-progress': (stats.inProgress / stats.total) * 100,
		pending: (stats.pending / stats.total) * 100,
		blocked: (stats.blocked / stats.total) * 100,
		deferred: (stats.deferred / stats.total) * 100,
		cancelled: (stats.cancelled / stats.total) * 100,
		review: ((stats.review || 0) / stats.total) * 100
	};
}

/**
 * Format status counts in the correct order with colors
 * @param stats - The statistics object containing counts
 * @param isSubtask - Whether this is for subtasks (affects "Done" vs "Completed" label)
 */
function formatStatusLine(
	stats: TaskStatistics,
	isSubtask: boolean = false
): string {
	const parts: string[] = [];

	// Order: Done, Cancelled, Deferred, In Progress, Review, Pending, Blocked
	if (isSubtask) {
		parts.push(`Completed: ${chalk.green(`${stats.done}/${stats.total}`)}`);
	} else {
		parts.push(`Done: ${chalk.green(stats.done)}`);
	}

	parts.push(`Cancelled: ${chalk.gray(stats.cancelled)}`);
	parts.push(`Deferred: ${chalk.gray(stats.deferred)}`);

	// Add line break for second row
	const firstLine = parts.join('  ');
	parts.length = 0;

	parts.push(`In Progress: ${chalk.blue(stats.inProgress)}`);
	parts.push(`Review: ${chalk.magenta(stats.review || 0)}`);
	parts.push(`Pending: ${chalk.yellow(stats.pending)}`);
	parts.push(`Blocked: ${chalk.red(stats.blocked)}`);

	const secondLine = parts.join('  ');

	return firstLine + '\n' + secondLine;
}

/**
 * Display the project dashboard box
 */
export function displayProjectDashboard(
	taskStats: TaskStatistics,
	subtaskStats: TaskStatistics,
	priorityBreakdown: Record<TaskPriority, number>
): string {
	// Calculate status breakdowns using the helper function
	const taskStatusBreakdown = calculateStatusBreakdown(taskStats);
	const subtaskStatusBreakdown = calculateStatusBreakdown(subtaskStats);

	// Create progress bars with the breakdowns
	const taskProgressBar = createProgressBar(
		taskStats.completionPercentage,
		30,
		taskStatusBreakdown
	);
	const subtaskProgressBar = createProgressBar(
		subtaskStats.completionPercentage,
		30,
		subtaskStatusBreakdown
	);

	const taskPercentage = `${taskStats.completionPercentage}% ${taskStats.done}/${taskStats.total}`;
	const subtaskPercentage = `${subtaskStats.completionPercentage}% ${subtaskStats.done}/${subtaskStats.total}`;

	const content =
		chalk.white.bold('Project Dashboard') +
		'\n' +
		`Tasks Progress: ${taskProgressBar} ${chalk.yellow(taskPercentage)}\n` +
		formatStatusLine(taskStats, false) +
		'\n\n' +
		`Subtasks Progress: ${subtaskProgressBar} ${chalk.cyan(subtaskPercentage)}\n` +
		formatStatusLine(subtaskStats, true) +
		'\n\n' +
		chalk.cyan.bold('Priority Breakdown:') +
		'\n' +
		`${chalk.red('•')} ${chalk.white('High priority:')} ${priorityBreakdown.high}\n` +
		`${chalk.yellow('•')} ${chalk.white('Medium priority:')} ${priorityBreakdown.medium}\n` +
		`${chalk.green('•')} ${chalk.white('Low priority:')} ${priorityBreakdown.low}`;

	return content;
}

/**
 * Display the dependency dashboard box
 */
export function displayDependencyDashboard(
	depStats: DependencyStatistics,
	nextTask?: NextTaskInfo
): string {
	const content =
		chalk.white.bold('Dependency Status & Next Task') +
		'\n' +
		chalk.cyan.bold('Dependency Metrics:') +
		'\n' +
		`${chalk.green('•')} ${chalk.white('Tasks with no dependencies:')} ${depStats.tasksWithNoDeps}\n` +
		`${chalk.green('•')} ${chalk.white('Tasks ready to work on:')} ${depStats.tasksReadyToWork}\n` +
		`${chalk.yellow('•')} ${chalk.white('Tasks blocked by dependencies:')} ${depStats.tasksBlockedByDeps}\n` +
		`${chalk.magenta('•')} ${chalk.white('Most depended-on task:')} ${
			depStats.mostDependedOnTaskId
				? chalk.cyan(
						`#${depStats.mostDependedOnTaskId} (${depStats.mostDependedOnCount} dependents)`
					)
				: chalk.gray('None')
		}\n` +
		`${chalk.blue('•')} ${chalk.white('Avg dependencies per task:')} ${depStats.avgDependenciesPerTask.toFixed(1)}\n\n` +
		chalk.cyan.bold('Next Task to Work On:') +
		'\n' +
		`ID: ${nextTask ? chalk.cyan(String(nextTask.id)) : chalk.gray('N/A')} - ${
			nextTask
				? chalk.white.bold(nextTask.title)
				: chalk.yellow('No task available')
		}\n` +
		`Priority: ${nextTask?.priority || chalk.gray('N/A')}  Dependencies: ${
			nextTask?.dependencies?.length
				? chalk.cyan(nextTask.dependencies.join(', '))
				: chalk.gray('None')
		}\n` +
		`Complexity: ${nextTask?.complexity !== undefined ? getComplexityWithColor(nextTask.complexity) : chalk.gray('N/A')}`;

	return content;
}

/**
 * Display dashboard boxes side by side or stacked
 */
export function displayDashboards(
	taskStats: TaskStatistics,
	subtaskStats: TaskStatistics,
	priorityBreakdown: Record<TaskPriority, number>,
	depStats: DependencyStatistics,
	nextTask?: NextTaskInfo
): void {
	const projectDashboardContent = displayProjectDashboard(
		taskStats,
		subtaskStats,
		priorityBreakdown
	);
	const dependencyDashboardContent = displayDependencyDashboard(
		depStats,
		nextTask
	);

	// Get terminal width
	const terminalWidth = process.stdout.columns || 80;
	const minDashboardWidth = 50;
	const minDependencyWidth = 50;
	const totalMinWidth = minDashboardWidth + minDependencyWidth + 4;

	// If terminal is wide enough, show side by side
	if (terminalWidth >= totalMinWidth) {
		const halfWidth = Math.floor(terminalWidth / 2);
		const boxContentWidth = halfWidth - 4;

		const dashboardBox = boxen(projectDashboardContent, {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			width: boxContentWidth,
			dimBorder: false
		});

		const dependencyBox = boxen(dependencyDashboardContent, {
			padding: 1,
			borderColor: 'magenta',
			borderStyle: 'round',
			width: boxContentWidth,
			dimBorder: false
		});

		// Create side-by-side layout
		const dashboardLines = dashboardBox.split('\n');
		const dependencyLines = dependencyBox.split('\n');
		const maxHeight = Math.max(dashboardLines.length, dependencyLines.length);

		const combinedLines = [];
		for (let i = 0; i < maxHeight; i++) {
			const dashLine = i < dashboardLines.length ? dashboardLines[i] : '';
			const depLine = i < dependencyLines.length ? dependencyLines[i] : '';
			const paddedDashLine = dashLine.padEnd(halfWidth, ' ');
			combinedLines.push(paddedDashLine + depLine);
		}

		console.log(combinedLines.join('\n'));
	} else {
		// Show stacked vertically
		const dashboardBox = boxen(projectDashboardContent, {
			padding: 1,
			borderColor: 'blue',
			borderStyle: 'round',
			margin: { top: 0, bottom: 1 }
		});

		const dependencyBox = boxen(dependencyDashboardContent, {
			padding: 1,
			borderColor: 'magenta',
			borderStyle: 'round',
			margin: { top: 0, bottom: 1 }
		});

		console.log(dashboardBox);
		console.log(dependencyBox);
	}
}
