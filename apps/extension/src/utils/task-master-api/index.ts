/**
 * TaskMaster API
 * Main API class that coordinates all modules
 */

import * as vscode from 'vscode';
import { ExtensionLogger } from '../logger';
import type { MCPClientManager } from '../mcpClient';
import { CacheManager } from './cache/cache-manager';
import { MCPClient } from './mcp-client';
import { TaskTransformer } from './transformers/task-transformer';
import type {
	AddSubtaskOptions,
	CacheConfig,
	GetTasksOptions,
	SubtaskData,
	TaskMasterApiConfig,
	TaskMasterApiResponse,
	TaskMasterTask,
	TaskUpdate,
	UpdateSubtaskOptions,
	UpdateTaskOptions,
	UpdateTaskStatusOptions
} from './types';

// Re-export types for backward compatibility
export * from './types';

export class TaskMasterApi {
	private mcpWrapper: MCPClient;
	private cache: CacheManager;
	private transformer: TaskTransformer;
	private config: TaskMasterApiConfig;
	private logger: ExtensionLogger;

	private readonly defaultCacheConfig: CacheConfig = {
		maxSize: 100,
		enableBackgroundRefresh: true,
		refreshInterval: 5 * 60 * 1000, // 5 minutes
		enableAnalytics: true,
		enablePrefetch: true,
		compressionEnabled: false,
		persistToDisk: false
	};

	private readonly defaultConfig: TaskMasterApiConfig = {
		timeout: 30000,
		retryAttempts: 3,
		cacheDuration: 5 * 60 * 1000, // 5 minutes
		cache: this.defaultCacheConfig
	};

	constructor(
		mcpClient: MCPClientManager,
		config?: Partial<TaskMasterApiConfig>
	) {
		this.logger = ExtensionLogger.getInstance();

		// Merge config - ensure cache is always fully defined
		const mergedCache: CacheConfig = {
			maxSize: config?.cache?.maxSize ?? this.defaultCacheConfig.maxSize,
			enableBackgroundRefresh:
				config?.cache?.enableBackgroundRefresh ??
				this.defaultCacheConfig.enableBackgroundRefresh,
			refreshInterval:
				config?.cache?.refreshInterval ??
				this.defaultCacheConfig.refreshInterval,
			enableAnalytics:
				config?.cache?.enableAnalytics ??
				this.defaultCacheConfig.enableAnalytics,
			enablePrefetch:
				config?.cache?.enablePrefetch ?? this.defaultCacheConfig.enablePrefetch,
			compressionEnabled:
				config?.cache?.compressionEnabled ??
				this.defaultCacheConfig.compressionEnabled,
			persistToDisk:
				config?.cache?.persistToDisk ?? this.defaultCacheConfig.persistToDisk
		};

		this.config = {
			...this.defaultConfig,
			...config,
			cache: mergedCache
		};

		// Initialize modules
		this.mcpWrapper = new MCPClient(mcpClient, this.logger, {
			timeout: this.config.timeout,
			retryAttempts: this.config.retryAttempts
		});

		this.cache = new CacheManager(
			{ ...mergedCache, cacheDuration: this.config.cacheDuration },
			this.logger
		);

		this.transformer = new TaskTransformer(this.logger);

		// Start background refresh if enabled
		if (this.config.cache?.enableBackgroundRefresh) {
			this.startBackgroundRefresh();
		}

		this.logger.log('TaskMasterApi: Initialized with modular architecture');
	}

	/**
	 * Get tasks from TaskMaster
	 */
	async getTasks(
		options?: GetTasksOptions
	): Promise<TaskMasterApiResponse<TaskMasterTask[]>> {
		const startTime = Date.now();
		const cacheKey = `get_tasks_${JSON.stringify(options || {})}`;

		try {
			// Check cache first
			const cached = this.cache.get(cacheKey);
			if (cached) {
				return {
					success: true,
					data: cached,
					requestDuration: Date.now() - startTime
				};
			}

			// Prepare MCP tool arguments
			const mcpArgs: Record<string, unknown> = {
				projectRoot: options?.projectRoot || this.getWorkspaceRoot(),
				withSubtasks: options?.withSubtasks ?? true
			};

			if (options?.status) {
				mcpArgs.status = options.status;
			}
			if (options?.tag) {
				mcpArgs.tag = options.tag;
			}

			this.logger.log('Calling get_tasks with args:', mcpArgs);

			// Call MCP tool
			const mcpResponse = await this.mcpWrapper.callTool('get_tasks', mcpArgs);

			// Transform response
			const transformedTasks =
				this.transformer.transformMCPTasksResponse(mcpResponse);

			// Cache the result
			this.cache.set(cacheKey, transformedTasks);

			return {
				success: true,
				data: transformedTasks,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			this.logger.error('Error getting tasks:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Update task status
	 */
	async updateTaskStatus(
		taskId: string,
		status: string,
		options?: UpdateTaskStatusOptions
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const mcpArgs: Record<string, unknown> = {
				id: String(taskId),
				status: status,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			this.logger.log('Calling set_task_status with args:', mcpArgs);

			await this.mcpWrapper.callTool('set_task_status', mcpArgs);

			// Clear relevant caches
			this.cache.clearPattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			this.logger.error('Error updating task status:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Update task content
	 */
	async updateTask(
		taskId: string,
		updates: TaskUpdate,
		options?: UpdateTaskOptions
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			// Build update prompt
			const updateFields: string[] = [];
			if (updates.title !== undefined) {
				updateFields.push(`Title: ${updates.title}`);
			}
			if (updates.description !== undefined) {
				updateFields.push(`Description: ${updates.description}`);
			}
			if (updates.details !== undefined) {
				updateFields.push(`Details: ${updates.details}`);
			}
			if (updates.priority !== undefined) {
				updateFields.push(`Priority: ${updates.priority}`);
			}
			if (updates.testStrategy !== undefined) {
				updateFields.push(`Test Strategy: ${updates.testStrategy}`);
			}
			if (updates.dependencies !== undefined) {
				updateFields.push(`Dependencies: ${updates.dependencies.join(', ')}`);
			}

			const prompt = `Update task with the following changes:\n${updateFields.join('\n')}`;

			const mcpArgs: Record<string, unknown> = {
				id: String(taskId),
				prompt: prompt,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			if (options?.append !== undefined) {
				mcpArgs.append = options.append;
			}
			if (options?.research !== undefined) {
				mcpArgs.research = options.research;
			}

			this.logger.log('Calling update_task with args:', mcpArgs);

			await this.mcpWrapper.callTool('update_task', mcpArgs);

			// Clear relevant caches
			this.cache.clearPattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			this.logger.error('Error updating task:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Update subtask content
	 */
	async updateSubtask(
		taskId: string,
		prompt: string,
		options?: UpdateSubtaskOptions
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const mcpArgs: Record<string, unknown> = {
				id: String(taskId),
				prompt: prompt,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			if (options?.research !== undefined) {
				mcpArgs.research = options.research;
			}

			this.logger.log('Calling update_subtask with args:', mcpArgs);

			await this.mcpWrapper.callTool('update_subtask', mcpArgs);

			// Clear relevant caches
			this.cache.clearPattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			this.logger.error('Error updating subtask:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Add a new subtask
	 */
	async addSubtask(
		parentTaskId: string,
		subtaskData: SubtaskData,
		options?: AddSubtaskOptions
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const mcpArgs: Record<string, unknown> = {
				id: String(parentTaskId),
				title: subtaskData.title,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			if (subtaskData.description) {
				mcpArgs.description = subtaskData.description;
			}
			if (subtaskData.dependencies && subtaskData.dependencies.length > 0) {
				mcpArgs.dependencies = subtaskData.dependencies.join(',');
			}
			if (subtaskData.status) {
				mcpArgs.status = subtaskData.status;
			}

			this.logger.log('Calling add_subtask with args:', mcpArgs);

			await this.mcpWrapper.callTool('add_subtask', mcpArgs);

			// Clear relevant caches
			this.cache.clearPattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			this.logger.error('Error adding subtask:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Get connection status
	 */
	getConnectionStatus(): { isConnected: boolean; error?: string } {
		const status = this.mcpWrapper.getStatus();
		return {
			isConnected: status.isRunning,
			error: status.error
		};
	}

	/**
	 * Test connection
	 */
	async testConnection(): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const isConnected = await this.mcpWrapper.testConnection();
			return {
				success: true,
				data: isConnected,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			this.logger.error('Connection test failed:', error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Connection test failed',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Clear all cached data
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Get cache analytics
	 */
	getCacheAnalytics() {
		return this.cache.getAnalytics();
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.cache.destroy();
		this.logger.log('TaskMasterApi: Destroyed and cleaned up resources');
	}

	/**
	 * Start background refresh
	 */
	private startBackgroundRefresh(): void {
		const interval = this.config.cache?.refreshInterval || 5 * 60 * 1000;
		setInterval(() => {
			this.performBackgroundRefresh();
		}, interval);
	}

	/**
	 * Perform background refresh of frequently accessed cache entries
	 */
	private async performBackgroundRefresh(): Promise<void> {
		if (!this.config.cache?.enableBackgroundRefresh) {
			return;
		}

		this.logger.log('Starting background cache refresh');
		const candidates = this.cache.getRefreshCandidates();

		let refreshedCount = 0;
		for (const [key, entry] of candidates) {
			try {
				const optionsMatch = key.match(/get_tasks_(.+)/);
				if (optionsMatch) {
					const options = JSON.parse(optionsMatch[1]);
					await this.getTasks(options);
					refreshedCount++;
					this.cache.incrementRefreshes();
				}
			} catch (error) {
				this.logger.warn(`Background refresh failed for key ${key}:`, error);
			}
		}

		this.logger.log(
			`Background refresh completed, refreshed ${refreshedCount} entries`
		);
	}

	/**
	 * Get workspace root path
	 */
	private getWorkspaceRoot(): string {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
	}
}
