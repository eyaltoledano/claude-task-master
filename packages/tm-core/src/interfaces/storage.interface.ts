/**
 * @fileoverview Storage interface definitions for the tm-core package
 * This file defines the contract for all storage implementations
 */

import type { Task, TaskMetadata } from '../types/index';

/**
 * Interface for storage operations on tasks
 * All storage implementations must implement this interface
 */
export interface IStorage {
	/**
	 * Load all tasks from storage, optionally filtered by tag
	 * @param tag - Optional tag to filter tasks by
	 * @returns Promise that resolves to an array of tasks
	 */
	loadTasks(tag?: string): Promise<Task[]>;

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
	 * Update a specific task by ID
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
	abstract loadTasks(tag?: string): Promise<Task[]>;
	abstract saveTasks(tasks: Task[], tag?: string): Promise<void>;
	abstract appendTasks(tasks: Task[], tag?: string): Promise<void>;
	abstract updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<void>;
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
