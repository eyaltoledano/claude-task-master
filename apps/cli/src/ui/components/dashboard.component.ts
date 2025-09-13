/**
 * @fileoverview Dashboard components for Task Master CLI
 * Displays project statistics and dependency information
 */

import chalk from 'chalk';
import boxen from 'boxen';
import type { Task, TaskPriority } from '@tm/core/types';

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
 * Create a progress bar with percentage
 */
function createProgressBar(percentage: number, width: number = 30): string {
	const filled = Math.round((percentage / 100) * width);
	const empty = width - filled;
	
	const bar = chalk.green('█').repeat(filled) + chalk.gray('░').repeat(empty);
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

	tasks.forEach(task => {
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

	stats.completionPercentage = stats.total > 0 
		? Math.round((stats.done / stats.total) * 100)
		: 0;

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

	tasks.forEach(task => {
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach(subtask => {
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

	stats.completionPercentage = stats.total > 0
		? Math.round((stats.done / stats.total) * 100)
		: 0;

	return stats;
}

/**
 * Calculate dependency statistics
 */
export function calculateDependencyStatistics(tasks: Task[]): DependencyStatistics {
	const completedTaskIds = new Set(
		tasks.filter(t => t.status === 'done').map(t => t.id)
	);

	const tasksWithNoDeps = tasks.filter(
		t => t.status !== 'done' && (!t.dependencies || t.dependencies.length === 0)
	).length;

	const tasksWithAllDepsSatisfied = tasks.filter(
		t => t.status !== 'done' &&
			t.dependencies &&
			t.dependencies.length > 0 &&
			t.dependencies.every(depId => completedTaskIds.has(depId))
	).length;

	const tasksBlockedByDeps = tasks.filter(
		t => t.status !== 'done' &&
			t.dependencies &&
			t.dependencies.length > 0 &&
			!t.dependencies.every(depId => completedTaskIds.has(depId))
	).length;

	// Calculate most depended-on task
	const dependencyCount: Record<string, number> = {};
	tasks.forEach(task => {
		if (task.dependencies && task.dependencies.length > 0) {
			task.dependencies.forEach(depId => {
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
	const avgDependenciesPerTask = tasks.length > 0 
		? totalDependencies / tasks.length 
		: 0;

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
export function getPriorityBreakdown(tasks: Task[]): Record<TaskPriority, number> {
	const breakdown: Record<TaskPriority, number> = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0
	};

	tasks.forEach(task => {
		const priority = task.priority || 'medium';
		breakdown[priority]++;
	});

	return breakdown;
}

/**
 * Display the project dashboard box
 */
export function displayProjectDashboard(
	taskStats: TaskStatistics,
	subtaskStats: TaskStatistics,
	priorityBreakdown: Record<TaskPriority, number>
): string {
	const taskProgressBar = createProgressBar(taskStats.completionPercentage);
	const subtaskProgressBar = createProgressBar(subtaskStats.completionPercentage);

	const taskPercentage = `${taskStats.completionPercentage}% ${taskStats.done}%`;
	const subtaskPercentage = `${subtaskStats.completionPercentage}% ${subtaskStats.done}%`;

	const content = 
		chalk.white.bold('Project Dashboard') + '\n' +
		`Tasks Progress: ${taskProgressBar} ${chalk.yellow(taskPercentage)}\n` +
		`Done: ${chalk.green(taskStats.done)}  In Progress: ${chalk.blue(taskStats.inProgress)}  Pending: ${chalk.yellow(taskStats.pending)}  Blocked: ${chalk.red(taskStats.blocked)}  Deferred: ${chalk.gray(taskStats.deferred)}\n` +
		`Cancelled: ${chalk.gray(taskStats.cancelled)}\n\n` +
		`Subtasks Progress: ${subtaskProgressBar} ${chalk.cyan(subtaskPercentage)}\n` +
		`Completed: ${chalk.green(`${subtaskStats.done}/${subtaskStats.total}`)}  In Progress: ${chalk.blue(subtaskStats.inProgress)}  Pending: ${chalk.yellow(subtaskStats.pending)}  Blocked: ${chalk.red(subtaskStats.blocked)}\n` +
		`Deferred: ${chalk.gray(subtaskStats.deferred)}  Cancelled: ${chalk.gray(subtaskStats.cancelled)}\n\n` +
		chalk.cyan.bold('Priority Breakdown:') + '\n' +
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
		chalk.white.bold('Dependency Status & Next Task') + '\n' +
		chalk.cyan.bold('Dependency Metrics:') + '\n' +
		`${chalk.green('•')} ${chalk.white('Tasks with no dependencies:')} ${depStats.tasksWithNoDeps}\n` +
		`${chalk.green('•')} ${chalk.white('Tasks ready to work on:')} ${depStats.tasksReadyToWork}\n` +
		`${chalk.yellow('•')} ${chalk.white('Tasks blocked by dependencies:')} ${depStats.tasksBlockedByDeps}\n` +
		`${chalk.magenta('•')} ${chalk.white('Most depended-on task:')} ${
			depStats.mostDependedOnTaskId 
				? chalk.cyan(`#${depStats.mostDependedOnTaskId} (${depStats.mostDependedOnCount} dependents)`)
				: chalk.gray('None')
		}\n` +
		`${chalk.blue('•')} ${chalk.white('Avg dependencies per task:')} ${depStats.avgDependenciesPerTask.toFixed(1)}\n\n` +
		chalk.cyan.bold('Next Task to Work On:') + '\n' +
		`ID: ${nextTask ? chalk.cyan(String(nextTask.id)) : chalk.gray('N/A')} - ${
			nextTask ? chalk.white.bold(nextTask.title) : chalk.yellow('No task available')
		}\n` +
		`Priority: ${nextTask?.priority || chalk.gray('N/A')}  Dependencies: ${
			nextTask?.dependencies?.length ? chalk.cyan(nextTask.dependencies.join(', ')) : chalk.gray('None')
		}\n` +
		`Complexity: ${nextTask?.complexity || chalk.gray('N/A')}`;

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
	const projectDashboardContent = displayProjectDashboard(taskStats, subtaskStats, priorityBreakdown);
	const dependencyDashboardContent = displayDependencyDashboard(depStats, nextTask);

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