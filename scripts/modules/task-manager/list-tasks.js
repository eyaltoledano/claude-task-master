import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import { log, readJSON, truncate } from '../utils.js';
import findNextTask from './find-next-task.js';

import {
	displayBanner,
	getStatusWithColor,
	formatDependenciesWithStatus,
	createProgressBar
} from '../ui.js';

/**
 * List all tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} statusFilter - Filter by status
 * @param {boolean} withSubtasks - Whether to show subtasks
 * @param {string} outputFormat - Output format (text or json)
 * @returns {Object} - Task list result for json format
 */
function listTasks(
	tasksPath,
	statusFilter,
	withSubtasks = false,
	outputFormat = 'text'
) {
	try {
		// Only display banner for text output
		if (outputFormat === 'text') {
			displayBanner();
		}

		const data = readJSON(tasksPath); // Reads the whole tasks.json
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Filter tasks by status if specified
		const filteredTasks =
			statusFilter && statusFilter.toLowerCase() !== 'all' // <-- Added check for 'all'
				? data.tasks.filter(
						(task) =>
							task.status &&
							task.status.toLowerCase() === statusFilter.toLowerCase()
					)
				: data.tasks; // Default to all tasks if no filter or filter is 'all'

		// Calculate completion statistics
		const totalTasks = data.tasks.length;
		const completedTasks = data.tasks.filter(
			(task) => task.status === 'done' || task.status === 'completed'
		).length;
		const completionPercentage =
			totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

		// Count statuses for tasks
		const doneCount = completedTasks;
		const inProgressCount = data.tasks.filter(
			(task) => task.status === 'in-progress'
		).length;
		const pendingCount = data.tasks.filter(
			(task) => task.status === 'pending'
		).length;
		const blockedCount = data.tasks.filter(
			(task) => task.status === 'blocked'
		).length;
		const deferredCount = data.tasks.filter(
			(task) => task.status === 'deferred'
		).length;
		const cancelledCount = data.tasks.filter(
			(task) => task.status === 'cancelled'
		).length;

		// Count subtasks and their statuses
		let totalSubtasks = 0;
		let completedSubtasks = 0;
		let inProgressSubtasks = 0;
		let pendingSubtasks = 0;
		let blockedSubtasks = 0;
		let deferredSubtasks = 0;
		let cancelledSubtasks = 0;

		data.tasks.forEach((task) => {
			if (task.subtasks && task.subtasks.length > 0) {
				totalSubtasks += task.subtasks.length;
				completedSubtasks += task.subtasks.filter(
					(st) => st.status === 'done' || st.status === 'completed'
				).length;
				inProgressSubtasks += task.subtasks.filter(
					(st) => st.status === 'in-progress'
				).length;
				pendingSubtasks += task.subtasks.filter(
					(st) => st.status === 'pending'
				).length;
				blockedSubtasks += task.subtasks.filter(
					(st) => st.status === 'blocked'
				).length;
				deferredSubtasks += task.subtasks.filter(
					(st) => st.status === 'deferred'
				).length;
				cancelledSubtasks += task.subtasks.filter(
					(st) => st.status === 'cancelled'
				).length;
			}
		});

		const subtaskCompletionPercentage =
			totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

		// For JSON output, return structured data
		if (outputFormat === 'json') {
			// *** Modification: Remove 'details' field for JSON output ***
			const tasksWithoutDetails = filteredTasks.map((task) => {
				// <-- USES filteredTasks!
				// Omit 'details' from the parent task
				const { details, ...taskRest } = task;

				// If subtasks exist, omit 'details' from them too
				if (taskRest.subtasks && Array.isArray(taskRest.subtasks)) {
					taskRest.subtasks = taskRest.subtasks.map((subtask) => {
						const { details: subtaskDetails, ...subtaskRest } = subtask;
						return subtaskRest;
					});
				}
				return taskRest;
			});
			// *** End of Modification ***

			return {
				tasks: tasksWithoutDetails, // <--- THIS IS THE ARRAY BEING RETURNED
				filter: statusFilter || 'all', // Return the actual filter used
				stats: {
					total: totalTasks,
					completed: doneCount,
					inProgress: inProgressCount,
					pending: pendingCount,
					blocked: blockedCount,
					deferred: deferredCount,
					cancelled: cancelledCount,
					completionPercentage,
					subtasks: {
						total: totalSubtasks,
						completed: completedSubtasks,
						inProgress: inProgressSubtasks,
						pending: pendingSubtasks,
						blocked: blockedSubtasks,
						deferred: deferredSubtasks,
						cancelled: cancelledSubtasks,
						completionPercentage: subtaskCompletionPercentage
					}
				}
			};
		}

		// ... existing code for text output ...

		// Calculate status breakdowns as percentages of total
		const taskStatusBreakdown = {
			'in-progress': totalTasks > 0 ? (inProgressCount / totalTasks) * 100 : 0,
			pending: totalTasks > 0 ? (pendingCount / totalTasks) * 100 : 0,
			blocked: totalTasks > 0 ? (blockedCount / totalTasks) * 100 : 0,
			deferred: totalTasks > 0 ? (deferredCount / totalTasks) * 100 : 0,
			cancelled: totalTasks > 0 ? (cancelledCount / totalTasks) * 100 : 0
		};

		const subtaskStatusBreakdown = {
			'in-progress':
				totalSubtasks > 0 ? (inProgressSubtasks / totalSubtasks) * 100 : 0,
			pending: totalSubtasks > 0 ? (pendingSubtasks / totalSubtasks) * 100 : 0,
			blocked: totalSubtasks > 0 ? (blockedSubtasks / totalSubtasks) * 100 : 0,
			deferred:
				totalSubtasks > 0 ? (deferredSubtasks / totalSubtasks) * 100 : 0,
			cancelled:
				totalSubtasks > 0 ? (cancelledSubtasks / totalSubtasks) * 100 : 0
		};

		// Create progress bars with status breakdowns
		const taskProgressBar = createProgressBar(
			completionPercentage,
			30,
			taskStatusBreakdown
		);
		const subtaskProgressBar = createProgressBar(
			subtaskCompletionPercentage,
			30,
			subtaskStatusBreakdown
		);

		// Calculate dependency statistics
		const completedTaskIds = new Set(
			data.tasks
				.filter((t) => t.status === 'done' || t.status === 'completed')
				.map((t) => t.id)
		);

		const tasksWithNoDeps = data.tasks.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'completed' &&
				(!t.dependencies || t.dependencies.length === 0)
		).length;

		const tasksWithAllDepsSatisfied = data.tasks.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'completed' &&
				t.dependencies &&
				t.dependencies.length > 0 &&
				t.dependencies.every((depId) => completedTaskIds.has(depId))
		).length;

		const tasksWithUnsatisfiedDeps = data.tasks.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'completed' &&
				t.dependencies &&
				t.dependencies.length > 0 &&
				!t.dependencies.every((depId) => completedTaskIds.has(depId))
		).length;

		// Calculate total tasks ready to work on (no deps + satisfied deps)
		const tasksReadyToWork = tasksWithNoDeps + tasksWithAllDepsSatisfied;

		// Calculate most depended-on tasks
		const dependencyCount = {};
		data.tasks.forEach((task) => {
			if (task.dependencies && task.dependencies.length > 0) {
				task.dependencies.forEach((depId) => {
					dependencyCount[depId] = (dependencyCount[depId] || 0) + 1;
				});
			}
		});

		// Find the most depended-on task
		let mostDependedOnTaskId = null;
		let maxDependents = 0;

		for (const [taskId, count] of Object.entries(dependencyCount)) {
			if (count > maxDependents) {
				maxDependents = count;
				mostDependedOnTaskId = parseInt(taskId);
			}
		}

		// Get the most depended-on task
		const mostDependedOnTask =
			mostDependedOnTaskId !== null
				? data.tasks.find((t) => t.id === mostDependedOnTaskId)
				: null;

		// Calculate average dependencies per task
		const totalDependencies = data.tasks.reduce(
			(sum, task) => sum + (task.dependencies ? task.dependencies.length : 0),
			0
		);
		const avgDependenciesPerTask = totalDependencies / data.tasks.length;

		// Find next task to work on
		const nextItem = findNextTask(data.tasks);

		// Get terminal width - more reliable method
		let terminalWidth;
		try {
			// Try to get the actual terminal columns
			terminalWidth = process.stdout.columns;
		} catch (e) {
			// Fallback if columns cannot be determined
			log('debug', 'Could not determine terminal width, using default');
		}
		// Ensure we have a reasonable default if detection fails
		terminalWidth = terminalWidth || 80;

		// Ensure terminal width is at least a minimum value to prevent layout issues
		terminalWidth = Math.max(terminalWidth, 80);

		// Create dashboard content
		const projectDashboardContent =
			chalk.white.bold('Project Dashboard') +
			'\n' +
			`Tasks Progress: ${chalk.greenBright(taskProgressBar)} ${completionPercentage.toFixed(0)}%\n` +
			`Done: ${chalk.green(doneCount)}  In Progress: ${chalk.blue(inProgressCount)}  Pending: ${chalk.yellow(pendingCount)}  Blocked: ${chalk.red(blockedCount)}  Deferred: ${chalk.gray(deferredCount)}  Cancelled: ${chalk.gray(cancelledCount)}\n\n` +
			`Subtasks Progress: ${chalk.cyan(subtaskProgressBar)} ${subtaskCompletionPercentage.toFixed(0)}%\n` +
			`Completed: ${chalk.green(completedSubtasks)}/${totalSubtasks}  In Progress: ${chalk.blue(inProgressSubtasks)}  Pending: ${chalk.yellow(pendingSubtasks)}  Blocked: ${chalk.red(blockedSubtasks)}  Deferred: ${chalk.gray(deferredSubtasks)}  Cancelled: ${chalk.gray(cancelledSubtasks)}\n\n` +
			chalk.cyan.bold('Priority Breakdown:') +
			'\n' +
			`${chalk.red('•')} ${chalk.white('High priority:')} ${data.tasks.filter((t) => t.priority === 'high').length}\n` +
			`${chalk.yellow('•')} ${chalk.white('Medium priority:')} ${data.tasks.filter((t) => t.priority === 'medium').length}\n` +
			`${chalk.green('•')} ${chalk.white('Low priority:')} ${data.tasks.filter((t) => t.priority === 'low').length}`;

		const dependencyDashboardContent =
			chalk.white.bold('Dependency Status & Next Task') +
			'\n' +
			chalk.cyan.bold('Dependency Metrics:') +
			'\n' +
			`${chalk.green('•')} ${chalk.white('Tasks with no dependencies:')} ${tasksWithNoDeps}\n` +
			`${chalk.green('•')} ${chalk.white('Tasks ready to work on:')} ${tasksReadyToWork}\n` +
			`${chalk.yellow('•')} ${chalk.white('Tasks blocked by dependencies:')} ${tasksWithUnsatisfiedDeps}\n` +
			`${chalk.magenta('•')} ${chalk.white('Most depended-on task:')} ${mostDependedOnTask ? chalk.cyan(`#${mostDependedOnTaskId} (${maxDependents} dependents)`) : chalk.gray('None')}\n` +
			`${chalk.blue('•')} ${chalk.white('Avg dependencies per task:')} ${avgDependenciesPerTask.toFixed(1)}\n\n` +
			chalk.cyan.bold('Next Task to Work On:') +
			'\n' +
			`ID: ${chalk.cyan(nextItem ? nextItem.id : 'N/A')} - ${nextItem ? chalk.white.bold(truncate(nextItem.title, 40)) : chalk.yellow('No task available')}\n` +
			`Priority: ${nextItem ? chalk.white(nextItem.priority || 'medium') : ''}  Dependencies: ${nextItem ? formatDependenciesWithStatus(nextItem.dependencies, data.tasks, true) : ''}`;

		// Calculate width for side-by-side display
		// Box borders, padding take approximately 4 chars on each side
		const minDashboardWidth = 50; // Minimum width for dashboard
		const minDependencyWidth = 50; // Minimum width for dependency dashboard
		const totalMinWidth = minDashboardWidth + minDependencyWidth + 4; // Extra 4 chars for spacing

		// If terminal is wide enough, show boxes side by side with responsive widths
		if (terminalWidth >= totalMinWidth) {
			// Calculate widths proportionally for each box - use exact 50% width each
			const availableWidth = terminalWidth;
			const halfWidth = Math.floor(availableWidth / 2);

			// Account for border characters (2 chars on each side)
			const boxContentWidth = halfWidth - 4;

			// Create boxen options with precise widths
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

			// Create a better side-by-side layout with exact spacing
			const dashboardLines = dashboardBox.split('\n');
			const dependencyLines = dependencyBox.split('\n');

			// Make sure both boxes have the same height
			const maxHeight = Math.max(dashboardLines.length, dependencyLines.length);

			// For each line of output, pad the dashboard line to exactly halfWidth chars
			// This ensures the dependency box starts at exactly the right position
			const combinedLines = [];
			for (let i = 0; i < maxHeight; i++) {
				// Get the dashboard line (or empty string if we've run out of lines)
				const dashLine = i < dashboardLines.length ? dashboardLines[i] : '';
				// Get the dependency line (or empty string if we've run out of lines)
				const depLine = i < dependencyLines.length ? dependencyLines[i] : '';

				// Remove any trailing spaces from dashLine before padding to exact width
				const trimmedDashLine = dashLine.trimEnd();
				// Pad the dashboard line to exactly halfWidth chars with no extra spaces
				const paddedDashLine = trimmedDashLine.padEnd(halfWidth, ' ');

				// Join the lines with no space in between
				combinedLines.push(paddedDashLine + depLine);
			}

			// Join all lines and output
			console.log(combinedLines.join('\n'));
		} else {
			// Terminal too narrow, show boxes stacked vertically
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

			// Display stacked vertically
			console.log(dashboardBox);
			console.log(dependencyBox);
		}

		if (filteredTasks.length === 0) {
			console.log(
				boxen(
					statusFilter
						? chalk.yellow(`No tasks with status '${statusFilter}' found`)
						: chalk.yellow('No tasks found'),
					{ padding: 1, borderColor: 'yellow', borderStyle: 'round' }
				)
			);
			return;
		}

		// COMPLETELY REVISED TABLE APPROACH
		// Define percentage-based column widths and calculate actual widths
		// Adjust percentages based on content type and user requirements

		// Adjust ID width if showing subtasks (subtask IDs are longer: e.g., "1.2")
		const idWidthPct = withSubtasks ? 10 : 7;

		// Calculate max status length to accommodate "in-progress"
		const statusWidthPct = 15;

		// Increase priority column width as requested
		const priorityWidthPct = 12;

		// Make dependencies column smaller as requested (-20%)
		const depsWidthPct = 20;

		// Calculate title/description width as remaining space (+20% from dependencies reduction)
		const titleWidthPct =
			100 - idWidthPct - statusWidthPct - priorityWidthPct - depsWidthPct;

		// Allow 10 characters for borders and padding
		const availableWidth = terminalWidth - 10;

		// Calculate actual column widths based on percentages
		const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
		const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
		const priorityWidth = Math.floor(availableWidth * (priorityWidthPct / 100));
		const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
		const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));

		// Create a table with correct borders and spacing
		const table = new Table({
			head: [
				chalk.cyan.bold('ID'),
				chalk.cyan.bold('Title'),
				chalk.cyan.bold('Status'),
				chalk.cyan.bold('Priority'),
				chalk.cyan.bold('Dependencies')
			],
			colWidths: [idWidth, titleWidth, statusWidth, priorityWidth, depsWidth],
			style: {
				head: [], // No special styling for header
				border: [], // No special styling for border
				compact: false // Use default spacing
			},
			wordWrap: true,
			wrapOnWordBoundary: true
		});

		// Process tasks for the table
		filteredTasks.forEach((task) => {
			// Format dependencies with status indicators (colored)
			let depText = 'None';
			if (task.dependencies && task.dependencies.length > 0) {
				// Use the proper formatDependenciesWithStatus function for colored status
				depText = formatDependenciesWithStatus(
					task.dependencies,
					data.tasks,
					true
				);
			} else {
				depText = chalk.gray('None');
			}

			// Clean up any ANSI codes or confusing characters
			const cleanTitle = task.title.replace(/\n/g, ' ');

			// Get priority color
			const priorityColor =
				{
					high: chalk.red,
					medium: chalk.yellow,
					low: chalk.gray
				}[task.priority || 'medium'] || chalk.white;

			// Format status
			const status = getStatusWithColor(task.status, true);

			// Add the row without truncating dependencies
			table.push([
				task.id.toString(),
				truncate(cleanTitle, titleWidth - 3),
				status,
				priorityColor(truncate(task.priority || 'medium', priorityWidth - 2)),
				depText // No truncation for dependencies
			]);

			// Add subtasks if requested
			if (withSubtasks && task.subtasks && task.subtasks.length > 0) {
				task.subtasks.forEach((subtask) => {
					// Format subtask dependencies with status indicators
					let subtaskDepText = 'None';
					if (subtask.dependencies && subtask.dependencies.length > 0) {
						// Handle both subtask-to-subtask and subtask-to-task dependencies
						const formattedDeps = subtask.dependencies
							.map((depId) => {
								// Check if it's a dependency on another subtask
								if (typeof depId === 'number' && depId < 100) {
									const foundSubtask = task.subtasks.find(
										(st) => st.id === depId
									);
									if (foundSubtask) {
										const isDone =
											foundSubtask.status === 'done' ||
											foundSubtask.status === 'completed';
										const isInProgress = foundSubtask.status === 'in-progress';

										// Use consistent color formatting instead of emojis
										if (isDone) {
											return chalk.green.bold(`${task.id}.${depId}`);
										} else if (isInProgress) {
											return chalk.hex('#FFA500').bold(`${task.id}.${depId}`);
										} else {
											return chalk.red.bold(`${task.id}.${depId}`);
										}
									}
								}
								// Default to regular task dependency
								const depTask = data.tasks.find((t) => t.id === depId);
								if (depTask) {
									const isDone =
										depTask.status === 'done' || depTask.status === 'completed';
									const isInProgress = depTask.status === 'in-progress';
									// Use the same color scheme as in formatDependenciesWithStatus
									if (isDone) {
										return chalk.green.bold(`${depId}`);
									} else if (isInProgress) {
										return chalk.hex('#FFA500').bold(`${depId}`);
									} else {
										return chalk.red.bold(`${depId}`);
									}
								}
								return chalk.cyan(depId.toString());
							})
							.join(', ');

						subtaskDepText = formattedDeps || chalk.gray('None');
					}

					// Add the subtask row without truncating dependencies
					table.push([
						`${task.id}.${subtask.id}`,
						chalk.dim(`└─ ${truncate(subtask.title, titleWidth - 5)}`),
						getStatusWithColor(subtask.status, true),
						chalk.dim('-'),
						subtaskDepText // No truncation for dependencies
					]);
				});
			}
		});

		// Ensure we output the table even if it had to wrap
		try {
			console.log(table.toString());
		} catch (err) {
			log('error', `Error rendering table: ${err.message}`);

			// Fall back to simpler output
			console.log(
				chalk.yellow(
					'\nFalling back to simple task list due to terminal width constraints:'
				)
			);
			filteredTasks.forEach((task) => {
				console.log(
					`${chalk.cyan(task.id)}: ${chalk.white(task.title)} - ${getStatusWithColor(task.status)}`
				);
			});
		}

		// Show filter info if applied
		if (statusFilter) {
			console.log(chalk.yellow(`\nFiltered by status: ${statusFilter}`));
			console.log(
				chalk.yellow(`Showing ${filteredTasks.length} of ${totalTasks} tasks`)
			);
		}

		// Define priority colors
		const priorityColors = {
			high: chalk.red.bold,
			medium: chalk.yellow,
			low: chalk.gray
		};

		// Show next task box in a prominent color
		if (nextItem) {
			// Prepare subtasks section if they exist (Only tasks have .subtasks property)
			let subtasksSection = '';
			// Check if the nextItem is a top-level task before looking for subtasks
			const parentTaskForSubtasks = data.tasks.find(
				(t) => String(t.id) === String(nextItem.id)
			); // Find the original task object
			if (
				parentTaskForSubtasks &&
				parentTaskForSubtasks.subtasks &&
				parentTaskForSubtasks.subtasks.length > 0
			) {
				subtasksSection = `\n\n${chalk.white.bold('Subtasks:')}\n`;
				subtasksSection += parentTaskForSubtasks.subtasks
					.map((subtask) => {
						// Using a more simplified format for subtask status display
						const status = subtask.status || 'pending';
						const statusColors = {
							done: chalk.green,
							completed: chalk.green,
							pending: chalk.yellow,
							'in-progress': chalk.blue,
							deferred: chalk.gray,
							blocked: chalk.red,
							cancelled: chalk.gray
						};
						const statusColor =
							statusColors[status.toLowerCase()] || chalk.white;
						// Ensure subtask ID is displayed correctly using parent ID from the original task object
						return `${chalk.cyan(`${parentTaskForSubtasks.id}.${subtask.id}`)} [${statusColor(status)}] ${subtask.title}`;
					})
					.join('\n');
			}

			console.log(
				boxen(
					chalk.hex('#FF8800').bold(
						// Use nextItem.id and nextItem.title
						`🔥 Next Task to Work On: #${nextItem.id} - ${nextItem.title}`
					) +
						'\n\n' +
						// Use nextItem.priority, nextItem.status, nextItem.dependencies
						`${chalk.white('Priority:')} ${priorityColors[nextItem.priority || 'medium'](nextItem.priority || 'medium')}   ${chalk.white('Status:')} ${getStatusWithColor(nextItem.status, true)}\n` +
						`${chalk.white('Dependencies:')} ${nextItem.dependencies && nextItem.dependencies.length > 0 ? formatDependenciesWithStatus(nextItem.dependencies, data.tasks, true) : chalk.gray('None')}\n\n` +
						// Use nextItem.description (Note: findNextTask doesn't return description, need to fetch original task/subtask for this)
						// *** Fetching original item for description and details ***
						`${chalk.white('Description:')} ${getWorkItemDescription(nextItem, data.tasks)}` +
						subtasksSection + // <-- Subtasks are handled above now
						'\n\n' +
						// Use nextItem.id
						`${chalk.cyan('Start working:')} ${chalk.yellow(`task-master set-status --id=${nextItem.id} --status=in-progress`)}\n` +
						// Use nextItem.id
						`${chalk.cyan('View details:')} ${chalk.yellow(`task-master show ${nextItem.id}`)}`,
					{
						padding: { left: 2, right: 2, top: 1, bottom: 1 },
						borderColor: '#FF8800',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 },
						title: '⚡ RECOMMENDED NEXT TASK ⚡',
						titleAlignment: 'center',
						width: terminalWidth - 4,
						fullscreen: false
					}
				)
			);
		} else {
			console.log(
				boxen(
					chalk.hex('#FF8800').bold('No eligible next task found') +
						'\n\n' +
						'All pending tasks have dependencies that are not yet completed, or all tasks are done.',
					{
						padding: 1,
						borderColor: '#FF8800',
						borderStyle: 'round',
						margin: { top: 1, bottom: 1 },
						title: '⚡ NEXT TASK ⚡',
						titleAlignment: 'center',
						width: terminalWidth - 4 // Use full terminal width minus a small margin
					}
				)
			);
		}

		// Show next steps
		console.log(
			boxen(
				chalk.white.bold('Suggested Next Steps:') +
					'\n\n' +
					`${chalk.cyan('1.')} Run ${chalk.yellow('task-master next')} to see what to work on next\n` +
					`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks\n` +
					`${chalk.cyan('3.')} Run ${chalk.yellow('task-master set-status --id=<id> --status=done')} to mark a task as complete`,
				{
					padding: 1,
					borderColor: 'gray',
					borderStyle: 'round',
					margin: { top: 1 }
				}
			)
		);
	} catch (error) {
		log('error', `Error listing tasks: ${error.message}`);

		if (outputFormat === 'json') {
			// Return structured error for JSON output
			throw {
				code: 'TASK_LIST_ERROR',
				message: error.message,
				details: error.stack
			};
		}

		console.error(chalk.red(`Error: ${error.message}`));
		process.exit(1);
	}
}

// *** Helper function to get description for task or subtask ***
function getWorkItemDescription(item, allTasks) {
	if (!item) return 'N/A';
	if (item.parentId) {
		// It's a subtask
		const parent = allTasks.find((t) => t.id === item.parentId);
		const subtask = parent?.subtasks?.find(
			(st) => `${parent.id}.${st.id}` === item.id
		);
		return subtask?.description || 'No description available.';
	} else {
		// It's a top-level task
		const task = allTasks.find((t) => String(t.id) === String(item.id));
		return task?.description || 'No description available.';
	}
}

export default listTasks;
