import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

import { log, readJSON, writeJSON, truncate, isSilentMode } from '../utils.js';
import { displayBanner } from '../ui.js';

/**
 * Clear subtasks from specified tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIds - Task IDs to clear subtasks from
 * @param {Object} context - Context object containing projectRoot and tag
 */
function clearSubtasks(tasksPath, taskIds, context = {}) {
	const { projectRoot, tag } = context;
	log('info', `Reading tasks from ${tasksPath}...`);
	const data = readJSON(tasksPath, projectRoot, tag);
	if (!data || !data.tasks) {
		log('error', 'No valid tasks found.');
		process.exit(1);
	}

	if (!isSilentMode()) {
		console.log(
			boxen(chalk.white.bold('Clearing Subtasks'), {
				padding: 1,
				borderColor: 'blue',
				borderStyle: 'round',
				margin: { top: 1, bottom: 1 }
			})
		);
	}

	// Handle multiple task IDs (comma-separated)
	const taskIdArray = taskIds.split(',').map((id) => id.trim());
	let clearedCount = 0;

	// Create a summary table for the cleared subtasks
	const summaryTable = new Table({
		head: [
			chalk.cyan.bold('Task ID'),
			chalk.cyan.bold('Task Title'),
			chalk.cyan.bold('Subtasks Cleared')
		],
		colWidths: [10, 50, 20],
		style: { head: [], border: [] }
	});

	taskIdArray.forEach((taskId) => {
		const id = parseInt(taskId, 10);
		if (Number.isNaN(id)) {
			log('error', `Invalid task ID: ${taskId}`);
			return;
		}

		const task = data.tasks.find((t) => t.id === id);
		if (!task) {
			log('error', `Task ${id} not found`);
			return;
		}

		if (!task.subtasks || task.subtasks.length === 0) {
			log('info', `Task ${id} has no subtasks to clear`);
			summaryTable.push([
				id.toString(),
				truncate(task.title, 47),
				chalk.yellow('No subtasks')
			]);
			return;
		}

		const subtaskCount = task.subtasks.length;
		task.subtasks = [];
		clearedCount++;
		log('info', `Cleared ${subtaskCount} subtasks from task ${id}`);

		summaryTable.push([
			id.toString(),
			truncate(task.title, 47),
			chalk.green(`${subtaskCount} subtasks cleared`)
		]);
	});

	if (clearedCount > 0) {
		writeJSON(tasksPath, data, projectRoot, tag);

		// Show summary table
		if (!isSilentMode()) {
			console.log(
				boxen(chalk.white.bold('Subtask Clearing Summary:'), {
					padding: { left: 2, right: 2, top: 0, bottom: 0 },
					margin: { top: 1, bottom: 0 },
					borderColor: 'blue',
					borderStyle: 'round'
				})
			);
			console.log(summaryTable.toString());
		}

		// Success message
		if (!isSilentMode()) {
			console.log(
				boxen(
					chalk.green(
						`Successfully cleared subtasks from ${chalk.bold(clearedCount)} task(s)`
					),
					{
						padding: 1,
						borderColor: 'green',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);

			// Next steps suggestion
			console.log(
				boxen(
					chalk.white.bold('Next Steps:') +
						'\n\n' +
						`${chalk.cyan('1.')} Run ${chalk.yellow('task-master expand --id=<id>')} to generate new subtasks\n` +
						`${chalk.cyan('2.')} Run ${chalk.yellow('task-master list --with-subtasks')} to verify changes`,
					{
						padding: 1,
						borderColor: 'cyan',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);
		}
	} else {
		if (!isSilentMode()) {
			console.log(
				boxen(chalk.yellow('No subtasks were cleared'), {
					padding: 1,
					borderColor: 'yellow',
					borderStyle: 'round',
					margin: { top: 1 }
				})
			);
		}
	}
}

export default clearSubtasks;
