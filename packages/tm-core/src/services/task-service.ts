/**
 * @fileoverview Task Service
 * Core service for task operations - handles business logic between storage and API
 */

import type { Task, TaskFilter, TaskStatus } from '../types/index.js';
import type { IStorage } from '../interfaces/storage.interface.js';
import { ConfigManager } from '../config/config-manager.js';
import { StorageFactory } from '../storage/storage-factory.js';
import { TaskEntity } from '../entities/task.entity.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';

/**
 * Result returned by getTaskList
 */
export interface TaskListResult {
	/** The filtered list of tasks */
	tasks: Task[];
	/** Total number of tasks before filtering */
	total: number;
	/** Number of tasks after filtering */
	filtered: number;
	/** The tag these tasks belong to (only present if explicitly provided) */
	tag?: string;
	/** Storage type being used */
	storageType: 'file' | 'api';
}

/**
 * Options for getTaskList
 */
export interface GetTaskListOptions {
	/** Optional tag override (uses active tag from config if not provided) */
	tag?: string;
	/** Filter criteria */
	filter?: TaskFilter;
	/** Include subtasks in response */
	includeSubtasks?: boolean;
}

/**
 * TaskService handles all task-related operations
 * This is where business logic lives - it coordinates between ConfigManager and Storage
 */
export class TaskService {
	private configManager: ConfigManager;
	private storage: IStorage;
	private initialized = false;

	constructor(configManager: ConfigManager) {
		this.configManager = configManager;

		// Storage will be created during initialization
		this.storage = null as any;
	}

	/**
	 * Initialize the service
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Create storage based on configuration
		const storageConfig = this.configManager.getStorageConfig();
		const projectRoot = this.configManager.getProjectRoot();

		this.storage = StorageFactory.create(
			{ storage: storageConfig } as any,
			projectRoot
		);

		// Initialize storage
		await this.storage.initialize();

		this.initialized = true;
	}

	/**
	 * Get list of tasks
	 * This is the main method that retrieves tasks from storage and applies filters
	 */
	async getTaskList(options: GetTaskListOptions = {}): Promise<TaskListResult> {
		// Determine which tag to use
		const activeTag = this.configManager.getActiveTag();
		const tag = options.tag || activeTag;

		try {
			// Load raw tasks from storage - storage only knows about tags
			const rawTasks = await this.storage.loadTasks(tag);

			// Convert to TaskEntity for business logic operations
			const taskEntities = TaskEntity.fromArray(rawTasks);

			// Apply filters if provided
			let filteredEntities = taskEntities;
			if (options.filter) {
				filteredEntities = this.applyFilters(taskEntities, options.filter);
			}

			// Convert back to plain objects
			let tasks = filteredEntities.map((entity) => entity.toJSON());

			// Handle subtasks option
			if (options.includeSubtasks === false) {
				tasks = tasks.map((task) => ({
					...task,
					subtasks: []
				}));
			}

			return {
				tasks,
				total: rawTasks.length,
				filtered: filteredEntities.length,
				tag: options.tag, // Only include tag if explicitly provided
				storageType: this.configManager.getStorageConfig().type
			};
		} catch (error) {
			throw new TaskMasterError(
				'Failed to get task list',
				ERROR_CODES.INTERNAL_ERROR,
				{
					operation: 'getTaskList',
					tag,
					hasFilter: !!options.filter
				},
				error as Error
			);
		}
	}

	/**
	 * Get a single task by ID
	 */
	async getTask(taskId: string, tag?: string): Promise<Task | null> {
		const result = await this.getTaskList({
			tag,
			includeSubtasks: true
		});

		return result.tasks.find((t) => t.id === taskId) || null;
	}

	/**
	 * Get tasks filtered by status
	 */
	async getTasksByStatus(
		status: TaskStatus | TaskStatus[],
		tag?: string
	): Promise<Task[]> {
		const statuses = Array.isArray(status) ? status : [status];

		const result = await this.getTaskList({
			tag,
			filter: { status: statuses }
		});

		return result.tasks;
	}

	/**
	 * Get statistics about tasks
	 */
	async getTaskStats(tag?: string): Promise<{
		total: number;
		byStatus: Record<TaskStatus, number>;
		withSubtasks: number;
		blocked: number;
		storageType: 'file' | 'api';
	}> {
		const result = await this.getTaskList({
			tag,
			includeSubtasks: true
		});

		const stats = {
			total: result.total,
			byStatus: {} as Record<TaskStatus, number>,
			withSubtasks: 0,
			blocked: 0,
			storageType: result.storageType
		};

		// Initialize all statuses
		const allStatuses: TaskStatus[] = [
			'pending',
			'in-progress',
			'done',
			'deferred',
			'cancelled',
			'blocked',
			'review'
		];

		allStatuses.forEach((status) => {
			stats.byStatus[status] = 0;
		});

		// Count tasks
		result.tasks.forEach((task) => {
			stats.byStatus[task.status]++;

			if (task.subtasks && task.subtasks.length > 0) {
				stats.withSubtasks++;
			}

			if (task.status === 'blocked') {
				stats.blocked++;
			}
		});

		return stats;
	}

	/**
	 * Get next available task to work on
	 */
	async getNextTask(tag?: string): Promise<Task | null> {
		const result = await this.getTaskList({
			tag,
			filter: {
				status: ['pending', 'in-progress']
			}
		});

		// Find tasks with no dependencies or all dependencies satisfied
		const completedIds = new Set(
			result.tasks.filter((t) => t.status === 'done').map((t) => t.id)
		);

		const availableTasks = result.tasks.filter((task) => {
			if (task.status === 'done' || task.status === 'blocked') {
				return false;
			}

			if (!task.dependencies || task.dependencies.length === 0) {
				return true;
			}

			return task.dependencies.every((depId) =>
				completedIds.has(depId.toString())
			);
		});

		// Sort by priority
		availableTasks.sort((a, b) => {
			const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
			const aPriority = priorityOrder[a.priority || 'medium'];
			const bPriority = priorityOrder[b.priority || 'medium'];
			return aPriority - bPriority;
		});

		return availableTasks[0] || null;
	}

	/**
	 * Apply filters to task entities
	 */
	private applyFilters(tasks: TaskEntity[], filter: TaskFilter): TaskEntity[] {
		return tasks.filter((task) => {
			// Status filter
			if (filter.status) {
				const statuses = Array.isArray(filter.status)
					? filter.status
					: [filter.status];
				if (!statuses.includes(task.status)) {
					return false;
				}
			}

			// Priority filter
			if (filter.priority) {
				const priorities = Array.isArray(filter.priority)
					? filter.priority
					: [filter.priority];
				if (!priorities.includes(task.priority)) {
					return false;
				}
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

			// Assignee filter
			if (filter.assignee) {
				if (task.assignee !== filter.assignee) {
					return false;
				}
			}

			// Complexity filter
			if (filter.complexity) {
				const complexities = Array.isArray(filter.complexity)
					? filter.complexity
					: [filter.complexity];
				if (!task.complexity || !complexities.includes(task.complexity)) {
					return false;
				}
			}

			// Search filter
			if (filter.search) {
				const searchLower = filter.search.toLowerCase();
				const inTitle = task.title.toLowerCase().includes(searchLower);
				const inDescription = task.description
					.toLowerCase()
					.includes(searchLower);
				const inDetails = task.details.toLowerCase().includes(searchLower);

				if (!inTitle && !inDescription && !inDetails) {
					return false;
				}
			}

			// Has subtasks filter
			if (filter.hasSubtasks !== undefined) {
				const hasSubtasks = task.subtasks.length > 0;
				if (hasSubtasks !== filter.hasSubtasks) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Get current storage type
	 */
	getStorageType(): 'file' | 'api' {
		return this.configManager.getStorageConfig().type;
	}

	/**
	 * Get current active tag
	 */
	getActiveTag(): string {
		return this.configManager.getActiveTag();
	}

	/**
	 * Set active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		await this.configManager.setActiveTag(tag);
	}
}
