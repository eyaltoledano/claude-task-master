/**
 * @fileoverview Suggested next steps component
 * Displays helpful command suggestions at the end of the list
 */

import chalk from 'chalk';
import boxen from 'boxen';
import { getBoxWidth } from '../../utils/ui.js';

/**
 * Display suggested next steps section
 */
export function displaySuggestedNextSteps(): void {
	const steps = [
		`${chalk.cyan('1.')} Run ${chalk.yellow('task-master next')} to see what to work on next`,
		`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks`,
		`${chalk.cyan('3.')} Run ${chalk.yellow('task-master set-status --id=<id> --status=done')} to mark a task as complete`
	];

	console.log(
		boxen(
			chalk.white.bold('Suggested Next Steps:') + '\n\n' + steps.join('\n'),
			{
				padding: 1,
				margin: { top: 0, bottom: 1 },
				borderStyle: 'round',
				borderColor: 'gray',
				width: getBoxWidth(0.97)
			}
		)
	);
}
