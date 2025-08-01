/**
 * Task Repository - Simplified version
 * Handles data access with caching
 */

import { EventEmitter } from '../utils/event-emitter';
import type { ExtensionLogger } from '../utils/logger';
import type { TaskMasterApi, TaskMasterTask } from '../utils/task-master-api';

// Use the TaskMasterTask type directly to ensure compatibility
export type Task = TaskMasterTask;

export class TaskRepository extends EventEmitter {
	private cache: Task[] | null = null;
	private cacheTimestamp = 0;
	private readonly CACHE_DURATION = 30000; // 30 seconds

	constructor(
		private api: TaskMasterApi,
		private logger: ExtensionLogger
	) {
		super();
	}

	async getAll(options?: {
		tag?: string;
		withSubtasks?: boolean;
	}): Promise<Task[]> {
		// If a tag is specified, always fetch fresh data
		const shouldUseCache =
			!options?.tag &&
			this.cache &&
			Date.now() - this.cacheTimestamp < this.CACHE_DURATION;

		if (shouldUseCache) {
			return this.cache || [];
		}

		try {
			const result = await this.api.getTasks({
				withSubtasks: options?.withSubtasks ?? true,
				tag: options?.tag
			});

			if (result.success && result.data) {
				this.cache = result.data;
				this.cacheTimestamp = Date.now();
				this.emit('tasks:updated', result.data);
				return result.data;
			}

			throw new Error(result.error || 'Failed to fetch tasks');
		} catch (error) {
			this.logger.error('Failed to get tasks', error);
			throw error;
		}
	}

	async getById(taskId: string): Promise<Task | null> {
		// First check cache
		if (this.cache) {
			// Handle both main tasks and subtasks
			for (const task of this.cache) {
				if (task.id === taskId) {
					return task;
				}
				// Check subtasks
				if (task.subtasks) {
					for (const subtask of task.subtasks) {
						if (
							subtask.id.toString() === taskId ||
							`${task.id}.${subtask.id}` === taskId
						) {
							return {
								...subtask,
								id: subtask.id.toString(),
								description: subtask.description || '',
								status: (subtask.status ||
									'pending') as TaskMasterTask['status'],
								priority: 'medium' as const,
								dependencies:
									subtask.dependencies?.map((d) => d.toString()) || []
							};
						}
					}
				}
			}
		}

		// If not in cache, fetch all and search
		const tasks = await this.getAll();
		for (const task of tasks) {
			if (task.id === taskId) {
				return task;
			}
			// Check subtasks
			if (task.subtasks) {
				for (const subtask of task.subtasks) {
					if (
						subtask.id.toString() === taskId ||
						`${task.id}.${subtask.id}` === taskId
					) {
						return {
							...subtask,
							id: subtask.id.toString(),
							description: subtask.description || '',
							status: (subtask.status || 'pending') as TaskMasterTask['status'],
							priority: 'medium' as const,
							dependencies: subtask.dependencies?.map((d) => d.toString()) || []
						};
					}
				}
			}
		}

		return null;
	}

	async updateStatus(taskId: string, status: Task['status']): Promise<void> {
		try {
			const result = await this.api.updateTaskStatus(taskId, status);

			if (!result.success) {
				throw new Error(result.error || 'Failed to update status');
			}

			// Invalidate cache
			this.cache = null;

			// Fetch updated tasks
			await this.getAll();
		} catch (error) {
			this.logger.error('Failed to update task status', error);
			throw error;
		}
	}

	async updateContent(taskId: string, updates: any): Promise<void> {
		try {
			const result = await this.api.updateTask(taskId, updates, {
				append: false,
				research: false
			});

			if (!result.success) {
				throw new Error(result.error || 'Failed to update task');
			}

			// Invalidate cache
			this.cache = null;

			// Fetch updated tasks
			await this.getAll();
		} catch (error) {
			this.logger.error('Failed to update task content', error);
			throw error;
		}
	}

	async refresh(): Promise<void> {
		this.cache = null;
		await this.getAll();
	}

	isConnected(): boolean {
		return this.api.getConnectionStatus().isConnected;
	}
}
