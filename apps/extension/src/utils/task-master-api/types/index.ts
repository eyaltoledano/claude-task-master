/**
 * TaskMaster API Types
 * All type definitions for the TaskMaster API
 */

// MCP Response Types
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

// Internal Task Interface
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
		testStrategy?: string;
		dependencies?: Array<number | string>;
	}>;
}

// API Response Wrapper
export interface TaskMasterApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	requestDuration?: number;
}

// API Configuration
export interface TaskMasterApiConfig {
	timeout: number;
	retryAttempts: number;
	cacheDuration: number;
	projectRoot?: string;
	cache?: CacheConfig;
}

export interface CacheConfig {
	maxSize: number;
	enableBackgroundRefresh: boolean;
	refreshInterval: number;
	enableAnalytics: boolean;
	enablePrefetch: boolean;
	compressionEnabled: boolean;
	persistToDisk: boolean;
}

// Cache Types
export interface CacheEntry {
	data: any;
	timestamp: number;
	accessCount: number;
	lastAccessed: number;
	size: number;
	ttl?: number;
	tags: string[];
}

export interface CacheAnalytics {
	hits: number;
	misses: number;
	evictions: number;
	refreshes: number;
	totalSize: number;
	averageAccessTime: number;
	hitRate: number;
}

// Method Options
export interface GetTasksOptions {
	status?: string;
	withSubtasks?: boolean;
	tag?: string;
	projectRoot?: string;
}

export interface UpdateTaskStatusOptions {
	projectRoot?: string;
}

export interface UpdateTaskOptions {
	projectRoot?: string;
	append?: boolean;
	research?: boolean;
}

export interface UpdateSubtaskOptions {
	projectRoot?: string;
	research?: boolean;
}

export interface AddSubtaskOptions {
	projectRoot?: string;
}

export interface TaskUpdate {
	title?: string;
	description?: string;
	details?: string;
	priority?: 'high' | 'medium' | 'low';
	testStrategy?: string;
	dependencies?: string[];
}

export interface SubtaskData {
	title: string;
	description?: string;
	dependencies?: string[];
	status?: string;
}
