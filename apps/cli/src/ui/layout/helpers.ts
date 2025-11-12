/**
 * @fileoverview Layout helper utilities
 * Provides utilities for calculating dimensions, truncating text, and creating visual elements
 */

import chalk from 'chalk';

/**
 * Calculate box width as percentage of terminal width
 * @param percentage - Percentage of terminal width to use (default: 0.9)
 * @param minWidth - Minimum width to enforce (default: 40)
 * @returns Calculated box width
 */
export function getBoxWidth(
	percentage: number = 0.9,
	minWidth: number = 40
): number {
	const terminalWidth = process.stdout.columns || 80;
	return Math.max(Math.floor(terminalWidth * percentage), minWidth);
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
