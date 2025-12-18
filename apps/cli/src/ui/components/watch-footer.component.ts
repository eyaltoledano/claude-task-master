/**
 * @fileoverview Watch mode footer component for real-time task updates
 */

import chalk from 'chalk';

/**
 * Format a timestamp for display in watch mode
 */
export function formatSyncTime(date: Date): string {
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	});
}

/**
 * Display watch status footer
 */
export function displayWatchFooter(
	storageType: 'api' | 'file',
	lastSync: Date
): void {
	const syncTime = formatSyncTime(lastSync);
	const source = storageType === 'api' ? 'Hamster Studio' : 'tasks.json';

	console.log(chalk.dim(`\nWatching ${source} for changes...`));
	console.log(chalk.gray(`Last synced: ${syncTime}`));
	console.log(chalk.dim('Press Ctrl+C to exit'));
}

/**
 * Display sync notification message
 */
export function displaySyncMessage(
	storageType: 'api' | 'file',
	syncTime: Date
): void {
	const formattedTime = formatSyncTime(syncTime);
	const source = storageType === 'api' ? 'Hamster Studio' : 'tasks.json';

	console.log(chalk.blue(`\nℹ ${source} updated at ${formattedTime}`));
}
