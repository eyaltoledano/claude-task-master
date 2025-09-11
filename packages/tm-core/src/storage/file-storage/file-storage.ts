/**
 * @fileoverview Refactored file-based storage implementation for Task Master
 */

import type { Task, TaskMetadata } from '../../types/index.js';
import type {
	IStorage,
	StorageStats
} from '../../interfaces/storage.interface.js';
import { FormatHandler } from './format-handler.js';
import { FileOperations } from './file-operations.js';
import { PathResolver } from './path-resolver.js';

/**
 * File-based storage implementation using a single tasks.json file with separated concerns
 */
export class FileStorage implements IStorage {
	private formatHandler: FormatHandler;
	private fileOps: FileOperations;
	private pathResolver: PathResolver;

	constructor(projectPath: string) {
		this.formatHandler = new FormatHandler();
		this.fileOps = new FileOperations();
		this.pathResolver = new PathResolver(projectPath);
	}

	/**
	 * Initialize storage by creating necessary directories
	 */
	async initialize(): Promise<void> {
		await this.fileOps.ensureDir(this.pathResolver.getTasksDir());
	}

	/**
	 * Close storage and cleanup resources
	 */
	async close(): Promise<void> {
		await this.fileOps.cleanup();
	}

	/**
	 * Get statistics about the storage
	 */
	async getStats(): Promise<StorageStats> {
		const filePath = this.pathResolver.getTasksPath();

		try {
			const stats = await this.fileOps.getStats(filePath);
			const data = await this.fileOps.readJson(filePath);
			const tags = this.formatHandler.extractTags(data);

			let totalTasks = 0;
			const tagStats = tags.map((tag) => {
				const tasks = this.formatHandler.extractTasks(data, tag);
				const taskCount = tasks.length;
				totalTasks += taskCount;

				return {
					tag,
					taskCount,
					lastModified: stats.mtime.toISOString()
				};
			});

			return {
				totalTasks,
				totalTags: tags.length,
				lastModified: stats.mtime.toISOString(),
				storageSize: 0, // Could calculate actual file sizes if needed
				tagStats
			};
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return {
					totalTasks: 0,
					totalTags: 0,
					lastModified: new Date().toISOString(),
					storageSize: 0,
					tagStats: []
				};
			}
			throw new Error(`Failed to get storage stats: ${error.message}`);
		}
	}

	/**
	 * Load tasks from the single tasks.json file for a specific tag
	 */
	async loadTasks(tag?: string): Promise<Task[]> {
		const filePath = this.pathResolver.getTasksPath();
		const resolvedTag = tag || 'master';

		try {
			const rawData = await this.fileOps.readJson(filePath);
			return this.formatHandler.extractTasks(rawData, resolvedTag);
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return []; // File doesn't exist, return empty array
			}
			throw new Error(`Failed to load tasks: ${error.message}`);
		}
	}

	/**
	 * Save tasks for a specific tag in the single tasks.json file
	 */
	async saveTasks(tasks: Task[], tag?: string): Promise<void> {
		const filePath = this.pathResolver.getTasksPath();
		const resolvedTag = tag || 'master';

		// Ensure directory exists
		await this.fileOps.ensureDir(this.pathResolver.getTasksDir());

		// Get existing data from the file
		let existingData: any = {};
		try {
			existingData = await this.fileOps.readJson(filePath);
		} catch (error: any) {
			if (error.code !== 'ENOENT') {
				throw new Error(`Failed to read existing tasks: ${error.message}`);
			}
			// File doesn't exist, start with empty data
		}

		// Create metadata for this tag
		const metadata: TaskMetadata = {
			version: '1.0.0',
			lastModified: new Date().toISOString(),
			taskCount: tasks.length,
			completedCount: tasks.filter((t) => t.status === 'done').length,
			tags: [resolvedTag]
		};

		// Normalize tasks
		const normalizedTasks = this.normalizeTaskIds(tasks);

		// Update the specific tag in the existing data structure
		if (
			this.formatHandler.detectFormat(existingData) === 'legacy' ||
			Object.keys(existingData).some(
				(key) => key !== 'tasks' && key !== 'metadata'
			)
		) {
			// Legacy format - update/add the tag
			existingData[resolvedTag] = {
				tasks: normalizedTasks,
				metadata
			};
		} else if (resolvedTag === 'master') {
			// Standard format for master tag
			existingData = {
				tasks: normalizedTasks,
				metadata
			};
		} else {
			// Convert to legacy format when adding non-master tags
			const masterTasks = existingData.tasks || [];
			const masterMetadata = existingData.metadata || metadata;

			existingData = {
				master: {
					tasks: masterTasks,
					metadata: masterMetadata
				},
				[resolvedTag]: {
					tasks: normalizedTasks,
					metadata
				}
			};
		}

		// Write the updated file
		await this.fileOps.writeJson(filePath, existingData);
	}

	/**
	 * Normalize task IDs - keep Task IDs as strings, Subtask IDs as numbers
	 */
	private normalizeTaskIds(tasks: Task[]): Task[] {
		return tasks.map((task) => ({
			...task,
			id: String(task.id), // Task IDs are strings
			dependencies: task.dependencies?.map((dep) => String(dep)) || [],
			subtasks:
				task.subtasks?.map((subtask) => ({
					...subtask,
					id: Number(subtask.id), // Subtask IDs are numbers
					parentId: String(subtask.parentId) // Parent ID is string (Task ID)
				})) || []
		}));
	}

	/**
	 * Check if the tasks file exists
	 */
	async exists(_tag?: string): Promise<boolean> {
		const filePath = this.pathResolver.getTasksPath();
		return this.fileOps.exists(filePath);
	}

	/**
	 * Get all available tags from the single tasks.json file
	 */
	async getAllTags(): Promise<string[]> {
		try {
			const filePath = this.pathResolver.getTasksPath();
			const data = await this.fileOps.readJson(filePath);
			return this.formatHandler.extractTags(data);
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return []; // File doesn't exist
			}
			throw new Error(`Failed to get tags: ${error.message}`);
		}
	}

	/**
	 * Load metadata from the single tasks.json file for a specific tag
	 */
	async loadMetadata(tag?: string): Promise<TaskMetadata | null> {
		const filePath = this.pathResolver.getTasksPath();
		const resolvedTag = tag || 'master';

		try {
			const rawData = await this.fileOps.readJson(filePath);
			return this.formatHandler.extractMetadata(rawData, resolvedTag);
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return null;
			}
			throw new Error(`Failed to load metadata: ${error.message}`);
		}
	}

	/**
	 * Save metadata (stored with tasks)
	 */
	async saveMetadata(_metadata: TaskMetadata, tag?: string): Promise<void> {
		const tasks = await this.loadTasks(tag);
		await this.saveTasks(tasks, tag);
	}

	/**
	 * Append tasks to existing storage
	 */
	async appendTasks(tasks: Task[], tag?: string): Promise<void> {
		const existingTasks = await this.loadTasks(tag);
		const allTasks = [...existingTasks, ...tasks];
		await this.saveTasks(allTasks, tag);
	}

	/**
	 * Update a specific task
	 */
	async updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<void> {
		const tasks = await this.loadTasks(tag);
		const taskIndex = tasks.findIndex((t) => t.id === taskId.toString());

		if (taskIndex === -1) {
			throw new Error(`Task ${taskId} not found`);
		}

		tasks[taskIndex] = {
			...tasks[taskIndex],
			...updates,
			id: taskId.toString()
		};
		await this.saveTasks(tasks, tag);
	}

	/**
	 * Delete a task
	 */
	async deleteTask(taskId: string, tag?: string): Promise<void> {
		const tasks = await this.loadTasks(tag);
		const filteredTasks = tasks.filter((t) => t.id !== taskId);

		if (filteredTasks.length === tasks.length) {
			throw new Error(`Task ${taskId} not found`);
		}

		await this.saveTasks(filteredTasks, tag);
	}

	/**
	 * Delete a tag from the single tasks.json file
	 */
	async deleteTag(tag: string): Promise<void> {
		const filePath = this.pathResolver.getTasksPath();

		try {
			const existingData = await this.fileOps.readJson(filePath);

			if (this.formatHandler.detectFormat(existingData) === 'legacy') {
				// Legacy format - remove the tag key
				if (tag in existingData) {
					delete existingData[tag];
					await this.fileOps.writeJson(filePath, existingData);
				} else {
					throw new Error(`Tag ${tag} not found`);
				}
			} else if (tag === 'master') {
				// Standard format - delete the entire file for master tag
				await this.fileOps.deleteFile(filePath);
			} else {
				throw new Error(`Tag ${tag} not found in standard format`);
			}
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				throw new Error(`Tag ${tag} not found - file doesn't exist`);
			}
			throw error;
		}
	}

	/**
	 * Rename a tag within the single tasks.json file
	 */
	async renameTag(oldTag: string, newTag: string): Promise<void> {
		const filePath = this.pathResolver.getTasksPath();

		try {
			const existingData = await this.fileOps.readJson(filePath);

			if (this.formatHandler.detectFormat(existingData) === 'legacy') {
				// Legacy format - rename the tag key
				if (oldTag in existingData) {
					existingData[newTag] = existingData[oldTag];
					delete existingData[oldTag];

					// Update metadata tags array
					if (existingData[newTag].metadata) {
						existingData[newTag].metadata.tags = [newTag];
					}

					await this.fileOps.writeJson(filePath, existingData);
				} else {
					throw new Error(`Tag ${oldTag} not found`);
				}
			} else if (oldTag === 'master') {
				// Convert standard format to legacy when renaming master
				const masterTasks = existingData.tasks || [];
				const masterMetadata = existingData.metadata || {};

				const newData = {
					[newTag]: {
						tasks: masterTasks,
						metadata: { ...masterMetadata, tags: [newTag] }
					}
				};

				await this.fileOps.writeJson(filePath, newData);
			} else {
				throw new Error(`Tag ${oldTag} not found in standard format`);
			}
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				throw new Error(`Tag ${oldTag} not found - file doesn't exist`);
			}
			throw error;
		}
	}

	/**
	 * Copy a tag within the single tasks.json file
	 */
	async copyTag(sourceTag: string, targetTag: string): Promise<void> {
		const tasks = await this.loadTasks(sourceTag);

		if (tasks.length === 0) {
			throw new Error(`Source tag ${sourceTag} not found or has no tasks`);
		}

		await this.saveTasks(tasks, targetTag);
	}
}

// Export as default for convenience
export default FileStorage;
