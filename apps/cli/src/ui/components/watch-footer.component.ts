/**
 * @fileoverview Watch mode footer component for real-time task updates
 */

import chalk from 'chalk';
import { formatTime } from '@tm/core';

/**
 * Get display label for storage source
 */
function getSourceLabel(storageType: 'api' | 'file'): string {
	return storageType === 'api' ? 'Hamster Studio' : 'tasks.json';
}

/**
 * Display watch status footer
 */
export function displayWatchFooter(
	storageType: 'api' | 'file',
	lastSync: Date
): void {
	const syncTime = formatTime(lastSync);
	const source = getSourceLabel(storageType);

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
	const formattedTime = formatTime(syncTime);
	const source = getSourceLabel(storageType);

	console.log(chalk.blue(`\nℹ ${source} updated at ${formattedTime}`));
}
