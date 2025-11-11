/**
 * @fileoverview Priority formatting utilities
 * Provides colored priority displays for tasks
 */

import type { TaskPriority } from '@tm/core';
import chalk from 'chalk';

/**
 * Get colored priority display
 */
export function getPriorityWithColor(priority: TaskPriority): string {
	const priorityColors: Record<TaskPriority, (text: string) => string> = {
		critical: chalk.red.bold,
		high: chalk.red,
		medium: chalk.yellow,
		low: chalk.gray
	};

	const colorFn = priorityColors[priority] || chalk.white;
	return colorFn(priority);
}
