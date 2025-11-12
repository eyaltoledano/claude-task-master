/**
 * @fileoverview Status formatting utilities
 * Provides colored status displays with ASCII icons for tasks and briefs
 */

import type { TaskStatus } from '@tm/core';
import chalk from 'chalk';

/**
 * Module-level task status configuration to avoid recreating on every call
 */
const TASK_STATUS_CONFIG: Record<
	TaskStatus,
	{ color: (text: string) => string; icon: string; tableIcon: string }
> = {
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

/**
 * Get colored status display with ASCII icons (matches scripts/modules/ui.js style)
 */
export function getStatusWithColor(
	status: TaskStatus,
	forTable: boolean = false
): string {
	const config = TASK_STATUS_CONFIG[status] || {
		color: chalk.red,
		icon: 'X',
		tableIcon: 'X'
	};

	const icon = forTable ? config.tableIcon : config.icon;
	return config.color(`${icon} ${status}`);
}

/**
 * Brief status configuration
 */
const BRIEF_STATUS_CONFIG: Record<
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

/**
 * Get the configuration for a brief status
 */
function getBriefStatusConfig(status: string) {
	// Normalize to lowercase for lookup
	const normalizedStatus = status.toLowerCase();
	return (
		BRIEF_STATUS_CONFIG[normalizedStatus] || {
			color: chalk.red,
			icon: '?',
			tableIcon: '?'
		}
	);
}

/**
 * Get the icon for a brief status
 */
export function getBriefStatusIcon(
	status: string | undefined,
	forTable: boolean = false
): string {
	if (!status) return '○';
	const config = getBriefStatusConfig(status);
	return forTable ? config.tableIcon : config.icon;
}

/**
 * Get the color function for a brief status
 */
export function getBriefStatusColor(
	status: string | undefined
): (text: string) => string {
	if (!status) return chalk.gray;
	return getBriefStatusConfig(status).color;
}

/**
 * Capitalize the first letter of a status
 */
export function capitalizeStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
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
		return chalk.gray('○ Unknown');
	}

	const config = getBriefStatusConfig(status);
	const icon = forTable ? config.tableIcon : config.icon;
	const displayStatus = capitalizeStatus(status);
	return config.color(`${icon} ${displayStatus}`);
}
