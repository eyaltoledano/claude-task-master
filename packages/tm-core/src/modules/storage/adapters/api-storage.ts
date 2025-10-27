/**
 * @fileoverview API-based storage implementation using repository pattern
 * This provides storage via repository abstraction for flexibility
 */

import type {
	IStorage,
	StorageStats,
	UpdateStatusResult,
	LoadTasksOptions
} from '../../../common/interfaces/storage.interface.js';
import type {
	Task,
	TaskMetadata,
	TaskTag,
	TaskStatus
} from '../../../common/types/index.js';
import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';
import { TaskRepository } from '../../tasks/repositories/task-repository.interface.js';
import { SupabaseTaskRepository } from '../../tasks/repositories/supabase/index.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthManager } from '../../auth/managers/auth-manager.js';
import { ApiClient } from '../utils/api-client.js';
import { getLogger } from '../../../common/logger/factory.js';

/**
 * API storage configuration
 */
export interface ApiStorageConfig {
	/** Supabase client instance */
	supabaseClient?: SupabaseClient;
	/** Custom repository implementation */
	repository?: TaskRepository;
	/** Project ID for scoping */
	projectId: string;
	/** Enable request retries */
	enableRetry?: boolean;
	/** Maximum retry attempts */
	maxRetries?: number;
}

/**
 * Auth context with a guaranteed briefId
 */
type ContextWithBrief = NonNullable<
	ReturnType<typeof AuthManager.prototype.getContext>
> & { briefId: string };

/**
 * Response from the update task with prompt API endpoint
 */
interface UpdateTaskWithPromptResponse {
	success: boolean;
	task: {
		id: string;
		displayId: string | null;
		title: string;
		description: string | null;
		status: string;
		priority: string | null;
	};
	message: string;
}

/**
 * ApiStorage implementation using repository pattern
 * Provides flexibility to swap between different backend implementations
 */
export class ApiStorage implements IStorage {
	private readonly repository: TaskRepository;
	private readonly projectId: string;
	private readonly enableRetry: boolean;
	private readonly maxRetries: number;
	private initialized = false;
	private tagsCache: Map<string, TaskTag> = new Map();
	private apiClient?: ApiClient;
	private readonly logger = getLogger('ApiStorage');

	constructor(config: ApiStorageConfig) {
		this.validateConfig(config);

		// Use provided repository or create Supabase repository
		if (config.repository) {
			this.repository = config.repository;
		} else if (config.supabaseClient) {
			// TODO: SupabaseTaskRepository doesn't implement all TaskRepository methods yet
			// Cast for now until full implementation is complete
			this.repository = new SupabaseTaskRepository(
				config.supabaseClient
			) as unknown as TaskRepository;
		} else {
			throw new TaskMasterError(
				'Either repository or supabaseClient must be provided',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		this.projectId = config.projectId;
		this.enableRetry = config.enableRetry ?? true;
		this.maxRetries = config.maxRetries ?? 3;
	}

	/**
	 * Validate API storage configuration
	 */
	private validateConfig(config: ApiStorageConfig): void {
		if (!config.projectId) {
			throw new TaskMasterError(
				'Project ID is required for API storage',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		if (!config.repository && !config.supabaseClient) {
			throw new TaskMasterError(
				'Either repository or supabaseClient must be provided',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}
	}

	/**
	 * Initialize the API storage
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Load initial tags
			await this.loadTagsIntoCache();
			this.initialized = true;
		} catch (error) {
			throw new TaskMasterError(
				'Failed to initialize API storage',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'initialize' },
				error as Error
			);
		}
	}

	/**
	 * Get the storage type
	 */
	getStorageType(): 'api' {
		return 'api';
	}

	/**
	 * Get the current brief name
	 * @returns The brief name if a brief is selected, null otherwise
	 */
	getCurrentBriefName(): string | null {
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();
		return context?.briefName || null;
	}

	/**
	 * Load tags into cache
	 * In our API-based system, "tags" represent briefs
	 */
	private async loadTagsIntoCache(): Promise<void> {
		try {
			const authManager = AuthManager.getInstance();
			const context = authManager.getContext();

			// If we have a selected brief, create a virtual "tag" for it
			if (context?.briefId) {
				// Create a virtual tag representing the current brief
				const briefTag: TaskTag = {
					name: context.briefId,
					tasks: [], // Will be populated when tasks are loaded
					metadata: {
						briefId: context.briefId,
						briefName: context.briefName,
						organizationId: context.orgId
					}
				};

				this.tagsCache.clear();
				this.tagsCache.set(context.briefId, briefTag);
			}
		} catch (error) {
			// If no brief is selected, that's okay - user needs to select one first
			console.debug('No brief selected, starting with empty cache');
		}
	}

	/**
	 * Load tasks from API
	 * In our system, the tag parameter represents a brief ID
	 */
	async loadTasks(tag?: string, options?: LoadTasksOptions): Promise<Task[]> {
		await this.ensureInitialized();

		try {
			const context = this.ensureBriefSelected('loadTasks');

			// Load tasks from the current brief context with filters pushed to repository
			const tasks = await this.retryOperation(() =>
				this.repository.getTasks(this.projectId, options)
			);

			// Update the tag cache with the loaded task IDs
			const briefTag = this.tagsCache.get(context.briefId);
			if (briefTag) {
				briefTag.tasks = tasks.map((task) => task.id);
			}

			return tasks;
		} catch (error) {
			this.wrapError(error, 'Failed to load tasks from API', {
				operation: 'loadTasks',
				tag,
				context: 'brief-based loading'
			});
		}
	}

	/**
	 * Save tasks to API
	 */
	async saveTasks(tasks: Task[], tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			if (tag) {
				// Update tag with task IDs
				const tagData = this.tagsCache.get(tag) || {
					name: tag,
					tasks: [],
					metadata: {}
				};
				tagData.tasks = tasks.map((t) => t.id);

				// Save or update tag
				if (this.tagsCache.has(tag)) {
					await this.repository.updateTag(this.projectId, tag, tagData);
				} else {
					await this.repository.createTag(this.projectId, tagData);
				}

				this.tagsCache.set(tag, tagData);
			}

			// Save tasks using bulk operation
			await this.retryOperation(() =>
				this.repository.bulkCreateTasks(this.projectId, tasks)
			);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to save tasks to API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'saveTasks', tag, taskCount: tasks.length },
				error as Error
			);
		}
	}

	/**
	 * Load a single task by ID
	 */
	async loadTask(taskId: string, tag?: string): Promise<Task | null> {
		await this.ensureInitialized();

		try {
			this.ensureBriefSelected('loadTask');

			return await this.retryOperation(() =>
				this.repository.getTask(this.projectId, taskId)
			);
		} catch (error) {
			this.wrapError(error, 'Failed to load task from API', {
				operation: 'loadTask',
				taskId,
				tag
			});
		}
	}

	/**
	 * Save a single task
	 */
	async saveTask(task: Task, tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			// Check if task exists
			const existing = await this.repository.getTask(this.projectId, task.id);

			if (existing) {
				await this.retryOperation(() =>
					this.repository.updateTask(this.projectId, task.id, task)
				);
			} else {
				await this.retryOperation(() =>
					this.repository.createTask(this.projectId, task)
				);
			}

			// Update tag if specified
			if (tag) {
				const tagData = this.tagsCache.get(tag);
				if (tagData && !tagData.tasks.includes(task.id)) {
					tagData.tasks.push(task.id);
					await this.repository.updateTag(this.projectId, tag, tagData);
				}
			}
		} catch (error) {
			throw new TaskMasterError(
				'Failed to save task to API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'saveTask', taskId: task.id, tag },
				error as Error
			);
		}
	}

	/**
	 * Delete a task
	 */
	async deleteTask(taskId: string, tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			await this.retryOperation(() =>
				this.repository.deleteTask(this.projectId, taskId)
			);

			// Remove from tag if specified
			if (tag) {
				const tagData = this.tagsCache.get(tag);
				if (tagData) {
					tagData.tasks = tagData.tasks.filter((id) => id !== taskId);
					await this.repository.updateTag(this.projectId, tag, tagData);
				}
			}
		} catch (error) {
			throw new TaskMasterError(
				'Failed to delete task from API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'deleteTask', taskId, tag },
				error as Error
			);
		}
	}

	/**
	 * List available tags (briefs in our system)
	 */
	async listTags(): Promise<string[]> {
		await this.ensureInitialized();

		try {
			const authManager = AuthManager.getInstance();
			const context = authManager.getContext();

			// In our API-based system, we only have one "tag" at a time - the current brief
			if (context?.briefId) {
				// Ensure the current brief is in our cache
				await this.loadTagsIntoCache();
				return [context.briefId];
			}

			// No brief selected, return empty array
			return [];
		} catch (error) {
			throw new TaskMasterError(
				'Failed to list tags from API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'listTags' },
				error as Error
			);
		}
	}

	/**
	 * Load metadata
	 */
	async loadMetadata(tag?: string): Promise<TaskMetadata | null> {
		await this.ensureInitialized();

		try {
			if (tag) {
				const tagData = this.tagsCache.get(tag);
				return (tagData?.metadata as TaskMetadata) || null;
			}

			// Return global metadata if no tag specified
			// This could be stored in a special system tag
			const systemTag = await this.repository.getTag(this.projectId, '_system');
			return (systemTag?.metadata as TaskMetadata) || null;
		} catch (error) {
			throw new TaskMasterError(
				'Failed to load metadata from API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'loadMetadata', tag },
				error as Error
			);
		}
	}

	/**
	 * Save metadata
	 */
	async saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			if (tag) {
				const tagData = this.tagsCache.get(tag) || {
					name: tag,
					tasks: [],
					metadata: {}
				};
				tagData.metadata = metadata as any;

				if (this.tagsCache.has(tag)) {
					await this.repository.updateTag(this.projectId, tag, tagData);
				} else {
					await this.repository.createTag(this.projectId, tagData);
				}

				this.tagsCache.set(tag, tagData);
			} else {
				// Save to system tag
				const systemTag: TaskTag = {
					name: '_system',
					tasks: [],
					metadata: metadata as any
				};

				const existing = await this.repository.getTag(
					this.projectId,
					'_system'
				);
				if (existing) {
					await this.repository.updateTag(this.projectId, '_system', systemTag);
				} else {
					await this.repository.createTag(this.projectId, systemTag);
				}
			}
		} catch (error) {
			throw new TaskMasterError(
				'Failed to save metadata to API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'saveMetadata', tag },
				error as Error
			);
		}
	}

	/**
	 * Check if storage exists
	 */
	async exists(): Promise<boolean> {
		try {
			await this.initialize();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Append tasks to existing storage
	 */
	async appendTasks(tasks: Task[], tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			// Use bulk create - repository should handle duplicates
			await this.retryOperation(() =>
				this.repository.bulkCreateTasks(this.projectId, tasks)
			);

			// Update tag if specified
			if (tag) {
				const tagData = this.tagsCache.get(tag) || {
					name: tag,
					tasks: [],
					metadata: {}
				};

				const newTaskIds = tasks.map((t) => t.id);
				tagData.tasks = [...new Set([...tagData.tasks, ...newTaskIds])];

				if (this.tagsCache.has(tag)) {
					await this.repository.updateTag(this.projectId, tag, tagData);
				} else {
					await this.repository.createTag(this.projectId, tagData);
				}

				this.tagsCache.set(tag, tagData);
			}
		} catch (error) {
			throw new TaskMasterError(
				'Failed to append tasks to API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'appendTasks', tag, taskCount: tasks.length },
				error as Error
			);
		}
	}

	/**
	 * Update a specific task
	 */
	async updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<void> {
		await this.ensureInitialized();

		try {
			await this.retryOperation(() =>
				this.repository.updateTask(this.projectId, taskId, updates)
			);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to update task via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'updateTask', taskId, tag },
				error as Error
			);
		}
	}

	/**
	 * Update task with AI-powered prompt
	 * Sends prompt to backend for server-side AI processing
	 */
	async updateTaskWithPrompt(
		taskId: string,
		prompt: string,
		tag?: string,
		options?: { useResearch?: boolean; mode?: 'append' | 'update' | 'rewrite' }
	): Promise<void> {
		await this.ensureInitialized();

		const mode = options?.mode ?? 'append';

		try {
			// Use the API client - all auth, error handling, etc. is centralized
			const apiClient = this.getApiClient();

			const result = await apiClient.patch<UpdateTaskWithPromptResponse>(
				`/ai/api/v1/tasks/${taskId}/prompt`,
				{ prompt, mode }
			);

			if (!result.success) {
				// API returned success: false
				throw new Error(
					result.message ||
						`Update failed for task ${taskId}. The server did not provide details.`
				);
			}

			// Log success with task details
			this.logger.info(
				`Successfully updated task ${result.task.displayId || result.task.id} using AI prompt (mode: ${mode})`
			);
			this.logger.info(`  Title: ${result.task.title}`);
			this.logger.info(`  Status: ${result.task.status}`);
			if (result.message) {
				this.logger.info(`  ${result.message}`);
			}
		} catch (error) {
			// If it's already a TaskMasterError, just add context and re-throw
			if (error instanceof TaskMasterError) {
				throw error.withContext({
					operation: 'updateTaskWithPrompt',
					taskId,
					tag,
					promptLength: prompt.length,
					mode
				});
			}

			// For other errors, wrap them
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new TaskMasterError(
				errorMessage,
				ERROR_CODES.STORAGE_ERROR,
				{
					operation: 'updateTaskWithPrompt',
					taskId,
					tag,
					promptLength: prompt.length,
					mode
				},
				error as Error
			);
		}
	}

	/**
	 * Update task or subtask status by ID - for API storage
	 */
	async updateTaskStatus(
		taskId: string,
		newStatus: TaskStatus,
		tag?: string
	): Promise<UpdateStatusResult> {
		await this.ensureInitialized();

		try {
			this.ensureBriefSelected('updateTaskStatus');

			const existingTask = await this.retryOperation(() =>
				this.repository.getTask(this.projectId, taskId)
			);

			if (!existingTask) {
				throw new Error(`Task ${taskId} not found`);
			}

			const oldStatus = existingTask.status;
			if (oldStatus === newStatus) {
				return {
					success: true,
					oldStatus,
					newStatus,
					taskId
				};
			}

			// Update the task/subtask status
			await this.retryOperation(() =>
				this.repository.updateTask(this.projectId, taskId, {
					status: newStatus,
					updatedAt: new Date().toISOString()
				})
			);

			// Note: Parent status auto-adjustment is handled by the backend API service
			// which has its own business logic for managing task relationships

			return {
				success: true,
				oldStatus,
				newStatus,
				taskId
			};
		} catch (error) {
			this.wrapError(error, 'Failed to update task status via API', {
				operation: 'updateTaskStatus',
				taskId,
				newStatus,
				tag
			});
		}
	}

	/**
	 * Get all available tags
	 */
	async getAllTags(): Promise<string[]> {
		return this.listTags();
	}

	/**
	 * Delete all tasks for a tag
	 */
	async deleteTag(tag: string): Promise<void> {
		await this.ensureInitialized();

		try {
			await this.retryOperation(() =>
				this.repository.deleteTag(this.projectId, tag)
			);

			this.tagsCache.delete(tag);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to delete tag via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'deleteTag', tag },
				error as Error
			);
		}
	}

	/**
	 * Rename a tag
	 */
	async renameTag(oldTag: string, newTag: string): Promise<void> {
		await this.ensureInitialized();

		try {
			const tagData = this.tagsCache.get(oldTag);
			if (!tagData) {
				throw new Error(`Tag ${oldTag} not found`);
			}

			// Create new tag with same data
			const newTagData = { ...tagData, name: newTag };
			await this.repository.createTag(this.projectId, newTagData);

			// Delete old tag
			await this.repository.deleteTag(this.projectId, oldTag);

			// Update cache
			this.tagsCache.delete(oldTag);
			this.tagsCache.set(newTag, newTagData);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to rename tag via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'renameTag', oldTag, newTag },
				error as Error
			);
		}
	}

	/**
	 * Copy a tag
	 */
	async copyTag(sourceTag: string, targetTag: string): Promise<void> {
		await this.ensureInitialized();

		try {
			const sourceData = this.tagsCache.get(sourceTag);
			if (!sourceData) {
				throw new Error(`Source tag ${sourceTag} not found`);
			}

			// Create new tag with copied data
			const targetData = { ...sourceData, name: targetTag };
			await this.repository.createTag(this.projectId, targetData);

			// Update cache
			this.tagsCache.set(targetTag, targetData);
		} catch (error) {
			throw new TaskMasterError(
				'Failed to copy tag via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'copyTag', sourceTag, targetTag },
				error as Error
			);
		}
	}

	/**
	 * Get storage statistics
	 */
	async getStats(): Promise<StorageStats> {
		await this.ensureInitialized();

		try {
			const tasks = await this.repository.getTasks(this.projectId);
			const tags = await this.repository.getTags(this.projectId);

			const tagStats = tags.map((tag) => ({
				tag: tag.name,
				taskCount: tag.tasks.length,
				lastModified: new Date().toISOString() // TODO: Get actual last modified from tag data
			}));

			return {
				totalTasks: tasks.length,
				totalTags: tags.length,
				storageSize: 0, // Not applicable for API storage
				lastModified: new Date().toISOString(),
				tagStats
			};
		} catch (error) {
			throw new TaskMasterError(
				'Failed to get stats from API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'getStats' },
				error as Error
			);
		}
	}

	/**
	 * Create backup
	 */
	async backup(): Promise<string> {
		await this.ensureInitialized();

		try {
			// Export all data
			await this.repository.getTasks(this.projectId);
			await this.repository.getTags(this.projectId);

			// TODO: In a real implementation, this would:
			// 1. Create backup data structure with tasks and tags
			// 2. Save the backup to a storage service
			// For now, return a backup identifier
			return `backup-${this.projectId}-${Date.now()}`;
		} catch (error) {
			throw new TaskMasterError(
				'Failed to create backup via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'backup' },
				error as Error
			);
		}
	}

	/**
	 * Restore from backup
	 */
	async restore(backupId: string): Promise<void> {
		await this.ensureInitialized();

		// This would restore from a backup service
		// Implementation depends on backup strategy
		throw new TaskMasterError(
			'Restore not implemented for API storage',
			ERROR_CODES.NOT_IMPLEMENTED,
			{ operation: 'restore', backupId }
		);
	}

	/**
	 * Clear all data
	 */
	async clear(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Delete all tasks
			const tasks = await this.repository.getTasks(this.projectId);
			if (tasks.length > 0) {
				await this.repository.bulkDeleteTasks(
					this.projectId,
					tasks.map((t) => t.id)
				);
			}

			// Delete all tags
			const tags = await this.repository.getTags(this.projectId);
			for (const tag of tags) {
				await this.repository.deleteTag(this.projectId, tag.name);
			}

			// Clear cache
			this.tagsCache.clear();
		} catch (error) {
			throw new TaskMasterError(
				'Failed to clear data via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'clear' },
				error as Error
			);
		}
	}

	/**
	 * Close connection
	 */
	async close(): Promise<void> {
		this.initialized = false;
		this.tagsCache.clear();
	}

	/**
	 * Ensure storage is initialized
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}

	/**
	 * Ensure a brief is selected in the current context
	 * @returns The current auth context with a valid briefId
	 */
	private ensureBriefSelected(operation: string): ContextWithBrief {
		const authManager = AuthManager.getInstance();
		const context = authManager.getContext();

		if (!context?.briefId) {
			throw new TaskMasterError(
				'No brief selected',
				ERROR_CODES.NO_BRIEF_SELECTED,
				{
					operation,
					userMessage:
						'No brief selected. Please select a brief first using: tm context brief <brief-id> or tm context brief <brief-url>'
				}
			);
		}

		return context as ContextWithBrief;
	}

	/**
	 * Get or create API client instance with auth
	 */
	private getApiClient(): ApiClient {
		if (!this.apiClient) {
			const apiEndpoint =
				process.env.TM_BASE_DOMAIN || process.env.TM_PUBLIC_BASE_DOMAIN;

			if (!apiEndpoint) {
				throw new TaskMasterError(
					'API endpoint not configured. Please set TM_PUBLIC_BASE_DOMAIN environment variable.',
					ERROR_CODES.MISSING_CONFIGURATION,
					{ operation: 'getApiClient' }
				);
			}

			const context = this.ensureBriefSelected('getApiClient');
			const authManager = AuthManager.getInstance();

			this.apiClient = new ApiClient({
				baseUrl: apiEndpoint,
				authManager,
				accountId: context.orgId
			});
		}

		return this.apiClient;
	}

	/**
	 * Retry an operation with exponential backoff
	 */
	private async retryOperation<T>(
		operation: () => Promise<T>,
		attempt: number = 1
	): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			if (this.enableRetry && attempt < this.maxRetries) {
				const delay = Math.pow(2, attempt) * 1000;
				await new Promise((resolve) => setTimeout(resolve, delay));
				return this.retryOperation(operation, attempt + 1);
			}
			throw error;
		}
	}

	/**
	 * Wrap an error unless it's already a NO_BRIEF_SELECTED error
	 */
	private wrapError(
		error: unknown,
		message: string,
		context: Record<string, unknown>
	): never {
		// If it's already a NO_BRIEF_SELECTED error, don't wrap it
		if (
			error instanceof TaskMasterError &&
			error.is(ERROR_CODES.NO_BRIEF_SELECTED)
		) {
			throw error;
		}

		throw new TaskMasterError(
			message,
			ERROR_CODES.STORAGE_ERROR,
			context,
			error as Error
		);
	}
}
