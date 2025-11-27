/**
 * @fileoverview Task Selector
 * Interactive task selection interface using Inquirer.js
 */

import boxen from 'boxen';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { validateTasks } from './export-validator.js';
import type { ExportableTask, TaskSelectionResult } from './types.js';

/**
 * Choice item for Inquirer checkbox
 */
interface TaskChoice {
	name: string;
	value: ExportableTask;
	checked: boolean;
	short: string;
}

/**
 * Presents an interactive task selection interface
 */
export async function selectTasks(
	tasks: ExportableTask[],
	options: {
		preselectAll?: boolean;
		showStatus?: boolean;
		showPriority?: boolean;
	} = {}
): Promise<TaskSelectionResult> {
	const { preselectAll = true, showStatus = true } = options;

	if (tasks.length === 0) {
		console.log(chalk.yellow('\nNo tasks available for export.\n'));
		return {
			selectedTasks: [],
			totalAvailable: 0,
			cancelled: false
		};
	}

	// Count subtasks for display
	const subtaskCount = tasks.reduce(
		(sum, t) => sum + (t.subtasks?.length || 0),
		0
	);
	const availableMessage =
		subtaskCount > 0
			? `${tasks.length} tasks + ${subtaskCount} subtasks available`
			: `${tasks.length} available`;

	// Build choices for Inquirer
	const choices = buildTaskChoices(tasks, { preselectAll, showStatus });

	try {
		const { selectedTasks } = await inquirer.prompt<{
			selectedTasks: ExportableTask[];
		}>([
			{
				type: 'checkbox',
				name: 'selectedTasks',
				message: `Select tasks to export (${availableMessage}):`,
				choices,
				pageSize: 12,
				loop: false,
				validate: (input: ExportableTask[]) => {
					if (input.length === 0) {
						return 'Please select at least one task';
					}
					return true;
				}
			}
		]);

		return {
			selectedTasks,
			totalAvailable: tasks.length,
			cancelled: false
		};
	} catch (error: any) {
		if (error.isTtyError || error.message?.includes('User force closed')) {
			return {
				selectedTasks: [],
				totalAvailable: tasks.length,
				cancelled: true
			};
		}
		throw error;
	}
}

/**
 * Builds Inquirer checkbox choices from tasks
 */
function buildTaskChoices(
	tasks: ExportableTask[],
	options: { preselectAll: boolean; showStatus: boolean }
): TaskChoice[] {
	return tasks.map((task) => {
		const statusIcon = getStatusIcon(task.status);
		const title =
			task.title.length > 45 ? task.title.substring(0, 42) + '...' : task.title;

		return {
			name: `${chalk.cyan(task.id.padEnd(6))} ${statusIcon} ${title}`,
			value: task,
			checked: options.preselectAll,
			short: `${task.id}`
		};
	});
}

/**
 * Get compact status icon
 */
function getStatusIcon(status?: string): string {
	switch (status?.toLowerCase()) {
		case 'done':
		case 'completed':
			return chalk.green('✓');
		case 'in-progress':
		case 'in_progress':
			return chalk.yellow('◐');
		case 'blocked':
			return chalk.red('✗');
		default:
			return chalk.gray('○');
	}
}

/**
 * Shows a compact preview of what will be exported
 */
export async function showExportPreview(
	tasks: ExportableTask[],
	_destination?: { briefName?: string; orgName?: string }
): Promise<boolean> {
	// Count tasks and subtasks (subtasks are nested inside tasks)
	const taskCount = tasks.length;
	const subtaskCount = tasks.reduce(
		(sum, t) => sum + (t.subtasks?.length || 0),
		0
	);
	const totalCount = taskCount + subtaskCount;

	// Compact summary
	console.log('');
	const taskSummary =
		subtaskCount > 0
			? `${taskCount} tasks + ${subtaskCount} subtasks (${totalCount} total)`
			: `${taskCount} tasks`;
	console.log(chalk.white(`  ${taskSummary} ready to export`));

	// Validation check
	const validation = validateTasks(tasks);
	if (validation.warnings.length > 0) {
		console.log(chalk.yellow(`  ${validation.warnings.length} warning(s):`));
		for (const warning of validation.warnings) {
			console.log(chalk.gray(`    - ${warning}`));
		}
	}

	if (!validation.isValid) {
		console.log('');
		console.log(chalk.red(`  Cannot export: ${validation.errors[0]}`));
		return false;
	}

	console.log('');

	// Confirmation prompt
	const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
		{
			type: 'confirm',
			name: 'confirmed',
			message: 'Continue?',
			default: true
		}
	]);

	return confirmed;
}

/**
 * Shows value prop message for Hamster export
 */
export function showUpgradeMessage(tagName?: string): void {
	const tagLine = tagName
		? chalk.cyan(`  Exporting tag: ${chalk.white.bold(tagName)}`)
		: '';

	const content = [
		chalk.white.bold('Exporting your tasks to Hamster'),
		'',
		chalk.gray('Your tasks will live on Hamster where you can:'),
		chalk.white('  • Invite teammates to collaborate on the brief together'),
		chalk.white('  • Chat with AI alongside your team in real-time'),
		chalk.white(
			'  • Draft, refine, align briefs and ship them faster together'
		),
		...(tagLine ? ['', tagLine] : [])
	].join('\n');

	console.log(
		boxen(content, {
			padding: { top: 1, bottom: 1, left: 2, right: 2 },
			margin: { top: 1, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'cyan',
			dimBorder: true
		})
	);
}
