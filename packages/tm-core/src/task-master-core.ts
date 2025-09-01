/**
 * @fileoverview TaskMasterCore facade - main entry point for tm-core functionality
 */

import { ConfigManager } from './config/config-manager.js';
import {
	TaskService,
	type TaskListResult as ListTasksResult,
	type GetTaskListOptions
} from './services/task-service.js';
import { ERROR_CODES, TaskMasterError } from './errors/task-master-error.js';
import type { IConfiguration } from './interfaces/configuration.interface.js';
import type { Task, TaskStatus, TaskFilter } from './types/index.js';

/**
 * Options for creating TaskMasterCore instance
 */
export interface TaskMasterCoreOptions {
	projectPath: string;
	configuration?: Partial<IConfiguration>;
}

/**
 * Re-export result types from TaskService
 */
export type { TaskListResult as ListTasksResult } from './services/task-service.js';
export type { GetTaskListOptions } from './services/task-service.js';

/**
 * TaskMasterCore facade class
 * Provides simplified API for all tm-core operations
 */
export class TaskMasterCore {
	private configManager: ConfigManager;
	private taskService: TaskService;

	/**
	 * Create and initialize a new TaskMasterCore instance
	 * This is the ONLY way to create a TaskMasterCore
	 *
	 * @param options - Configuration options for TaskMasterCore
	 * @returns Fully initialized TaskMasterCore instance
	 */
	static async create(options: TaskMasterCoreOptions): Promise<TaskMasterCore> {
		const instance = new TaskMasterCore();
		await instance.initialize(options);
		return instance;
	}

	/**
	 * Private constructor - use TaskMasterCore.create() instead
	 * This ensures the TaskMasterCore is always properly initialized
	 */
	private constructor() {
		// Services will be initialized in the initialize() method
		this.configManager = null as any;
		this.taskService = null as any;
	}

	/**
	 * Initialize by loading services
	 * Private - only called by the factory method
	 */
	private async initialize(options: TaskMasterCoreOptions): Promise<void> {
		if (!options.projectPath) {
			throw new TaskMasterError(
				'Project path is required',
				ERROR_CODES.MISSING_CONFIGURATION
			);
		}

		try {
			// Create config manager using factory method
			this.configManager = await ConfigManager.create(options.projectPath);

			// Apply configuration overrides if provided
			if (options.configuration) {
				await this.configManager.updateConfig(options.configuration);
			}

			// Create task service
			this.taskService = new TaskService(this.configManager);
			await this.taskService.initialize();
		} catch (error) {
			throw new TaskMasterError(
				'Failed to initialize TaskMasterCore',
				ERROR_CODES.INTERNAL_ERROR,
				{ operation: 'initialize' },
				error as Error
			);
		}
	}

	/**
	 * Get list of tasks with optional filtering
	 * @deprecated Use getTaskList() instead
	 */
	async listTasks(options?: {
		tag?: string;
		filter?: TaskFilter;
		includeSubtasks?: boolean;
	}): Promise<ListTasksResult> {
		return this.getTaskList(options);
	}

	/**
	 * Get list of tasks with optional filtering
	 */
	async getTaskList(options?: GetTaskListOptions): Promise<ListTasksResult> {
		return this.taskService.getTaskList(options);
	}

	/**
	 * Get a specific task by ID
	 */
	async getTask(taskId: string, tag?: string): Promise<Task | null> {
		return this.taskService.getTask(taskId, tag);
	}

	/**
	 * Get tasks by status
	 */
	async getTasksByStatus(
		status: TaskStatus | TaskStatus[],
		tag?: string
	): Promise<Task[]> {
		return this.taskService.getTasksByStatus(status, tag);
	}

	/**
	 * Get task statistics
	 */
	async getTaskStats(tag?: string): Promise<{
		total: number;
		byStatus: Record<TaskStatus, number>;
		withSubtasks: number;
		blocked: number;
	}> {
		const stats = await this.taskService.getTaskStats(tag);
		// Remove storageType from the return to maintain backward compatibility
		const { storageType, ...restStats } = stats;
		return restStats;
	}

	/**
	 * Get next available task
	 */
	async getNextTask(tag?: string): Promise<Task | null> {
		return this.taskService.getNextTask(tag);
	}

	/**
	 * Get current storage type
	 */
	getStorageType(): 'file' | 'api' {
		return this.taskService.getStorageType();
	}

	/**
	 * Get current active tag
	 */
	getActiveTag(): string {
		return this.configManager.getActiveTag();
	}

	/**
	 * Set active tag
	 */
	async setActiveTag(tag: string): Promise<void> {
		await this.configManager.setActiveTag(tag);
	}

	/**
	 * Close and cleanup resources
	 */
	async close(): Promise<void> {
		// TaskService handles storage cleanup internally
	}
}

/**
 * Factory function to create TaskMasterCore instance
 */
export async function createTaskMasterCore(
	options: TaskMasterCoreOptions
): Promise<TaskMasterCore> {
	return TaskMasterCore.create(options);
}
