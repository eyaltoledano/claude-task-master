/**
 * @fileoverview Update notification display utilities
 */

import boxen from 'boxen';
import chalk from 'chalk';

/**
 * Display upgrade notification message
 */
export function displayUpgradeNotification(
	currentVersion: string,
	latestVersion: string,
	highlights?: string[]
) {
	let content = `${chalk.blue.bold('Update Available!')} ${chalk.dim(currentVersion)} → ${chalk.green(latestVersion)}`;

	if (highlights && highlights.length > 0) {
		content += '\n\n' + chalk.bold("What's New:");
		for (const highlight of highlights) {
			content += '\n' + chalk.cyan('• ') + highlight;
		}
		content += '\n\n' + 'Auto-updating to the latest version...';
	} else {
		content +=
			'\n\n' +
			'Auto-updating to the latest version with new features and bug fixes...';
	}

	const message = boxen(content, {
		padding: 1,
		margin: { top: 1, bottom: 1 },
		borderColor: 'yellow',
		borderStyle: 'round'
	});

	console.log(message);
}
