/**
 * Storage interface and base implementation for Task Master
 */

import type {
	Task,
	TaskMetadata,
	TaskFilter,
	TaskSortOptions
} from '../types/index.js';

/**
 * Storage statistics
 */
export interface StorageStats {
	totalTasks: number;
	totalTags: number;
	lastModified: string;
	storageSize?: number;
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
	basePath?: string;
	autoBackup?: boolean;
	backupInterval?: number;
	maxBackups?: number;
	compression?: boolean;
}

/**
 * Core storage interface for task persistence
 */
export interface IStorage {
	// Core task operations
	loadTasks(tag?: string): Promise<Task[]>;
	saveTasks(tasks: Task[], tag?: string): Promise<void>;
	appendTasks(tasks: Task[], tag?: string): Promise<void>;
	updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<boolean>;
	deleteTask(taskId: string, tag?: string): Promise<boolean>;
	exists(tag?: string): Promise<boolean>;

	// Metadata operations
	loadMetadata(tag?: string): Promise<TaskMetadata | null>;
	saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void>;

	// Tag management
	getAllTags(): Promise<string[]>;
	deleteTag(tag: string): Promise<boolean>;
	renameTag(oldTag: string, newTag: string): Promise<boolean>;
	copyTag(sourceTag: string, targetTag: string): Promise<boolean>;

	// Advanced operations
	searchTasks(filter: TaskFilter, tag?: string): Promise<Task[]>;
	sortTasks(tasks: Task[], options: TaskSortOptions): Task[];

	// Lifecycle methods
	initialize(): Promise<void>;
	close(): Promise<void>;
	getStats(): Promise<StorageStats>;
}

/**
 * Abstract base class for storage implementations
 */
export abstract class BaseStorage implements IStorage {
	protected config: StorageConfig;

	constructor(config: StorageConfig = {}) {
		this.config = {
			autoBackup: false,
			backupInterval: 3600000, // 1 hour
			maxBackups: 10,
			compression: false,
			...config
		};
	}

	// Abstract methods that must be implemented by subclasses
	abstract loadTasks(tag?: string): Promise<Task[]>;
	abstract saveTasks(tasks: Task[], tag?: string): Promise<void>;
	abstract exists(tag?: string): Promise<boolean>;
	abstract initialize(): Promise<void>;
	abstract close(): Promise<void>;
	abstract getAllTags(): Promise<string[]>;
	abstract getStats(): Promise<StorageStats>;

	// Default implementations that can be overridden
	async appendTasks(tasks: Task[], tag?: string): Promise<void> {
		const existingTasks = await this.loadTasks(tag);
		const existingIds = new Set(existingTasks.map((t) => t.id));
		const newTasks = tasks.filter((t) => !existingIds.has(t.id));
		const mergedTasks = [...existingTasks, ...newTasks];
		await this.saveTasks(mergedTasks, tag);
	}

	async updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<boolean> {
		const tasks = await this.loadTasks(tag);
		const taskIndex = tasks.findIndex((t) => t.id === taskId);

		if (taskIndex === -1) {
			return false;
		}

		tasks[taskIndex] = {
			...tasks[taskIndex],
			...updates,
			id: taskId, // Ensure ID cannot be changed
			updatedAt: new Date().toISOString()
		};

		await this.saveTasks(tasks, tag);
		return true;
	}

	async deleteTask(taskId: string, tag?: string): Promise<boolean> {
		const tasks = await this.loadTasks(tag);
		const filteredTasks = tasks.filter((t) => t.id !== taskId);

		if (tasks.length === filteredTasks.length) {
			return false; // Task not found
		}

		await this.saveTasks(filteredTasks, tag);
		return true;
	}

	async loadMetadata(tag?: string): Promise<TaskMetadata | null> {
		const tasks = await this.loadTasks(tag);
		if (tasks.length === 0) return null;

		const completedCount = tasks.filter((t) => t.status === 'done').length;

		return {
			version: '1.0.0',
			lastModified: new Date().toISOString(),
			taskCount: tasks.length,
			completedCount
		};
	}

	async saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void> {
		// Default implementation: metadata is derived from tasks
		// Subclasses can override if they store metadata separately
	}

	async deleteTag(tag: string): Promise<boolean> {
		if (await this.exists(tag)) {
			await this.saveTasks([], tag);
			return true;
		}
		return false;
	}

	async renameTag(oldTag: string, newTag: string): Promise<boolean> {
		if (!(await this.exists(oldTag))) {
			return false;
		}

		const tasks = await this.loadTasks(oldTag);
		await this.saveTasks(tasks, newTag);
		await this.deleteTag(oldTag);
		return true;
	}

	async copyTag(sourceTag: string, targetTag: string): Promise<boolean> {
		if (!(await this.exists(sourceTag))) {
			return false;
		}

		const tasks = await this.loadTasks(sourceTag);
		await this.saveTasks(tasks, targetTag);
		return true;
	}

	async searchTasks(filter: TaskFilter, tag?: string): Promise<Task[]> {
		const tasks = await this.loadTasks(tag);

		return tasks.filter((task) => {
			// Status filter
			if (filter.status) {
				const statuses = Array.isArray(filter.status)
					? filter.status
					: [filter.status];
				if (!statuses.includes(task.status)) return false;
			}

			// Priority filter
			if (filter.priority) {
				const priorities = Array.isArray(filter.priority)
					? filter.priority
					: [filter.priority];
				if (!priorities.includes(task.priority)) return false;
			}

			// Tags filter
			if (filter.tags && filter.tags.length > 0) {
				if (
					!task.tags ||
					!filter.tags.some((tag) => task.tags?.includes(tag))
				) {
					return false;
				}
			}

			// Subtasks filter
			if (filter.hasSubtasks !== undefined) {
				const hasSubtasks = task.subtasks && task.subtasks.length > 0;
				if (hasSubtasks !== filter.hasSubtasks) return false;
			}

			// Search filter
			if (filter.search) {
				const searchLower = filter.search.toLowerCase();
				const inTitle = task.title.toLowerCase().includes(searchLower);
				const inDescription = task.description
					.toLowerCase()
					.includes(searchLower);
				const inDetails = task.details.toLowerCase().includes(searchLower);
				if (!inTitle && !inDescription && !inDetails) return false;
			}

			// Assignee filter
			if (filter.assignee && task.assignee !== filter.assignee) {
				return false;
			}

			// Complexity filter
			if (filter.complexity) {
				const complexities = Array.isArray(filter.complexity)
					? filter.complexity
					: [filter.complexity];
				if (!task.complexity || !complexities.includes(task.complexity))
					return false;
			}

			return true;
		});
	}

	sortTasks(tasks: Task[], options: TaskSortOptions): Task[] {
		return [...tasks].sort((a, b) => {
			const aValue = a[options.field];
			const bValue = b[options.field];

			if (aValue === undefined || bValue === undefined) return 0;

			let comparison = 0;
			if (aValue < bValue) comparison = -1;
			if (aValue > bValue) comparison = 1;

			return options.direction === 'asc' ? comparison : -comparison;
		});
	}

	// Helper methods
	protected validateTask(task: Task): void {
		if (!task.id || typeof task.id !== 'string') {
			throw new Error('Task must have a valid string ID');
		}
		if (!task.title || typeof task.title !== 'string') {
			throw new Error('Task must have a valid title');
		}
		if (!task.status) {
			throw new Error('Task must have a valid status');
		}
	}

	protected sanitizeTag(tag: string): string {
		// Remove or replace characters that might cause filesystem issues
		return tag.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
	}

	protected getBackupPath(originalPath: string, timestamp: string): string {
		const parts = originalPath.split('.');
		const ext = parts.pop();
		return `${parts.join('.')}.backup.${timestamp}.${ext}`;
	}
}
