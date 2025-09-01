/**
 * @fileoverview API-based storage implementation for Hamster integration
 * This provides storage via REST API instead of local file system
 */

import type {
	IStorage,
	StorageStats
} from '../interfaces/storage.interface.js';
import type { Task, TaskMetadata } from '../types/index.js';
import { ERROR_CODES, TaskMasterError } from '../errors/task-master-error.js';

/**
 * API storage configuration
 */
export interface ApiStorageConfig {
	/** API endpoint base URL */
	endpoint: string;
	/** Access token for authentication */
	accessToken: string;
	/** Optional project ID */
	projectId?: string;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Enable request retries */
	enableRetry?: boolean;
	/** Maximum retry attempts */
	maxRetries?: number;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

/**
 * ApiStorage implementation for Hamster integration
 * Fetches and stores tasks via REST API
 */
export class ApiStorage implements IStorage {
	private readonly config: Required<ApiStorageConfig>;
	private initialized = false;

	constructor(config: ApiStorageConfig) {
		this.validateConfig(config);

		this.config = {
			endpoint: config.endpoint.replace(/\/$/, ''), // Remove trailing slash
			accessToken: config.accessToken,
			projectId: config.projectId || 'default',
			timeout: config.timeout || 30000,
			enableRetry: config.enableRetry ?? true,
			maxRetries: config.maxRetries || 3
		};
	}

	/**
	 * Validate API storage configuration
	 */
	private validateConfig(config: ApiStorageConfig): void {
		if (!config.endpoint) {
			throw new TaskMasterError(
				'API endpoint is required for API storage',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		if (!config.accessToken) {
			throw new TaskMasterError(
				'Access token is required for API storage',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		// Validate endpoint URL format
		try {
			new URL(config.endpoint);
		} catch {
			throw new TaskMasterError(
				'Invalid API endpoint URL',
				ERROR_CODES.INVALID_INPUT,
				{ endpoint: config.endpoint }
			);
		}
	}

	/**
	 * Initialize the API storage
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Verify API connectivity
			await this.verifyConnection();
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
	 * Verify API connection
	 */
	private async verifyConnection(): Promise<void> {
		const response = await this.makeRequest<{ status: string }>('/health');

		if (!response.success) {
			throw new Error(`API health check failed: ${response.error}`);
		}
	}

	/**
	 * Load tasks from API
	 */
	async loadTasks(tag?: string): Promise<Task[]> {
		await this.ensureInitialized();

		try {
			const endpoint = tag
				? `/projects/${this.config.projectId}/tasks?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/tasks`;

			const response = await this.makeRequest<{ tasks: Task[] }>(endpoint);

			if (!response.success) {
				throw new Error(response.error || 'Failed to load tasks');
			}

			return response.data?.tasks || [];
		} catch (error) {
			throw new TaskMasterError(
				'Failed to load tasks from API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'loadTasks', tag },
				error as Error
			);
		}
	}

	/**
	 * Save tasks to API
	 */
	async saveTasks(tasks: Task[], tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			const endpoint = tag
				? `/projects/${this.config.projectId}/tasks?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/tasks`;

			const response = await this.makeRequest(endpoint, 'PUT', { tasks });

			if (!response.success) {
				throw new Error(response.error || 'Failed to save tasks');
			}
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
			const endpoint = tag
				? `/projects/${this.config.projectId}/tasks/${taskId}?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/tasks/${taskId}`;

			const response = await this.makeRequest<{ task: Task }>(endpoint);

			if (!response.success) {
				if (response.error?.includes('not found')) {
					return null;
				}
				throw new Error(response.error || 'Failed to load task');
			}

			return response.data?.task || null;
		} catch (error) {
			throw new TaskMasterError(
				'Failed to load task from API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'loadTask', taskId, tag },
				error as Error
			);
		}
	}

	/**
	 * Save a single task
	 */
	async saveTask(task: Task, tag?: string): Promise<void> {
		await this.ensureInitialized();

		try {
			const endpoint = tag
				? `/projects/${this.config.projectId}/tasks/${task.id}?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/tasks/${task.id}`;

			const response = await this.makeRequest(endpoint, 'PUT', { task });

			if (!response.success) {
				throw new Error(response.error || 'Failed to save task');
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
			const endpoint = tag
				? `/projects/${this.config.projectId}/tasks/${taskId}?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/tasks/${taskId}`;

			const response = await this.makeRequest(endpoint, 'DELETE');

			if (!response.success) {
				throw new Error(response.error || 'Failed to delete task');
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
	 * List available tags
	 */
	async listTags(): Promise<string[]> {
		await this.ensureInitialized();

		try {
			const response = await this.makeRequest<{ tags: string[] }>(
				`/projects/${this.config.projectId}/tags`
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to list tags');
			}

			return response.data?.tags || [];
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
			const endpoint = tag
				? `/projects/${this.config.projectId}/metadata?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/metadata`;

			const response = await this.makeRequest<{ metadata: TaskMetadata }>(
				endpoint
			);

			if (!response.success) {
				return null;
			}

			return response.data?.metadata || null;
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
			const endpoint = tag
				? `/projects/${this.config.projectId}/metadata?tag=${encodeURIComponent(tag)}`
				: `/projects/${this.config.projectId}/metadata`;

			const response = await this.makeRequest(endpoint, 'PUT', { metadata });

			if (!response.success) {
				throw new Error(response.error || 'Failed to save metadata');
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
			// First load existing tasks
			const existingTasks = await this.loadTasks(tag);

			// Append new tasks
			const allTasks = [...existingTasks, ...tasks];

			// Save all tasks
			await this.saveTasks(allTasks, tag);
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
			// Load the task
			const task = await this.loadTask(taskId, tag);

			if (!task) {
				throw new Error(`Task ${taskId} not found`);
			}

			// Merge updates
			const updatedTask = { ...task, ...updates, id: taskId };

			// Save updated task
			await this.saveTask(updatedTask, tag);
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
			const response = await this.makeRequest(
				`/projects/${this.config.projectId}/tags/${encodeURIComponent(tag)}`,
				'DELETE'
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to delete tag');
			}
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
			const response = await this.makeRequest(
				`/projects/${this.config.projectId}/tags/${encodeURIComponent(oldTag)}/rename`,
				'POST',
				{ newTag }
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to rename tag');
			}
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
			const response = await this.makeRequest(
				`/projects/${this.config.projectId}/tags/${encodeURIComponent(sourceTag)}/copy`,
				'POST',
				{ targetTag }
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to copy tag');
			}
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
			const response = await this.makeRequest<{
				stats: StorageStats;
			}>(`/projects/${this.config.projectId}/stats`);

			if (!response.success) {
				throw new Error(response.error || 'Failed to get stats');
			}

			// Return stats or default values
			return (
				response.data?.stats || {
					totalTasks: 0,
					totalTags: 0,
					storageSize: 0,
					lastModified: new Date().toISOString(),
					tagStats: []
				}
			);
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
			const response = await this.makeRequest<{ backupId: string }>(
				`/projects/${this.config.projectId}/backup`,
				'POST'
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to create backup');
			}

			return response.data?.backupId || 'unknown';
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
	async restore(backupPath: string): Promise<void> {
		await this.ensureInitialized();

		try {
			const response = await this.makeRequest(
				`/projects/${this.config.projectId}/restore`,
				'POST',
				{ backupId: backupPath }
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to restore backup');
			}
		} catch (error) {
			throw new TaskMasterError(
				'Failed to restore backup via API',
				ERROR_CODES.STORAGE_ERROR,
				{ operation: 'restore', backupPath },
				error as Error
			);
		}
	}

	/**
	 * Clear all data
	 */
	async clear(): Promise<void> {
		await this.ensureInitialized();

		try {
			const response = await this.makeRequest(
				`/projects/${this.config.projectId}/clear`,
				'POST'
			);

			if (!response.success) {
				throw new Error(response.error || 'Failed to clear data');
			}
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
	 * Make HTTP request to API
	 */
	private async makeRequest<T>(
		path: string,
		method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
		body?: unknown
	): Promise<ApiResponse<T>> {
		const url = `${this.config.endpoint}${path}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

		try {
			const options: RequestInit = {
				method,
				headers: {
					Authorization: `Bearer ${this.config.accessToken}`,
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				signal: controller.signal
			};

			if (body && (method === 'POST' || method === 'PUT')) {
				options.body = JSON.stringify(body);
			}

			let lastError: Error | null = null;
			let attempt = 0;

			while (attempt < this.config.maxRetries) {
				attempt++;

				try {
					const response = await fetch(url, options);
					const data = await response.json();

					if (response.ok) {
						return { success: true, data: data as T };
					}

					// Handle specific error codes
					if (response.status === 401) {
						return {
							success: false,
							error: 'Authentication failed - check access token'
						};
					}

					if (response.status === 404) {
						return {
							success: false,
							error: 'Resource not found'
						};
					}

					if (response.status === 429) {
						// Rate limited - retry with backoff
						if (this.config.enableRetry && attempt < this.config.maxRetries) {
							await this.delay(Math.pow(2, attempt) * 1000);
							continue;
						}
					}

					const errorData = data as any;
					return {
						success: false,
						error:
							errorData.error ||
							errorData.message ||
							`HTTP ${response.status}: ${response.statusText}`
					};
				} catch (error) {
					lastError = error as Error;

					// Retry on network errors
					if (this.config.enableRetry && attempt < this.config.maxRetries) {
						await this.delay(Math.pow(2, attempt) * 1000);
						continue;
					}
				}
			}

			// All retries exhausted
			return {
				success: false,
				error: lastError?.message || 'Request failed after retries'
			};
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Delay helper for retries
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
