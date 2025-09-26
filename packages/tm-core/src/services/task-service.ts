/**
 * @fileoverview Task Service
 * Core service for task operations - handles business logic between storage and API
 */

import type {
	Task,
	TaskFilter,
	TaskStatus,
	StorageType
} from '../types/index.js';
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
	storageType: StorageType;
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

		this.storage = StorageFactory.createFromStorageConfig(
			storageConfig,
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
				tag: tag, // Return the actual tag being used (either explicitly provided or active tag)
				storageType: this.getStorageType()
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
	 * Get a single task by ID - delegates to storage layer
	 */
	async getTask(taskId: string, tag?: string): Promise<Task | null> {
		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();

		try {
			// Delegate to storage layer which handles the specific logic for tasks vs subtasks
			return await this.storage.loadTask(String(taskId), activeTag);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to get task ${taskId}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'getTask',
					resource: 'task',
					taskId: String(taskId),
					tag: activeTag
				},
				error as Error
			);
		}
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
		storageType: StorageType;
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
	 * Prioritizes eligible subtasks from in-progress parent tasks before falling back to top-level tasks
	 */
	async getNextTask(tag?: string): Promise<Task | null> {
		const result = await this.getTaskList({
			tag,
			filter: {
				status: ['pending', 'in-progress', 'done']
			}
		});

		const allTasks = result.tasks;
		const priorityValues = { critical: 4, high: 3, medium: 2, low: 1 };

		// Helper to convert subtask dependencies to full dotted notation
		const toFullSubId = (
			parentId: string,
			maybeDotId: string | number
		): string => {
			if (typeof maybeDotId === 'string' && maybeDotId.includes('.')) {
				return maybeDotId;
			}
			return `${parentId}.${maybeDotId}`;
		};

		// Build completed IDs set (both tasks and subtasks)
		const completedIds = new Set<string>();
		allTasks.forEach((t) => {
			if (t.status === 'done') {
				completedIds.add(String(t.id));
			}
			if (Array.isArray(t.subtasks)) {
				t.subtasks.forEach((st) => {
					if (st.status === 'done') {
						completedIds.add(`${t.id}.${st.id}`);
					}
				});
			}
		});

		// 1) Look for eligible subtasks from in-progress parent tasks
		const candidateSubtasks: Array<Task & { parentId?: string }> = [];

		allTasks
			.filter((t) => t.status === 'in-progress' && Array.isArray(t.subtasks))
			.forEach((parent) => {
				parent.subtasks!.forEach((st) => {
					const stStatus = (st.status || 'pending').toLowerCase();
					if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

					const fullDeps =
						st.dependencies?.map((d) => toFullSubId(String(parent.id), d)) ??
						[];
					const depsSatisfied =
						fullDeps.length === 0 ||
						fullDeps.every((depId) => completedIds.has(String(depId)));

					if (depsSatisfied) {
						candidateSubtasks.push({
							id: `${parent.id}.${st.id}`,
							title: st.title || `Subtask ${st.id}`,
							status: st.status || 'pending',
							priority: st.priority || parent.priority || 'medium',
							dependencies: fullDeps,
							parentId: String(parent.id),
							description: st.description,
							details: st.details,
							testStrategy: st.testStrategy,
							subtasks: []
						} as Task & { parentId: string });
					}
				});
			});

		if (candidateSubtasks.length > 0) {
			// Sort by priority → dependency count → parent ID → subtask ID
			candidateSubtasks.sort((a, b) => {
				const pa =
					priorityValues[a.priority as keyof typeof priorityValues] ?? 2;
				const pb =
					priorityValues[b.priority as keyof typeof priorityValues] ?? 2;
				if (pb !== pa) return pb - pa;

				if (a.dependencies!.length !== b.dependencies!.length) {
					return a.dependencies!.length - b.dependencies!.length;
				}

				// Compare parent then subtask ID numerically
				const [aPar, aSub] = String(a.id).split('.').map(Number);
				const [bPar, bSub] = String(b.id).split('.').map(Number);
				if (aPar !== bPar) return aPar - bPar;
				return aSub - bSub;
			});

			return candidateSubtasks[0];
		}

		// 2) Fall back to top-level tasks (original logic)
		const eligibleTasks = allTasks.filter((task) => {
			const status = (task.status || 'pending').toLowerCase();
			if (status !== 'pending' && status !== 'in-progress') return false;

			const deps = task.dependencies ?? [];
			return deps.every((depId) => completedIds.has(String(depId)));
		});

		if (eligibleTasks.length === 0) return null;

		// Sort by priority → dependency count → task ID
		const nextTask = eligibleTasks.sort((a, b) => {
			const pa = priorityValues[a.priority as keyof typeof priorityValues] ?? 2;
			const pb = priorityValues[b.priority as keyof typeof priorityValues] ?? 2;
			if (pb !== pa) return pb - pa;

			const da = (a.dependencies ?? []).length;
			const db = (b.dependencies ?? []).length;
			if (da !== db) return da - db;

			return Number(a.id) - Number(b.id);
		})[0];

		return nextTask;
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
	getStorageType(): StorageType {
		// Prefer the runtime storage type if available to avoid exposing 'auto'
		const s = this.storage as { getType?: () => 'file' | 'api' } | null;
		const runtimeType = s?.getType?.();
		return (runtimeType ??
			this.configManager.getStorageConfig().type) as StorageType;
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

	/**
	 * Update task status - delegates to storage layer which handles storage-specific logic
	 */
	async updateTaskStatus(
		taskId: string | number,
		newStatus: TaskStatus,
		tag?: string
	): Promise<{
		success: boolean;
		oldStatus: TaskStatus;
		newStatus: TaskStatus;
		taskId: string;
	}> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// Delegate to storage layer which handles the specific logic for tasks vs subtasks
			return await this.storage.updateTaskStatus(
				taskIdStr,
				newStatus,
				activeTag
			);
		} catch (error) {
			throw new TaskMasterError(
				`Failed to update task status for ${taskIdStr}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTaskStatus',
					resource: 'task',
					taskId: taskIdStr,
					newStatus,
					tag: activeTag
				},
				error as Error
			);
		}
	}
}
