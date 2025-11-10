/**
 * @fileoverview Status formatting utilities
 * Provides colored status displays with ASCII icons for tasks and briefs
 */

import chalk from 'chalk';
import type { TaskStatus } from '@tm/core';

/**
 * Get colored status display with ASCII icons (matches scripts/modules/ui.js style)
 */
export function getStatusWithColor(
	status: TaskStatus,
	forTable: boolean = false
): string {
	const statusConfig = {
		done: {
			color: chalk.green,
			icon: '✓',
			tableIcon: '✓'
		},
		pending: {
			color: chalk.yellow,
			icon: '○',
			tableIcon: '○'
		},
		'in-progress': {
			color: chalk.hex('#FFA500'),
			icon: '▶',
			tableIcon: '▶'
		},
		deferred: {
			color: chalk.gray,
			icon: 'x',
			tableIcon: 'x'
		},
		review: {
			color: chalk.magenta,
			icon: '?',
			tableIcon: '?'
		},
		cancelled: {
			color: chalk.gray,
			icon: 'x',
			tableIcon: 'x'
		},
		blocked: {
			color: chalk.red,
			icon: '!',
			tableIcon: '!'
		},
		completed: {
			color: chalk.green,
			icon: '✓',
			tableIcon: '✓'
		}
	};

	const config = statusConfig[status] || {
		color: chalk.red,
		icon: 'X',
		tableIcon: 'X'
	};

	const icon = forTable ? config.tableIcon : config.icon;
	return config.color(`${icon} ${status}`);
}

/**
 * Get colored brief/tag status display with ASCII icons
 * Brief statuses: draft, refining, aligned, delivering, delivered, done, archived
 */
export function getBriefStatusWithColor(
	status: string | undefined,
	forTable: boolean = false
): string {
	if (!status) {
		return chalk.gray('○ unknown');
	}

	const statusConfig: Record<
		string,
		{ color: (text: string) => string; icon: string; tableIcon: string }
	> = {
		draft: {
			color: chalk.gray,
			icon: '○',
			tableIcon: '○'
		},
		refining: {
			color: chalk.yellow,
			icon: '◐',
			tableIcon: '◐'
		},
		aligned: {
			color: chalk.cyan,
			icon: '◎',
			tableIcon: '◎'
		},
		delivering: {
			color: chalk.hex('#FFA500'), // orange
			icon: '▶',
			tableIcon: '▶'
		},
		delivered: {
			color: chalk.blue,
			icon: '◆',
			tableIcon: '◆'
		},
		done: {
			color: chalk.green,
			icon: '✓',
			tableIcon: '✓'
		},
		archived: {
			color: chalk.gray,
			icon: '■',
			tableIcon: '■'
		}
	};

	const config = statusConfig[status] || {
		color: chalk.red,
		icon: '?',
		tableIcon: '?'
	};

	const icon = forTable ? config.tableIcon : config.icon;
	return config.color(`${icon} ${status}`);
}
