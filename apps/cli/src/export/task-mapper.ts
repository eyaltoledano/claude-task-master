/**
 * @fileoverview Task Mapper
 * Transforms CLI task structure to Hamster Studio format
 */

import type { ExportableTask, MappedTask } from './types.js';

/**
 * Status mapping from CLI to Hamster format
 */
const STATUS_MAP: Record<string, MappedTask['status']> = {
	pending: 'todo',
	'in-progress': 'in_progress',
	in_progress: 'in_progress',
	done: 'done',
	completed: 'done',
	blocked: 'blocked',
	deferred: 'todo',
	cancelled: 'done',
	review: 'in_progress'
};

/**
 * Priority mapping from CLI to Hamster format
 * Note: Hamster uses 'urgent' instead of 'critical'
 */
const PRIORITY_MAP: Record<string, MappedTask['priority']> = {
	low: 'low',
	medium: 'medium',
	high: 'high',
	critical: 'urgent',
	urgent: 'urgent',
	// Numeric priority mapping
	'1': 'urgent',
	'2': 'high',
	'3': 'medium',
	'4': 'low'
};

/**
 * Maps a single task from CLI format to Hamster format
 */
export function mapTask(task: ExportableTask): MappedTask {
	return {
		externalId: task.id,
		title: task.title,
		description: task.description || undefined,
		status: mapStatus(task.status),
		priority: mapPriority(task.priority),
		dependencies: task.dependencies?.length ? task.dependencies : undefined,
		metadata: {
			originalStatus: task.status,
			originalPriority: task.priority,
			createdAt: task.createdAt,
			updatedAt: task.updatedAt,
			source: 'task-master-cli'
		}
	};
}

/**
 * Maps multiple tasks
 */
export function mapTasks(tasks: ExportableTask[]): MappedTask[] {
	return tasks.map(mapTask);
}

/**
 * Maps CLI status to Hamster status
 */
export function mapStatus(status?: string): MappedTask['status'] {
	if (!status) return 'todo';

	const normalized = status.toLowerCase().trim();
	return STATUS_MAP[normalized] || 'todo';
}

/**
 * Maps CLI priority to Hamster priority
 */
export function mapPriority(priority?: string): MappedTask['priority'] {
	if (!priority) return 'medium';

	const normalized = priority.toLowerCase().trim();
	return PRIORITY_MAP[normalized] || 'medium';
}

/**
 * Flattens tasks with subtasks into a flat array
 * Subtasks get their parent ID prefixed
 */
export function flattenTasks(tasks: ExportableTask[]): ExportableTask[] {
	const result: ExportableTask[] = [];

	for (const task of tasks) {
		result.push(task);

		if (task.subtasks?.length) {
			for (const subtask of task.subtasks) {
				result.push({
					...subtask,
					id: `${task.id}.${subtask.id}`
				});
			}
		}
	}

	return result;
}

/**
 * Get display-friendly status for preview
 */
export function getDisplayStatus(status?: string): string {
	const mapped = mapStatus(status);
	const displayMap: Record<string, string> = {
		todo: '○ To Do',
		in_progress: '◐ In Progress',
		done: '● Done',
		blocked: '⊘ Blocked'
	};
	return displayMap[mapped] || '○ To Do';
}

/**
 * Get display-friendly priority for preview
 */
export function getDisplayPriority(priority?: string): string {
	const mapped = mapPriority(priority);
	const displayMap: Record<string, string> = {
		low: '↓ Low',
		medium: '→ Medium',
		high: '↑ High',
		urgent: '⚡ Urgent'
	};
	return displayMap[mapped] || '→ Medium';
}
