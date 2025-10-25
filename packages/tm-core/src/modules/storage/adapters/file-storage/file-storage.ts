/**
 * @fileoverview Refactored file-based storage implementation for Task Master
 */

import type {
	Task,
	TaskMetadata,
	TaskStatus
} from '../../../../common/types/index.js';
import type {
	IStorage,
	StorageStats,
	UpdateStatusResult,
	LoadTasksOptions
} from '../../../../common/interfaces/storage.interface.js';
import { FormatHandler } from './format-handler.js';
import { FileOperations } from './file-operations.js';
import { PathResolver } from './path-resolver.js';
import { ComplexityReportManager } from '../../../reports/managers/complexity-report-manager.js';

/**
 * File-based storage implementation using a single tasks.json file with separated concerns
 */
export class FileStorage implements IStorage {
	private formatHandler: FormatHandler;
	private fileOps: FileOperations;
	private pathResolver: PathResolver;
	private complexityManager: ComplexityReportManager;

	constructor(projectPath: string) {
		this.formatHandler = new FormatHandler();
		this.fileOps = new FileOperations();
		this.pathResolver = new PathResolver(projectPath);
		this.complexityManager = new ComplexityReportManager(projectPath);
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
	 * Get the storage type
	 */
	getStorageType(): 'file' {
		return 'file';
	}

	/**
	 * Get the current brief name (not applicable for file storage)
	 * @returns null (file storage doesn't use briefs)
	 */
	getCurrentBriefName(): null {
		return null;
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
	 * Enriches tasks with complexity data from the complexity report
	 */
	async loadTasks(tag?: string, options?: LoadTasksOptions): Promise<Task[]> {
		const filePath = this.pathResolver.getTasksPath();
		const resolvedTag = tag || 'master';

		try {
			const rawData = await this.fileOps.readJson(filePath);
			let tasks = this.formatHandler.extractTasks(rawData, resolvedTag);

			// Apply filters if provided
			if (options) {
				// Filter by status if specified
				if (options.status) {
					tasks = tasks.filter((task) => task.status === options.status);
				}

				// Exclude subtasks if specified
				if (options.excludeSubtasks) {
					tasks = tasks.map((task) => ({
						...task,
						subtasks: []
					}));
				}
			}

			return await this.enrichTasksWithComplexity(tasks, resolvedTag);
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				return []; // File doesn't exist, return empty array
			}
			throw new Error(`Failed to load tasks: ${error.message}`);
		}
	}

	/**
	 * Load a single task by ID from the tasks.json file
	 * Handles both regular tasks and subtasks (with dotted notation like "1.2")
	 */
	async loadTask(taskId: string, tag?: string): Promise<Task | null> {
		const tasks = await this.loadTasks(tag);

		// Check if this is a subtask (contains a dot)
		if (taskId.includes('.')) {
			const [parentId, subtaskId] = taskId.split('.');
			const parentTask = tasks.find((t) => String(t.id) === parentId);

			if (!parentTask || !parentTask.subtasks) {
				return null;
			}

			const subtask = parentTask.subtasks.find(
				(st) => String(st.id) === subtaskId
			);
			if (!subtask) {
				return null;
			}

			const toFullSubId = (maybeDotId: string | number): string => {
				const depId = String(maybeDotId);
				return depId.includes('.') ? depId : `${parentTask.id}.${depId}`;
			};
			const resolvedDependencies =
				subtask.dependencies?.map((dep) => toFullSubId(dep)) ?? [];

			// Return a Task-like object for the subtask with the full dotted ID
			// Following the same pattern as findTaskById in utils.js
			const subtaskResult = {
				...subtask,
				id: taskId, // Use the full dotted ID
				title: subtask.title || `Subtask ${subtaskId}`,
				description: subtask.description || '',
				status: subtask.status || 'pending',
				priority: subtask.priority || parentTask.priority || 'medium',
				dependencies: resolvedDependencies,
				details: subtask.details || '',
				testStrategy: subtask.testStrategy || '',
				subtasks: [],
				tags: parentTask.tags || [],
				assignee: subtask.assignee || parentTask.assignee,
				complexity: subtask.complexity || parentTask.complexity,
				createdAt: subtask.createdAt || parentTask.createdAt,
				updatedAt: subtask.updatedAt || parentTask.updatedAt,
				// Add reference to parent task for context (like utils.js does)
				parentTask: {
					id: parentTask.id,
					title: parentTask.title,
					status: parentTask.status
				},
				isSubtask: true
			};

			return subtaskResult;
		}

		// Handle regular task lookup
		return tasks.find((task) => String(task.id) === String(taskId)) || null;
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
		const taskIndex = tasks.findIndex((t) => String(t.id) === String(taskId));

		if (taskIndex === -1) {
			throw new Error(`Task ${taskId} not found`);
		}

		tasks[taskIndex] = {
			...tasks[taskIndex],
			...updates,
			id: String(taskId) // Keep consistent with normalizeTaskIds
		};
		await this.saveTasks(tasks, tag);
	}

	/**
	 * Update task with AI-powered prompt
	 * For file storage, this should NOT be called - client must handle AI processing first
	 */
	async updateTaskWithPrompt(
		_taskId: string,
		_prompt: string,
		_tag?: string,
		_options?: { useResearch?: boolean; mode?: 'append' | 'update' | 'rewrite' }
	): Promise<void> {
		throw new Error(
			'File storage does not support updateTaskWithPrompt. ' +
				'Client-side AI logic must process the prompt before calling updateTask().'
		);
	}

	/**
	 * Update task or subtask status by ID - handles file storage logic with parent/subtask relationships
	 */
	async updateTaskStatus(
		taskId: string,
		newStatus: TaskStatus,
		tag?: string
	): Promise<UpdateStatusResult> {
		const tasks = await this.loadTasks(tag);

		// Check if this is a subtask (contains a dot)
		if (taskId.includes('.')) {
			return this.updateSubtaskStatusInFile(tasks, taskId, newStatus, tag);
		}

		// Handle regular task update
		const taskIndex = tasks.findIndex((t) => String(t.id) === String(taskId));

		if (taskIndex === -1) {
			throw new Error(`Task ${taskId} not found`);
		}

		const oldStatus = tasks[taskIndex].status;
		if (oldStatus === newStatus) {
			return {
				success: true,
				oldStatus,
				newStatus,
				taskId: String(taskId)
			};
		}

		tasks[taskIndex] = {
			...tasks[taskIndex],
			status: newStatus,
			updatedAt: new Date().toISOString()
		};

		await this.saveTasks(tasks, tag);

		return {
			success: true,
			oldStatus,
			newStatus,
			taskId: String(taskId)
		};
	}

	/**
	 * Update subtask status within file storage - handles parent status auto-adjustment
	 */
	private async updateSubtaskStatusInFile(
		tasks: Task[],
		subtaskId: string,
		newStatus: TaskStatus,
		tag?: string
	): Promise<UpdateStatusResult> {
		// Parse the subtask ID to get parent ID and subtask ID
		const parts = subtaskId.split('.');
		if (parts.length !== 2) {
			throw new Error(
				`Invalid subtask ID format: ${subtaskId}. Expected format: parentId.subtaskId`
			);
		}

		const [parentId, subIdRaw] = parts;
		const subId = subIdRaw.trim();
		if (!/^\d+$/.test(subId)) {
			throw new Error(
				`Invalid subtask ID: ${subId}. Subtask ID must be a positive integer.`
			);
		}
		const subtaskNumericId = Number(subId);

		// Find the parent task
		const parentTaskIndex = tasks.findIndex(
			(t) => String(t.id) === String(parentId)
		);

		if (parentTaskIndex === -1) {
			throw new Error(`Parent task ${parentId} not found`);
		}

		const parentTask = tasks[parentTaskIndex];

		// Find the subtask within the parent task
		const subtaskIndex = parentTask.subtasks.findIndex(
			(st) => st.id === subtaskNumericId || String(st.id) === subId
		);

		if (subtaskIndex === -1) {
			throw new Error(
				`Subtask ${subtaskId} not found in parent task ${parentId}`
			);
		}

		const oldStatus = parentTask.subtasks[subtaskIndex].status || 'pending';
		if (oldStatus === newStatus) {
			return {
				success: true,
				oldStatus,
				newStatus,
				taskId: subtaskId
			};
		}

		const now = new Date().toISOString();

		// Update the subtask status
		parentTask.subtasks[subtaskIndex] = {
			...parentTask.subtasks[subtaskIndex],
			status: newStatus,
			updatedAt: now
		};

		// Auto-adjust parent status based on subtask statuses
		const subs = parentTask.subtasks;
		let parentNewStatus = parentTask.status;
		if (subs.length > 0) {
			const norm = (s: any) => s.status || 'pending';
			const isDoneLike = (s: any) => {
				const st = norm(s);
				return st === 'done' || st === 'completed';
			};
			const allDone = subs.every(isDoneLike);
			const anyInProgress = subs.some((s) => norm(s) === 'in-progress');
			const anyDone = subs.some(isDoneLike);
			const allPending = subs.every((s) => norm(s) === 'pending');

			if (allDone) parentNewStatus = 'done';
			else if (anyInProgress || anyDone) parentNewStatus = 'in-progress';
			else if (allPending) parentNewStatus = 'pending';
		}

		// Always bump updatedAt; update status only if changed
		tasks[parentTaskIndex] = {
			...parentTask,
			...(parentNewStatus !== parentTask.status
				? { status: parentNewStatus }
				: {}),
			updatedAt: now
		};

		await this.saveTasks(tasks, tag);

		return {
			success: true,
			oldStatus,
			newStatus,
			taskId: subtaskId
		};
	}

	/**
	 * Delete a task
	 */
	async deleteTask(taskId: string, tag?: string): Promise<void> {
		const tasks = await this.loadTasks(tag);
		const filteredTasks = tasks.filter((t) => String(t.id) !== String(taskId));

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

	/**
	 * Enrich tasks with complexity data from the complexity report
	 * Private helper method called by loadTasks()
	 */
	private async enrichTasksWithComplexity(
		tasks: Task[],
		tag: string
	): Promise<Task[]> {
		// Get all task IDs for bulk lookup
		const taskIds = tasks.map((t) => t.id);

		// Load complexity data for all tasks at once (more efficient)
		const complexityMap = await this.complexityManager.getComplexityForTasks(
			taskIds,
			tag
		);

		// If no complexity data found, return tasks as-is
		if (complexityMap.size === 0) {
			return tasks;
		}

		// Enrich each task with its complexity data
		return tasks.map((task) => {
			const complexityData = complexityMap.get(String(task.id));
			if (!complexityData) {
				return task;
			}

			// Merge complexity data into the task
			return {
				...task,
				complexity: complexityData.complexityScore,
				recommendedSubtasks: complexityData.recommendedSubtasks,
				expansionPrompt: complexityData.expansionPrompt,
				complexityReasoning: complexityData.complexityReasoning
			};
		});
	}
}

// Export as default for convenience
export default FileStorage;
