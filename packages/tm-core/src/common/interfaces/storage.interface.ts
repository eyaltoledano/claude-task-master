/**
 * @fileoverview Storage interface definitions for the tm-core package
 * This file defines the contract for all storage implementations
 */

import type { Task, TaskMetadata, TaskStatus } from '../types/index.js';

/**
 * Options for loading tasks from storage
 */
export interface LoadTasksOptions {
	/** Filter tasks by status */
	status?: TaskStatus;
	/** Exclude subtasks from loaded tasks (default: false) */
	excludeSubtasks?: boolean;
}

/**
 * Result type for updateTaskStatus operations
 */
export interface UpdateStatusResult {
	success: boolean;
	oldStatus: TaskStatus;
	newStatus: TaskStatus;
	taskId: string;
}

/**
 * Interface for storage operations on tasks
 * All storage implementations must implement this interface
 */
export interface IStorage {
	/**
	 * Load all tasks from storage, optionally filtered by tag and other criteria
	 * @param tag - Optional tag to filter tasks by
	 * @param options - Optional filtering options (status, excludeSubtasks)
	 * @returns Promise that resolves to an array of tasks
	 */
	loadTasks(tag?: string, options?: LoadTasksOptions): Promise<Task[]>;

	/**
	 * Load a single task by ID
	 * @param taskId - ID of the task to load
	 * @param tag - Optional tag context for the task
	 * @returns Promise that resolves to the task or null if not found
	 */
	loadTask(taskId: string, tag?: string): Promise<Task | null>;

	/**
	 * Save tasks to storage, replacing existing tasks
	 * @param tasks - Array of tasks to save
	 * @param tag - Optional tag context for the tasks
	 * @returns Promise that resolves when save is complete
	 */
	saveTasks(tasks: Task[], tag?: string): Promise<void>;

	/**
	 * Append new tasks to existing storage without replacing
	 * @param tasks - Array of tasks to append
	 * @param tag - Optional tag context for the tasks
	 * @returns Promise that resolves when append is complete
	 */
	appendTasks(tasks: Task[], tag?: string): Promise<void>;

	/**
	 * Update a specific task by ID (direct structural update)
	 * @param taskId - ID of the task to update
	 * @param updates - Partial task object with fields to update
	 * @param tag - Optional tag context for the task
	 * @returns Promise that resolves when update is complete
	 */
	updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<void>;

	/**
	 * Update a task using AI-powered prompt (natural language update)
	 * @param taskId - ID of the task to update
	 * @param prompt - Natural language prompt describing the update
	 * @param tag - Optional tag context for the task
	 * @param options - Optional update options
	 * @param options.useResearch - Whether to use research capabilities (for file storage)
	 * @param options.mode - Update mode: 'append' adds info, 'update' makes targeted changes, 'rewrite' restructures (for API storage)
	 * @returns Promise that resolves when update is complete
	 */
	updateTaskWithPrompt(
		taskId: string,
		prompt: string,
		tag?: string,
		options?: { useResearch?: boolean; mode?: 'append' | 'update' | 'rewrite' }
	): Promise<void>;

	/**
	 * Update task or subtask status by ID
	 * @param taskId - ID of the task or subtask (e.g., "1" or "1.2")
	 * @param newStatus - New status to set
	 * @param tag - Optional tag context for the task
	 * @returns Promise that resolves to update result with old and new status
	 */
	updateTaskStatus(
		taskId: string,
		newStatus: TaskStatus,
		tag?: string
	): Promise<UpdateStatusResult>;

	/**
	 * Delete a task by ID
	 * @param taskId - ID of the task to delete
	 * @param tag - Optional tag context for the task
	 * @returns Promise that resolves when deletion is complete
	 */
	deleteTask(taskId: string, tag?: string): Promise<void>;

	/**
	 * Check if tasks exist in storage for the given tag
	 * @param tag - Optional tag to check existence for
	 * @returns Promise that resolves to boolean indicating existence
	 */
	exists(tag?: string): Promise<boolean>;

	/**
	 * Load metadata about the task collection
	 * @param tag - Optional tag to get metadata for
	 * @returns Promise that resolves to task metadata
	 */
	loadMetadata(tag?: string): Promise<TaskMetadata | null>;

	/**
	 * Save metadata about the task collection
	 * @param metadata - Metadata object to save
	 * @param tag - Optional tag context for the metadata
	 * @returns Promise that resolves when save is complete
	 */
	saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void>;

	/**
	 * Get all available tags in storage
	 * @returns Promise that resolves to array of available tags
	 */
	getAllTags(): Promise<string[]>;

	/**
	 * Delete all tasks and metadata for a specific tag
	 * @param tag - Tag to delete
	 * @returns Promise that resolves when deletion is complete
	 */
	deleteTag(tag: string): Promise<void>;

	/**
	 * Rename a tag (move all tasks from old tag to new tag)
	 * @param oldTag - Current tag name
	 * @param newTag - New tag name
	 * @returns Promise that resolves when rename is complete
	 */
	renameTag(oldTag: string, newTag: string): Promise<void>;

	/**
	 * Copy all tasks from one tag to another
	 * @param sourceTag - Source tag to copy from
	 * @param targetTag - Target tag to copy to
	 * @returns Promise that resolves when copy is complete
	 */
	copyTag(sourceTag: string, targetTag: string): Promise<void>;

	/**
	 * Initialize storage (create necessary directories, files, etc.)
	 * @returns Promise that resolves when initialization is complete
	 */
	initialize(): Promise<void>;

	/**
	 * Clean up and close storage connections
	 * @returns Promise that resolves when cleanup is complete
	 */
	close(): Promise<void>;

	/**
	 * Get storage statistics (file sizes, task counts, etc.)
	 * @returns Promise that resolves to storage statistics
	 */
	getStats(): Promise<StorageStats>;

	/**
	 * Get the storage type identifier
	 * @returns The type of storage implementation ('file' or 'api')
	 */
	getStorageType(): 'file' | 'api';

	/**
	 * Get the current brief name (only applicable for API storage)
	 * @returns The brief name if using API storage with a selected brief, null otherwise
	 */
	getCurrentBriefName(): string | null;
}

/**
 * Storage statistics interface
 */
export interface StorageStats {
	/** Total number of tasks across all tags */
	totalTasks: number;
	/** Total number of tags */
	totalTags: number;
	/** Storage size in bytes */
	storageSize: number;
	/** Last modified timestamp */
	lastModified: string;
	/** Available tags with task counts */
	tagStats: Array<{
		tag: string;
		taskCount: number;
		lastModified: string;
	}>;
}

/**
 * Configuration options for storage implementations
 */
export interface StorageConfig {
	/** Base path for storage */
	basePath: string;
	/** Enable backup creation */
	enableBackup?: boolean;
	/** Maximum number of backups to keep */
	maxBackups?: number;
	/** Enable compression for storage */
	enableCompression?: boolean;
	/** File encoding (default: utf8) */
	encoding?: BufferEncoding;
	/** Enable atomic writes */
	atomicWrites?: boolean;
}

/**
 * Base abstract class for storage implementations
 * Provides common functionality and enforces the interface
 */
export abstract class BaseStorage implements IStorage {
	protected config: StorageConfig;

	constructor(config: StorageConfig) {
		this.config = config;
	}

	// Abstract methods that must be implemented by concrete classes
	abstract loadTasks(tag?: string, options?: LoadTasksOptions): Promise<Task[]>;
	abstract loadTask(taskId: string, tag?: string): Promise<Task | null>;
	abstract saveTasks(tasks: Task[], tag?: string): Promise<void>;
	abstract appendTasks(tasks: Task[], tag?: string): Promise<void>;
	abstract updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<void>;
	abstract updateTaskWithPrompt(
		taskId: string,
		prompt: string,
		tag?: string,
		options?: { useResearch?: boolean; mode?: 'append' | 'update' | 'rewrite' }
	): Promise<void>;
	abstract updateTaskStatus(
		taskId: string,
		newStatus: TaskStatus,
		tag?: string
	): Promise<UpdateStatusResult>;
	abstract deleteTask(taskId: string, tag?: string): Promise<void>;
	abstract exists(tag?: string): Promise<boolean>;
	abstract loadMetadata(tag?: string): Promise<TaskMetadata | null>;
	abstract saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void>;
	abstract getAllTags(): Promise<string[]>;
	abstract deleteTag(tag: string): Promise<void>;
	abstract renameTag(oldTag: string, newTag: string): Promise<void>;
	abstract copyTag(sourceTag: string, targetTag: string): Promise<void>;
	abstract initialize(): Promise<void>;
	abstract close(): Promise<void>;
	abstract getStats(): Promise<StorageStats>;
	abstract getStorageType(): 'file' | 'api';
	abstract getCurrentBriefName(): string | null;
	/**
	 * Utility method to generate backup filename
	 * @param originalPath - Original file path
	 * @returns Backup file path with timestamp
	 */
	protected generateBackupPath(originalPath: string): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const parts = originalPath.split('.');
		const extension = parts.pop();
		const baseName = parts.join('.');
		return `${baseName}.backup.${timestamp}.${extension}`;
	}

	/**
	 * Utility method to validate task data before storage operations
	 * @param task - Task to validate
	 * @throws Error if task is invalid
	 */
	protected validateTask(task: Task): void {
		if (!task.id) {
			throw new Error('Task ID is required');
		}
		if (!task.title) {
			throw new Error('Task title is required');
		}
		if (!task.description) {
			throw new Error('Task description is required');
		}
		if (!task.status) {
			throw new Error('Task status is required');
		}
	}

	/**
	 * Utility method to sanitize tag names for file system safety
	 * @param tag - Tag name to sanitize
	 * @returns Sanitized tag name
	 */
	protected sanitizeTag(tag: string): string {
		return tag.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
	}
}
