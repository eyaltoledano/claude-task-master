import type { Task, TaskStatus, TaskComplexity } from '@tm/core';

/**
 * Helper functions for task display and formatting
 */

/**
 * Get color for task status
 */
export const getStatusColor = (status: TaskStatus): string => {
	switch (status) {
		case 'done':
			return 'green';
		case 'in-progress':
			return 'yellow';
		case 'pending':
			return 'blue';
		case 'review':
			return 'cyan';
		case 'deferred':
			return 'gray';
		case 'blocked':
			return 'magenta';
		case 'cancelled':
			return 'gray';
		default:
			return 'white';
	}
};

/**
 * Get color for task priority
 */
export const getPriorityColor = (priority?: string): string => {
	switch (priority) {
		case 'critical':
			return 'red';
		case 'high':
			return 'yellow';
		case 'medium':
			return 'blue';
		case 'low':
			return 'gray';
		default:
			return 'white';
	}
};

/**
 * Get complexity display (icon, text, color)
 */
export const getComplexityDisplay = (
	complexity: TaskComplexity | number | undefined
): { icon: string; text: string; color: string } => {
	if (complexity === undefined || complexity === null) {
		return { icon: '', text: 'N/A', color: 'gray' };
	}

	// Convert string complexity to numeric value
	let numericComplexity: number;
	if (typeof complexity === 'string') {
		const complexityMap: Record<TaskComplexity, number> = {
			simple: 2,
			moderate: 4,
			complex: 7,
			'very-complex': 9
		};
		numericComplexity = complexityMap[complexity] || 5;
	} else {
		numericComplexity = complexity;
	}

	// Use dots based on complexity level
	const dots = '●'.repeat(Math.min(numericComplexity, 10));

	if (numericComplexity >= 7) {
		return { icon: dots, text: numericComplexity.toString(), color: 'red' };
	} else if (numericComplexity >= 4) {
		return { icon: dots, text: numericComplexity.toString(), color: 'yellow' };
	} else {
		return { icon: dots, text: numericComplexity.toString(), color: 'green' };
	}
};

/**
 * Pad/truncate text to specific width
 */
export const padText = (
	text: string,
	width: number,
	align: 'left' | 'center' | 'right' = 'left'
): string => {
	// Truncate if too long
	const truncated = text.length > width ? text.slice(0, width - 1) + '…' : text;

	// Pad to width
	if (truncated.length < width) {
		const padding = ' '.repeat(width - truncated.length);
		if (align === 'right') {
			return padding + truncated;
		} else if (align === 'center') {
			const leftPad = Math.floor((width - truncated.length) / 2);
			const rightPad = width - truncated.length - leftPad;
			return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);
		} else {
			return truncated + padding;
		}
	}

	return truncated;
};

/**
 * Flatten tasks including subtasks for display
 */
export const flattenTasks = (tasks: Task[]): Array<any> => {
	const flattened: Array<any> = [];

	tasks.forEach((task) => {
		flattened.push(task);
		if (task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((subtask) => {
				flattened.push({
					...subtask,
					isSubtask: true,
					parentId: task.id
				});
			});
		}
	});

	return flattened;
};
