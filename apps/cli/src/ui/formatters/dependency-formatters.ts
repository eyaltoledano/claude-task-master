/**
 * @fileoverview Dependency formatting utilities
 * Provides formatted dependency displays with status indicators
 */

import type { Task } from '@tm/core';
import chalk from 'chalk';

/**
 * Format dependencies with their status
 */
export function formatDependenciesWithStatus(
	dependencies: string[] | number[],
	tasks: Task[]
): string {
	if (!dependencies || dependencies.length === 0) {
		return chalk.gray('none');
	}

	const taskMap = new Map(tasks.map((t) => [t.id.toString(), t]));

	return dependencies
		.map((depId) => {
			const task = taskMap.get(depId.toString());
			if (!task) {
				return chalk.red(`${depId} (not found)`);
			}

			const statusIcon =
				task.status === 'done'
					? '✓'
					: task.status === 'in-progress'
						? '►'
						: '○';

			return `${depId}${statusIcon}`;
		})
		.join(', ');
}
