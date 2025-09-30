/**
 * @fileoverview TaskMasterCore facade - main entry point for tm-core functionality
 */

import { ConfigManager } from './config/config-manager.js';
import {
	TaskService,
	type TaskListResult as ListTasksResult,
	type GetTaskListOptions
} from './services/task-service.js';
import {
	TaskExecutionService,
	type StartTaskOptions,
	type StartTaskResult,
	type ConflictCheckResult
} from './services/task-execution-service.js';
import {
	ExportService,
	type ExportTasksOptions,
	type ExportResult
} from './services/export.service.js';
import { AuthManager } from './auth/auth-manager.js';
import { ERROR_CODES, TaskMasterError } from './errors/task-master-error.js';
import type { IConfiguration } from './interfaces/configuration.interface.js';
import type {
	Task,
	TaskStatus,
	TaskFilter,
	StorageType
} from './types/index.js';
import {
	ExecutorService,
	type ExecutorServiceOptions,
	type ExecutionResult,
	type ExecutorType
} from './executors/index.js';

/**
 * Options for creating TaskMasterCore instance
 */
export interface TaskMasterCoreOptions {
	projectPath: string;
	configuration?: Partial<IConfiguration>;
}

/**
 * Re-export result types from services
 */
export type { TaskListResult as ListTasksResult } from './services/task-service.js';
export type { GetTaskListOptions } from './services/task-service.js';
export type {
	StartTaskOptions,
	StartTaskResult,
	ConflictCheckResult
} from './services/task-execution-service.js';
export type {
	ExportTasksOptions,
	ExportResult
} from './services/export.service.js';

/**
 * TaskMasterCore facade class
 * Provides simplified API for all tm-core operations
 */
export class TaskMasterCore {
	private configManager: ConfigManager;
	private taskService: TaskService;
	private taskExecutionService: TaskExecutionService;
	private exportService: ExportService;
	private executorService: ExecutorService | null = null;

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
		this.taskExecutionService = null as any;
		this.exportService = null as any;
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

			// Create task execution service
			this.taskExecutionService = new TaskExecutionService(this.taskService);

			// Create export service
			const authManager = AuthManager.getInstance();
			this.exportService = new ExportService(
				this.configManager,
				this.taskService,
				authManager
			);
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
	getStorageType(): StorageType {
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

	// ==================== Task Execution Methods ====================

	/**
	 * Start working on a task with comprehensive business logic
	 */
	async startTask(
		taskId: string,
		options: StartTaskOptions = {}
	): Promise<StartTaskResult> {
		return this.taskExecutionService.startTask(taskId, options);
	}

	/**
	 * Check if a task can be started (no conflicts)
	 */
	async canStartTask(taskId: string, force = false): Promise<boolean> {
		return this.taskExecutionService.canStartTask(taskId, force);
	}

	/**
	 * Check for existing in-progress tasks and determine conflicts
	 */
	async checkInProgressConflicts(
		targetTaskId: string
	): Promise<ConflictCheckResult> {
		return this.taskExecutionService.checkInProgressConflicts(targetTaskId);
	}

	/**
	 * Get task with subtask resolution
	 */
	async getTaskWithSubtask(
		taskId: string
	): Promise<{ task: Task | null; subtask?: any; subtaskId?: string }> {
		return this.taskExecutionService.getTaskWithSubtask(taskId);
	}

	/**
	 * Get the next available task to start
	 */
	async getNextAvailableTask(): Promise<string | null> {
		return this.taskExecutionService.getNextAvailableTask();
	}

	// ==================== Export Service Methods ====================

	/**
	 * Export tasks to an external system (e.g., Hamster brief)
	 */
	async exportTasks(options: ExportTasksOptions): Promise<ExportResult> {
		return this.exportService.exportTasks(options);
	}

	/**
	 * Export tasks from a brief ID or URL
	 */
	async exportFromBriefInput(briefInput: string): Promise<ExportResult> {
		return this.exportService.exportFromBriefInput(briefInput);
	}

	/**
	 * Validate export context before prompting
	 */
	async validateExportContext(): Promise<{
		hasOrg: boolean;
		hasBrief: boolean;
		context: any;
	}> {
		return this.exportService.validateContext();
	}

	// ==================== Executor Service Methods ====================

	/**
	 * Initialize executor service (lazy initialization)
	 */
	private getExecutorService(): ExecutorService {
		if (!this.executorService) {
			const executorOptions: ExecutorServiceOptions = {
				projectRoot: this.configManager.getProjectRoot()
			};
			this.executorService = new ExecutorService(executorOptions);
		}
		return this.executorService;
	}

	/**
	 * Execute a task
	 */
	async executeTask(
		task: Task,
		executorType?: ExecutorType
	): Promise<ExecutionResult> {
		const executor = this.getExecutorService();
		return executor.executeTask(task, executorType);
	}

	/**
	 * Stop the current task execution
	 */
	async stopCurrentTask(): Promise<void> {
		if (this.executorService) {
			await this.executorService.stopCurrentTask();
		}
	}

	/**
	 * Update task status
	 */
	async updateTaskStatus(
		taskId: string | number,
		newStatus: TaskStatus,
		tag?: string
	): Promise<{
		success: boolean;
		oldStatus: TaskStatus;
		newStatus: TaskStatus;
		taskId: string;
	}> {
		return this.taskService.updateTaskStatus(taskId, newStatus, tag);
	}

	/**
	 * Close and cleanup resources
	 */
	async close(): Promise<void> {
		// Stop any running executors
		if (this.executorService) {
			await this.executorService.stopCurrentTask();
		}
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
