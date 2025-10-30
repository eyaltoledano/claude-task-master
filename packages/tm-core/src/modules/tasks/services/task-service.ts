/**
 * @fileoverview Task Service
 * Core service for task operations - handles business logic between storage and API
 */

import type {
	Task,
	TaskFilter,
	TaskStatus,
	StorageType
} from '../../../common/types/index.js';
import type { IStorage } from '../../../common/interfaces/storage.interface.js';
import { ConfigManager } from '../../config/managers/config-manager.js';
import { StorageFactory } from '../../storage/services/storage-factory.js';
import { TaskEntity } from '../entities/task.entity.js';
import { ERROR_CODES, TaskMasterError } from '../../../common/errors/task-master-error.js';
import { getLogger } from '../../../common/logger/factory.js';

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
	/** The tag/brief name for these tasks (brief name for API storage, tag for file storage) */
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
	private logger = getLogger('TaskService');

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

		this.storage = await StorageFactory.createFromStorageConfig(
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
			// Determine if we can push filters to storage layer
			const canPushStatusFilter =
				options.filter?.status &&
				!options.filter.priority &&
				!options.filter.tags &&
				!options.filter.assignee &&
				!options.filter.search &&
				options.filter.hasSubtasks === undefined;

			// Build storage-level options
			const storageOptions: any = {};

			// Push status filter to storage if it's the only filter
			if (canPushStatusFilter) {
				const statuses = Array.isArray(options.filter!.status)
					? options.filter!.status
					: [options.filter!.status];
				// Only push single status to storage (multiple statuses need in-memory filtering)
				if (statuses.length === 1) {
					storageOptions.status = statuses[0];
				}
			}

			// Push subtask exclusion to storage
			if (options.includeSubtasks === false) {
				storageOptions.excludeSubtasks = true;
			}

			// Load tasks from storage with pushed-down filters
			const rawTasks = await this.storage.loadTasks(tag, storageOptions);

			// Get total count without status filters, but preserve subtask exclusion
			const baseOptions: any = {};
			if (options.includeSubtasks === false) {
				baseOptions.excludeSubtasks = true;
			}

			const allTasks =
				storageOptions.status !== undefined
					? await this.storage.loadTasks(tag, baseOptions)
					: rawTasks;

			// Convert to TaskEntity for business logic operations
			const taskEntities = TaskEntity.fromArray(rawTasks);

			// Apply remaining filters in-memory if needed
			let filteredEntities = taskEntities;
			if (options.filter && !canPushStatusFilter) {
				filteredEntities = this.applyFilters(taskEntities, options.filter);
			} else if (
				options.filter?.status &&
				Array.isArray(options.filter.status) &&
				options.filter.status.length > 1
			) {
				// Multiple statuses - filter in-memory
				filteredEntities = this.applyFilters(taskEntities, options.filter);
			}

			// Convert back to plain objects
			const tasks = filteredEntities.map((entity) => entity.toJSON());

			// For API storage, use brief name. For file storage, use tag.
			// This way consumers don't need to know about the difference.
			const storageType = this.getStorageType();
			const tagOrBrief =
				storageType === 'api'
					? this.storage.getCurrentBriefName() || tag
					: tag;

			return {
				tasks,
				total: allTasks.length,
				filtered: filteredEntities.length,
				tag: tagOrBrief, // For API: brief name, For file: tag
				storageType
			};
		} catch (error) {
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't log it as an internal error
			if (
				error instanceof TaskMasterError &&
				error.is(ERROR_CODES.NO_BRIEF_SELECTED)
			) {
				// Just re-throw user-facing errors without wrapping
				throw error;
			}

			// Log internal errors
			this.logger.error('Failed to get task list', error);
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
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't wrap it
			if (
				error instanceof TaskMasterError &&
				error.is(ERROR_CODES.NO_BRIEF_SELECTED)
			) {
				throw error;
			}

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
	 * Get current storage type (resolved at runtime)
	 * Returns the actual storage type being used, never 'auto'
	 */
	getStorageType(): 'file' | 'api' {
		// Storage interface guarantees this method exists
		return this.storage.getStorageType();
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
	 * Update a task with new data (direct structural update)
	 * @param taskId - Task ID (supports numeric, alphanumeric, and subtask IDs)
	 * @param updates - Partial task object with fields to update
	 * @param tag - Optional tag context
	 */
	async updateTask(
		taskId: string | number,
		updates: Partial<Task>,
		tag?: string
	): Promise<void> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Auto-initialize if needed
		if (!this.initialized) {
			await this.initialize();
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// Direct update - no AI processing
			await this.storage.updateTask(taskIdStr, updates, activeTag);
		} catch (error) {
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't wrap it
			if (
				error instanceof TaskMasterError &&
				error.is(ERROR_CODES.NO_BRIEF_SELECTED)
			) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to update task ${taskId}`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTask',
					resource: 'task',
					taskId: taskIdStr,
					tag: activeTag
				},
				error as Error
			);
		}
	}

	/**
	 * Update a task using AI-powered prompt (natural language update)
	 * @param taskId - Task ID (supports numeric, alphanumeric, and subtask IDs)
	 * @param prompt - Natural language prompt describing the update
	 * @param tag - Optional tag context
	 * @param options - Optional update options
	 * @param options.useResearch - Use research AI for file storage updates
	 * @param options.mode - Update mode for API storage: 'append', 'update', or 'rewrite'
	 */
	async updateTaskWithPrompt(
		taskId: string | number,
		prompt: string,
		tag?: string,
		options?: { mode?: 'append' | 'update' | 'rewrite'; useResearch?: boolean }
	): Promise<void> {
		// Ensure we have storage
		if (!this.storage) {
			throw new TaskMasterError(
				'Storage not initialized',
				ERROR_CODES.STORAGE_ERROR
			);
		}

		// Auto-initialize if needed
		if (!this.initialized) {
			await this.initialize();
		}

		// Use provided tag or get active tag
		const activeTag = tag || this.getActiveTag();
		const taskIdStr = String(taskId);

		try {
			// AI-powered update - send prompt to storage layer
			// API storage: sends prompt to backend for server-side AI processing
			// File storage: must use client-side AI logic before calling this
			await this.storage.updateTaskWithPrompt(
				taskIdStr,
				prompt,
				activeTag,
				options
			);
		} catch (error) {
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't wrap it
			if (
				error instanceof TaskMasterError
			) {
				throw error;
			}

			throw new TaskMasterError(
				`Failed to update task ${taskId} with prompt`,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTaskWithPrompt',
					resource: 'task',
					taskId: taskIdStr,
					tag: activeTag,
					promptLength: prompt.length
				},
				error as Error
			);
		}
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
			// If it's a user-facing error (like NO_BRIEF_SELECTED), don't wrap it
			if (
				error instanceof TaskMasterError &&
				error.is(ERROR_CODES.NO_BRIEF_SELECTED)
			) {
				throw error;
			}

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
