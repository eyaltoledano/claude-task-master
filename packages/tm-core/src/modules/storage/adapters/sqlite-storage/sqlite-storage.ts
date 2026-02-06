/**
 * @fileoverview SQLite storage adapter implementing IStorage interface
 * Uses SQLite as the working database with JSONL sync for git-friendly persistence.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
	IStorage,
	LoadTasksOptions,
	StorageStats,
	TagsWithStatsResult,
	UpdateStatusResult,
	WatchEvent,
	WatchOptions,
	WatchSubscription
} from '../../../../common/interfaces/storage.interface.js';
import type {
	Task,
	TaskMetadata,
	TaskStatus
} from '../../../../common/types/index.js';
import type { Subtask } from '../../../../common/types/index.js';
import type { ExpandTaskResult } from '../../../integration/services/task-expansion.service.js';
import { SqliteDatabase } from './database.js';
import { JsonlSync } from './jsonl-sync.js';
import {
	copyTasksToTag,
	deleteAllTasksForTag,
	deleteTagMetadata,
	deleteTask as deleteTaskQuery,
	getAllTags,
	getSubtasks,
	getTagMetadata,
	getTask,
	getTaskCounts,
	loadAllTasks,
	loadCompleteTask,
	saveCompleteTask,
	setSubtaskDependencies,
	setTagMetadata,
	setTaskDependencies,
	tagMetadataRowToTaskMetadata,
	updateSubtask as updateSubtaskQuery,
	updateTask as updateTaskQuery
} from './queries.js';
import type { SqliteStorageConfig } from './types.js';

/**
 * Convert a Subtask to a Task-like object with safe defaults
 * Ensures all required Task fields are present even if subtask data is incomplete
 */
function convertSubtaskToTask(subtask: Subtask, fullTaskId: string): Task {
	return {
		id: fullTaskId,
		title: subtask.title || '',
		description: subtask.description || '',
		status: subtask.status || 'pending',
		priority: subtask.priority || 'medium',
		dependencies: subtask.dependencies || [],
		details: subtask.details || '',
		testStrategy: subtask.testStrategy || '',
		subtasks: []
	};
}

/**
 * Normalize a subtask dependency ID to a numeric value
 * Handles both numeric IDs and dotted notation (e.g., "1.2.3" -> 3)
 */
function normalizeSubtaskDepId(dep: unknown): number {
	if (typeof dep === 'number') {
		return dep;
	}
	const str = String(dep);
	if (str.includes('.')) {
		const parts = str.split('.');
		return parseInt(parts[parts.length - 1], 10);
	}
	return parseInt(str, 10);
}

/**
 * Persist tasks using a two-pass approach for dependency resolution
 * Pass 1: Save all tasks without dependencies (so all FKs can be satisfied)
 * Pass 2: Set all task and subtask dependencies
 *
 * @param db - Raw libsql Database instance
 * @param tasksByTag - Map of tag name to tasks array
 */
function persistTasksWithDependencies(
	db: import('libsql').Database,
	tasksByTag: Map<string, Task[]>
): void {
	// First pass: Save all tasks without dependencies
	for (const [tag, tagTasks] of tasksByTag) {
		for (const task of tagTasks) {
			saveCompleteTask(db, task, tag, {
				skipTaskDependencies: true,
				skipSubtaskDependencies: true
			});
		}
	}

	// Second pass: Set all dependencies
	for (const [tag, tagTasks] of tasksByTag) {
		for (const task of tagTasks) {
			// Set task dependencies (filter to only valid ones that exist in this tag)
			const validDeps = (task.dependencies || [])
				.filter((depId) => tagTasks.some((t) => String(t.id) === String(depId)))
				.map((d) => String(d));

			if (
				validDeps.length > 0 ||
				(task.dependencies && task.dependencies.length > 0)
			) {
				setTaskDependencies(db, String(task.id), tag, validDeps);
			}

			// Set subtask dependencies (within the same task)
			const subtasks = task.subtasks || [];
			const subtaskIds = new Set(
				subtasks.map((s) =>
					typeof s.id === 'number' ? s.id : parseInt(String(s.id), 10)
				)
			);

			for (const subtask of subtasks) {
				const subtaskId =
					typeof subtask.id === 'number'
						? subtask.id
						: parseInt(String(subtask.id), 10);

				const deps: number[] = [];
				for (const d of subtask.dependencies || []) {
					const depId = normalizeSubtaskDepId(d);
					if (!isNaN(depId) && subtaskIds.has(depId)) {
						deps.push(depId);
					}
				}

				if (deps.length > 0) {
					setSubtaskDependencies(db, String(task.id), subtaskId, tag, deps);
				}
			}
		}
	}
}

/**
 * Default paths for SQLite storage files
 */
const DEFAULT_DB_FILENAME = 'tasks.db';
const DEFAULT_JSONL_FILENAME = 'tasks.jsonl';
const DEFAULT_TASKS_DIR = '.taskmaster/tasks';

/**
 * SQLite storage adapter implementing IStorage interface
 * Uses SQLite for fast local operations and syncs to JSONL for git compatibility.
 */
export class SqliteStorage implements IStorage {
	private db: SqliteDatabase | null = null;
	private jsonlSync: JsonlSync;
	private projectPath: string;
	private dbPath: string;
	private jsonlPath: string;
	private config?: Partial<SqliteStorageConfig>;
	private initialized = false;

	/**
	 * Create a new SqliteStorage instance
	 * @param projectPath - Root path of the project
	 * @param config - Optional configuration overrides
	 */
	constructor(projectPath: string, config?: Partial<SqliteStorageConfig>) {
		this.projectPath = projectPath;
		this.config = config;

		// Determine paths
		const tasksDir = path.join(projectPath, DEFAULT_TASKS_DIR);
		this.dbPath = config?.dbPath || path.join(tasksDir, DEFAULT_DB_FILENAME);
		this.jsonlPath = path.join(tasksDir, DEFAULT_JSONL_FILENAME);

		// Initialize JSONL sync (doesn't require directory to exist yet)
		this.jsonlSync = new JsonlSync(this.jsonlPath);
	}

	/**
	 * Get the database instance, throwing if not initialized
	 */
	private getDb(): SqliteDatabase {
		if (!this.db || !this.initialized) {
			throw new Error(
				'SqliteStorage not initialized. Call initialize() first.'
			);
		}
		return this.db;
	}

	/**
	 * Initialize storage
	 * Creates necessary directories and schema, rebuilds from JSONL if needed
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return; // Already initialized
		}

		// Ensure tasks directory exists
		const tasksDir = path.dirname(this.dbPath);
		await fs.promises.mkdir(tasksDir, { recursive: true });

		// Check if we need to rebuild from JSONL (self-healing)
		const dbExists = fs.existsSync(this.dbPath);
		const jsonlExists = this.jsonlSync.exists();

		// Create database connection now that directory exists
		// Extract dbPath from config to avoid passing undefined dbPath to SqliteDatabase
		// (if config has dbPath: undefined, spreading it would override the computed this.dbPath)
		const { dbPath: _unusedDbPath, ...configWithoutDbPath } = this.config || {};
		this.db = new SqliteDatabase(this.dbPath, configWithoutDbPath);

		// Open database connection (loads libsql dynamically)
		await this.db.open();

		// Initialize database schema
		this.db.initialize();

		// If database was just created but JSONL exists, rebuild from JSONL
		// Only mark as initialized after successful rebuild to prevent partial state
		if (!dbExists && jsonlExists) {
			try {
				await this.rebuildFromJsonl();
				this.initialized = true;
			} catch (error) {
				// Close database on rebuild failure to allow retry
				this.db.close();
				this.db = null;
				throw error;
			}
		} else {
			this.initialized = true;
		}
	}

	/**
	 * Rebuild database from JSONL file (self-healing)
	 */
	private async rebuildFromJsonl(): Promise<void> {
		const tasks = await this.jsonlSync.readAll();

		if (tasks.length === 0) {
			return;
		}

		// Group tasks by tag (using stored _tag or 'master' as default)
		const tasksByTag = new Map<string, Task[]>();

		for (const jsonlTask of tasks) {
			// Remove JSONL metadata fields before saving
			const { _v, _ts, _deleted, _tag, ...task } = jsonlTask;

			// Skip soft-deleted tasks to prevent resurrecting them
			if (_deleted) {
				continue;
			}

			// Use stored tag or default to 'master'
			const tag = _tag || 'master';

			if (!tasksByTag.has(tag)) {
				tasksByTag.set(tag, []);
			}
			tasksByTag.get(tag)!.push(task as Task);
		}

		// Save all tasks in a transaction using two-pass approach
		// Use this.db directly since we're called during initialization before this.initialized is set
		if (!this.db) {
			throw new Error('Database not available for rebuild');
		}
		this.db.transaction(() => {
			persistTasksWithDependencies(this.db!.getDb(), tasksByTag);
		});
	}

	/**
	 * Close the database connection
	 */
	async close(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.initialized = false;
		}
	}

	/**
	 * Get the storage type identifier
	 */
	getStorageType(): 'sqlite' {
		return 'sqlite';
	}

	/**
	 * Get current brief name (not applicable for local storage)
	 */
	getCurrentBriefName(): string | null {
		return null;
	}

	/**
	 * Load all tasks for a tag
	 */
	async loadTasks(tag?: string, options?: LoadTasksOptions): Promise<Task[]> {
		const resolvedTag = tag || 'master';
		let tasks = loadAllTasks(this.getDb().getDb(), resolvedTag);

		// Apply filters if provided
		if (options) {
			if (options.status) {
				tasks = tasks.filter((task) => task.status === options.status);
			}

			if (options.excludeSubtasks) {
				tasks = tasks.map((task) => ({
					...task,
					subtasks: []
				}));
			}
		}

		return tasks;
	}

	/**
	 * Load a single task by ID
	 * Handles both regular tasks and subtasks (with dotted notation like "1.2")
	 */
	async loadTask(taskId: string, tag?: string): Promise<Task | null> {
		const resolvedTag = tag || 'master';

		// Check if this is a subtask (contains a dot)
		if (taskId.includes('.')) {
			const [parentId, subtaskId] = taskId.split('.');
			const parentTask = loadCompleteTask(
				this.getDb().getDb(),
				parentId,
				resolvedTag
			);

			if (!parentTask || !parentTask.subtasks) {
				return null;
			}

			const subtask = parentTask.subtasks.find(
				(st) => String(st.id) === subtaskId
			);

			if (!subtask) {
				return null;
			}

			// Return a Task-like object for the subtask with safe defaults
			return convertSubtaskToTask(subtask, taskId);
		}

		return loadCompleteTask(this.getDb().getDb(), taskId, resolvedTag);
	}

	/**
	 * Save tasks to storage, replacing existing tasks for the tag
	 */
	async saveTasks(tasks: Task[], tag?: string): Promise<void> {
		const resolvedTag = tag || 'master';

		this.getDb().transaction(() => {
			// Delete all existing tasks for this tag
			deleteAllTasksForTag(this.getDb().getDb(), resolvedTag);

			// Use two-pass helper to save tasks with dependencies
			const tasksByTag = new Map<string, Task[]>();
			tasksByTag.set(resolvedTag, tasks);
			persistTasksWithDependencies(this.getDb().getDb(), tasksByTag);

			// Update tag metadata
			setTagMetadata(this.getDb().getDb(), resolvedTag, {
				updated_at: new Date().toISOString()
			});
		});

		// Sync to JSONL
		await this.syncToJsonl(resolvedTag);
	}

	/**
	 * Append tasks without replacing existing ones
	 * Uses two-pass approach for dependency resolution
	 */
	async appendTasks(tasks: Task[], tag?: string): Promise<void> {
		const resolvedTag = tag || 'master';

		this.getDb().transaction(() => {
			// Use two-pass helper to save tasks with dependencies
			const tasksByTag = new Map<string, Task[]>();
			tasksByTag.set(resolvedTag, tasks);
			persistTasksWithDependencies(this.getDb().getDb(), tasksByTag);

			setTagMetadata(this.getDb().getDb(), resolvedTag, {
				updated_at: new Date().toISOString()
			});
		});

		// Sync to JSONL
		await this.syncToJsonl(resolvedTag);
	}

	/**
	 * Update a specific task
	 */
	async updateTask(
		taskId: string,
		updates: Partial<Task>,
		tag?: string
	): Promise<void> {
		const resolvedTag = tag || 'master';

		// Load the existing task
		const existingTask = loadCompleteTask(
			this.getDb().getDb(),
			taskId,
			resolvedTag
		);

		if (!existingTask) {
			throw new Error(`Task ${taskId} not found`);
		}

		// Merge updates with existing task
		const updatedTask: Task = {
			...existingTask,
			...updates,
			id: taskId,
			updatedAt: new Date().toISOString()
		};

		this.getDb().transaction(() => {
			saveCompleteTask(this.getDb().getDb(), updatedTask, resolvedTag);
		});

		// Incremental JSONL sync for single task
		await this.jsonlSync.writeTaskWithTag(updatedTask, resolvedTag);
	}

	/**
	 * Update task with AI-powered prompt
	 * Not yet implemented for SQLite storage
	 */
	async updateTaskWithPrompt(
		_taskId: string,
		_prompt: string,
		_tag?: string,
		_options?: { useResearch?: boolean; mode?: 'append' | 'update' | 'rewrite' }
	): Promise<void> {
		throw new Error(
			'AI operations not yet implemented for SQLite storage. ' +
				'Client-side AI logic must process the prompt before calling updateTask().'
		);
	}

	/**
	 * Expand task into subtasks with AI-powered generation
	 * Not yet implemented for SQLite storage
	 */
	async expandTaskWithPrompt(
		_taskId: string,
		_tag?: string,
		_options?: {
			numSubtasks?: number;
			useResearch?: boolean;
			additionalContext?: string;
			force?: boolean;
		}
	): Promise<ExpandTaskResult | void> {
		throw new Error(
			'AI operations not yet implemented for SQLite storage. ' +
				'Client-side AI logic must process the expansion before calling updateTask().'
		);
	}

	/**
	 * Update task or subtask status
	 */
	async updateTaskStatus(
		taskId: string,
		newStatus: TaskStatus,
		tag?: string
	): Promise<UpdateStatusResult> {
		const resolvedTag = tag || 'master';

		// Check if this is a subtask (contains a dot)
		if (taskId.includes('.')) {
			return this.updateSubtaskStatus(taskId, newStatus, resolvedTag);
		}

		// Get current task status
		const task = getTask(this.getDb().getDb(), taskId, resolvedTag);

		if (!task) {
			throw new Error(`Task ${taskId} not found`);
		}

		const oldStatus = task.status;

		if (oldStatus === newStatus) {
			return {
				success: true,
				oldStatus,
				newStatus,
				taskId
			};
		}

		this.getDb().transaction(() => {
			updateTaskQuery(this.getDb().getDb(), taskId, resolvedTag, {
				status: newStatus
			});
		});

		// Incremental JSONL sync - reload and write the updated task
		const updatedTask = loadCompleteTask(
			this.getDb().getDb(),
			taskId,
			resolvedTag
		);
		if (updatedTask) {
			await this.jsonlSync.writeTaskWithTag(updatedTask, resolvedTag);
		}

		return {
			success: true,
			oldStatus,
			newStatus,
			taskId
		};
	}

	/**
	 * Update subtask status
	 */
	private async updateSubtaskStatus(
		subtaskId: string,
		newStatus: TaskStatus,
		tag: string
	): Promise<UpdateStatusResult> {
		const [parentId, subIdRaw] = subtaskId.split('.');
		const subId = parseInt(subIdRaw, 10);

		if (isNaN(subId)) {
			throw new Error(
				`Invalid subtask ID: ${subIdRaw}. Subtask ID must be a positive integer.`
			);
		}

		// Get subtasks to find current status
		const subtasks = getSubtasks(this.getDb().getDb(), parentId, tag);
		const subtask = subtasks.find((st) => st.id === subId);

		if (!subtask) {
			throw new Error(`Subtask ${subtaskId} not found`);
		}

		const oldStatus = subtask.status;

		if (oldStatus === newStatus) {
			return {
				success: true,
				oldStatus,
				newStatus,
				taskId: subtaskId
			};
		}

		this.getDb().transaction(() => {
			updateSubtaskQuery(this.getDb().getDb(), subId, parentId, tag, {
				status: newStatus
			});

			// Auto-adjust parent status based on subtask statuses
			const allSubtasks = getSubtasks(this.getDb().getDb(), parentId, tag);
			const isDoneLike = (status: string) =>
				status === 'done' || status === 'completed';

			const allDone = allSubtasks.every((s) => isDoneLike(s.status));
			const anyInProgress = allSubtasks.some((s) => s.status === 'in-progress');
			const anyDone = allSubtasks.some((s) => isDoneLike(s.status));

			let parentNewStatus: TaskStatus | undefined;

			if (allDone) {
				parentNewStatus = 'done';
			} else if (anyInProgress || anyDone) {
				parentNewStatus = 'in-progress';
			} else {
				// All subtasks are pending, revert parent to pending
				parentNewStatus = 'pending';
			}

			if (parentNewStatus) {
				updateTaskQuery(this.getDb().getDb(), parentId, tag, {
					status: parentNewStatus
				});
			}
		});

		// Sync to JSONL
		await this.syncToJsonl(tag);

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
		const resolvedTag = tag || 'master';

		const task = getTask(this.getDb().getDb(), taskId, resolvedTag);

		if (!task) {
			throw new Error(`Task ${taskId} not found`);
		}

		this.getDb().transaction(() => {
			deleteTaskQuery(this.getDb().getDb(), taskId, resolvedTag);
		});

		// Incremental JSONL sync for single task deletion
		await this.jsonlSync.deleteTaskWithTag(taskId, resolvedTag);
	}

	/**
	 * Check if tasks exist for a tag
	 */
	async exists(tag?: string): Promise<boolean> {
		const resolvedTag = tag || 'master';
		const counts = getTaskCounts(this.getDb().getDb(), resolvedTag);
		return counts.total > 0;
	}

	/**
	 * Load metadata for a tag
	 */
	async loadMetadata(tag?: string): Promise<TaskMetadata | null> {
		const resolvedTag = tag || 'master';
		const tagMetadata = getTagMetadata(this.getDb().getDb(), resolvedTag);
		const counts = getTaskCounts(this.getDb().getDb(), resolvedTag);

		return tagMetadataRowToTaskMetadata(
			tagMetadata,
			counts.total,
			counts.completed
		);
	}

	/**
	 * Save metadata for a tag
	 */
	async saveMetadata(metadata: TaskMetadata, tag?: string): Promise<void> {
		const resolvedTag = tag || 'master';

		setTagMetadata(this.getDb().getDb(), resolvedTag, {
			description: metadata.description,
			project_name: metadata.projectName,
			version: metadata.version
		});
	}

	/**
	 * Get all available tags
	 */
	async getAllTags(): Promise<string[]> {
		return getAllTags(this.getDb().getDb());
	}

	/**
	 * Create a new tag
	 */
	async createTag(
		tagName: string,
		options?: { copyFrom?: string; description?: string }
	): Promise<void> {
		// Check if tag already exists
		const existingTags = getAllTags(this.getDb().getDb());
		if (existingTags.includes(tagName)) {
			throw new Error(`Tag ${tagName} already exists`);
		}

		this.getDb().transaction(() => {
			// Create tag metadata
			setTagMetadata(this.getDb().getDb(), tagName, {
				description:
					options?.description ||
					`Tag created on ${new Date().toLocaleDateString()}`
			});

			// Copy tasks from source tag if specified
			if (options?.copyFrom) {
				copyTasksToTag(this.getDb().getDb(), options.copyFrom, tagName);
			}
		});

		// Sync to JSONL
		await this.syncToJsonl(tagName);
	}

	/**
	 * Delete a tag and all its tasks
	 */
	async deleteTag(tag: string): Promise<void> {
		if (tag === 'master') {
			throw new Error('Cannot delete the master tag');
		}

		this.getDb().transaction(() => {
			deleteAllTasksForTag(this.getDb().getDb(), tag);
			deleteTagMetadata(this.getDb().getDb(), tag);
		});

		// Sync to JSONL (will remove tasks for this tag)
		await this.syncAllToJsonl();
	}

	/**
	 * Rename a tag
	 */
	async renameTag(oldTag: string, newTag: string): Promise<void> {
		// Check if new tag already exists
		const existingTags = getAllTags(this.getDb().getDb());
		if (existingTags.includes(newTag)) {
			throw new Error(`Tag ${newTag} already exists`);
		}

		this.getDb().transaction(() => {
			// Copy tasks to new tag
			copyTasksToTag(this.getDb().getDb(), oldTag, newTag);

			// Copy metadata
			const oldMetadata = getTagMetadata(this.getDb().getDb(), oldTag);
			if (oldMetadata) {
				setTagMetadata(this.getDb().getDb(), newTag, {
					description: oldMetadata.description,
					project_name: oldMetadata.project_name,
					version: oldMetadata.version
				});
			}

			// Delete old tag
			deleteAllTasksForTag(this.getDb().getDb(), oldTag);
			deleteTagMetadata(this.getDb().getDb(), oldTag);
		});

		// Sync to JSONL
		await this.syncAllToJsonl();
	}

	/**
	 * Copy all tasks from one tag to another
	 */
	async copyTag(sourceTag: string, targetTag: string): Promise<void> {
		this.getDb().transaction(() => {
			copyTasksToTag(this.getDb().getDb(), sourceTag, targetTag);

			setTagMetadata(this.getDb().getDb(), targetTag, {
				description: `Copied from ${sourceTag} on ${new Date().toLocaleDateString()}`
			});
		});

		// Sync to JSONL
		await this.syncToJsonl(targetTag);
	}

	/**
	 * Get storage statistics
	 */
	async getStats(): Promise<StorageStats> {
		const tags = getAllTags(this.getDb().getDb());
		let totalTasks = 0;

		const tagStats = tags.map((tag) => {
			const counts = getTaskCounts(this.getDb().getDb(), tag);
			const metadata = getTagMetadata(this.getDb().getDb(), tag);
			totalTasks += counts.total;

			return {
				tag,
				taskCount: counts.total,
				lastModified: metadata?.updated_at || new Date().toISOString()
			};
		});

		// Get database size
		const storageSize = this.getDb().getSize();

		// Get last modified from JSONL file stats or fall back to now
		const jsonlStats = this.jsonlSync.getStats();
		const lastModified =
			jsonlStats?.modifiedTime?.toISOString() ?? new Date().toISOString();

		return {
			totalTasks,
			totalTags: tags.length,
			storageSize,
			lastModified,
			tagStats
		};
	}

	/**
	 * Get all tags with detailed statistics
	 */
	async getTagsWithStats(): Promise<TagsWithStatsResult> {
		const tags = getAllTags(this.getDb().getDb());

		// Get active tag from state.json if it exists
		const activeTag = await this.getActiveTagFromState();

		const tagsWithStats = tags.map((tagName) => {
			const counts = getTaskCounts(this.getDb().getDb(), tagName);
			const metadata = getTagMetadata(this.getDb().getDb(), tagName);

			// Get subtask counts
			const tasks = loadAllTasks(this.getDb().getDb(), tagName);
			let totalSubtasks = 0;
			const subtasksByStatus: Record<string, number> = {};

			for (const task of tasks) {
				if (task.subtasks && task.subtasks.length > 0) {
					totalSubtasks += task.subtasks.length;
					for (const subtask of task.subtasks) {
						const status = subtask.status || 'pending';
						subtasksByStatus[status] = (subtasksByStatus[status] || 0) + 1;
					}
				}
			}

			return {
				name: tagName,
				isCurrent: tagName === activeTag,
				taskCount: counts.total,
				completedTasks: counts.completed,
				statusBreakdown: counts.byStatus,
				subtaskCounts:
					totalSubtasks > 0 ? { totalSubtasks, subtasksByStatus } : undefined,
				created: metadata?.created_at,
				updatedAt: metadata?.updated_at,
				description: metadata?.description ?? undefined
			};
		});

		return {
			tags: tagsWithStats,
			currentTag: activeTag,
			totalTags: tags.length
		};
	}

	/**
	 * Watch for changes to the JSONL file
	 */
	async watch(
		callback: (event: WatchEvent) => void,
		options?: WatchOptions
	): Promise<WatchSubscription> {
		const debounceMs = options?.debounceMs ?? 100;

		// Ensure JSONL file exists
		if (!this.jsonlSync.exists()) {
			// Create an empty JSONL file
			await this.jsonlSync.exportAll([]);
		}

		let debounceTimer: NodeJS.Timeout | undefined;
		let closed = false;

		const watcher = fs.watch(this.jsonlPath, (eventType, filename) => {
			if (closed) return;
			if (filename && eventType === 'change') {
				if (debounceTimer) {
					clearTimeout(debounceTimer);
				}
				debounceTimer = setTimeout(() => {
					if (!closed) {
						callback({
							type: 'change',
							timestamp: new Date()
						});
					}
				}, debounceMs);
			}
		});

		watcher.on('error', (error) => {
			if (!closed) {
				callback({
					type: 'error',
					timestamp: new Date(),
					error
				});
			}
		});

		return {
			unsubscribe: () => {
				closed = true;
				if (debounceTimer) {
					clearTimeout(debounceTimer);
				}
				watcher.close();
			}
		};
	}

	/**
	 * Sync tasks for a specific tag to JSONL
	 * Only exports the affected tag for efficiency
	 */
	private async syncToJsonl(tag: string): Promise<void> {
		const tasks = loadAllTasks(this.getDb().getDb(), tag);
		await this.jsonlSync.syncTagTasks(tasks, tag);
	}

	/**
	 * Sync all tasks from all tags to JSONL
	 * Preserves tag information for proper rebuild
	 */
	private async syncAllToJsonl(): Promise<void> {
		const tags = getAllTags(this.getDb().getDb());
		const tasksWithTags: Array<{ task: Task; tag: string }> = [];

		for (const tag of tags) {
			const tasks = loadAllTasks(this.getDb().getDb(), tag);
			for (const task of tasks) {
				tasksWithTags.push({ task, tag });
			}
		}

		await this.jsonlSync.exportAllWithTags(tasksWithTags);
	}

	/**
	 * Get the active tag from state.json
	 */
	private async getActiveTagFromState(): Promise<string> {
		try {
			const statePath = path.join(
				this.projectPath,
				'.taskmaster',
				'state.json'
			);
			const content = await fs.promises.readFile(statePath, 'utf-8');
			const stateData = JSON.parse(content);
			return stateData?.currentTag || 'master';
		} catch {
			// If state.json doesn't exist or can't be read, default to 'master'
			return 'master';
		}
	}
}

export default SqliteStorage;
