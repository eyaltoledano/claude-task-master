import * as vscode from 'vscode';
import { MCPClientManager } from './mcpClient';

// Task Master MCP API response types
export interface MCPTaskResponse {
	data?: {
		tasks?: Array<{
			id: number | string;
			title: string;
			description: string;
			status: string;
			priority: string;
			details?: string;
			testStrategy?: string;
			dependencies?: Array<number | string>;
			complexityScore?: number;
			subtasks?: Array<{
				id: number;
				title: string;
				description?: string;
				status: string;
				details?: string;
				dependencies?: Array<number | string>;
			}>;
		}>;
		tag?: {
			currentTag: string;
			availableTags: string[];
		};
	};
	version?: {
		version: string;
		name: string;
	};
	error?: string;
}

// Our internal Task interface (matches the webview expectations)
export interface TaskMasterTask {
	id: string;
	title: string;
	description: string;
	status:
		| 'pending'
		| 'in-progress'
		| 'review'
		| 'done'
		| 'deferred'
		| 'cancelled';
	priority: 'high' | 'medium' | 'low';
	details?: string;
	testStrategy?: string;
	dependencies?: string[];
	complexityScore?: number;
	subtasks?: Array<{
		id: number;
		title: string;
		description?: string;
		status: string;
		details?: string;
		dependencies?: Array<number | string>;
	}>;
}

// API response wrapper
export interface TaskMasterApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	requestDuration?: number;
}

// API configuration
export interface TaskMasterApiConfig {
	timeout: number;
	retryAttempts: number;
	cacheDuration: number;
	projectRoot?: string;
	// Enhanced caching configuration
	cache?: {
		maxSize: number; // Maximum number of cache entries
		enableBackgroundRefresh: boolean; // Enable background cache refresh
		refreshInterval: number; // Background refresh interval in ms
		enableAnalytics: boolean; // Track cache hit/miss statistics
		enablePrefetch: boolean; // Enable prefetching of related data
		compressionEnabled: boolean; // Enable data compression for large datasets
		persistToDisk: boolean; // Persist cache to disk (future enhancement)
	};
}

// Enhanced cache entry interface
interface CacheEntry {
	data: any;
	timestamp: number;
	accessCount: number;
	lastAccessed: number;
	size: number;
	ttl?: number;
	tags: string[];
}

// Cache analytics interface
interface CacheAnalytics {
	hits: number;
	misses: number;
	evictions: number;
	refreshes: number;
	totalSize: number;
	averageAccessTime: number;
	hitRate: number;
}

/**
 * Task Master API client that wraps MCP tool calls
 */
export class TaskMasterApi {
	private mcpClient: MCPClientManager;
	private config: TaskMasterApiConfig;
	private cache = new Map<string, CacheEntry>();
	private cacheAnalytics: CacheAnalytics = {
		hits: 0,
		misses: 0,
		evictions: 0,
		refreshes: 0,
		totalSize: 0,
		averageAccessTime: 0,
		hitRate: 0
	};
	private backgroundRefreshTimer?: NodeJS.Timeout;
	private readonly defaultCacheConfig = {
		maxSize: 100,
		enableBackgroundRefresh: true,
		refreshInterval: 5 * 60 * 1000, // 5 minutes
		enableAnalytics: true,
		enablePrefetch: true,
		compressionEnabled: false,
		persistToDisk: false
	};

	constructor(
		mcpClient: MCPClientManager,
		config?: Partial<TaskMasterApiConfig>
	) {
		this.mcpClient = mcpClient;
		this.config = {
			timeout: 30000,
			retryAttempts: 3,
			cacheDuration: 5 * 60 * 1000, // 5 minutes
			...config,
			cache: { ...this.defaultCacheConfig, ...config?.cache }
		};

		// Initialize background refresh if enabled
		if (this.config.cache?.enableBackgroundRefresh) {
			this.initializeBackgroundRefresh();
		}

		console.log('TaskMasterApi: Initialized with enhanced caching:', {
			cacheDuration: this.config.cacheDuration,
			maxSize: this.config.cache?.maxSize,
			backgroundRefresh: this.config.cache?.enableBackgroundRefresh,
			analytics: this.config.cache?.enableAnalytics
		});
	}

	/**
	 * Get tasks from Task Master using the get_tasks MCP tool
	 */
	async getTasks(options?: {
		status?: string;
		withSubtasks?: boolean;
		tag?: string;
		projectRoot?: string;
	}): Promise<TaskMasterApiResponse<TaskMasterTask[]>> {
		const startTime = Date.now();
		const cacheKey = `get_tasks_${JSON.stringify(options || {})}`;

		try {
			// Check cache first
			const cached = this.getFromCache(cacheKey);
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

			// Add optional parameters
			if (options?.status) {
				mcpArgs.status = options.status;
			}
			if (options?.tag) {
				mcpArgs.tag = options.tag;
			}

			console.log('TaskMasterApi: Calling get_tasks with args:', mcpArgs);

			// Call the MCP tool
			const mcpResponse = await this.callMCPTool('get_tasks', mcpArgs);

			// Transform the response
			const transformedTasks = this.transformMCPTasksResponse(mcpResponse);

			// Cache the result
			this.setCache(cacheKey, transformedTasks);

			return {
				success: true,
				data: transformedTasks,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			console.error('TaskMasterApi: Error getting tasks:', error);

			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown error occurred',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Update task status using the set_task_status MCP tool
	 */
	async updateTaskStatus(
		taskId: string,
		status: string,
		options?: {
			projectRoot?: string;
		}
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const mcpArgs: Record<string, unknown> = {
				id: taskId,
				status: status,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			console.log('TaskMasterApi: Calling set_task_status with args:', mcpArgs);

			await this.callMCPTool('set_task_status', mcpArgs);

			// Clear relevant caches
			this.clearCachePattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			console.error('TaskMasterApi: Error updating task status:', error);

			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown error occurred',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Update task content using the update_task MCP tool
	 */
	async updateTask(
		taskId: string,
		updates: {
			title?: string;
			description?: string;
			details?: string;
			priority?: 'high' | 'medium' | 'low';
			testStrategy?: string;
			dependencies?: string[];
		},
		options?: {
			projectRoot?: string;
			append?: boolean;
			research?: boolean;
		}
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			// Build the prompt for the update_task MCP tool
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
				id: taskId,
				prompt: prompt,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			// Add optional parameters
			if (options?.append !== undefined) {
				mcpArgs.append = options.append;
			}
			if (options?.research !== undefined) {
				mcpArgs.research = options.research;
			}

			console.log('TaskMasterApi: Calling update_task with args:', mcpArgs);

			await this.callMCPTool('update_task', mcpArgs);

			// Clear relevant caches
			this.clearCachePattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			console.error('TaskMasterApi: Error updating task:', error);

			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown error occurred',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Update subtask content using the update_subtask MCP tool
	 */
	async updateSubtask(
		taskId: string,
		prompt: string,
		options?: {
			projectRoot?: string;
			research?: boolean;
		}
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const mcpArgs: Record<string, unknown> = {
				id: taskId,
				prompt: prompt,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			// Add optional parameters
			if (options?.research !== undefined) {
				mcpArgs.research = options.research;
			}

			console.log('TaskMasterApi: Calling update_subtask with args:', mcpArgs);

			await this.callMCPTool('update_subtask', mcpArgs);

			// Clear relevant caches
			this.clearCachePattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			console.error('TaskMasterApi: Error updating subtask:', error);

			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown error occurred',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Add a new subtask to an existing task using the add_subtask MCP tool
	 */
	async addSubtask(
		parentTaskId: string,
		subtaskData: {
			title: string;
			description?: string;
			dependencies?: string[];
			status?: string;
		},
		options?: {
			projectRoot?: string;
		}
	): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const mcpArgs: Record<string, unknown> = {
				id: parentTaskId,
				title: subtaskData.title,
				projectRoot: options?.projectRoot || this.getWorkspaceRoot()
			};

			// Add optional parameters
			if (subtaskData.description) {
				mcpArgs.description = subtaskData.description;
			}
			if (subtaskData.dependencies && subtaskData.dependencies.length > 0) {
				mcpArgs.dependencies = subtaskData.dependencies.join(',');
			}
			if (subtaskData.status) {
				mcpArgs.status = subtaskData.status;
			}

			console.log('TaskMasterApi: Calling add_subtask with args:', mcpArgs);

			await this.callMCPTool('add_subtask', mcpArgs);

			// Clear relevant caches to force refresh
			this.clearCachePattern('get_tasks');

			return {
				success: true,
				data: true,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			console.error('TaskMasterApi: Error adding subtask:', error);

			return {
				success: false,
				error:
					error instanceof Error ? error.message : 'Unknown error occurred',
				requestDuration: Date.now() - startTime
			};
		}
	}

	/**
	 * Get current Task Master connection status
	 */
	getConnectionStatus(): { isConnected: boolean; error?: string } {
		const status = this.mcpClient.getStatus();
		return {
			isConnected: status.isRunning,
			error: status.error
		};
	}

	/**
	 * Test the connection to Task Master
	 */
	async testConnection(): Promise<TaskMasterApiResponse<boolean>> {
		const startTime = Date.now();

		try {
			const isConnected = await this.mcpClient.testConnection();

			return {
				success: true,
				data: isConnected,
				requestDuration: Date.now() - startTime
			};
		} catch (error) {
			console.error('TaskMasterApi: Connection test failed:', error);

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
		this.resetCacheAnalytics();
	}

	/**
	 * Get cache analytics
	 */
	getCacheAnalytics(): CacheAnalytics {
		this.updateAnalytics();
		return { ...this.cacheAnalytics };
	}

	/**
	 * Initialize background refresh timer
	 */
	private initializeBackgroundRefresh(): void {
		if (this.backgroundRefreshTimer) {
			clearInterval(this.backgroundRefreshTimer);
		}

		const interval = this.config.cache?.refreshInterval || 5 * 60 * 1000;
		this.backgroundRefreshTimer = setInterval(() => {
			this.performBackgroundRefresh();
		}, interval);

		console.log(
			`TaskMasterApi: Background refresh initialized with ${interval}ms interval`
		);
	}

	/**
	 * Perform background refresh of frequently accessed cache entries
	 */
	private async performBackgroundRefresh(): Promise<void> {
		if (!this.config.cache?.enableBackgroundRefresh) {
			return;
		}

		console.log('TaskMasterApi: Starting background cache refresh');
		const startTime = Date.now();

		// Find frequently accessed entries that are close to expiration
		const refreshCandidates = Array.from(this.cache.entries())
			.filter(([key, entry]) => {
				const age = Date.now() - entry.timestamp;
				const isNearExpiration = age > this.config.cacheDuration * 0.7; // 70% of TTL
				const isFrequentlyAccessed = entry.accessCount >= 3;
				return (
					isNearExpiration && isFrequentlyAccessed && key.includes('get_tasks')
				);
			})
			.sort((a, b) => b[1].accessCount - a[1].accessCount) // Most accessed first
			.slice(0, 5); // Limit to top 5 entries

		let refreshedCount = 0;
		for (const [key, entry] of refreshCandidates) {
			try {
				// Parse the cache key to extract options
				const optionsMatch = key.match(/get_tasks_(.+)/);
				if (optionsMatch) {
					const options = JSON.parse(optionsMatch[1]);
					console.log(`TaskMasterApi: Background refreshing cache key: ${key}`);

					// Perform the refresh (this will update the cache)
					await this.getTasks(options);
					refreshedCount++;
					this.cacheAnalytics.refreshes++;
				}
			} catch (error) {
				console.warn(
					`TaskMasterApi: Background refresh failed for key ${key}:`,
					error
				);
			}
		}

		const duration = Date.now() - startTime;
		console.log(
			`TaskMasterApi: Background refresh completed in ${duration}ms, refreshed ${refreshedCount} entries`
		);
	}

	/**
	 * Reset cache analytics
	 */
	private resetCacheAnalytics(): void {
		this.cacheAnalytics = {
			hits: 0,
			misses: 0,
			evictions: 0,
			refreshes: 0,
			totalSize: 0,
			averageAccessTime: 0,
			hitRate: 0
		};
	}

	/**
	 * Update cache analytics calculations
	 */
	private updateAnalytics(): void {
		const total = this.cacheAnalytics.hits + this.cacheAnalytics.misses;
		this.cacheAnalytics.hitRate =
			total > 0 ? this.cacheAnalytics.hits / total : 0;
		this.cacheAnalytics.totalSize = this.cache.size;

		if (this.cache.size > 0) {
			const totalAccessTime = Array.from(this.cache.values()).reduce(
				(sum, entry) => sum + (entry.lastAccessed - entry.timestamp),
				0
			);
			this.cacheAnalytics.averageAccessTime = totalAccessTime / this.cache.size;
		}
	}

	/**
	 * Clear cache entries matching a pattern
	 */
	private clearCachePattern(pattern: string): void {
		let evictedCount = 0;
		for (const key of this.cache.keys()) {
			if (key.includes(pattern)) {
				this.cache.delete(key);
				evictedCount++;
			}
		}

		if (evictedCount > 0) {
			this.cacheAnalytics.evictions += evictedCount;
			console.log(
				`TaskMasterApi: Evicted ${evictedCount} cache entries matching pattern: ${pattern}`
			);
		}
	}

	/**
	 * Get data from cache if not expired with analytics tracking
	 */
	private getFromCache(key: string): any {
		const startTime = Date.now();
		const cached = this.cache.get(key);

		if (cached) {
			const isExpired =
				Date.now() - cached.timestamp >=
				(cached.ttl || this.config.cacheDuration);

			if (!isExpired) {
				// Update access statistics
				cached.accessCount++;
				cached.lastAccessed = Date.now();

				if (this.config.cache?.enableAnalytics) {
					this.cacheAnalytics.hits++;
				}

				const accessTime = Date.now() - startTime;
				console.log(
					`TaskMasterApi: Cache hit for ${key} (${accessTime}ms, ${cached.accessCount} accesses)`
				);
				return cached.data;
			} else {
				// Remove expired entry
				this.cache.delete(key);
				console.log(`TaskMasterApi: Cache entry expired and removed: ${key}`);
			}
		}

		if (this.config.cache?.enableAnalytics) {
			this.cacheAnalytics.misses++;
		}

		console.log(`TaskMasterApi: Cache miss for ${key}`);
		return null;
	}

	/**
	 * Set data in cache with enhanced metadata and LRU eviction
	 */
	private setCache(
		key: string,
		data: any,
		options?: { ttl?: number; tags?: string[] }
	): void {
		const now = Date.now();
		const dataSize = this.estimateDataSize(data);

		// Create cache entry
		const entry: CacheEntry = {
			data,
			timestamp: now,
			accessCount: 1,
			lastAccessed: now,
			size: dataSize,
			ttl: options?.ttl,
			tags: options?.tags || [key.split('_')[0]] // Default tag based on key prefix
		};

		// Check if we need to evict entries (LRU strategy)
		const maxSize = this.config.cache?.maxSize || 100;
		if (this.cache.size >= maxSize) {
			this.evictLRUEntries(Math.max(1, Math.floor(maxSize * 0.1))); // Evict 10% of max size
		}

		this.cache.set(key, entry);
		console.log(
			`TaskMasterApi: Cached data for ${key} (size: ${dataSize} bytes, TTL: ${entry.ttl || this.config.cacheDuration}ms)`
		);

		// Trigger prefetch if enabled
		if (this.config.cache?.enablePrefetch) {
			this.scheduleRelatedDataPrefetch(key, data);
		}
	}

	/**
	 * Evict least recently used cache entries
	 */
	private evictLRUEntries(count: number): void {
		const entries = Array.from(this.cache.entries())
			.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed) // Oldest first
			.slice(0, count);

		for (const [key] of entries) {
			this.cache.delete(key);
			this.cacheAnalytics.evictions++;
		}

		if (entries.length > 0) {
			console.log(`TaskMasterApi: Evicted ${entries.length} LRU cache entries`);
		}
	}

	/**
	 * Estimate data size for cache analytics
	 */
	private estimateDataSize(data: any): number {
		try {
			return JSON.stringify(data).length * 2; // Rough estimate (2 bytes per character)
		} catch {
			return 1000; // Default fallback size
		}
	}

	/**
	 * Schedule prefetch of related data
	 */
	private scheduleRelatedDataPrefetch(key: string, data: any): void {
		// This is a simple implementation - in a more sophisticated system,
		// we might prefetch related tasks, subtasks, or dependency data
		if (key.includes('get_tasks') && Array.isArray(data)) {
			console.log(
				`TaskMasterApi: Scheduled prefetch for ${data.length} tasks related to ${key}`
			);
			// Future enhancement: prefetch individual task details, related dependencies, etc.
		}
	}

	/**
	 * Cleanup method to clear timers
	 */
	destroy(): void {
		if (this.backgroundRefreshTimer) {
			clearInterval(this.backgroundRefreshTimer);
			this.backgroundRefreshTimer = undefined;
		}
		this.clearCache();
		console.log('TaskMasterApi: Destroyed and cleaned up resources');
	}

	/**
	 * Call MCP tool with retry logic
	 */
	private async callMCPTool(
		toolName: string,
		args: Record<string, unknown>
	): Promise<any> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
			try {
				const rawResponse = await this.mcpClient.callTool(toolName, args);
				console.log(
					`🔍 DEBUGGING: Raw MCP response for ${toolName}:`,
					JSON.stringify(rawResponse, null, 2)
				);

				// Parse MCP response format: { content: [{ type: 'text', text: '{"data": {...}}' }] }
				if (
					rawResponse &&
					rawResponse.content &&
					Array.isArray(rawResponse.content) &&
					rawResponse.content[0]
				) {
					const contentItem = rawResponse.content[0];
					if (contentItem.type === 'text' && contentItem.text) {
						try {
							const parsedData = JSON.parse(contentItem.text);
							console.log(
								`🔍 DEBUGGING: Parsed MCP data for ${toolName}:`,
								parsedData
							);
							return parsedData;
						} catch (parseError) {
							console.error(
								`TaskMasterApi: Failed to parse MCP response text for ${toolName}:`,
								parseError
							);
							console.error(`TaskMasterApi: Raw text was:`, contentItem.text);
							return rawResponse; // Fall back to original response
						}
					}
				}

				// If not in expected format, return as-is
				console.warn(
					`TaskMasterApi: Unexpected MCP response format for ${toolName}, returning raw response`
				);
				return rawResponse;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');
				console.warn(
					`TaskMasterApi: Attempt ${attempt}/${this.config.retryAttempts} failed for ${toolName}:`,
					lastError.message
				);

				if (attempt < this.config.retryAttempts) {
					// Exponential backoff
					const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw (
			lastError ||
			new Error(
				`Failed to call ${toolName} after ${this.config.retryAttempts} attempts`
			)
		);
	}

	/**
	 * Transform MCP tasks response to our internal format with comprehensive validation
	 */
	private transformMCPTasksResponse(mcpResponse: any): TaskMasterTask[] {
		const transformStartTime = Date.now();

		try {
			// Validate response structure
			const validationResult = this.validateMCPResponse(mcpResponse);
			if (!validationResult.isValid) {
				console.warn(
					'TaskMasterApi: MCP response validation failed:',
					validationResult.errors
				);
				return [];
			}

			const tasks = mcpResponse.data.tasks || [];
			console.log(
				`TaskMasterApi: Transforming ${tasks.length} tasks from MCP response`
			);

			const transformedTasks: TaskMasterTask[] = [];
			const transformationErrors: Array<{
				taskId: any;
				error: string;
				task: any;
			}> = [];

			for (let i = 0; i < tasks.length; i++) {
				try {
					const task = tasks[i];
					const transformedTask = this.transformSingleTask(task, i);
					if (transformedTask) {
						transformedTasks.push(transformedTask);
					}
				} catch (error) {
					const errorMsg =
						error instanceof Error
							? error.message
							: 'Unknown transformation error';
					transformationErrors.push({
						taskId: tasks[i]?.id || `unknown_${i}`,
						error: errorMsg,
						task: tasks[i]
					});
					console.error(
						`TaskMasterApi: Failed to transform task at index ${i}:`,
						errorMsg,
						tasks[i]
					);
				}
			}

			// Log transformation summary
			const transformDuration = Date.now() - transformStartTime;
			console.log(
				`TaskMasterApi: Transformation completed in ${transformDuration}ms`,
				{
					totalTasks: tasks.length,
					successfulTransformations: transformedTasks.length,
					errors: transformationErrors.length,
					errorSummary: transformationErrors.map((e) => ({
						id: e.taskId,
						error: e.error
					}))
				}
			);

			return transformedTasks;
		} catch (error) {
			console.error(
				'TaskMasterApi: Critical error during response transformation:',
				error
			);
			return [];
		}
	}

	/**
	 * Validate MCP response structure
	 */
	private validateMCPResponse(mcpResponse: any): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!mcpResponse) {
			errors.push('Response is null or undefined');
			return { isValid: false, errors };
		}

		if (typeof mcpResponse !== 'object') {
			errors.push('Response is not an object');
			return { isValid: false, errors };
		}

		if (mcpResponse.error) {
			errors.push(`MCP error: ${mcpResponse.error}`);
		}

		if (!mcpResponse.data) {
			errors.push('Response missing data property');
		} else if (typeof mcpResponse.data !== 'object') {
			errors.push('Response data is not an object');
		}

		if (mcpResponse.data && !Array.isArray(mcpResponse.data.tasks)) {
			// Allow null/undefined tasks array, but not wrong type
			if (
				mcpResponse.data.tasks !== null &&
				mcpResponse.data.tasks !== undefined
			) {
				errors.push('Response data.tasks is not an array');
			}
		}

		return { isValid: errors.length === 0, errors };
	}

	/**
	 * Transform a single task with comprehensive validation
	 */
	private transformSingleTask(task: any, index: number): TaskMasterTask | null {
		if (!task || typeof task !== 'object') {
			console.warn(
				`TaskMasterApi: Task at index ${index} is not a valid object:`,
				task
			);
			return null;
		}

		try {
			// Validate required fields
			const taskId = this.validateAndNormalizeId(task.id, index);
			const title =
				this.validateAndNormalizeString(
					task.title,
					'Untitled Task',
					`title for task ${taskId}`
				) || 'Untitled Task';
			const description =
				this.validateAndNormalizeString(
					task.description,
					'',
					`description for task ${taskId}`
				) || '';

			// Normalize and validate status/priority
			const status = this.normalizeStatus(task.status);
			const priority = this.normalizePriority(task.priority);

			// Handle optional fields
			const details = this.validateAndNormalizeString(
				task.details,
				undefined,
				`details for task ${taskId}`
			);
			const testStrategy = this.validateAndNormalizeString(
				task.testStrategy,
				undefined,
				`testStrategy for task ${taskId}`
			);

			// Handle complexity score
			const complexityScore =
				typeof task.complexityScore === 'number'
					? task.complexityScore
					: undefined;

			// Transform dependencies
			const dependencies = this.transformDependencies(
				task.dependencies,
				taskId
			);

			// Transform subtasks
			const subtasks = this.transformSubtasks(task.subtasks, taskId);

			const transformedTask: TaskMasterTask = {
				id: taskId,
				title,
				description,
				status,
				priority,
				details,
				testStrategy,
				complexityScore,
				dependencies,
				subtasks
			};

			// Log successful transformation for complex tasks
			if (
				subtasks.length > 0 ||
				dependencies.length > 0 ||
				complexityScore !== undefined
			) {
				console.log(
					`TaskMasterApi: Successfully transformed complex task ${taskId}:`,
					{
						subtaskCount: subtasks.length,
						dependencyCount: dependencies.length,
						status,
						priority,
						complexityScore
					}
				);
			}

			return transformedTask;
		} catch (error) {
			console.error(
				`TaskMasterApi: Error transforming task at index ${index}:`,
				error,
				task
			);
			return null;
		}
	}

	/**
	 * Validate and normalize task ID
	 */
	private validateAndNormalizeId(id: any, fallbackIndex: number): string {
		if (id === null || id === undefined) {
			const generatedId = `generated_${fallbackIndex}_${Date.now()}`;
			console.warn(`TaskMasterApi: Task missing ID, generated: ${generatedId}`);
			return generatedId;
		}

		const stringId = String(id).trim();
		if (stringId === '') {
			const generatedId = `empty_${fallbackIndex}_${Date.now()}`;
			console.warn(
				`TaskMasterApi: Task has empty ID, generated: ${generatedId}`
			);
			return generatedId;
		}

		return stringId;
	}

	/**
	 * Validate and normalize string fields
	 */
	private validateAndNormalizeString(
		value: any,
		defaultValue: string | undefined,
		fieldName: string
	): string | undefined {
		if (value === null || value === undefined) {
			return defaultValue;
		}

		if (typeof value !== 'string') {
			console.warn(
				`TaskMasterApi: ${fieldName} is not a string, converting:`,
				value
			);
			return String(value).trim() || defaultValue;
		}

		const trimmed = value.trim();
		if (trimmed === '' && defaultValue !== undefined) {
			return defaultValue;
		}

		return trimmed || defaultValue;
	}

	/**
	 * Transform and validate dependencies
	 */
	private transformDependencies(dependencies: any, taskId: string): string[] {
		if (!dependencies) {
			return [];
		}

		if (!Array.isArray(dependencies)) {
			console.warn(
				`TaskMasterApi: Dependencies for task ${taskId} is not an array:`,
				dependencies
			);
			return [];
		}

		const validDependencies: string[] = [];
		for (let i = 0; i < dependencies.length; i++) {
			const dep = dependencies[i];
			if (dep === null || dep === undefined) {
				console.warn(
					`TaskMasterApi: Null dependency at index ${i} for task ${taskId}`
				);
				continue;
			}

			const stringDep = String(dep).trim();
			if (stringDep === '') {
				console.warn(
					`TaskMasterApi: Empty dependency at index ${i} for task ${taskId}`
				);
				continue;
			}

			// Check for self-dependency
			if (stringDep === taskId) {
				console.warn(
					`TaskMasterApi: Self-dependency detected for task ${taskId}, skipping`
				);
				continue;
			}

			validDependencies.push(stringDep);
		}

		return validDependencies;
	}

	/**
	 * Transform and validate subtasks
	 */
	private transformSubtasks(
		subtasks: any,
		parentTaskId: string
	): Array<{
		id: number;
		title: string;
		description?: string;
		status: string;
		details?: string;
		dependencies?: Array<number | string>;
	}> {
		if (!subtasks) {
			return [];
		}

		if (!Array.isArray(subtasks)) {
			console.warn(
				`TaskMasterApi: Subtasks for task ${parentTaskId} is not an array:`,
				subtasks
			);
			return [];
		}

		const validSubtasks = [];
		for (let i = 0; i < subtasks.length; i++) {
			try {
				const subtask = subtasks[i];
				if (!subtask || typeof subtask !== 'object') {
					console.warn(
						`TaskMasterApi: Invalid subtask at index ${i} for task ${parentTaskId}:`,
						subtask
					);
					continue;
				}

				const transformedSubtask = {
					id: typeof subtask.id === 'number' ? subtask.id : i + 1,
					title:
						this.validateAndNormalizeString(
							subtask.title,
							`Subtask ${i + 1}`,
							`subtask title for parent ${parentTaskId}`
						) || `Subtask ${i + 1}`,
					description: this.validateAndNormalizeString(
						subtask.description,
						undefined,
						`subtask description for parent ${parentTaskId}`
					),
					status:
						this.validateAndNormalizeString(
							subtask.status,
							'pending',
							`subtask status for parent ${parentTaskId}`
						) || 'pending',
					details: this.validateAndNormalizeString(
						subtask.details,
						undefined,
						`subtask details for parent ${parentTaskId}`
					),
					dependencies: subtask.dependencies || []
				};

				validSubtasks.push(transformedSubtask);
			} catch (error) {
				console.error(
					`TaskMasterApi: Error transforming subtask at index ${i} for task ${parentTaskId}:`,
					error
				);
			}
		}

		return validSubtasks;
	}

	/**
	 * Normalize task status to our expected values with detailed logging
	 */
	private normalizeStatus(status: string): TaskMasterTask['status'] {
		const original = status;
		const normalized = status?.toLowerCase()?.trim() || 'pending';

		const statusMap: Record<string, TaskMasterTask['status']> = {
			pending: 'pending',
			'in-progress': 'in-progress',
			in_progress: 'in-progress',
			inprogress: 'in-progress',
			progress: 'in-progress',
			working: 'in-progress',
			active: 'in-progress',
			review: 'review',
			reviewing: 'review',
			'in-review': 'review',
			in_review: 'review',
			done: 'done',
			completed: 'done',
			complete: 'done',
			finished: 'done',
			closed: 'done',
			resolved: 'done',
			blocked: 'deferred',
			block: 'deferred',
			stuck: 'deferred',
			waiting: 'deferred',
			cancelled: 'cancelled',
			canceled: 'cancelled',
			cancel: 'cancelled',
			abandoned: 'cancelled',
			deferred: 'deferred',
			defer: 'deferred',
			postponed: 'deferred',
			later: 'deferred'
		};

		const result = statusMap[normalized] || 'pending';

		if (original && original !== result) {
			console.log(
				`TaskMasterApi: Normalized status '${original}' -> '${result}'`
			);
		}

		return result;
	}

	/**
	 * Normalize task priority to our expected values with detailed logging
	 */
	private normalizePriority(priority: string): TaskMasterTask['priority'] {
		const original = priority;
		const normalized = priority?.toLowerCase()?.trim() || 'medium';

		let result: TaskMasterTask['priority'] = 'medium';

		if (
			normalized.includes('high') ||
			normalized.includes('urgent') ||
			normalized.includes('critical') ||
			normalized.includes('important') ||
			normalized === 'h' ||
			normalized === '3'
		) {
			result = 'high';
		} else if (
			normalized.includes('low') ||
			normalized.includes('minor') ||
			normalized.includes('trivial') ||
			normalized === 'l' ||
			normalized === '1'
		) {
			result = 'low';
		} else if (
			normalized.includes('medium') ||
			normalized.includes('normal') ||
			normalized.includes('standard') ||
			normalized === 'm' ||
			normalized === '2'
		) {
			result = 'medium';
		}

		if (original && original !== result) {
			console.log(
				`TaskMasterApi: Normalized priority '${original}' -> '${result}'`
			);
		}

		return result;
	}

	/**
	 * Get workspace root path
	 */
	private getWorkspaceRoot(): string {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
	}
}
