/**
 * @fileoverview Priority formatting utilities
 * Provides colored priority displays for tasks
 */

import type { TaskPriority } from '@tm/core';
import chalk from 'chalk';

/**
 * Module-level priority color map to avoid recreating on every call
 */
const PRIORITY_COLORS: Record<TaskPriority, (text: string) => string> = {
	critical: chalk.red.bold,
	high: chalk.red,
	medium: chalk.yellow,
	low: chalk.gray
};

/**
 * Get colored priority display
 */
export function getPriorityWithColor(priority: TaskPriority): string {
	const colorFn = PRIORITY_COLORS[priority] || chalk.white;
	return colorFn(priority);
}
